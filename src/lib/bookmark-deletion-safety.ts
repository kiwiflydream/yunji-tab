const suppressionStorageKey = 'yunji-tab:bookmark-deletion-suppression'
const suppressionTtlMs = 30_000

type SuppressionMap = Record<string, number>

async function readSuppressions(): Promise<SuppressionMap> {
  const stored = await chrome.storage.session.get(suppressionStorageKey)
  const value = stored[suppressionStorageKey]
  return typeof value === 'object' && value !== null
    ? value as SuppressionMap
    : {}
}

export async function suppressBookmarkDeletionArchive(ids: string[]): Promise<void> {
  const suppressions = await readSuppressions()
  const expiresAt = Date.now() + suppressionTtlMs
  for (const id of ids)
    suppressions[id] = expiresAt
  await chrome.storage.session.set({ [suppressionStorageKey]: suppressions })
}

export async function releaseBookmarkDeletionArchive(ids: string[]): Promise<void> {
  const suppressions = await readSuppressions()
  for (const id of ids)
    delete suppressions[id]
  await chrome.storage.session.set({ [suppressionStorageKey]: suppressions })
}

export async function consumeBookmarkDeletionSuppression(id: string): Promise<boolean> {
  const suppressions = await readSuppressions()
  const expiresAt = suppressions[id]
  delete suppressions[id]
  for (const [candidateId, candidateExpiresAt] of Object.entries(suppressions)) {
    if (candidateExpiresAt <= Date.now())
      delete suppressions[candidateId]
  }
  await chrome.storage.session.set({ [suppressionStorageKey]: suppressions })
  return typeof expiresAt === 'number' && expiresAt > Date.now()
}
