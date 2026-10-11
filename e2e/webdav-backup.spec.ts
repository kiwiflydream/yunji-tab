import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, test } from './extension.fixture'

const configKey = 'yunji-tab:webdav-config'
const statusKey = 'yunji-tab:webdav-status'
const historyKey = 'yunji-tab:webdav-history'
// Reuse an already-authorized host; WebDAV transport is mocked, not Google's API.
const directory = 'https://www.google.com/yunji-webdav/'
const password = 'webdav-e2e-app-password'
const collectionXml = '<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>'

function listingXml(files: Map<string, string>): string {
  return `<d:multistatus xmlns:d="DAV:">${Array.from(files, ([url, raw]) => `<d:response><d:href>${url}</d:href><d:propstat><d:prop><d:resourcetype/><d:getlastmodified>Sun, 11 Oct 2026 10:00:00 GMT</d:getlastmodified><d:getcontentlength>${Buffer.byteLength(raw)}</d:getcontentlength><d:getetag>"${Buffer.byteLength(raw)}"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('')}</d:multistatus>`
}

async function openDataSettings(page: Page) {
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '数据与隐私', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'WebDAV 备份', exact: true })).toBeVisible()
}

test('configures WebDAV, uploads privately, previews restore and preserves the native tree until confirmation', async ({ extensionWorker, newTabPage }) => {
  const errors: string[] = []
  newTabPage.on('pageerror', error => errors.push(error.message))
  newTabPage.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  const previous = await extensionWorker.evaluate(async keys => chrome.storage.local.get(keys), [configKey, statusKey, historyKey])
  let remote = ''
  const versions = new Map<string, string>()
  const downloads: string[] = []
  let uploads = 0
  let failUpload = false
  let invalidDirectory = false
  let originalId: string | undefined
  let restoredId: string | undefined
  await newTabPage.route(`${directory}**`, async (route) => {
    expect(route.request().headers().authorization).toBe(`Basic ${Buffer.from(`kiwi:${password}`).toString('base64')}`)
    if (route.request().method() === 'PROPFIND') {
      expect(['0', '1']).toContain(route.request().headers().depth)
      await route.fulfill(invalidDirectory
        ? { status: 200, contentType: 'text/html', body: '<html>Login</html>' }
        : { status: 207, contentType: 'application/xml', body: route.request().headers().depth === '0' ? collectionXml : listingXml(versions) })
    }
    else if (route.request().method() === 'PUT') {
      uploads += 1
      expect(route.request().url()).toMatch(/yunji-tab-backup-\d{8}T\d{9}Z-[0-9a-f-]+\.json$/)
      expect(route.request().headers()['if-none-match']).toBe('*')
      if (failUpload) {
        await route.fulfill({ status: 401, body: '' })
        return
      }
      remote = route.request().postData()!
      versions.set(route.request().url(), remote)
      await route.fulfill({ status: 201, body: '' })
    }
    else {
      const url = route.request().url()
      downloads.push(url)
      expect(versions.has(url)).toBe(true)
      await route.fulfill({ status: 200, contentType: 'application/json', body: versions.get(url)! })
    }
  })
  try {
    originalId = await extensionWorker.evaluate(async () => (await chrome.bookmarks.create({ parentId: '1', title: 'WebDAV Original', url: 'https://webdav-original.example/' })).id)
    await openDataSettings(newTabPage)
    const form = newTabPage.locator('div').filter({ has: newTabPage.getByRole('heading', { name: 'WebDAV 备份', exact: true }) }).last()
    await newTabPage.getByLabel('WebDAV 目录地址').fill(directory)
    await newTabPage.getByLabel('账号', { exact: true }).fill('kiwi')
    await newTabPage.getByLabel('应用密码', { exact: true }).fill(password)
    await expect(newTabPage.getByRole('button', { name: '立即备份', exact: true })).toBeDisabled()
    await form.getByRole('button', { name: '保存', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '连接配置已保存' })).toBeVisible()
    await newTabPage.getByRole('button', { name: '测试连接', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '连接成功' })).toBeVisible()
    invalidDirectory = true
    await newTabPage.getByRole('button', { name: '测试连接', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText('服务器拒绝了 WebDAV 请求')
    invalidDirectory = false
    await newTabPage.getByRole('button', { name: '立即备份', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '备份已上传' })).toBeVisible()
    expect(uploads).toBe(1)
    expect(versions.size).toBe(1)
    const history = newTabPage.getByRole('region', { name: '同步记录', exact: true })
    const firstUrl = Array.from(versions.keys())[0]
    const firstFilename = new URL(firstUrl).pathname.split('/').at(-1)!
    await expect(history.getByText(firstFilename, { exact: true })).toBeVisible()
    expect(await extensionWorker.evaluate(async key => (await chrome.storage.local.get(key))[key], historyKey)).toBeUndefined()
    expect(JSON.parse(remote).kind).toBe('yunji-tab-full-bookmark-snapshot')
    expect(remote).toContain('WebDAV Original')
    expect(remote).not.toContain(password)
    expect(remote).not.toContain('webdav-config')
    expect(await extensionWorker.evaluate(() => chrome.storage.sync.get(null))).not.toHaveProperty(configKey)
    const tree = await extensionWorker.evaluate(() => chrome.bookmarks.getTree())
    const validRemote = remote
    versions.set(firstUrl, '{}')
    await newTabPage.getByRole('button', { name: '恢复最新备份', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText('不是有效的云吉 Tab 完整快照')
    expect(await extensionWorker.evaluate(() => chrome.bookmarks.getTree())).toEqual(tree)
    versions.set(firstUrl, validRemote)
    await newTabPage.getByRole('button', { name: '恢复最新备份', exact: true }).click()
    await expect(newTabPage.getByText('导入预览', { exact: true })).toBeVisible()
    expect(await extensionWorker.evaluate(() => chrome.bookmarks.getTree())).toEqual(tree)
    await newTabPage.getByRole('button', { name: '取消', exact: true }).click()
    const priorStatus = await extensionWorker.evaluate(async key => JSON.parse(String((await chrome.storage.local.get(key))[key])), statusKey)
    failUpload = true
    await newTabPage.getByRole('button', { name: '立即备份', exact: true }).click()
    await expect(newTabPage.getByRole('alert')).toContainText('认证失败')
    const failed = await extensionWorker.evaluate(async key => JSON.parse(String((await chrome.storage.local.get(key))[key])), statusKey)
    expect(failed.lastSuccessAt).toBe(priorStatus.lastSuccessAt)
    await expect(history.getByRole('listitem')).toHaveCount(1)
    failUpload = false
    await extensionWorker.evaluate(async id => chrome.bookmarks.update(id!, { title: 'WebDAV Newer Version' }), originalId)
    await newTabPage.getByRole('button', { name: '立即备份', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '备份已上传' })).toBeVisible()
    expect(remote).toContain('WebDAV Newer Version')
    expect(versions.size).toBe(2)
    // Restore the oldest successful record, even though the latest file differs.
    await expect(history.getByRole('listitem')).toHaveCount(2)
    await history.getByRole('button', { name: `恢复 ${firstFilename}`, exact: true }).click()
    await expect(newTabPage.getByRole('button', { name: '确认导入', exact: true })).toBeInViewport()
    expect(downloads.at(-1)).toBe(firstUrl)
    expect(await extensionWorker.evaluate(async () => (await chrome.bookmarks.search({ url: 'https://webdav-original.example/' })).length)).toBe(1)
    await newTabPage.getByRole('button', { name: '确认导入', exact: true }).click()
    await expect.poll(() => extensionWorker.evaluate(async () => (await chrome.bookmarks.getChildren('1')).some(node => node.title.startsWith('Yunji Tab Restore ')))).toBe(true)
    restoredId = await extensionWorker.evaluate(async () => (await chrome.bookmarks.getChildren('1')).find(node => node.title.startsWith('Yunji Tab Restore '))!.id)
    await expect(newTabPage.getByText(/已恢复.*Yunji Tab Restore/)).toBeVisible()
    expect(await extensionWorker.evaluate(async id => (await chrome.bookmarks.get(id!))[0].title, originalId)).toBe('WebDAV Newer Version')
    expect(await extensionWorker.evaluate(async (id) => {
      const containsOriginal = (node: chrome.bookmarks.BookmarkTreeNode): boolean =>
        (node.title === 'WebDAV Original' && node.url === 'https://webdav-original.example/')
        || (node.children ?? []).some(containsOriginal)
      return containsOriginal((await chrome.bookmarks.getSubTree(id!))[0])
    }, restoredId)).toBe(true)
    expect(await extensionWorker.evaluate(async () => (await chrome.bookmarks.search({ url: 'https://webdav-original.example/' })).length)).toBe(2)
    await history.scrollIntoViewIfNeeded()
    await newTabPage.screenshot({ path: '/tmp/yunji-webdav-desktop.png', fullPage: false })
    await newTabPage.setViewportSize({ width: 375, height: 900 })
    await expect.poll(() => newTabPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await history.scrollIntoViewIfNeeded()
    await newTabPage.screenshot({ path: '/tmp/yunji-webdav-mobile.png', fullPage: false })
    // The remote list survives loss of all local backup bookkeeping.
    await extensionWorker.evaluate(async keys => chrome.storage.local.remove(keys), [statusKey, historyKey])
    await newTabPage.reload()
    await openDataSettings(newTabPage)
    await expect(newTabPage.getByLabel('WebDAV 目录地址')).toHaveValue(directory)
    await expect(newTabPage.getByLabel('应用密码', { exact: true })).toHaveValue(password)
    await expect(history.getByRole('listitem')).toHaveCount(2)
    await newTabPage.getByRole('button', { name: '清除连接配置', exact: true }).click()
    await expect(newTabPage.getByLabel('应用密码', { exact: true })).toHaveValue('')
    await expect(history).toContainText('保存连接配置后读取备份记录')
    expect(versions.size).toBe(2)
    await expect(newTabPage.getByRole('button', { name: '立即备份', exact: true })).toBeDisabled()
    // The expected 401 produces Chrome's network error; no application errors.
    expect(errors.filter(error => !error.includes('401'))).toEqual([])
  }
  finally {
    await extensionWorker.evaluate(async ({ keys, previous, originalId, restoredId }) => {
      if (restoredId)
        await chrome.bookmarks.removeTree(restoredId)
      if (originalId)
        await chrome.bookmarks.remove(originalId)
      await chrome.storage.local.remove(keys)
      await chrome.storage.local.set(previous)
    }, { keys: [configKey, statusKey, historyKey], previous, originalId, restoredId })
  }
})

test('backs up changed data on new-tab opens, skips unchanged snapshots, and coalesces simultaneous pages', async ({ extensionWorker, extensionContext, extensionId, newTabPage }) => {
  const previous = await extensionWorker.evaluate(async keys => chrome.storage.local.get(keys), [configKey, statusKey, historyKey])
  const config = { enabled: true, url: directory, username: 'kiwi', password, intervalHours: 24 }
  let uploads = 0
  let remote = ''
  const versions = new Map<string, string>()
  await extensionContext.route(`${directory}**`, async (route) => {
    if (route.request().method() === 'PROPFIND') {
      expect(route.request().headers().depth).toBe('1')
      await route.fulfill({ status: 207, contentType: 'application/xml', body: listingXml(versions) })
      return
    }
    expect(route.request().method()).toBe('PUT')
    uploads += 1
    remote = route.request().postData()!
    versions.set(route.request().url(), remote)
    // Keep the first upload in flight while the other page tries to back up.
    await new Promise(resolve => setTimeout(resolve, 150))
    await route.fulfill({ status: 201, body: '' })
  })
  const expire = () => extensionWorker.evaluate(async (key) => {
    const status = JSON.parse(String((await chrome.storage.local.get(key))[key]))
    await chrome.storage.local.set({ [key]: JSON.stringify({ ...status, lastCheckedAt: 0 }) })
  }, statusKey)
  let other: Page | undefined
  let bookmarkId: string | undefined
  try {
    // Complete the fixture page's initial startup before enabling auto backup;
    // reloading during that startup would abort its first upload.
    await openDataSettings(newTabPage)
    await expect(newTabPage.getByLabel('WebDAV 目录地址')).toBeEnabled()
    await extensionWorker.evaluate(async ({ key, config, statusKey }) => {
      await chrome.storage.local.set({ [key]: JSON.stringify(config) })
      await chrome.storage.local.remove(statusKey)
    }, { key: configKey, config, statusKey })
    other = await extensionContext.newPage()
    await Promise.all([newTabPage.reload(), other.goto(`chrome-extension://${extensionId}/newtab.html`)])
    await expect.poll(() => uploads).toBe(1)
    await expect.poll(() => extensionWorker.evaluate(async key => Boolean(JSON.parse(String((await chrome.storage.local.get(key))[key] ?? '{}')).lastSuccessAt), statusKey)).toBe(true)
    await newTabPage.reload()
    await openDataSettings(newTabPage)
    await expect(newTabPage.getByText(/^上次成功备份：/)).toBeVisible()
    expect(uploads).toBe(1)
    const history = newTabPage.getByRole('region', { name: '同步记录', exact: true })
    await expect(history.getByRole('listitem')).toHaveCount(1)

    await expire()
    await newTabPage.reload()
    await expect.poll(() => extensionWorker.evaluate(async key => JSON.parse(String((await chrome.storage.local.get(key))[key])).lastCheckedAt, statusKey)).toBeGreaterThan(0)
    expect(uploads).toBe(1)
    await openDataSettings(newTabPage)
    await expect(newTabPage.getByText('内容未变化，未上传', { exact: true })).toBeVisible()
    await expect(history.getByRole('listitem')).toHaveCount(1)
    bookmarkId = await extensionWorker.evaluate(async () => (await chrome.bookmarks.create({ parentId: '1', title: 'WebDAV Changed Bookmark', url: 'https://webdav-changed.example/' })).id)
    await expire()
    await newTabPage.reload()
    await expect.poll(() => uploads).toBe(2)
    await expect.poll(() => remote).toContain('WebDAV Changed Bookmark')
    expect(remote).not.toContain(password)
    const manifest = await extensionWorker.evaluate(() => chrome.runtime.getManifest())
    expect(manifest.permissions).not.toContain('alarms')
    expect(manifest.permissions).not.toContain('notifications')
  }
  finally {
    await other?.close()
    await extensionWorker.evaluate(async ({ keys, previous, bookmarkId }) => {
      if (bookmarkId)
        await chrome.bookmarks.remove(bookmarkId)
      await chrome.storage.local.remove(keys)
      await chrome.storage.local.set(previous)
    }, { keys: [configKey, statusKey, historyKey], previous, bookmarkId })
    await extensionContext.unroute(`${directory}**`)
  }
})

test('lists remote and legacy backups safely, refreshes server changes, and handles invalid listings', async ({ extensionWorker, newTabPage }) => {
  const previous = await extensionWorker.evaluate(async keys => chrome.storage.local.get(keys), [configKey, statusKey, historyKey])
  const latest = 'yunji-tab-backup-20261011T120000000Z-00000000-0000-4000-8000-000000000001.json'
  const older = 'yunji-tab-backup-20261010T120000000Z-00000000-0000-4000-8000-000000000002.json'
  const legacy = 'yunji-tab-snapshot-00000000-0000-4000-8000-000000000003.json'
  const fixed = 'yunji-tab-full-snapshot.json'
  const raw = JSON.stringify({ kind: 'yunji-tab-full-bookmark-snapshot', schemaVersion: 1, exportedAt: '2026-10-11T10:00:00Z', roots: [], yunjiTab: { schemaVersion: 1, settings: {}, bookmarkMeta: {}, categoryMeta: [], usage: {} } })
  const files = new Map([latest, older, legacy, fixed].map(name => [`${directory}${name}`, raw]))
  let listingMode: 'valid' | 'html' | 'malformed' = 'valid'
  let changed = false
  let downloads = 0
  const response = (href: string, prop = '<d:resourcetype/>', status = '200 OK') => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${prop}</d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`
  await newTabPage.route(`${directory}**`, async (route) => {
    if (route.request().method() === 'PROPFIND') {
      expect(route.request().headers().depth).toBe('1')
      if (listingMode !== 'valid') {
        await route.fulfill({ status: listingMode === 'html' ? 200 : 207, contentType: listingMode === 'html' ? 'text/html' : 'application/xml', body: listingMode === 'html' ? '<html>Login</html>' : '<d:multistatus xmlns:d="DAV:"><broken>' })
        return
      }
      const invalidDate = latest.replace('20261011', '20260230')
      const directoryName = latest.replace('000000000001', '000000000099')
      const extra = [
        files.has(`${directory}${latest}`) ? response(`${directory}${latest}`) : '', // Duplicate href must not duplicate a row.
        response(`https://other.example.com/yunji-webdav/${latest}`),
        response(`/outside/${latest}`),
        response(`${directory}nested/${latest}`),
        response(`${directory}${latest}?token=secret`),
        response(`${directory}%2F${latest}`),
        response(`${directory}%zz${latest}`),
        response(`${directory}${invalidDate}`),
        response(`${directory}unrelated.json`),
        response(`${directory}${directoryName}`, '<d:resourcetype><d:collection/></d:resourcetype>'),
        response(`${directory}${directoryName}`, '<d:getlastmodified>Thu, 01 Jan 2099 00:00:00 GMT</d:getlastmodified>', '404 Not Found'),
      ].join('')
      // Exercise an alternate XML namespace prefix and encoded relative href.
      const xml = listingXml(files).replace(`${directory}${older}`, encodeURIComponent(older).replace('yunji', '%79unji')).replace('</d:multistatus>', `${extra}</d:multistatus>`).replaceAll('d:', 'dav:').replace('xmlns:d=', 'xmlns:dav=')
      await route.fulfill({ status: 207, contentType: 'application/xml', body: xml })
      return
    }
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers()['if-match']).toBe(`"${Buffer.byteLength(raw)}"`)
    downloads += 1
    if (changed) {
      await route.fulfill({ status: 412, body: '' })
      return
    }
    expect(files.has(route.request().url())).toBe(true)
    await route.fulfill({ status: 200, contentType: 'application/json', body: raw })
  })
  try {
    await openDataSettings(newTabPage)
    await expect(newTabPage.getByLabel('WebDAV 目录地址')).toBeEnabled()
    await extensionWorker.evaluate(async ({ configKey, statusKey, historyKey, config }) => {
      await chrome.storage.local.set({ [configKey]: JSON.stringify(config), [historyKey]: JSON.stringify([{ id: 'obsolete' }]) })
      await chrome.storage.local.remove(statusKey)
    }, { configKey, statusKey, historyKey, config: { enabled: false, url: directory, username: 'kiwi', password, intervalHours: 24 } })
    const history = newTabPage.getByRole('region', { name: '同步记录', exact: true })
    await expect(history.getByRole('listitem')).toHaveCount(4)
    await expect(history.getByRole('listitem').first()).toContainText(latest)
    await expect(history.getByText(older, { exact: true })).toBeVisible()
    expect(await extensionWorker.evaluate(async key => (await chrome.storage.local.get(key))[key], historyKey)).toBeUndefined()
    changed = true
    await history.getByRole('button', { name: `恢复 ${latest}`, exact: true }).click()
    await expect(newTabPage.getByRole('alert')).toContainText('备份文件已变化')
    await expect(newTabPage.getByText('导入预览', { exact: true })).toHaveCount(0)
    changed = false
    await history.getByRole('button', { name: `恢复 ${legacy}`, exact: true }).click()
    await expect(newTabPage.getByText('导入预览', { exact: true })).toBeVisible()
    await newTabPage.getByRole('button', { name: '取消', exact: true }).click()
    expect(downloads).toBe(2)
    files.delete(`${directory}${latest}`)
    await history.getByRole('button', { name: '刷新记录', exact: true }).click()
    await expect(history.getByRole('listitem')).toHaveCount(3)
    listingMode = 'html'
    await history.getByRole('button', { name: '刷新记录', exact: true }).click()
    await expect(history.getByRole('alert')).toContainText('服务器拒绝了 WebDAV 请求')
    listingMode = 'malformed'
    await history.getByRole('button', { name: '刷新记录', exact: true }).click()
    await expect(history.getByRole('alert')).toContainText('服务器拒绝了 WebDAV 请求')
    listingMode = 'valid'
    files.clear()
    await history.getByRole('button', { name: '刷新记录', exact: true }).click()
    await expect(history).toContainText('目录中暂无备份文件')
  }
  finally {
    await extensionWorker.evaluate(async ({ keys, previous }) => {
      await chrome.storage.local.remove(keys)
      await chrome.storage.local.set(previous)
    }, { keys: [configKey, statusKey, historyKey], previous })
  }
})

test('supports optional backup encryption and restores old files with a temporary passphrase', async ({ extensionWorker, newTabPage, extensionId }) => {
  const previous = await extensionWorker.evaluate(async keys => chrome.storage.local.get(keys), [configKey, statusKey, historyKey])
  const versions = new Map<string, string>()
  const firstPassphrase = 'e2e-original-backup-key'
  const nextPassphrase = 'e2e-new-backup-key'
  const errors: string[] = []
  newTabPage.on('pageerror', error => errors.push(error.message))
  newTabPage.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  let originalId: string | undefined
  let restoredId: string | undefined
  await newTabPage.route(`${directory}**`, async (route) => {
    if (route.request().method() === 'PROPFIND') {
      await route.fulfill({ status: 207, contentType: 'application/xml', body: listingXml(versions) })
    }
    else if (route.request().method() === 'PUT') {
      versions.set(route.request().url(), route.request().postData()!)
      await route.fulfill({ status: 201, body: '' })
    }
    else {
      expect(versions.has(route.request().url())).toBe(true)
      await route.fulfill({ status: 200, contentType: 'application/json', body: versions.get(route.request().url())! })
    }
  })
  const readSavedPassphrase = () => extensionWorker.evaluate(async key => JSON.parse(String((await chrome.storage.local.get(key))[key])).encryptionPassphrase, configKey)
  try {
    await openDataSettings(newTabPage)
    expect(newTabPage.url()).toBe(`chrome-extension://${extensionId}/newtab.html`)
    expect(await newTabPage.title()).toBeTruthy()
    const form = newTabPage.locator('div').filter({ has: newTabPage.getByRole('heading', { name: 'WebDAV 备份', exact: true }) }).last()
    const passphrase = newTabPage.getByLabel('备份加密口令（可选）', { exact: true })
    await expect(passphrase).toHaveValue('')
    await newTabPage.getByLabel('WebDAV 目录地址').fill(directory)
    await newTabPage.getByLabel('账号', { exact: true }).fill('kiwi')
    await newTabPage.getByLabel('应用密码', { exact: true }).fill(password)
    await passphrase.fill(firstPassphrase)
    await form.getByRole('button', { name: '保存', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '连接配置已保存' })).toBeVisible()
    expect(await readSavedPassphrase()).toBe(firstPassphrase)
    expect(JSON.stringify(await extensionWorker.evaluate(() => chrome.storage.sync.get(null)))).not.toContain(firstPassphrase)
    await passphrase.scrollIntoViewIfNeeded()
    await newTabPage.screenshot({ path: '/tmp/yunji-webdav-encryption-desktop.png' })
    await newTabPage.setViewportSize({ width: 375, height: 900 })
    await passphrase.scrollIntoViewIfNeeded()
    await expect.poll(() => newTabPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await newTabPage.screenshot({ path: '/tmp/yunji-webdav-encryption-mobile.png' })
    await newTabPage.setViewportSize({ width: 1280, height: 720 })

    originalId = await extensionWorker.evaluate(async () => (await chrome.bookmarks.create({ parentId: '1', title: 'WebDAV Encrypted Secret', url: 'https://webdav-encrypted.example/' })).id)
    await newTabPage.getByRole('button', { name: '立即备份', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '备份已上传' })).toBeVisible()
    expect(versions.size).toBe(1)
    const [firstUrl, encrypted] = Array.from(versions)[0]
    const firstFilename = new URL(firstUrl).pathname.split('/').at(-1)!
    expect(JSON.parse(encrypted)).toMatchObject({ kind: 'yunji-tab-encrypted-full-snapshot', payload: { encrypted: true, algorithm: 'AES-GCM' } })
    for (const secret of ['WebDAV Encrypted Secret', 'https://webdav-encrypted.example/', firstPassphrase, password])
      expect(encrypted).not.toContain(secret)
    const nativeBefore = await extensionWorker.evaluate(() => chrome.bookmarks.getTree())
    await newTabPage.getByRole('button', { name: '恢复最新备份', exact: true }).click()
    await expect(newTabPage.getByText('导入预览', { exact: true })).toBeVisible()
    expect(await extensionWorker.evaluate(() => chrome.bookmarks.getTree())).toEqual(nativeBefore)
    await newTabPage.getByRole('button', { name: '取消', exact: true }).click()

    await passphrase.fill(nextPassphrase)
    await form.getByRole('button', { name: '保存', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '连接配置已保存' })).toBeVisible()
    const history = newTabPage.getByRole('region', { name: '同步记录', exact: true })
    await history.getByRole('button', { name: `恢复 ${firstFilename}`, exact: true }).click()
    const restorePassphrase = newTabPage.getByLabel('此备份的解密口令', { exact: true })
    await expect(restorePassphrase).toBeVisible()
    await expect(newTabPage.getByRole('alert')).toContainText('口令不正确')
    await restorePassphrase.fill('wrong temporary key')
    await newTabPage.getByRole('button', { name: '解密并预览', exact: true }).click()
    await expect(newTabPage.getByRole('alert')).toContainText('口令不正确')
    await expect(newTabPage.getByText('导入预览', { exact: true })).toHaveCount(0)
    expect(await extensionWorker.evaluate(() => chrome.bookmarks.getTree())).toEqual(nativeBefore)
    await restorePassphrase.fill(firstPassphrase)
    await newTabPage.screenshot({ path: '/tmp/yunji-webdav-decrypt-preview.png' })
    await newTabPage.getByRole('button', { name: '解密并预览', exact: true }).click()
    await expect(newTabPage.getByText('导入预览', { exact: true })).toBeVisible()
    await expect(restorePassphrase).toHaveCount(0)
    expect(await readSavedPassphrase()).toBe(nextPassphrase)
    expect(await extensionWorker.evaluate(() => chrome.bookmarks.getTree())).toEqual(nativeBefore)
    await newTabPage.getByRole('button', { name: '确认导入', exact: true }).click()
    await expect(newTabPage.getByText(/已恢复.*Yunji Tab Restore/)).toBeVisible()
    restoredId = await extensionWorker.evaluate(async () => (await chrome.bookmarks.getChildren('1')).find(node => node.title.startsWith('Yunji Tab Restore '))!.id)
    expect(await extensionWorker.evaluate(async () => (await chrome.bookmarks.search({ url: 'https://webdav-encrypted.example/' })).length)).toBe(2)
    expect(await readSavedPassphrase()).toBe(nextPassphrase)

    // An empty optional field creates plaintext again; encrypted history stays readable.
    await passphrase.fill('')
    await form.getByRole('button', { name: '保存', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '连接配置已保存' })).toBeVisible()
    await history.getByRole('button', { name: `恢复 ${firstFilename}`, exact: true }).click()
    await expect(newTabPage.getByRole('alert')).toContainText('此备份已加密')
    await expect(restorePassphrase).toBeVisible()
    await newTabPage.getByRole('button', { name: '取消', exact: true }).click()
    await newTabPage.getByRole('button', { name: '立即备份', exact: true }).click()
    await expect(form.getByRole('status').filter({ hasText: '备份已上传' })).toBeVisible()
    expect(versions.size).toBe(2)
    const plaintext = Array.from(versions.values()).at(-1)!
    expect(JSON.parse(plaintext).kind).toBe('yunji-tab-full-bookmark-snapshot')
    expect(plaintext).toContain('WebDAV Encrypted Secret')
    expect(plaintext).not.toContain(firstPassphrase)
    expect(plaintext).not.toContain(nextPassphrase)
    await newTabPage.getByRole('button', { name: '清除连接配置', exact: true }).click()
    await expect(passphrase).toHaveValue('')
    expect(errors).toEqual([])
  }
  finally {
    await extensionWorker.evaluate(async ({ keys, previous, originalId, restoredId }) => {
      if (restoredId)
        await chrome.bookmarks.removeTree(restoredId)
      if (originalId)
        await chrome.bookmarks.remove(originalId)
      await chrome.storage.local.remove(keys)
      await chrome.storage.local.set(previous)
    }, { keys: [configKey, statusKey, historyKey], previous, originalId, restoredId })
  }
})
