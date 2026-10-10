const assert=require('node:assert/strict')
const path=require('node:path')
const {Module}=require('node:module')
module.exports=async function(root,temporary,nativeRoot,paths,fixture) {
 const compiled=require('esbuild').buildSync({stdin:{contents:"export {KeyServiceMac} from './electron/services/bundledMacKeyService'; export {wcdbService} from './electron/services/wcdbService'",loader:'ts',resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',write:false}).outputFiles[0].text
 const m=new Module(__filename,module);m.paths=module.paths;m._compile(compiled,__filename)
 const {KeyServiceMac,wcdbService}=m.exports
 wcdbService.setPaths(nativeRoot,temporary);wcdbService.setLibPath(path.join(nativeRoot,paths.wcdbLibPath))
 const service=new KeyServiceMac()
 // Only capture/permission interfaces are simulated. Candidate verification uses real encrypted WCDB.
 service.getPid=async()=>123
 let calls=0
 service.runHelper=async()=>{calls++;return JSON.stringify({success:true,key:fixture.dbKey})}
 const dialog=require('electron').dialog,original=dialog.showMessageBox
 try {
  const successful=await service.autoGetDbKey(1000,undefined,temporary,'synthetic_me')
  assert.equal(successful.success,true,successful.error);assert.equal(successful.key,fixture.dbKey)
  service.runHelper=async()=>JSON.stringify({success:true,key:'0'.repeat(64)})
  assert.equal((await service.autoGetDbKey(1000,undefined,temporary,'synthetic_me')).success,false)
  assert.equal((await service.autoGetDbKey(1000,undefined,temporary,'missing_account')).success,false)
  let prompts=0
  dialog.showMessageBox=async()=>{prompts++;return {response:0,checkboxChecked:false}}
  service.runHelper=async()=>{calls++;return 'ERROR:ATTACH_FAILED:task_for_pid:5'}
  const before=calls
  const denied=await service.autoGetDbKey(1000,undefined,temporary,'synthetic_me')
  assert.equal(denied.success,false);assert.equal(calls,before+1);assert.equal(prompts,1)
  dialog.showMessageBox=async()=>({response:1,checkboxChecked:false})
  service.runHelper=async(helper,args,timeout,elevated)=>elevated?JSON.stringify({success:true,key:fixture.dbKey}):'ERROR:ATTACH_FAILED:task_for_pid:5'
  assert.equal((await service.autoGetDbKey(1000,undefined,temporary,'synthetic_me')).success,true)
  assert.equal((await service.autoGetImageKey(temporary,undefined,'synthetic_me')).success,false,'No template must not return a guessed image key')
  console.log('Mac key adapter: simulated capture verified against actual encrypted WCDB, wrong key/account rejection, permission cancellation and one elevated retry passed. Real WeChat capture is not exercised.')
 } finally {dialog.showMessageBox=original;await wcdbService.shutdown()}
}
