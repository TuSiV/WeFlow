// Helper protocol adapted from Panther114/Weport@3b9e2afd341f0eef56d4be9dafca25c8fe8be533 (CC BY-NC-SA 4.0).
import { dialog } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { resolveBundledComponentPath } from './bundledNativeComponents'
import { ConfigService } from './config'
import { parseMacKeyResult, getMacImageKey, readMacTemplates } from './macKeySupport'
import { verifyDerivedAesKey, resolveAccountImageDirs } from './bundledWindowsKeyService'
const execute = promisify(execFile)
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"

export class KeyServiceMac {
  private lastAccount?: { directory:string; id?:string }
  private busy = false

  private async getPid(): Promise<number> {
    const ids = new Set<number>()
    for (const name of ['WeChat','Weixin']) {
      try {
        const { stdout } = await execute('/usr/bin/pgrep', ['-x',name], { timeout:5000 })
        for (const value of stdout.trim().split(/\s+/)) if (/^\d+$/.test(value) && Number(value) > 0) ids.add(Number(value))
      } catch { /* Not running under this name. */ }
    }
    if (ids.size !== 1) throw new Error(ids.size ? '检测到多个微信实例，请只保留要获取密钥的一个实例' : '目标应用进程未运行，请先打开微信')
    return [...ids][0]
  }

  private async runHelper(helper: string, args: string[], timeout: number, elevated = false): Promise<string> {
    try {
      if (!elevated) {
        const result = await execute(helper,args,{ timeout, maxBuffer:1024*1024 })
        return result.stdout + '\n' + result.stderr
      }
      const command = [quote(helper), ...args.map(quote)].join(' ') + ' 2>&1'
      // AppleScript string quoting is distinct from shell quoting.
      const appleString = '"' + command.replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"'
      const script = `with timeout of ${Math.ceil(timeout/1000)} seconds\ntry\nreturn do shell script ${appleString} with administrator privileges\non error errMsg number errNum\nreturn "ERROR:" & errNum & ":" & errMsg\nend try\nend timeout`
      const result = await execute('/usr/bin/osascript',['-e',script],{ timeout:timeout+5000, maxBuffer:1024*1024 })
      if (/ERROR:-128:/.test(result.stdout)) throw new Error('已取消管理员授权')
      return result.stdout
    } catch (error:any) {
      if (error.killed || error.code === 'ETIMEDOUT') throw new Error('内置密钥工具执行超时，请保持微信打开后重试')
      if (typeof error.stdout === 'string' && error.stdout.trim()) return error.stdout + '\n' + (error.stderr || '')
      // Do not echo command arguments or helper output containing credentials.
      throw new Error(error.message === '已取消管理员授权' ? error.message : '内置密钥工具启动失败，请检查安装包及系统权限')
    }
  }

  async autoGetDbKey(timeoutMs=60000, onStatus?: (message:string,level:number)=>void, dbPath?:string, accountId?:string) {
    if (this.busy) return { success:false,error:'密钥获取正在进行，请等待完成' }
    this.busy=true
    try {
      if (!dbPath || !accountId) return { success:false,error:'请先选择要获取密钥的账号' }
      const directory = new ConfigService().getAccountDir(dbPath,accountId)
      if (!directory) return { success:false,error:'未找到所选账号目录' }
      const helper = resolveBundledComponentPath('macKeyHelperPath')
      if (!helper) return { success:false,error:'内置 Mac 密钥工具缺失或校验失败，请重新安装' }
      const pid = await this.getPid()
      const wait = Math.min(Math.max(timeoutMs,1000),120000)
      onStatus?.('已找到微信，正在运行内置 Mac 密钥工具；请保持微信打开并切换会话',0)
      let output = await this.runHelper(helper,[String(pid),String(wait)],wait+10000)
      if (/task_for_pid|ATTACH_FAILED|permission denied|not permitted/i.test(output)) {
        const answer = await dialog.showMessageBox({ type:'question',title:'微信进程访问受限',
          message:'是否通过系统管理员授权再尝试一次？',
          detail:'系统会显示授权窗口。授权不保证当前微信版本允许访问；取消后可手动填写密钥。不会修改 SIP、微信签名或系统调试设置。',
          buttons:['取消','授权并重试'],defaultId:0,cancelId:0 })
        if (answer.response !== 1) return parseMacKeyResult(output)
        // Resolve again immediately before privileged execution.
        if (resolveBundledComponentPath('macKeyHelperPath') !== helper) return {success:false,error:'密钥工具校验失败'}
        onStatus?.('正在等待系统管理员授权',0)
        output = await this.runHelper(helper,[String(await this.getPid()),String(wait)],wait+10000,true)
      }
      const result = parseMacKeyResult(output)
      if (!result.success || !result.key) return result
      onStatus?.('正在验证密钥能否打开所选账号数据库',0)
      const { wcdbService } = await import('./wcdbService')
      const checked = await wcdbService.testConnection(directory,result.key)
      if (!checked.success) return {success:false,error:'获取的密钥无法打开所选账号，请确认当前微信登录账号与选择一致'}
      return {success:true,key:result.key,accountId}
    } catch(error:any) { return {success:false,error:error.message || 'Mac 密钥获取失败'} }
    finally { this.busy=false }
  }

  async autoGetImageKey(directory?:string,onStatus?:(message:string)=>void,accountId?:string) {
    if (!directory) return {success:false,error:'请先选择当前账号目录'}
    this.lastAccount={directory,id:accountId}
    onStatus?.('正在从本机缓存推导并校验当前账号图片密钥')
    const result=getMacImageKey(directory,accountId,onStatus)
    return result.success ? result : {...result,error:result.error+'\n请在当前账号打开几张图片大图；若目录不可读，请在系统设置中允许 WeFlow 访问微信数据目录。'}
  }

  async autoGetImageKeyByMemoryScan(directory:string,onStatus?:(message:string)=>void) {
    const id=this.lastAccount?.directory===directory ? this.lastAccount.id : undefined
    const cached=await this.autoGetImageKey(directory,onStatus,id)
    if(cached.success) return cached
    const scope=resolveAccountImageDirs(directory,id)
    if(!scope.scoped || scope.dirs.length!==1) return cached
    const templates=readMacTemplates(scope.dirs[0])
    if(!templates.ciphertexts.length || templates.xorKey===null) return {success:false,error:'缺少可验证的当前账号图片模板，请打开至少两张图片大图后重试'}
    const helper=resolveBundledComponentPath('macImageKeyHelperPath')
    if(!helper) return {success:false,error:'内置 Mac 图片密钥工具缺失或校验失败'}
    try {
      onStatus?.('正在运行内置图片密钥工具')
      const output=await this.runHelper(helper,[String(await this.getPid()),templates.ciphertexts[0].toString('hex')],60000)
      for(const line of output.split(/\r?\n/)) {
        try {
          const payload=JSON.parse(line)
          if(payload.success===true && typeof payload.aesKey==='string' && payload.aesKey.length===16 && verifyDerivedAesKey(payload.aesKey,templates.ciphertexts[0]))
            return {success:true,aesKey:payload.aesKey,xorKey:templates.xorKey,verified:true}
        } catch { /* never accept unverified keys */ }
      }
      return {success:false,error:parseMacKeyResult(output).error || '图片密钥未通过当前账号模板校验'}
    } catch(error:any) { return {success:false,error:error.message} }
  }
}
