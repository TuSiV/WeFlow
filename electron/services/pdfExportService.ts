import { BrowserWindow } from 'electron'
import { promises as fs, existsSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import type { Worker } from 'worker_threads'

// Only the main process owns Chromium. Workers send trusted, generated static HTML.
let renderingQueue: Promise<unknown> = Promise.resolve()
export function renderChatPdf(htmlPath: string, pdfPath: string, signal?: AbortSignal): Promise<void> {
  const operation = renderingQueue.catch(() => undefined).then(async () => {
    if (signal?.aborted) throw new Error('PDF 导出已停止')
    const window = new BrowserWindow({ show: false, width: 1000, height: 800,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
        partition: 'weflow-pdf' } })
    const abort = () => { if (!window.isDestroyed()) window.destroy() }
    signal?.addEventListener('abort', abort, { once: true })
    // Exported messages cannot fetch remote pages, track users or open external windows.
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', event => event.preventDefault())
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }))
    let timeout: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        (async () => {
          await window.loadFile(htmlPath)
          const fontRelative = 'resources/fonts/annual-report/NotoSerifSC-Var.ttf'
          const fontPath = [process.resourcesPath, resolve(__dirname, '..'), resolve(__dirname, '../..')]
            .filter((root): root is string => Boolean(root))
            .map(root => join(root, fontRelative)).find(file => existsSync(file))
          if (!fontPath) throw new Error('PDF 中文字体缺失，请检查安装是否完整')
          // Some macOS system fonts print as outlines, making every message
          // unsearchable. Use the already bundled, embeddable Noto font instead.
          await window.webContents.insertCSS(`@font-face { font-family: WeFlowPdf; src: url(${JSON.stringify(pathToFileURL(fontPath).href)}); font-weight: 100 900; font-display: block; } body { font-family: WeFlowPdf, serif !important; }`)
          await window.webContents.executeJavaScript(`(async () => {
            await document.fonts.load('14px WeFlowPdf');
            await document.fonts.ready;
            if (!document.fonts.check('14px WeFlowPdf')) throw new Error('PDF 中文字体加载失败');
            await Promise.all(Array.from(document.images, image => image.complete ? Promise.resolve() :
              new Promise(resolve => { image.onload = resolve; image.onerror = resolve; })));
          })()`)
          const pdf = await window.webContents.printToPDF({ pageSize: 'A4', printBackground: true,
            margins: { top: 0.5, bottom: 0.5, left: 0.45, right: 0.45 }, displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' })
          if (signal?.aborted) throw new Error('PDF 导出已停止')
          if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF 生成失败')
          await fs.writeFile(pdfPath, pdf)
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => { abort(); reject(new Error('PDF 生成超时，请缩小导出范围后重试')) }, 90000)
        })
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      abort()
    }
  })
  renderingQueue = operation
  return operation
}

export function handlePdfExportRequest(worker: Worker, message: any): boolean {
  if (message?.type !== 'export:renderPdf') return false
  const controller = new AbortController()
  const stopped = () => controller.abort()
  worker.once('exit', stopped)
  void renderChatPdf(message.htmlPath, message.pdfPath, controller.signal).then(
    () => { if (!controller.signal.aborted) worker.postMessage({ type: 'export:pdfResult', requestId: message.requestId }) },
    error => { if (!controller.signal.aborted) worker.postMessage({ type: 'export:pdfResult', requestId: message.requestId, error: String(error) }) }
  ).finally(() => worker.removeListener('exit', stopped))
  return true
}
