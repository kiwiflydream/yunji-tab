import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFullBookmarkSnapshot, createYunjiTabBackup } from './backup'
import { decryptMetadataText, encryptMetadataText } from './metadata-crypto'
import { normalizeSettings } from './store-settings-state'
import {
  forgetWebdavConfig,
  loadWebdavConfig,
  loadWebdavStatus,
  readWebdavBackup,
  requestWebdavPermission,
  runWebdavBackup,
  saveWebdavConfig,
  snapshotFingerprint,
  WEBDAV_CONFIG_KEY,
  WEBDAV_FILENAME,
  WEBDAV_STATUS_KEY,
  webdavDirectory,
} from './webdav-backup'

const state = vi.hoisted(() => ({ values: new Map<string, unknown>(), areas: [] as string[] }))
vi.mock('@plasmohq/storage', () => ({
  Storage: class {
    constructor(options: { area: string }) { state.areas.push(options.area) }
    async get(key: string) { return structuredClone(state.values.get(key)) }
    async set(key: string, value: unknown) { state.values.set(key, structuredClone(value)) }
    async remove(key: string) { state.values.delete(key) }
  },
}))

const config = { enabled: true, url: 'https://dav.example.com/backups', username: 'kiwi', password: 'test-app-password', intervalHours: 24 }
const fetchMock = vi.fn()
const permissions = { contains: vi.fn(), request: vi.fn() }
let lockQueue = Promise.resolve<unknown>(undefined)

function snapshot(title = 'Example', timestamp = '2026-10-11T00:00:00.000Z') {
  const value = createFullBookmarkSnapshot({
    yunjiTab: createYunjiTabBackup({ settings: normalizeSettings({}), meta: {}, usage: {}, categoryMeta: {}, categories: [] }),
    nativeRoots: [{ id: '1', title: 'Folder', syncing: false, children: [{ id: '2', title, url: 'https://example.com/', syncing: false }] }],
  })
  value.exportedAt = timestamp
  value.yunjiTab.exportedAt = timestamp
  return JSON.stringify(value)
}

beforeEach(() => {
  state.values.clear()
  lockQueue = Promise.resolve()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
  permissions.contains.mockResolvedValue(true)
  permissions.request.mockResolvedValue(true)
  fetchMock.mockImplementation(async () => new Response(null, { status: 201 }))
  vi.stubGlobal('chrome', { permissions })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('navigator', { locks: { request: (_name: string, task: () => Promise<unknown>) => {
    const result = lockQueue.then(task)
    lockQueue = result.catch(() => undefined)
    return result
  } } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('webDAV backups', () => {
  it('defaults to opt-in and stores credentials only in local storage, outside snapshot data', async () => {
    expect(await loadWebdavConfig()).toMatchObject({ enabled: false, url: 'https://dav.jianguoyun.com/dav/' })
    expect(state.areas).toEqual(['local'])
    await saveWebdavConfig(config)
    expect(await loadWebdavConfig()).toEqual({ ...config, url: `${config.url}/`, encryptionPassphrase: '' })
    expect(snapshot()).not.toContain(config.password)
    await forgetWebdavConfig()
    expect(state.values.size).toBe(0)
    expect(await loadWebdavConfig()).toMatchObject({ enabled: false, url: 'https://dav.jianguoyun.com/dav/', username: '' })
  })

  it.each([
    ['ftp://example.com/', 'address'],
    ['https://user:password@example.com/', 'address'],
    ['https://example.com/?secret=x', 'address'],
    ['http://example.com/', 'insecure'],
  ])('rejects unsafe endpoint %s before requesting permission', (url, code) => {
    expect(() => requestWebdavPermission({ ...config, url })).toThrow(`webdav.${code}`)
    expect(permissions.request).not.toHaveBeenCalled()
  })

  it('requests only the configured host directly and permits loopback HTTP for local testing', async () => {
    const result = requestWebdavPermission(config)
    expect(permissions.request).toHaveBeenCalledWith({ origins: ['https://dav.example.com/*'] })
    await result
    expect(webdavDirectory({ ...config, url: 'http://127.0.0.1:9876/dav' }).href).toBe('http://127.0.0.1:9876/dav/')
    expect(() => webdavDirectory({ ...config, username: 'a:b' })).toThrow('webdav.credentials')
  })

  it('ignores export timestamps and object key order while detecting actual data changes', async () => {
    const first = snapshot()
    const next = JSON.parse(snapshot('Example', '2026-10-12T00:00:00Z'))
    next.yunjiTab.usage = Object.fromEntries(Object.entries(next.yunjiTab.usage).reverse())
    const reversed = JSON.stringify(Object.fromEntries(Object.entries(next).reverse()))
    expect(await snapshotFingerprint(first)).toBe(await snapshotFingerprint(reversed))
    expect(await snapshotFingerprint(first)).not.toBe(await snapshotFingerprint(snapshot('Changed')))
  })

  it('does no snapshot read or network request when automatic backup is disabled', async () => {
    const exportSnapshot = vi.fn(async () => snapshot())
    expect(await runWebdavBackup(exportSnapshot)).toBe('skipped')
    expect(exportSnapshot).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads on first open, skips within the interval, skips unchanged data after it, and uploads changes later', async () => {
    await saveWebdavConfig(config)
    const exportSnapshot = vi.fn(async () => snapshot())
    expect(await runWebdavBackup(exportSnapshot)).toBe('uploaded')
    const first = await loadWebdavStatus()
    expect(await runWebdavBackup(exportSnapshot)).toBe('skipped')
    expect(exportSnapshot).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 24 * 3_600_000)
    expect(await runWebdavBackup(async () => snapshot('Example', new Date().toISOString()))).toBe('unchanged')
    expect(await loadWebdavStatus()).toMatchObject({ lastSuccessAt: first.lastSuccessAt, lastResult: 'unchanged' })
    vi.setSystemTime(Date.now() + 24 * 3_600_000)
    expect(await runWebdavBackup(async () => snapshot('Changed'))).toBe('uploaded')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/^https:\/\/dav\.example\.com\/backups\/yunji-tab-backup-20261011T100000000Z-[0-9a-f-]+\.json$/)
    expect(options).toMatchObject({ method: 'PUT', redirect: 'error', credentials: 'omit', cache: 'no-store', body: snapshot() })
    expect(atob(options.headers.Authorization.slice(6))).toBe(`${config.username}:${config.password}`)
    expect((await loadWebdavStatus()).lastResult).toBe('uploaded')
    expect(Array.from(state.values.keys()).sort()).toEqual([WEBDAV_CONFIG_KEY, WEBDAV_STATUS_KEY].sort())
  })

  it('serializes concurrent home opens and rechecks the interval inside the shared lock', async () => {
    await saveWebdavConfig(config)
    const results = await Promise.all(Array.from({ length: 5 }, () => runWebdavBackup(async () => snapshot())))
    expect(results.filter(result => result === 'uploaded')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('allows manual uploads with auto disabled and without waiting for the interval', async () => {
    await saveWebdavConfig({ ...config, enabled: false })
    expect(await runWebdavBackup(async () => snapshot(), true)).toBe('uploaded')
    expect(await runWebdavBackup(async () => snapshot(), true)).toBe('uploaded')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retains the successful checkpoint on failure, throttles auto retries, and permits a manual retry', async () => {
    await saveWebdavConfig(config)
    await runWebdavBackup(async () => snapshot())
    const success = await loadWebdavStatus()
    vi.setSystemTime(Date.now() + 24 * 3_600_000)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    await expect(runWebdavBackup(async () => snapshot('Changed'))).rejects.toThrow('webdav.auth')
    expect(await loadWebdavStatus()).toMatchObject({ lastSuccessAt: success.lastSuccessAt, fingerprint: success.fingerprint, error: 'auth' })
    expect(await runWebdavBackup(async () => snapshot('Changed'))).toBe('skipped')
    expect(await runWebdavBackup(async () => snapshot('Changed'), true)).toBe('uploaded')
    expect((await loadWebdavStatus()).error).toBeUndefined()
  })

  it('does not send credentials over the network when permission is absent', async () => {
    await saveWebdavConfig(config)
    permissions.contains.mockResolvedValue(false)
    await expect(runWebdavBackup(async () => snapshot(), true)).rejects.toThrow('webdav.permission')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(permissions.request).not.toHaveBeenCalled()
  })

  it('resets the checkpoint when the target or credentials change, retaining it for interval-only changes', async () => {
    await saveWebdavConfig(config)
    await runWebdavBackup(async () => snapshot())
    await saveWebdavConfig({ ...config, intervalHours: 6 })
    expect((await loadWebdavStatus()).lastSuccessAt).toBeDefined()
    await saveWebdavConfig({ ...config, url: 'https://other.example.com/dav' })
    expect(await loadWebdavStatus()).toEqual({})
    expect(await runWebdavBackup(async () => snapshot())).toBe('uploaded')
    await saveWebdavConfig({ ...config, url: 'https://other.example.com/dav', password: 'new-password' })
    expect(state.values.has(WEBDAV_STATUS_KEY)).toBe(false)
    expect(state.values.has(WEBDAV_CONFIG_KEY)).toBe(true)
  })

  it('validates downloaded snapshots and rejects invalid data without restoring anything', async () => {
    await saveWebdavConfig(config)
    const file = { filename: 'yunji-tab-full-snapshot.json', directory: `${config.url}/`, username: config.username }
    fetchMock.mockResolvedValueOnce(new Response(snapshot()))
    expect(await readWebdavBackup(file)).toBe(snapshot())
    fetchMock.mockResolvedValueOnce(new Response('<html>login</html>'))
    await expect(readWebdavBackup(file)).rejects.toThrow('webdav.invalid')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    await expect(readWebdavBackup(file)).rejects.toThrow('webdav.missing')
  })

  it('restores selected remote files without local history and rejects stale targets and changed files', async () => {
    await saveWebdavConfig(config)
    const files = new Map<string, string>()
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
      if (options.method === 'PUT') {
        files.set(url, String(options.body))
        return new Response(null, { status: 201 })
      }
      return new Response(files.get(url) ?? null, { status: files.has(url) ? 200 : 404 })
    })
    await runWebdavBackup(async () => snapshot('Old version'), true)
    const old = { filename: new URL(Array.from(files.keys())[0]).pathname.split('/').at(-1)!, directory: `${config.url}/`, username: config.username, etag: '"version-one"' }
    await runWebdavBackup(async () => snapshot('New version'), true)
    expect(files.size).toBe(2)
    expect(await readWebdavBackup(old)).toBe(snapshot('Old version'))
    expect(fetchMock.mock.calls.at(-1)?.[1].headers['If-Match']).toBe('"version-one"')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 412 }))
    await expect(readWebdavBackup(old)).rejects.toThrow('webdav.changed')
    files.delete(`${config.url}/${old.filename}`)
    await expect(readWebdavBackup(old)).rejects.toThrow('webdav.missing')
    const calls = fetchMock.mock.calls.length
    await expect(readWebdavBackup({ ...old, filename: '../other-file.json' })).rejects.toThrow('webdav.missing')
    await expect(readWebdavBackup({ ...old, directory: 'https://other.example.com/' })).rejects.toThrow('webdav.missing')
    await expect(readWebdavBackup({ ...old, username: 'other-account' })).rejects.toThrow('webdav.missing')
    expect(fetchMock).toHaveBeenCalledTimes(calls)
    expect(state.values.has('yunji-tab:webdav-history')).toBe(false)
  })

  it('uploads one immutable timestamped file per attempt without overwrites, local records or remote deletion', async () => {
    await saveWebdavConfig(config)
    for (let i = 0; i < 35; i++)
      await runWebdavBackup(async () => snapshot(`Version ${i}`), true)
    expect(fetchMock).toHaveBeenCalledTimes(35)
    expect(new Set(fetchMock.mock.calls.map(([url]) => url)).size).toBe(35)
    expect(fetchMock.mock.calls.every(([url, options]) => url.includes('yunji-tab-backup-20261011T100000000Z-')
      && options.method === 'PUT' && options.headers['If-None-Match'] === '*')).toBe(true)
    expect(Array.from(state.values.keys()).sort()).toEqual([WEBDAV_CONFIG_KEY, WEBDAV_STATUS_KEY].sort())
  })

  it('removes obsolete local records without touching remote files or saved connection settings', async () => {
    await saveWebdavConfig(config)
    state.values.set('yunji-tab:webdav-history', [{ id: 'old-local-record' }])
    expect((await loadWebdavConfig()).url).toBe(`${config.url}/`)
    expect(state.values.has('yunji-tab:webdav-history')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('encrypts the complete snapshot locally with fresh randomness while deduplicating the plaintext', async () => {
    const passphrase = '备份口令 🔐 with spaces '
    await saveWebdavConfig({ ...config, encryptionPassphrase: passphrase })
    expect(await runWebdavBackup(async () => snapshot())).toBe('uploaded')
    vi.setSystemTime(Date.now() + 24 * 3_600_000)
    expect(await runWebdavBackup(async () => snapshot('Example', new Date().toISOString()))).toBe('unchanged')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await runWebdavBackup(async () => snapshot(), true)
    const first = JSON.parse(fetchMock.mock.calls[0][1].body)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(first).toMatchObject({ kind: 'yunji-tab-encrypted-full-snapshot', schemaVersion: 1, payload: { encrypted: true, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA-256' } })
    expect(first.payload.salt).not.toBe(second.payload.salt)
    expect(first.payload.iv).not.toBe(second.payload.iv)
    const body = fetchMock.mock.calls[0][1].body
    expect(body).not.toContain('Example')
    expect(body).not.toContain('https://example.com/')
    expect(body).not.toContain(passphrase)
    expect(body).not.toContain(config.password)
    expect(await decryptMetadataText(first.payload, passphrase)).toBe(snapshot())
    expect((await loadWebdavConfig()).encryptionPassphrase).toBe(passphrase)
  })

  it('prompts for missing or wrong passphrases, accepts a temporary old key, and rejects damaged ciphertext', async () => {
    const passphrase = 'original backup key'
    await saveWebdavConfig({ ...config, encryptionPassphrase: passphrase })
    await runWebdavBackup(async () => snapshot(), true)
    const body = fetchMock.mock.calls[0][1].body
    const file = { filename: WEBDAV_FILENAME, directory: `${config.url}/`, username: config.username }
    fetchMock.mockImplementation(async () => new Response(body))
    expect(await readWebdavBackup(file)).toBe(snapshot())
    await saveWebdavConfig(config)
    await expect(readWebdavBackup(file)).rejects.toThrow('webdav.passphrase')
    await expect(readWebdavBackup(file, 'wrong key')).rejects.toThrow('webdav.decrypt')
    expect(await readWebdavBackup(file, passphrase)).toBe(snapshot())
    expect((await loadWebdavConfig()).encryptionPassphrase).toBe('')
    const damaged = JSON.parse(body)
    damaged.payload.data = `${damaged.payload.data[0] === 'A' ? 'B' : 'A'}${damaged.payload.data.slice(1)}`
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(damaged)))
    await expect(readWebdavBackup(file, passphrase)).rejects.toThrow('webdav.decrypt')
  })

  it.each([0, -1, 1_000_001, '150000', undefined])('rejects unsafe remote key derivation cost %s before decrypting', async (iterations) => {
    await saveWebdavConfig(config)
    const envelope = await encryptMetadataText({ plaintext: snapshot(), passphrase: 'key', updatedAt: 1, deviceId: '' })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ kind: 'yunji-tab-encrypted-full-snapshot', schemaVersion: 1, payload: { ...envelope, iterations } })))
    await expect(readWebdavBackup({ filename: WEBDAV_FILENAME, directory: `${config.url}/`, username: config.username }, 'key')).rejects.toThrow('webdav.invalid')
  })

  it('validates decrypted snapshot content before handing it to restore', async () => {
    await saveWebdavConfig({ ...config, encryptionPassphrase: 'key' })
    const payload = await encryptMetadataText({ plaintext: '{}', passphrase: 'key', updatedAt: 1, deviceId: '' })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ kind: 'yunji-tab-encrypted-full-snapshot', schemaVersion: 1, payload })))
    await expect(readWebdavBackup({ filename: WEBDAV_FILENAME, directory: `${config.url}/`, username: config.username })).rejects.toThrow('webdav.invalid')
  })

  it('reuploads unchanged data after enabling, changing or clearing the encryption passphrase and still reads plaintext backups', async () => {
    await saveWebdavConfig(config)
    await runWebdavBackup(async () => snapshot())
    const plaintext = fetchMock.mock.calls.at(-1)![1].body
    for (const encryptionPassphrase of ['first key', 'second key', '']) {
      await saveWebdavConfig({ ...config, encryptionPassphrase })
      expect(await loadWebdavStatus()).toEqual({})
      expect(await runWebdavBackup(async () => snapshot())).toBe('uploaded')
      const body = fetchMock.mock.calls.at(-1)![1].body
      if (encryptionPassphrase)
        expect(await decryptMetadataText(JSON.parse(body).payload, encryptionPassphrase)).toBe(snapshot())
      else expect(body).toBe(plaintext)
    }
    await saveWebdavConfig({ ...config, encryptionPassphrase: 'new key' })
    fetchMock.mockResolvedValueOnce(new Response(plaintext))
    expect(await readWebdavBackup({ filename: WEBDAV_FILENAME, directory: `${config.url}/`, username: config.username })).toBe(snapshot())
    await forgetWebdavConfig()
    expect((await loadWebdavConfig()).encryptionPassphrase).toBe('')
  })
})
