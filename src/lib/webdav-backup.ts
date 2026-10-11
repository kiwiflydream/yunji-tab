import { Storage } from '@plasmohq/storage'
import { parseFullBookmarkSnapshot } from './backup'
import { decryptMetadataText, encryptMetadataText, isEncryptedMetadataEnvelope } from './metadata-crypto'

export const WEBDAV_CONFIG_KEY = 'yunji-tab:webdav-config'
export const WEBDAV_STATUS_KEY = 'yunji-tab:webdav-status'
const legacyHistoryKey = 'yunji-tab:webdav-history'
export const WEBDAV_FILENAME = 'yunji-tab-full-snapshot.json'
export const WEBDAV_DEFAULT_URL = 'https://dav.jianguoyun.com/dav/'
const storage = new Storage({ area: 'local' })
const lockName = 'yunji-tab:webdav-backup'
const encryptedSnapshotKind = 'yunji-tab-encrypted-full-snapshot'
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const filenamePattern = new RegExp(`^yunji-tab-backup-(\\d{8}T\\d{9}Z)-${uuidPattern}\\.json$`)
const legacyFilenamePattern = new RegExp(`^yunji-tab-snapshot-${uuidPattern}\\.json$`)

export interface WebdavConfig {
  enabled: boolean
  url: string
  username: string
  password: string
  intervalHours: number
  encryptionPassphrase?: string
}

export interface WebdavStatus {
  lastSuccessAt?: number
  lastCheckedAt?: number
  fingerprint?: string
  error?: WebdavErrorCode
  lastResult?: 'uploaded' | 'unchanged' | 'failed'
}

export interface WebdavBackupFile {
  filename: string
  timestamp?: number
  size?: number
  etag?: string
  directory: string
  username: string
}

export type WebdavErrorCode = 'address' | 'insecure' | 'credentials' | 'permission' | 'auth' | 'missing' | 'network' | 'server' | 'invalid' | 'changed' | 'passphrase' | 'decrypt'

class WebdavError extends Error {
  constructor(public code: WebdavErrorCode) {
    super(`webdav.${code}`)
  }
}

export function webdavErrorCode(error: unknown): WebdavErrorCode {
  return error instanceof WebdavError ? error.code : 'network'
}

export async function loadWebdavConfig(): Promise<WebdavConfig> {
  const [stored] = await Promise.all([
    storage.get<Partial<WebdavConfig>>(WEBDAV_CONFIG_KEY),
    storage.remove(legacyHistoryKey), // Discard obsolete local history; files stay on WebDAV.
  ])
  return {
    enabled: stored?.enabled === true,
    url: typeof stored?.url === 'string' ? stored.url : WEBDAV_DEFAULT_URL,
    username: typeof stored?.username === 'string' ? stored.username : '',
    password: typeof stored?.password === 'string' ? stored.password : '',
    encryptionPassphrase: typeof stored?.encryptionPassphrase === 'string' ? stored.encryptionPassphrase : '',
    intervalHours: [1, 6, 24, 72].includes(stored?.intervalHours ?? 0) ? stored!.intervalHours! : 24,
  }
}

export async function loadWebdavStatus(): Promise<WebdavStatus> {
  return await storage.get<WebdavStatus>(WEBDAV_STATUS_KEY) ?? {}
}

function filenameTimestamp(filename: string): number | undefined {
  const compact = filename.match(filenamePattern)?.[1]
  if (!compact)
    return undefined
  const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(9, 11)}:${compact.slice(11, 13)}:${compact.slice(13, 15)}.${compact.slice(15, 18)}Z`
  const time = Date.parse(iso)
  return Number.isFinite(time) && new Date(time).toISOString() === iso ? time : undefined
}

function isBackupFilename(filename: string): boolean {
  return filenameTimestamp(filename) !== undefined || legacyFilenamePattern.test(filename) || filename === WEBDAV_FILENAME
}

export function webdavDirectory(config: WebdavConfig): URL {
  let url: URL
  try {
    url = new URL(config.url.trim())
  }
  catch {
    throw new WebdavError('address')
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new WebdavError('address')
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new WebdavError('insecure')
  if (!config.username.trim() || config.username.includes(':') || !config.password)
    throw new WebdavError('credentials')
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
  return url
}

export function requestWebdavPermission(config: WebdavConfig): Promise<boolean> {
  const url = webdavDirectory(config)
  // Call directly from the button handler; no await may consume the user gesture.
  return chrome.permissions.request({ origins: [`${url.protocol}//${url.host}/*`] })
}

async function withWebdavLock<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(lockName, task)
}

export async function saveWebdavConfig(config: WebdavConfig): Promise<void> {
  const normalized = { ...config, url: webdavDirectory(config).href, username: config.username.trim(), encryptionPassphrase: config.encryptionPassphrase ?? '' }
  await withWebdavLock(async () => {
    const previous = await loadWebdavConfig()
    if (previous.url !== normalized.url || previous.username !== normalized.username || previous.password !== normalized.password
      || previous.encryptionPassphrase !== normalized.encryptionPassphrase) {
      await storage.remove(WEBDAV_STATUS_KEY)
    }
    await storage.set(WEBDAV_CONFIG_KEY, normalized)
  })
}

export async function forgetWebdavConfig(): Promise<void> {
  await withWebdavLock(async () => {
    await storage.remove(WEBDAV_CONFIG_KEY)
    await storage.remove(WEBDAV_STATUS_KEY)
    await storage.remove(legacyHistoryKey)
  })
}

async function webdavRequest(config: WebdavConfig, method: 'PROPFIND' | 'PUT' | 'GET', body?: string, filename = WEBDAV_FILENAME, depth: '0' | '1' = '0', etag?: string): Promise<Response> {
  const directory = webdavDirectory(config)
  if (!await chrome.permissions.contains({ origins: [`${directory.protocol}//${directory.host}/*`] }))
    throw new WebdavError('permission')
  const bytes = new TextEncoder().encode(`${config.username.trim()}:${config.password}`)
  const authorization = `Basic ${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`
  const response = await fetch(method === 'PROPFIND' ? directory.href : new URL(filename, directory).href, {
    method,
    headers: {
      Authorization: authorization,
      ...(method === 'PROPFIND' ? { 'Depth': depth, 'Content-Type': 'application/xml; charset=utf-8' } : {}),
      ...(method === 'PUT' ? { 'Content-Type': 'application/json; charset=utf-8', 'If-None-Match': '*' } : {}),
      ...(method === 'GET' && etag ? { 'If-Match': etag } : {}),
    },
    body: method === 'PROPFIND' ? '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getlastmodified/><d:getcontentlength/><d:getetag/></d:prop></d:propfind>' : body,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    await response.body?.cancel()
    if (method === 'GET' && response.status === 412)
      throw new WebdavError('changed')
    throw new WebdavError(response.status === 401 || response.status === 403 ? 'auth' : response.status === 404 || response.status === 409 ? 'missing' : 'server')
  }
  return response
}

function davChildren(element: Element, name: string): Element[] {
  return Array.from(element.children).filter(child => child.namespaceURI === 'DAV:' && child.localName === name)
}

function davText(element: Element, name: string): string {
  return davChildren(element, name)[0]?.textContent?.trim() ?? ''
}

function successfulProperties(response: Element): Element[] {
  return davChildren(response, 'propstat')
    .filter(stat => /^HTTP\/\d(?:\.\d)?\s+200(?:\s|$)/.test(davText(stat, 'status')))
    .flatMap(stat => davChildren(stat, 'prop'))
}

async function readMultistatus(response: Response): Promise<Document> {
  if (response.status !== 207) {
    await response.body?.cancel()
    throw new WebdavError('server')
  }
  const document = new DOMParser().parseFromString(await response.text(), 'application/xml')
  if (document.getElementsByTagName('parsererror').length
    || document.documentElement.namespaceURI !== 'DAV:' || document.documentElement.localName !== 'multistatus') {
    throw new WebdavError('server')
  }
  return document
}

export async function testWebdavConnection(config: WebdavConfig): Promise<void> {
  const document = await readMultistatus(await webdavRequest(config, 'PROPFIND'))
  const properties = davChildren(document.documentElement, 'response').flatMap(successfulProperties)
  if (!properties.some(prop => davChildren(prop, 'resourcetype').some(type => davChildren(type, 'collection').length > 0)))
    throw new WebdavError('missing')
}

async function listBackupFiles(config: WebdavConfig): Promise<WebdavBackupFile[]> {
  const directory = webdavDirectory(config)
  const document = await readMultistatus(await webdavRequest(config, 'PROPFIND', undefined, undefined, '1'))
  const files = new Map<string, WebdavBackupFile>()
  for (const response of davChildren(document.documentElement, 'response')) {
    const properties = successfulProperties(response)
    const status = davText(response, 'status')
    if (!properties.length || (status && !/^HTTP\/\d(?:\.\d)?\s+2\d\d(?:\s|$)/.test(status)))
      continue
    if (properties.some(prop => davChildren(prop, 'resourcetype').some(type => davChildren(type, 'collection').length)))
      continue
    let filename: string
    try {
      const href = davText(response, 'href')
      if (!href)
        continue
      const url = new URL(href, directory)
      if (url.origin !== directory.origin || url.username || url.password || url.search || url.hash)
        continue
      const path = decodeURIComponent(url.pathname)
      const base = decodeURIComponent(directory.pathname)
      if (!path.startsWith(base))
        continue
      filename = path.slice(base.length)
      if (!isBackupFilename(filename))
        continue
    }
    catch {
      continue
    }
    if (files.has(filename))
      continue
    const property = (name: string) => properties.map(prop => davText(prop, name)).find(Boolean) ?? ''
    const modified = Date.parse(property('getlastmodified'))
    const length = property('getcontentlength')
    const size = /^\d+$/.test(length) ? Number(length) : undefined
    const etag = property('getetag')
    files.set(filename, {
      filename,
      timestamp: filenameTimestamp(filename) ?? (Number.isFinite(modified) ? modified : undefined),
      size: size !== undefined && Number.isSafeInteger(size) ? size : undefined,
      etag: /^"[\x21\x23-\x7E]*"$/.test(etag) ? etag : undefined,
      directory: directory.href,
      username: config.username,
    })
  }
  return Array.from(files.values()).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || b.filename.localeCompare(a.filename))
}

export async function listWebdavBackups(): Promise<WebdavBackupFile[]> {
  return withWebdavLock(async () => listBackupFiles(await loadWebdavConfig()))
}

export async function readWebdavBackup(selected?: WebdavBackupFile, passphraseOverride?: string): Promise<string> {
  return withWebdavLock(async () => {
    const config = await loadWebdavConfig()
    const file = selected ?? (await listBackupFiles(config))[0]
    if (!file || !isBackupFilename(file.filename) || file.directory !== webdavDirectory(config).href || file.username !== config.username)
      throw new WebdavError('missing')
    const response = await webdavRequest(config, 'GET', undefined, file.filename, undefined, file.etag)
    let raw = await response.text()
    let value: unknown
    try {
      value = JSON.parse(raw)
    }
    catch {
      throw new WebdavError('invalid')
    }
    if (typeof value === 'object' && value !== null && 'kind' in value && value.kind === encryptedSnapshotKind) {
      if (!('schemaVersion' in value) || value.schemaVersion !== 1 || !('payload' in value)
        || !isEncryptedMetadataEnvelope(value.payload)
        || !Number.isSafeInteger(value.payload.iterations) || value.payload.iterations < 100_000 || value.payload.iterations > 1_000_000
        || !/^[A-Z0-9+/]{22}==$/i.test(value.payload.salt) || !/^[A-Z0-9+/]{16}$/i.test(value.payload.iv)) {
        throw new WebdavError('invalid')
      }
      const passphrase = passphraseOverride ?? config.encryptionPassphrase
      if (!passphrase)
        throw new WebdavError('passphrase')
      try {
        raw = await decryptMetadataText(value.payload, passphrase)
      }
      catch {
        throw new WebdavError('decrypt')
      }
    }
    try {
      parseFullBookmarkSnapshot(raw)
    }
    catch {
      throw new WebdavError('invalid')
    }
    return raw
  })
}

export async function snapshotFingerprint(raw: string): Promise<string> {
  const snapshot = parseFullBookmarkSnapshot(raw)
  // Export timestamps change on every read, even when the backed-up data did not.
  const { exportedAt: _exportedAt, yunjiTab, ...rest } = snapshot
  const { exportedAt: _metadataExportedAt, ...metadata } = yunjiTab
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value))
      return value.map(stable)
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]))
    return value
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable({ ...rest, yunjiTab: metadata }))))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function runWebdavBackup(exportSnapshot: () => Promise<string>, manual = false): Promise<'uploaded' | 'unchanged' | 'skipped'> {
  return withWebdavLock(async () => {
    const config = await loadWebdavConfig()
    if (!manual && !config.enabled)
      return 'skipped'
    const status = await loadWebdavStatus()
    const now = Date.now()
    if (!manual && now - (status.lastCheckedAt ?? 0) < config.intervalHours * 3_600_000)
      return 'skipped'
    try {
      const raw = await exportSnapshot()
      const fingerprint = await snapshotFingerprint(raw)
      if (!manual && status.fingerprint === fingerprint) {
        await storage.set(WEBDAV_STATUS_KEY, { ...status, lastCheckedAt: now, error: undefined, lastResult: 'unchanged' })
        return 'unchanged'
      }
      const timestamp = new Date(now).toISOString().replaceAll('-', '').replaceAll(':', '').replaceAll('.', '')
      const filename = `yunji-tab-backup-${timestamp}-${crypto.randomUUID()}.json`
      const body = config.encryptionPassphrase
        ? JSON.stringify({
            kind: encryptedSnapshotKind,
            schemaVersion: 1,
            payload: await encryptMetadataText({ plaintext: raw, passphrase: config.encryptionPassphrase, updatedAt: now, deviceId: '' }),
          })
        : raw
      const response = await webdavRequest(config, 'PUT', body, filename)
      await response.body?.cancel()
      await storage.set(WEBDAV_STATUS_KEY, { lastSuccessAt: Date.now(), lastCheckedAt: now, fingerprint, lastResult: 'uploaded' })
      return 'uploaded'
    }
    catch (error) {
      // Keep the previous successful checkpoint, and throttle failed auto attempts.
      const code = webdavErrorCode(error)
      await storage.set(WEBDAV_STATUS_KEY, { ...status, lastCheckedAt: now, error: code, lastResult: 'failed' })
      throw error
    }
  })
}
