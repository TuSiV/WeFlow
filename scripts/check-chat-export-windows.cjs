const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { Worker } = require('node:worker_threads')
const { BrowserWindow } = require('electron')
const { load, buildSyntheticPdfHtml } = require('./test-chat-export.cjs')
function verifyPdf(file, expected, excluded = [], minPages = 1) {
  assert(fs.readFileSync(file).subarray(0, 5).toString() === '%PDF-')
  const result = spawnSync('python', ['-c', `import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1]); text='\\n'.join(p.extract_text() or '' for p in r.pages)\nexpect=json.loads(sys.argv[2]); exclude=json.loads(sys.argv[3])\nassert len(r.pages)>=int(sys.argv[4]),len(r.pages)\nfor s in expect: assert s in text,s\nfor s in exclude: assert s not in text,s\nprint('Verified PDF pages:',len(r.pages),'messages:',len(expect))`, file, JSON.stringify(expected), JSON.stringify(excluded), String(minPages)], { encoding:'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  console.log(result.stdout.trim())
}
module.exports = async function(root, temporary, workerConfig, selectedRef) {
  const { renderChatPdf, handlePdfExportRequest } = load('electron/services/pdfExportService.ts')
  const fullHtml = path.join(temporary, 'pagination.html'), fullPdf = path.join(temporary, 'pagination.pdf')
  const messages = await buildSyntheticPdfHtml(fullHtml, 620)
  await renderChatPdf(fullHtml, fullPdf)
  verifyPdf(fullPdf, [...messages.map(row => row.content.split(' ')[0]), '中文内容'], [], 2)
  const selectedHtml = path.join(temporary, 'selection.html'), selectedPdf = path.join(temporary, 'selection.pdf')
  await buildSyntheticPdfHtml(selectedHtml, 620, [{localId:1,createTime:1700000000},{localId:620,createTime:1700000619}])
  await renderChatPdf(selectedHtml, selectedPdf)
  verifyPdf(selectedPdf, ['MESSAGE_0001_END','MESSAGE_0620_END'], ['MESSAGE_0002_END','MESSAGE_0619_END'])
  // Exercise the shipped worker -> main-process renderer -> atomic output path on encrypted WCDB data.
  const runWorker = async (options, outputDir) => {
    const worker = new Worker(path.join(root, 'dist-electron/exportWorker.js'), {
      env: { ...process.env, WEFLOW_USER_DATA_PATH:path.join(temporary, 'pdf-worker-config') },
      workerData: { ...workerConfig, outputDir, options }
    })
    let timeout
    try {
      return await new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('PDF export worker timed out')), 60000)
        worker.on('message', message => {
          if (handlePdfExportRequest(worker, message)) return
          if (message.type === 'export:result') resolve(message.data)
          if (message.type === 'export:error') reject(new Error(message.error))
        })
        worker.on('error', reject)
        worker.on('exit', code => reject(new Error(`PDF worker exited (${code})`)))
      })
    } finally { clearTimeout(timeout); await worker.terminate() }
  }
  const options = { format:'pdf', selectedMessages:[selectedRef], exportImages:false, exportVideos:false, exportVoices:false, exportEmojis:false, exportFiles:false }
  const successful = await runWorker(options, path.join(temporary, 'encrypted-pdf-export'))
  assert.equal(successful.success, true, successful.error)
  const outputs = Object.values(successful.sessionOutputPaths || {})
  assert.equal(outputs.length, 1)
  assert.equal(path.extname(outputs[0]), '.pdf')
  verifyPdf(outputs[0], [workerConfig.expectedText])
  assert(fs.readdirSync(path.dirname(outputs[0])).every(file => !file.includes('weflow-partial') && !file.endsWith('.html')))
  const failedDirectory = path.join(temporary, 'missing-selection')
  const failed = await runWorker({ ...options, selectedMessages:[{...selectedRef,localId:999999}] }, failedDirectory)
  assert.equal(failed.success, false)
  assert.equal(Object.keys(failed.sessionOutputPaths || {}).length, 0)
  assert(!fs.existsSync(failedDirectory) || fs.readdirSync(failedDirectory).every(file => !file.endsWith('.pdf') && !file.includes('weflow-partial')))
  // Actual configuration component: selection stays explicit and PDF is immediately available.
  const source = `import React from 'react'; import {createRoot} from 'react-dom/client';
    import ExportDialog from './src/pages/Export/components/ExportDialog/index';
    window.electronAPI = { config: {get:async()=>null}, shell:{openPath:async()=>{}}, dialog:{openFile:async()=>({canceled:true,filePaths:[]})} };
    window.exportedOptions = null;
    createRoot(document.getElementById('root')).render(<ExportDialog
      dialogState={{open:true,intent:'manual',scope:'single',sessionIds:['friend'],sessionNames:['friend'],title:'导出选定消息',selectedMessages:[{localId:1,createTime:1700000000},{localId:3,createTime:1700000002}]}}
      options={{format:'html',useAllTime:false,dateRange:{start:new Date(),end:new Date()},exportAvatars:false,exportMedia:false,exportImages:false,exportVideos:false,exportVoices:false,exportEmojis:false,exportFiles:false,exportVoiceAsText:false,maxFileSizeMb:0,exportPathStyle:'auto',exportConflictStrategy:'rename',excelCompactColumns:true,txtColumns:[],displayNamePreference:'remark',exportConcurrency:1,fileNamingMode:'classic'}}
      rawDateRangeConfig={null} exportPath="C:/synthetic/export" onClose={()=>{}} onSelectPath={()=>{}}
      onConfirm={options=>{window.exportedOptions=options}} onAutomationCreate={()=>{}} />);`
  const bundle = require('esbuild').buildSync({ stdin:{contents:source,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',jsx:'automatic',write:false,
    loader:{'.scss':'empty','.css':'empty','.svg':'dataurl'}, define:{'process.env.NODE_ENV':'"production"'} }).outputFiles[0].text
  const testFile = path.join(temporary, 'export-dialog.html')
  fs.writeFileSync(testFile, `<html><head><meta charset="UTF-8"></head><body><div id="root"></div><script>${bundle.replace(/<\/script/gi,'<\\/script')}</script></body></html>`)
  const win = new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}})
  try {
    await win.loadFile(testFile)
    const deadline = Date.now() + 10000
    while (Date.now()<deadline && !await win.webContents.executeJavaScript('document.body.innerText.includes("仅导出勾选的 2 条消息")')) await new Promise(resolve=>setTimeout(resolve,50))
    assert(await win.webContents.executeJavaScript('document.body.innerText.includes("仅导出勾选的 2 条消息")'))
    assert(await win.webContents.executeJavaScript('document.querySelector(".format-card.active").textContent.includes("PDF")'))
    await win.webContents.executeJavaScript('[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "开始导出").click()')
    const sent = await win.webContents.executeJavaScript('window.exportedOptions')
    assert.equal(sent.format, 'pdf'); assert.equal(sent.useAllTime, true); assert.equal(sent.dateRange, null)
    await win.webContents.executeJavaScript('[...document.querySelectorAll(".format-card")].find(button => button.textContent.startsWith("HTML")).click()')
    const formatDeadline = Date.now() + 10000
    while (Date.now() < formatDeadline && !await win.webContents.executeJavaScript('document.querySelector(".format-card.active").textContent.startsWith("HTML")')) await new Promise(resolve => setTimeout(resolve, 50))
    assert(await win.webContents.executeJavaScript('document.querySelector(".format-card.active").textContent.startsWith("HTML")'))
    await win.webContents.executeJavaScript('[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "开始导出").click()')
    assert.equal(await win.webContents.executeJavaScript('window.exportedOptions.format'), 'html')
  } finally { win.destroy() }
  console.log('Chat export: all 620 PDF messages across pages, exact subset PDF, actual encrypted WCDB worker PDF, missing-selection failure/cleanup and actual React format selection passed.')
}
