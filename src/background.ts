import type { HistoryEntry, TrashEntry } from '~/lib/activity'
import type { RemoteFaviconResponse } from '~/lib/favicon-messages'
import type { LocalizedMessage, TranslationParams } from '~/lib/i18n'
import type { RuntimeMessageKey } from '~/lib/i18n-runtime'
import type {
  BookmarkMeta,
  BookmarkUsage,
  CategoryMeta,
  Language,
  Settings,
} from '~/lib/types'
import { Storage } from '@plasmohq/storage'
import {
  historyStorageKey,
  pruneHistory,
  pruneTrash,
  trashRetentionMs,
  trashStorageKey,
} from '~/lib/activity'
import { consumeBookmarkDeletionSuppression } from '~/lib/bookmark-deletion-safety'
import { toNodeId } from '~/lib/bookmark-tree'
import {
  normalizeBookmarkUrl,
  resolveFastestBookmarkUrl,
} from '~/lib/bookmark-urls'
import {
  fetchRemoteFaviconMessage,
  isRemoteFaviconUrl,
} from '~/lib/favicon-messages'
import {
  globalPaletteCloseMessage,
  globalPaletteHomeHash,
  globalPaletteOpenBookmarkMessage,
  globalPaletteOpenForTabMessage,
  globalPaletteOpenHomeMessage,
  globalPaletteSavePageMessage,
  globalPaletteSessionKey,
  globalPaletteSessionPrefix,
  globalPaletteSessionTtlMs,
  globalPaletteValidateMessage,
  isGlobalPaletteSessionValid,
  openGlobalCommandPaletteCommand,
  toggleGlobalCommandPalette,
} from '~/lib/global-command-palette'
import {
  homeTabReadyMessage,
  homeTabStorageKey,
  openHomeTabMessage,
} from '~/lib/home-tabs'
import { translateRuntime } from '~/lib/i18n-runtime'
import { loadPreferredLanguage } from '~/lib/language'
import { LocalizedError } from '~/lib/localized-error'
import { markLocalMetadataChanged } from '~/lib/metadata-sync'
import {
  currentPageFromTab,
  getDuplicateBookmark,
  loadQuickSaveData,
  quickSaveBookmarkMessage,
  quickSaveCategoryKey,
} from '~/lib/quick-save'

const MENU_ID = 'yunji-tab-save-page'
const META_KEY = 'yunji-tab:meta'
const SETTINGS_KEY = 'yunji-tab:settings'
const CATEGORY_META_KEY = 'yunji-tab:category-meta'
const USAGE_KEY = 'yunji-tab:usage'
const HOME_URL = chrome.runtime.getURL('newtab.html')
const FAVICON_FETCH_TIMEOUT_MS = 8_000
const localStorage = new Storage({ area: 'local' })
const settingsStorage = new Storage({ area: 'sync' })
let homeTabQueue = Promise.resolve()
let bookmarkDeletionQueue = Promise.resolve()

function runtimeMessage(
  key: RuntimeMessageKey,
  params?: TranslationParams,
): LocalizedMessage {
  return params ? { key, params } : { key }
}

async function getSelectedLanguage(): Promise<Language> {
  return loadPreferredLanguage(
    () => settingsStorage.get<Partial<Settings>>(SETTINGS_KEY),
  )
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    )
  }
  return btoa(binary)
}

async function fetchRemoteFavicon(url: unknown): Promise<RemoteFaviconResponse> {
  if (!isRemoteFaviconUrl(url))
    return { ok: false }

  const controller = new AbortController()
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    FAVICON_FETCH_TIMEOUT_MS,
  )
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok)
      return { ok: false }
    const blob = await response.blob()
    const validType
      = blob.type.startsWith('image/')
        || blob.type === 'application/octet-stream'
    if (!blob.size || !validType)
      return { ok: false }
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    return {
      ok: true,
      base64: uint8ArrayToBase64(bytes),
      type: blob.type,
    }
  }
  catch {
    return { ok: false }
  }
  finally {
    globalThis.clearTimeout(timeout)
  }
}

function collectCategoryIds(node: chrome.bookmarks.BookmarkTreeNode): string[] {
  if (node.url)
    return []
  return [
    `cat-${node.id}`,
    ...(node.children ?? []).flatMap(collectCategoryIds),
  ]
}

async function archiveExternalBookmarkDeletion(
  node: chrome.bookmarks.BookmarkTreeNode,
): Promise<void> {
  if (await consumeBookmarkDeletionSuppression(node.id))
    return
  const [storedTrash, storedHistory, storedCategoryMeta] = await Promise.all([
    localStorage.get<unknown>(trashStorageKey),
    localStorage.get<unknown>(historyStorageKey),
    localStorage.get<Record<string, CategoryMeta>>(CATEGORY_META_KEY),
  ])
  const categoryIds = collectCategoryIds(node)
  const categoryMeta = { ...(storedCategoryMeta ?? {}) }
  const removedCategoryMeta: Record<string, CategoryMeta> = {}
  for (const id of categoryIds) {
    if (categoryMeta[id])
      removedCategoryMeta[id] = categoryMeta[id]
    delete categoryMeta[id]
  }
  const deletedAt = Date.now()
  const label = node.url
    ? runtimeMessage('runtimeExternalBookmarkDeletion', {
        name: node.title || node.url,
      })
    : runtimeMessage('runtimeExternalFolderDeletion', {
        name: node.title,
      })
  const entry: TrashEntry = {
    id: crypto.randomUUID(),
    label,
    deletedAt,
    expiresAt: deletedAt + trashRetentionMs,
    roots: [node],
    categoryMeta: removedCategoryMeta,
  }
  const historyEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    action: 'delete',
    label,
    createdAt: deletedAt,
  }
  const trash = [entry, ...pruneTrash(storedTrash)].slice(0, 100)
  const history = [historyEntry, ...pruneHistory(storedHistory)].slice(0, 200)
  await Promise.all([
    localStorage.set(trashStorageKey, trash),
    localStorage.set(historyStorageKey, history),
    localStorage.set(CATEGORY_META_KEY, categoryMeta),
    markLocalMetadataChanged(),
  ])
}

function isExtensionHomeUrl(url?: string): boolean {
  if (!url)
    return false

  try {
    const currentUrl = new URL(url)
    const homeUrl = new URL(HOME_URL)
    return currentUrl.origin === homeUrl.origin
      && currentUrl.pathname === homeUrl.pathname
  }
  catch {
    return false
  }
}

function isBrowserNewTabUrl(url?: string): boolean {
  return url === 'chrome://newtab/' || url === 'chrome://newtab'
}

function isHomeTab(tab: chrome.tabs.Tab, includeBrowserNewTab: boolean): boolean {
  return isExtensionHomeUrl(tab.url)
    || isExtensionHomeUrl(tab.pendingUrl)
    || (includeBrowserNewTab && (isBrowserNewTabUrl(tab.url) || isBrowserNewTabUrl(tab.pendingUrl)))
}

async function focusHomeTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined)
    return
  await chrome.windows.update(tab.windowId, { focused: true })
  await chrome.tabs.update(tab.id, { active: true })
}

async function registerHomeTab(openedTab?: chrome.tabs.Tab): Promise<void> {
  if (openedTab?.id === undefined)
    return

  const settings = await settingsStorage.get<Partial<Settings>>(SETTINGS_KEY)
  if (settings?.singleHomeTab !== true) {
    await chrome.storage.session.remove(homeTabStorageKey)
    return
  }

  // Chrome exposes an overridden New Tab page as chrome://newtab/ in real
  // browser windows. Only include those tabs after Yunji Tab itself reports
  // that its page loaded, so another enabled New Tab extension is untouched.
  const includeBrowserNewTab = isBrowserNewTabUrl(openedTab.url)
    || isBrowserNewTabUrl(openedTab.pendingUrl)
  const tabs = await chrome.tabs.query({})
  const homeTabs = tabs
    .filter(tab => isHomeTab(tab, includeBrowserNewTab))
    .sort((left, right) => (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER))

  const existingTab = homeTabs[0] ?? openedTab
  if (existingTab.id === undefined)
    return

  await chrome.storage.session.set({ [homeTabStorageKey]: existingTab.id })
  if (homeTabs.length === 1)
    return

  const duplicateTabIds = homeTabs
    .slice(1)
    .flatMap(tab => tab.id === undefined ? [] : [tab.id])
  await chrome.tabs.remove(duplicateTabIds).catch(() => undefined)
  await focusHomeTab(existingTab).catch(() => undefined)
}

async function getRegisteredHomeTab(): Promise<chrome.tabs.Tab | undefined> {
  const stored = await chrome.storage.session.get(homeTabStorageKey)
  const tabId = stored[homeTabStorageKey]
  if (typeof tabId !== 'number')
    return undefined

  const tab = await chrome.tabs.get(tabId).catch(() => undefined)
  if (tab && isHomeTab(tab, true))
    return tab

  await chrome.storage.session.remove(homeTabStorageKey)
  return undefined
}

async function openOrFocusHomeTab(openCommandPalette = false): Promise<void> {
  const targetUrl = openCommandPalette
    ? `${HOME_URL}${globalPaletteHomeHash}`
    : HOME_URL
  const settings = await settingsStorage.get<Partial<Settings>>(SETTINGS_KEY)
  if (settings?.singleHomeTab !== true) {
    await chrome.tabs.create({ url: targetUrl })
    return
  }

  const homeTab = await getRegisteredHomeTab()
  if (homeTab) {
    await focusHomeTab(homeTab)
    if (openCommandPalette && homeTab.id !== undefined)
      await chrome.tabs.update(homeTab.id, { url: targetUrl })
    return
  }
  await chrome.tabs.create({ url: targetUrl })
}

function queueHomeTabTask(task: () => Promise<void>): Promise<void> {
  const result = homeTabQueue.then(task)
  homeTabQueue = result.catch(() => undefined)
  return result
}

function setBadge(text: string, color: string): void {
  void chrome.action.setBadgeBackgroundColor({ color })
  void chrome.action.setBadgeText({ text })
  setTimeout(() => void chrome.action.setBadgeText({ text: '' }), 1800)
}

async function getAllBookmarks(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const [root] = await chrome.bookmarks.getTree()
  const bookmarks: chrome.bookmarks.BookmarkTreeNode[] = []
  const visit = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
    for (const node of nodes) {
      if (node.url)
        bookmarks.push(node)
      if (node.children)
        visit(node.children)
    }
  }
  visit(root.children ?? [])
  return bookmarks
}

async function resolveQuickSaveParent(): Promise<string> {
  const stored = await chrome.storage.local.get(quickSaveCategoryKey)
  const categoryId = stored[quickSaveCategoryKey]
  if (typeof categoryId === 'string') {
    const nodeId = categoryId.replace(/^cat-/, '')
    try {
      const [node] = await chrome.bookmarks.get(nodeId)
      if (node && !node.url)
        return nodeId
    }
    catch {
      // The remembered folder may have been removed on another device.
    }
  }
  return '1'
}

async function resolveRequestedParent(categoryId: unknown): Promise<string> {
  if (typeof categoryId !== 'string')
    return '1'
  const nodeId = categoryId.replace(/^cat-/, '')
  const [node] = await chrome.bookmarks.get(nodeId).catch(() => [])
  return node && !node.url ? nodeId : '1'
}

async function saveQuickBookmark(input: unknown): Promise<void> {
  if (!input || typeof input !== 'object')
    throw new LocalizedError('runtimeQuickSaveInvalidData')
  const candidate = input as Record<string, unknown>
  const page = currentPageFromTab({
    title: typeof candidate.name === 'string' ? candidate.name : '',
    url: typeof candidate.url === 'string' ? candidate.url : '',
  })
  if (!page)
    throw new LocalizedError('runtimeQuickSaveInvalidUrl')

  const bookmarks = await getAllBookmarks()
  if (getDuplicateBookmark(
    bookmarks.flatMap(node => node.url ? [{ url: node.url }] : []),
    page.url,
  )) {
    throw new LocalizedError('runtimeQuickSaveDuplicate')
  }

  await chrome.bookmarks.create({
    parentId: await resolveRequestedParent(candidate.categoryId),
    title: page.title,
    url: page.url,
  })
  const tags = Array.isArray(candidate.tags)
    ? [...new Set(candidate.tags.filter(
        (tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()),
      ).map(tag => tag.trim()))].slice(0, 12)
    : []
  const meta = await localStorage.get<Record<string, BookmarkMeta>>(META_KEY) ?? {}
  meta[page.url] = {
    ...(meta[page.url] ?? {}),
    tags: tags.length > 0 ? tags : undefined,
    inboxAt: typeof candidate.inboxAt === 'number' && candidate.inboxAt > 0
      ? candidate.inboxAt
      : Date.now(),
  }
  await localStorage.set(META_KEY, meta)
  await markLocalMetadataChanged()
}

type SaveTabResult = 'duplicate' | 'invalid' | 'saved'

async function saveTab(tab?: chrome.tabs.Tab): Promise<SaveTabResult> {
  const page = currentPageFromTab(tab)
  if (!page) {
    setBadge('!', '#b91c1c')
    return 'invalid'
  }
  const bookmarks = await getAllBookmarks()
  const bookmarkUrls = bookmarks.flatMap(node => node.url ? [{ url: node.url }] : [])
  if (getDuplicateBookmark(bookmarkUrls, page.url)) {
    setBadge('=', '#525252')
    return 'duplicate'
  }
  await chrome.bookmarks.create({
    parentId: await resolveQuickSaveParent(),
    title: page.title,
    url: page.url,
  })
  const meta = await localStorage.get<Record<string, BookmarkMeta>>(META_KEY) ?? {}
  meta[page.url] = { ...(meta[page.url] ?? {}), inboxAt: Date.now() }
  await localStorage.set(META_KEY, meta)
  await markLocalMetadataChanged()
  setBadge('✓', '#15803d')
  return 'saved'
}

async function getGlobalPaletteSession(token: unknown, senderTabId?: number) {
  if (typeof token !== 'string' || !token || senderTabId === undefined)
    return undefined
  const key = globalPaletteSessionKey(token)
  const stored = await chrome.storage.session.get(key)
  const session = stored[key]
  if (!isGlobalPaletteSessionValid(session, senderTabId)) {
    await chrome.storage.session.remove(key)
    return undefined
  }
  return session
}

async function removeGlobalPaletteSessionsForTab(tabId: number): Promise<void> {
  const stored = await chrome.storage.session.get(null)
  const keys = Object.entries(stored).flatMap(([key, session]) =>
    key.startsWith(globalPaletteSessionPrefix)
    && isGlobalPaletteSessionValid(session, undefined, 0)
    && session.tabId === tabId
      ? [key]
      : [])
  if (keys.length > 0)
    await chrome.storage.session.remove(keys)
}

async function pruneExpiredGlobalPaletteSessions(): Promise<void> {
  const stored = await chrome.storage.session.get(null)
  const keys = Object.entries(stored).flatMap(([key, session]) =>
    key.startsWith(globalPaletteSessionPrefix)
    && !isGlobalPaletteSessionValid(session, undefined)
      ? [key]
      : [])
  if (keys.length > 0)
    await chrome.storage.session.remove(keys)
}

async function recordGlobalPaletteBookmarkOpen(url: string): Promise<void> {
  const usage = await localStorage.get<Record<string, BookmarkUsage>>(USAGE_KEY)
    ?? {}
  const current = usage[url]
  usage[url] = {
    openCount: (current?.openCount ?? 0) + 1,
    lastOpenedAt: Date.now(),
  }
  await localStorage.set(USAGE_KEY, usage)
}

async function loadGlobalPaletteData() {
  const [{ bookmarks, categories }, bookmarkMeta, settings] = await Promise.all(
    [
      loadQuickSaveData(),
      localStorage.get<Record<string, BookmarkMeta>>(META_KEY),
      settingsStorage.get<Partial<Settings>>(SETTINGS_KEY),
    ],
  )
  return {
    bookmarks: bookmarks.map(bookmark => ({
      ...bookmark,
      ...(bookmarkMeta?.[bookmark.url] ?? {}),
    })),
    categories,
    language: await getSelectedLanguage(),
    theme: settings?.theme ?? 'system',
  }
}

async function openGlobalPaletteBookmark(
  token: unknown,
  bookmarkId: unknown,
  senderTabId?: number,
): Promise<boolean> {
  if (!(await getGlobalPaletteSession(token, senderTabId)))
    return false
  if (typeof bookmarkId !== 'string')
    return false
  const [bookmark] = await chrome.bookmarks
    .get(toNodeId(bookmarkId))
    .catch(() => [])
  const primaryUrl = normalizeBookmarkUrl(bookmark?.url ?? '')
  if (!primaryUrl)
    return false
  const bookmarkMeta = await localStorage.get<Record<string, BookmarkMeta>>(
    META_KEY,
  )
  const url = await resolveFastestBookmarkUrl({
    url: primaryUrl,
    alternateUrls: bookmarkMeta?.[primaryUrl]?.alternateUrls,
  })
  await recordGlobalPaletteBookmarkOpen(primaryUrl)
  await chrome.tabs.create({ url })
  return true
}

async function openGlobalCommandPalette(tab?: chrome.tabs.Tab): Promise<void> {
  if (tab?.id === undefined) {
    await queueHomeTabTask(() => openOrFocusHomeTab(true))
    return
  }

  if (isHomeTab(tab, true)) {
    await chrome.tabs.update(tab.id, {
      url: `${HOME_URL}${globalPaletteHomeHash}`,
    })
    return
  }

  await pruneExpiredGlobalPaletteSessions()
  const token = crypto.randomUUID()
  const key = globalPaletteSessionKey(token)
  await chrome.storage.session.set({
    [key]: {
      tabId: tab.id,
      expiresAt: Date.now() + globalPaletteSessionTtlMs,
    },
  })
  const iframeUrl = chrome.runtime.getURL(
    `tabs/global-command-palette.html#${encodeURIComponent(token)}`,
  )

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleGlobalCommandPalette,
      args: [iframeUrl, token],
    })
    if (result?.result === 'closed')
      await chrome.storage.session.remove(key)
  }
  catch {
    await chrome.storage.session.remove(key)
    await queueHomeTabTask(() => openOrFocusHomeTab(true))
  }
}

async function openGlobalCommandPaletteIfEnabled(
  tab?: chrome.tabs.Tab,
): Promise<boolean> {
  const settings = await settingsStorage.get<Partial<Settings>>(SETTINGS_KEY)
  if (settings?.globalCommandPaletteEnabled !== true)
    return false
  await openGlobalCommandPalette(tab)
  return true
}

async function refreshContextMenu(): Promise<void> {
  const language = await getSelectedLanguage()
  await chrome.contextMenus.remove(MENU_ID).catch(() => undefined)
  chrome.contextMenus.create({
    id: MENU_ID,
    title: translateRuntime(language, 'runtimeSaveCurrentPage'),
    contexts: ['page'],
  })
}

chrome.runtime.onInstalled.addListener(() => {
  void refreshContextMenu()
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[SETTINGS_KEY])
    void refreshContextMenu()
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID)
    void saveTab(tab).catch(() => setBadge('!', '#b91c1c'))
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'quick-save-page')
    void saveTab(tab).catch(() => setBadge('!', '#b91c1c'))
  if (command === openGlobalCommandPaletteCommand)
    void openGlobalCommandPaletteIfEnabled(tab)
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === fetchRemoteFaviconMessage) {
    void fetchRemoteFavicon(message.url).then(sendResponse)
    return true
  }
  if (message?.type === homeTabReadyMessage) {
    void queueHomeTabTask(() => registerHomeTab(sender.tab))
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === openHomeTabMessage) {
    void queueHomeTabTask(openOrFocusHomeTab)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === globalPaletteValidateMessage) {
    void getGlobalPaletteSession(message.token, sender.tab?.id)
      .then(session => (session ? loadGlobalPaletteData() : undefined))
      .then(data => sendResponse(data ? { ok: true, data } : { ok: false }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (
    message?.type === globalPaletteOpenForTabMessage
    && sender.id === chrome.runtime.id
  ) {
    void (typeof message.tabId === 'number'
      ? chrome.tabs.get(message.tabId).then(openGlobalCommandPaletteIfEnabled)
      : Promise.reject(new TypeError('Missing target tab')))
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === globalPaletteOpenBookmarkMessage) {
    void openGlobalPaletteBookmark(
      message.token,
      message.bookmarkId,
      sender.tab?.id,
    )
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === globalPaletteSavePageMessage) {
    void getGlobalPaletteSession(message.token, sender.tab?.id)
      .then(async (session) => {
        if (!session)
          return undefined
        const tab = await chrome.tabs.get(session.tabId).catch(() => undefined)
        return saveTab(tab)
      })
      .then(result => sendResponse({ ok: Boolean(result), result }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === globalPaletteOpenHomeMessage) {
    void getGlobalPaletteSession(message.token, sender.tab?.id)
      .then(async (session) => {
        if (!session)
          return false
        await queueHomeTabTask(openOrFocusHomeTab)
        return true
      })
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === globalPaletteCloseMessage) {
    const key
      = typeof message.token === 'string'
        ? globalPaletteSessionKey(message.token)
        : ''
    void getGlobalPaletteSession(message.token, sender.tab?.id)
      .then(session =>
        session && key ? chrome.storage.session.remove(key) : undefined,
      )
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (message?.type === quickSaveBookmarkMessage) {
    void saveQuickBookmark(message.bookmark)
      .then(() => sendResponse({ ok: true }))
      .catch(cause => sendResponse({
        ok: false,
        errorKey: cause instanceof LocalizedError
          ? cause.messageKey
          : 'runtimeQuickSaveFailed',
        params: cause instanceof LocalizedError ? cause.params : undefined,
      }))
    return true
  }
  return false
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void removeGlobalPaletteSessionsForTab(tabId)
  void chrome.storage.session.get(homeTabStorageKey).then((stored) => {
    if (stored[homeTabStorageKey] === tabId)
      return chrome.storage.session.remove(homeTabStorageKey)
  })
})

chrome.bookmarks.onRemoved.addListener((_id, removeInfo) => {
  const task = bookmarkDeletionQueue.then(() =>
    archiveExternalBookmarkDeletion(removeInfo.node))
  bookmarkDeletionQueue = task.catch(() => undefined)
})
