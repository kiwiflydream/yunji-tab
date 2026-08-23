import { Storage } from '@plasmohq/storage'

// 补充描述和图标可能较多，使用 local 避免 sync 配额导致刷新后丢失。
export const metaStorage = new Storage({ area: 'local' })
export const settingsStorage = new Storage({ area: 'sync' })

export const STORAGE_KEYS = {
  meta: 'yunji-tab:meta',
  categoryMeta: 'yunji-tab:category-meta',
  settings: 'yunji-tab:settings',
  usage: 'yunji-tab:usage',
  metadataSyncLog: 'yunji-tab:metadata-sync-log',
  metadataSyncPassphrase: 'yunji-tab:metadata-sync-passphrase',
  tasks: 'yunji-tab:tasks',
} as const

let supplementaryPersisted: () => Promise<void> = async () => {}

export function registerSupplementaryPersisted(callback: () => Promise<void>) {
  supplementaryPersisted = callback
}

// 持久化失败需要暴露给调用方，避免界面显示已同步但刷新后丢失。
export async function persist(client: Storage, key: string, value: unknown) {
  await client.set(key, value)
  if (
    client === metaStorage
    && (key === STORAGE_KEYS.meta || key === STORAGE_KEYS.categoryMeta)
  ) {
    await supplementaryPersisted()
  }
}
