import type { BookmarkMeta, Category, CategoryMeta, MetadataSyncScope } from './types'
import { getCategoryPath } from './category-path'
import { LocalizedError } from './localized-error'
import {
  decryptMetadataText,
  encryptMetadataText,
  isEncryptedMetadataEnvelope,
} from './metadata-crypto'

const SYNC_MANIFEST_KEY = 'yunji-tab:metadata-sync:manifest'
const SYNC_PART_PREFIX = 'yunji-tab:metadata-sync:part:'
const LOCAL_DOCUMENT_KEY = 'yunji-tab:metadata-sync:local-document'
const DEVICE_ID_KEY = 'yunji-tab:metadata-sync:device-id'
const MAX_PART_BYTES = 6_500
const MAX_SYNC_BYTES = 90_000
const MAX_ATTEMPTS = 3
const META_FIELDS = [
  'description',
  'icon',
  'alternateUrls',
  'pinnedAt',
  'tags',
  'inboxAt',
] as const satisfies ReadonlyArray<keyof BookmarkMeta>

type MetaField = typeof META_FIELDS[number]

export const DEFAULT_METADATA_SYNC_SCOPE: MetadataSyncScope = {
  description: true,
  icon: true,
  alternateUrls: true,
  pinnedAt: true,
  tags: true,
  inboxAt: true,
  categoryIcons: true,
}

interface VersionedValue {
  value?: unknown
  deleted?: true
  updatedAt: number
  deviceId: string
}

interface VersionedBookmarkMeta {
  fields: Partial<Record<MetaField, VersionedValue>>
}

interface MetadataSyncManifest {
  schemaVersion: 2 | 3
  partCount: number
  updatedAt: number
  deviceId: string
  encrypted?: boolean
}

export interface MetadataSyncDocument {
  schemaVersion: 2
  updatedAt: number
  deviceId: string
  bookmarkMeta: Record<string, VersionedBookmarkMeta>
  categoryMeta: Record<string, VersionedValue>
}

export interface MaterializedMetadataSyncDocument {
  bookmarkMeta: Record<string, BookmarkMeta>
  categoryMeta: Array<{ path: string[], emoji: string }>
}

export interface MetadataSyncPayload {
  document: MetadataSyncDocument
  omittedBookmarkCount: number
  omittedBookmarkUrls: string[]
  byteCount: number
}

export interface MetadataSyncResult {
  direction: 'downloaded' | 'uploaded' | 'merged' | 'unchanged'
  document: MaterializedMetadataSyncDocument
  omittedBookmarkCount: number
  omittedBookmarkUrls: string[]
  byteCount: number
  syncedAt: number
  retryCount: number
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function isMetadataSyncWriteQuotaError(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause)
  return /MAX_(?:SUSTAINED_)?WRITE_OPERATIONS|write operations.{0,40}quota|quota.{0,40}write operations/i.test(message)
}

export function normalizeMetadataSyncScope(scope?: Partial<MetadataSyncScope>): MetadataSyncScope {
  return {
    ...DEFAULT_METADATA_SYNC_SCOPE,
    ...scope,
  }
}

function enabledMetaFields(scope?: Partial<MetadataSyncScope>): MetaField[] {
  const normalized = normalizeMetadataSyncScope(scope)
  return META_FIELDS.filter(field => normalized[field])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function valuesEqual(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value))
      return value.map(normalize)
    if (!isRecord(value))
      return value
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, normalize(value[key])]),
    )
  }
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

function syncContentEqual(left: MetadataSyncDocument, right: MetadataSyncDocument): boolean {
  return valuesEqual(left.bookmarkMeta, right.bookmarkMeta)
    && valuesEqual(left.categoryMeta, right.categoryMeta)
}

function splitUtf8(value: string, maxBytes = MAX_PART_BYTES): string[] {
  const parts: string[] = []
  let part = ''
  let partBytes = 0
  for (const character of value) {
    const characterBytes = byteLength(character)
    if (part && partBytes + characterBytes > maxBytes) {
      parts.push(part)
      part = ''
      partBytes = 0
    }
    part += character
    partBytes += characterBytes
  }
  if (part)
    parts.push(part)
  return parts
}

function newerValue(left: VersionedValue | undefined, right: VersionedValue | undefined): VersionedValue | undefined {
  if (!left)
    return right
  if (!right)
    return left
  if (left.updatedAt !== right.updatedAt)
    return left.updatedAt > right.updatedAt ? left : right
  return left.deviceId >= right.deviceId ? left : right
}

function encodePath(path: string[]): string {
  return JSON.stringify(path)
}

function decodePath(value: string): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string')
      ? parsed
      : undefined
  }
  catch {
    return undefined
  }
}

function createVersionedValue(value: unknown, updatedAt: number, deviceId: string): VersionedValue {
  return value === undefined
    ? { deleted: true, updatedAt, deviceId }
    : { value, updatedAt, deviceId }
}

function parseVersionedValue(value: unknown): VersionedValue | undefined {
  if (!isRecord(value) || typeof value.updatedAt !== 'number' || typeof value.deviceId !== 'string')
    return undefined
  return {
    value: value.value,
    deleted: value.deleted === true ? true : undefined,
    updatedAt: value.updatedAt,
    deviceId: value.deviceId,
  }
}

function parseDocument(value: unknown): MetadataSyncDocument | undefined {
  if (!isRecord(value) || typeof value.updatedAt !== 'number'
    || typeof value.deviceId !== 'string' || !isRecord(value.bookmarkMeta)) {
    return undefined
  }

  if (value.schemaVersion === 1 && Array.isArray(value.categoryMeta)) {
    const bookmarkMeta: MetadataSyncDocument['bookmarkMeta'] = {}
    for (const [url, rawMeta] of Object.entries(value.bookmarkMeta)) {
      if (!isRecord(rawMeta))
        continue
      const fields: VersionedBookmarkMeta['fields'] = {}
      for (const field of META_FIELDS) {
        if (rawMeta[field] !== undefined)
          fields[field] = createVersionedValue(rawMeta[field], value.updatedAt, value.deviceId)
      }
      bookmarkMeta[url] = { fields }
    }
    const categoryMeta: MetadataSyncDocument['categoryMeta'] = {}
    for (const item of value.categoryMeta) {
      if (isRecord(item) && Array.isArray(item.path)
        && item.path.every(part => typeof part === 'string')
        && typeof item.emoji === 'string') {
        categoryMeta[encodePath(item.path as string[])] = createVersionedValue(
          item.emoji,
          value.updatedAt,
          value.deviceId,
        )
      }
    }
    return {
      schemaVersion: 2,
      updatedAt: value.updatedAt,
      deviceId: value.deviceId,
      bookmarkMeta,
      categoryMeta,
    }
  }

  if (value.schemaVersion !== 2 || !isRecord(value.categoryMeta))
    return undefined
  const bookmarkMeta: MetadataSyncDocument['bookmarkMeta'] = {}
  for (const [url, rawEntry] of Object.entries(value.bookmarkMeta)) {
    if (!isRecord(rawEntry) || !isRecord(rawEntry.fields))
      continue
    const fields: VersionedBookmarkMeta['fields'] = {}
    for (const field of META_FIELDS) {
      const parsed = parseVersionedValue(rawEntry.fields[field])
      if (parsed)
        fields[field] = parsed
    }
    bookmarkMeta[url] = { fields }
  }
  const categoryMeta: MetadataSyncDocument['categoryMeta'] = {}
  for (const [path, rawValue] of Object.entries(value.categoryMeta)) {
    const parsed = parseVersionedValue(rawValue)
    if (parsed && decodePath(path))
      categoryMeta[path] = parsed
  }
  return {
    schemaVersion: 2,
    updatedAt: value.updatedAt,
    deviceId: value.deviceId,
    bookmarkMeta,
    categoryMeta,
  }
}

export function materializeMetadataDocument(
  document: MetadataSyncDocument,
  scope?: Partial<MetadataSyncScope>,
): MaterializedMetadataSyncDocument {
  const fields = enabledMetaFields(scope)
  const bookmarkMeta: Record<string, BookmarkMeta> = {}
  for (const [url, entry] of Object.entries(document.bookmarkMeta)) {
    const meta: BookmarkMeta = {}
    for (const field of fields) {
      const versioned = entry.fields[field]
      if (versioned && !versioned.deleted && versioned.value !== undefined)
        Object.assign(meta, { [field]: versioned.value })
    }
    if (Object.keys(meta).length > 0)
      bookmarkMeta[url] = meta
  }
  const categoryMeta = normalizeMetadataSyncScope(scope).categoryIcons
    ? Object.entries(document.categoryMeta).flatMap(([encodedPath, versioned]) => {
        const path = decodePath(encodedPath)
        return path && !versioned.deleted && typeof versioned.value === 'string'
          ? [{ path, emoji: versioned.value }]
          : []
      })
    : []
  return { bookmarkMeta, categoryMeta }
}

export function applyMaterializedBookmarkMetadata(
  local: Record<string, BookmarkMeta>,
  synchronized: Record<string, BookmarkMeta>,
  scope?: Partial<MetadataSyncScope>,
  options?: {
    baseline?: Record<string, BookmarkMeta>
    omittedUrls?: Iterable<string>
  },
): Record<string, BookmarkMeta> {
  const fields = enabledMetaFields(scope)
  const omittedUrls = new Set(options?.omittedUrls)
  const urls = new Set([...Object.keys(local), ...Object.keys(synchronized)])
  const applied: Record<string, BookmarkMeta> = {}
  for (const url of urls) {
    const next: BookmarkMeta = { ...(local[url] ?? {}) }
    for (const field of fields) {
      if (omittedUrls.has(url))
        continue
      if (options?.baseline
        && !valuesEqual(options.baseline[url]?.[field], local[url]?.[field])) {
        continue
      }
      const synchronizedValue = synchronized[url]?.[field]
      if (synchronizedValue === undefined)
        delete next[field]
      else
        Object.assign(next, { [field]: structuredClone(synchronizedValue) })
    }
    if (Object.keys(next).length > 0)
      applied[url] = next
  }
  return applied
}

function createDocument(input: {
  meta: Record<string, BookmarkMeta>
  categoryMeta: Record<string, CategoryMeta>
  categories: Category[]
  updatedAt: number
  deviceId: string
  scope?: Partial<MetadataSyncScope>
}): MetadataSyncDocument {
  const fieldsToSync = enabledMetaFields(input.scope)
  const bookmarkMeta: MetadataSyncDocument['bookmarkMeta'] = {}
  for (const [url, meta] of Object.entries(input.meta)) {
    const fields: VersionedBookmarkMeta['fields'] = {}
    for (const field of fieldsToSync) {
      if (meta[field] !== undefined)
        fields[field] = createVersionedValue(meta[field], input.updatedAt, input.deviceId)
    }
    bookmarkMeta[url] = { fields }
  }
  const categoryMeta: MetadataSyncDocument['categoryMeta'] = {}
  if (normalizeMetadataSyncScope(input.scope).categoryIcons) {
    for (const [categoryId, meta] of Object.entries(input.categoryMeta)) {
      const path = getCategoryPath(categoryId, input.categories)
      if (path && meta.emoji) {
        categoryMeta[encodePath(path)] = createVersionedValue(
          meta.emoji,
          input.updatedAt,
          input.deviceId,
        )
      }
    }
  }
  return {
    schemaVersion: 2,
    updatedAt: input.updatedAt,
    deviceId: input.deviceId,
    bookmarkMeta,
    categoryMeta,
  }
}

function withLocalDiff(
  shadow: MetadataSyncDocument | undefined,
  current: ReturnType<typeof createDocument>,
  scope?: Partial<MetadataSyncScope>,
): MetadataSyncDocument {
  if (!shadow)
    return current
  const fieldsToSync = enabledMetaFields(scope)
  const next: MetadataSyncDocument = structuredClone(shadow)
  next.updatedAt = current.updatedAt
  next.deviceId = current.deviceId
  const urls = new Set([...Object.keys(shadow.bookmarkMeta), ...Object.keys(current.bookmarkMeta)])
  for (const url of urls) {
    const existing = shadow.bookmarkMeta[url]?.fields ?? {}
    const currentFields = current.bookmarkMeta[url]?.fields ?? {}
    const fields = { ...existing }
    for (const field of fieldsToSync) {
      const previousValue = existing[field]?.deleted ? undefined : existing[field]?.value
      const currentValue = currentFields[field]?.value
      if (!valuesEqual(previousValue, currentValue))
        fields[field] = createVersionedValue(currentValue, current.updatedAt, current.deviceId)
    }
    next.bookmarkMeta[url] = { fields }
  }
  if (!normalizeMetadataSyncScope(scope).categoryIcons)
    return next
  const paths = new Set([...Object.keys(shadow.categoryMeta), ...Object.keys(current.categoryMeta)])
  for (const path of paths) {
    const previousValue = shadow.categoryMeta[path]?.deleted ? undefined : shadow.categoryMeta[path]?.value
    const currentValue = current.categoryMeta[path]?.value
    if (!valuesEqual(previousValue, currentValue))
      next.categoryMeta[path] = createVersionedValue(currentValue, current.updatedAt, current.deviceId)
  }
  return next
}

export function mergeMetadataDocuments(
  left: MetadataSyncDocument,
  right: MetadataSyncDocument,
  deviceId = left.deviceId,
): MetadataSyncDocument {
  const merged: MetadataSyncDocument = {
    schemaVersion: 2,
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    deviceId,
    bookmarkMeta: {},
    categoryMeta: {},
  }
  const urls = new Set([...Object.keys(left.bookmarkMeta), ...Object.keys(right.bookmarkMeta)])
  for (const url of urls) {
    const fields: VersionedBookmarkMeta['fields'] = {}
    for (const field of META_FIELDS) {
      const value = newerValue(left.bookmarkMeta[url]?.fields[field], right.bookmarkMeta[url]?.fields[field])
      if (value)
        fields[field] = value
    }
    merged.bookmarkMeta[url] = { fields }
  }
  const paths = new Set([...Object.keys(left.categoryMeta), ...Object.keys(right.categoryMeta)])
  for (const path of paths) {
    const value = newerValue(left.categoryMeta[path], right.categoryMeta[path])
    if (value)
      merged.categoryMeta[path] = value
  }
  return merged
}

function fitDocumentToBudget(document: MetadataSyncDocument): MetadataSyncPayload {
  const materialized = materializeMetadataDocument(document).bookmarkMeta
  const entries = Object.entries(document.bookmarkMeta).sort(([leftUrl, left], [rightUrl, right]) => {
    const priority = (url: string, entry: VersionedBookmarkMeta) => {
      const allDeleted = Object.values(entry.fields).every(value => value?.deleted)
      const meta = materialized[url]
      return (allDeleted ? 10 : 0) + (meta?.pinnedAt ? 2 : 0)
        + (meta?.inboxAt ? 2 : 0) + (meta?.tags?.length ? 1 : 0)
    }
    return priority(rightUrl, right) - priority(leftUrl, left)
  })
  const fitted: MetadataSyncDocument = { ...document, bookmarkMeta: {} }
  let currentBytes = byteLength(JSON.stringify(fitted))
  let omittedBookmarkCount = 0
  const omittedBookmarkUrls: string[] = []
  const includedUrls: string[] = []
  for (const [url, entry] of entries) {
    const entryBytes = byteLength(JSON.stringify(url))
      + byteLength(JSON.stringify(entry)) + 2
    if (currentBytes + entryBytes > MAX_SYNC_BYTES) {
      omittedBookmarkCount += 1
      omittedBookmarkUrls.push(url)
      continue
    }
    fitted.bookmarkMeta[url] = entry
    includedUrls.push(url)
    currentBytes += entryBytes
  }
  let serialized = JSON.stringify(fitted)
  while (byteLength(serialized) > MAX_SYNC_BYTES && includedUrls.length > 0) {
    const url = includedUrls.pop()
    if (url)
      delete fitted.bookmarkMeta[url]
    if (url)
      omittedBookmarkUrls.push(url)
    omittedBookmarkCount += 1
    serialized = JSON.stringify(fitted)
  }
  return {
    document: fitted,
    omittedBookmarkCount,
    omittedBookmarkUrls,
    byteCount: byteLength(serialized),
  }
}

export function createMetadataSyncPayload(input: {
  meta: Record<string, BookmarkMeta>
  categoryMeta: Record<string, CategoryMeta>
  categories: Category[]
  updatedAt: number
  deviceId: string
  scope?: Partial<MetadataSyncScope>
}): MetadataSyncPayload {
  return fitDocumentToBudget(createDocument(input))
}

async function getDeviceId(): Promise<string> {
  const stored = await chrome.storage.local.get(DEVICE_ID_KEY)
  if (typeof stored[DEVICE_ID_KEY] === 'string')
    return stored[DEVICE_ID_KEY]
  const deviceId = crypto.randomUUID()
  await chrome.storage.local.set({ [DEVICE_ID_KEY]: deviceId })
  return deviceId
}

async function readRemoteDocument(
  run: <T>(task: () => Promise<T>) => Promise<T>,
  passphrase?: string,
): Promise<MetadataSyncDocument | undefined> {
  const manifestValue = await run(() => chrome.storage.sync.get(SYNC_MANIFEST_KEY))
  const manifest = manifestValue[SYNC_MANIFEST_KEY]
  if (!isRecord(manifest) || typeof manifest.partCount !== 'number' || manifest.partCount < 1)
    return undefined
  const keys = Array.from({ length: manifest.partCount }, (_, index) => `${SYNC_PART_PREFIX}${index}`)
  const values = await run(() => chrome.storage.sync.get(keys))
  const serialized = keys.map(key => values[key]).join('')
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  }
  catch {
    return undefined
  }
  if (!isEncryptedMetadataEnvelope(parsed))
    return parseDocument(parsed)
  if (!passphrase)
    throw new LocalizedError('runtimeMetadataRemotePassphraseRequired')
  try {
    return parseDocument(JSON.parse(await decryptMetadataText(parsed, passphrase)))
  }
  catch {
    throw new LocalizedError('runtimeMetadataDecryptFailed')
  }
}

async function writeRemoteDocument(
  document: MetadataSyncDocument,
  run: <T>(task: () => Promise<T>) => Promise<T>,
  passphrase?: string,
): Promise<number> {
  const serialized = passphrase
    ? JSON.stringify(await encryptMetadataText({
        plaintext: JSON.stringify(document),
        passphrase,
        updatedAt: document.updatedAt,
        deviceId: document.deviceId,
      }))
    : JSON.stringify(document)
  const parts = splitUtf8(serialized)
  const values = Object.fromEntries(parts.map((part, index) => [`${SYNC_PART_PREFIX}${index}`, part]))
  const manifest: MetadataSyncManifest = {
    schemaVersion: passphrase ? 3 : 2,
    partCount: parts.length,
    updatedAt: document.updatedAt,
    deviceId: document.deviceId,
    encrypted: Boolean(passphrase),
  }
  // A multi-item set is a single write operation. Keeping the parts and manifest
  // together halves Chrome Sync write pressure and avoids exposing a new manifest
  // before all of its parts have been stored.
  await run(() => chrome.storage.sync.set({
    ...values,
    [SYNC_MANIFEST_KEY]: manifest,
  }))
  return byteLength(serialized)
}

export function markLocalMetadataChanged(): Promise<void> {
  // The current values are diffed against the local shadow during the next sync.
  return Promise.resolve()
}

export async function synchronizeMetadata(input: {
  meta: Record<string, BookmarkMeta>
  categoryMeta: Record<string, CategoryMeta>
  categories: Category[]
  scope?: Partial<MetadataSyncScope>
  encryptionPassphrase?: string
}): Promise<MetadataSyncResult> {
  let retryCount = 0
  const run = async <T>(task: () => Promise<T>): Promise<T> => {
    let lastError: unknown
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return await task()
      }
      catch (cause) {
        lastError = cause
        // Frequency quotas recover over minutes or hours. Immediate retries only
        // add more pressure, so let the outer scheduler apply a long backoff.
        if (isMetadataSyncWriteQuotaError(cause))
          throw cause
        if (attempt === MAX_ATTEMPTS - 1)
          break
        retryCount += 1
        await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt))
      }
    }
    throw lastError
  }

  const [deviceId, localValue, remote] = await Promise.all([
    getDeviceId(),
    chrome.storage.local.get(LOCAL_DOCUMENT_KEY),
    readRemoteDocument(run, input.encryptionPassphrase?.trim() || undefined),
  ])
  const shadow = parseDocument(localValue[LOCAL_DOCUMENT_KEY])
  const updatedAt = Date.now()
  const current = createDocument({ ...input, deviceId, updatedAt })
  const local = withLocalDiff(shadow, current, input.scope)
  const merged = remote ? mergeMetadataDocuments(local, remote, deviceId) : local
  merged.updatedAt = Math.max(updatedAt, merged.updatedAt)
  const remoteContributed = Boolean(remote && !syncContentEqual(local, merged))
  const needsUpload = !remote || !syncContentEqual(remote, merged)
  const payload = fitDocumentToBudget(merged)

  const encryptionPassphrase = input.encryptionPassphrase?.trim() || undefined
  const byteCount = needsUpload
    ? await writeRemoteDocument(payload.document, run, encryptionPassphrase)
    : payload.byteCount
  await chrome.storage.local.set({ [LOCAL_DOCUMENT_KEY]: payload.document })

  const direction: MetadataSyncResult['direction'] = needsUpload
    ? remoteContributed ? 'merged' : 'uploaded'
    : remoteContributed ? 'downloaded' : 'unchanged'
  return {
    direction,
    document: materializeMetadataDocument(payload.document, input.scope),
    omittedBookmarkCount: payload.omittedBookmarkCount,
    omittedBookmarkUrls: payload.omittedBookmarkUrls,
    byteCount,
    syncedAt: payload.document.updatedAt,
    retryCount,
  }
}

export const metadataSyncManifestKey = SYNC_MANIFEST_KEY

export async function clearMetadataSyncStorage(): Promise<void> {
  const all = await chrome.storage.sync.get(null)
  const keys = Object.keys(all).filter(key =>
    key === SYNC_MANIFEST_KEY || key.startsWith(SYNC_PART_PREFIX))
  if (keys.length > 0)
    await chrome.storage.sync.remove(keys)
  await chrome.storage.local.remove(LOCAL_DOCUMENT_KEY)
}
