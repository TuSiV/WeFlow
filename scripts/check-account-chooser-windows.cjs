const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

module.exports = async function checkAccountChooser(root, temporary) {
  const { BrowserWindow } = require('electron')
  const accounts = [
    { accountId: 'wxid_first_abcd', accountDir: 'C:/synthetic/xwechat_files/wxid_first_abcd', dbPath: 'C:/synthetic/xwechat_files', layout: 'wcdb4', supported: true },
    { accountId: 'custom_second_efgh', accountDir: 'C:/synthetic/xwechat_files/custom_second_efgh', dbPath: 'C:/synthetic/xwechat_files', layout: 'wcdb4', supported: true },
    { accountId: 'legacy_alias', accountDir: 'C:/synthetic/WeChat Files/legacy_alias', dbPath: 'C:/synthetic/WeChat Files', layout: 'legacy3', supported: false }
  ]
  const source = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router-dom';
    import WelcomePage from './src/pages/WelcomePage';
    window.testAccounts = ${JSON.stringify(accounts)};
    window.testVerification = true;
    window.testCalls = [];
    window.accountInput = () => document.querySelector('input[placeholder="请输入账号 ID"]');
    window.keyInput = () => document.querySelector('input[placeholder="64 位十六进制密钥"]');
    window.electronAPI = {
      config: { get: async key => ({dbPath: 'C:/synthetic/xwechat_files', myAccountId: 'custom_second_efgh', cachePath: ''}[key]), set: async () => {} },
      account: { scan: async root => ({accounts: window.testAccounts, searchedPaths: [root], warnings: []}) },
      key: { onDbKeyStatus: () => () => {}, onImageKeyStatus: () => () => {}, trace: () => {},
        autoGetDbKey: async (...args) => { window.testCalls.push(args); return { success: true, key: 'a'.repeat(64), accountId: 'different_external_id' }; } },
      wcdb: { testConnection: async (...args) => { window.testCalls.push(args); return {success: window.testVerification, error: window.testVerification ? undefined : 'wrong key'}; } },
      window: { minimize: () => {}, close: () => {} }
    };
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/?mode=add-account']}><WelcomePage standalone /></MemoryRouter>);
  `
  const bundle = require('esbuild').buildSync({ stdin: { contents: source, loader: 'tsx', resolveDir: root },
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
    loader: { '.scss': 'empty', '.css': 'empty', '.svg': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"' }
  }).outputFiles[0].text
  const file = path.join(temporary, 'account-chooser-test.html')
  fs.writeFileSync(file, `<html><head><meta charset="utf-8"></head><body><div id="root"></div><script>${bundle.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
  const win = new BrowserWindow({ show: false, width: 1000, height: 900, webPreferences: { nodeIntegration: false, contextIsolation: true } })
  win.webContents.on('console-message', event => console.log('Account chooser renderer:', event.message))
  const run = async js => {
    const value = await win.webContents.executeJavaScript(`(() => { try { return eval(${JSON.stringify(js)}); } catch (error) { return { __failure: String(error), stack: error.stack }; } })()`)
    if (value && value.__failure) throw new Error(`${value.__failure}; script: ${js}; ${value.stack}`)
    return value
  }
  const waitFor = async condition => {
    const deadline = Date.now() + 10000
    while (Date.now() < deadline) {
      if (await run(condition)) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Account chooser condition timed out: ${condition}; ${await run('document.body.innerText')}`)
  }
  try {
    await win.loadFile(file)
    await waitFor('document.querySelectorAll(".account-discovery-item").length === 3')
    assert.equal(await run('document.querySelectorAll(".account-discovery-item")[2].disabled'), true)
    await run('document.querySelectorAll(".account-discovery-item")[0].click()')
    await waitFor('window.accountInput().value === "wxid_first_abcd"')
    await run(`const input = window.keyInput(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'b'.repeat(64)); input.dispatchEvent(new Event('input', {bubbles:true}));`)
    await waitFor('window.keyInput().value.length === 64')
    await run('document.querySelectorAll(".account-discovery-item")[1].click()')
    await waitFor('window.accountInput().value === "custom_second_efgh" && window.keyInput().value === ""')
    const fetchKey = async () => {
      await run('[...document.querySelectorAll("button")].find(b => b.textContent.includes("自动获取密钥")).click()')
      await waitFor('!!document.querySelector(".confirm-dialog-overlay")')
      await run('[...document.querySelectorAll(".confirm-dialog-overlay button")].find(b => b.textContent.trim() === "确认").click()')
    }
    await fetchKey()
    await waitFor('window.keyInput().value.length === 64')
    assert.equal(await run('window.accountInput().value'), 'custom_second_efgh')
    assert.equal(await run('window.testCalls[1][2]'), 'custom_second_efgh')
    await waitFor('document.querySelectorAll(".account-discovery-item").length === 3 && !document.querySelectorAll(".account-discovery-item")[0].disabled')
    await run('window.testVerification = false; document.querySelectorAll(".account-discovery-item")[0].click()')
    await fetchKey()
    await waitFor('document.body.innerText.includes("获取的密钥无法打开所选账号")')
    assert.equal(await run('window.keyInput().value'), '')
    await waitFor('![...document.querySelectorAll("button")].find(b => b.textContent.includes("扫描当前目录")).disabled')
    await run('window.testAccounts = []; [...document.querySelectorAll("button")].find(b => b.textContent.includes("扫描当前目录")).click()')
    await waitFor('document.body.innerText.includes("未找到可用账号") && document.querySelectorAll(".account-discovery-item").length === 0')
    console.log('Actual React account chooser: selection/autofill, legacy disabled, key reset, selected-account verification, wrong-key rejection and empty scan fallback passed.')
  } finally { win.destroy() }
}
