import type { FullBookmarkSnapshot, NativeBookmarkSnapshotNode, YunjiTabBackup } from './backup'
import { parseFullBookmarkSnapshot, parseYunjiTabBackup } from './backup'
import { canonicalizeBookmarkUrl } from './bookmark-urls'

export interface ImportPreview {
  kind: 'metadata' | 'full'
  bookmarkCount: number
  categoryCount: number
  conflictCount: number
  nodeCount: number
}

function flattenNodes(nodes: NativeBookmarkSnapshotNode[]): NativeBookmarkSnapshotNode[] {
  return nodes.flatMap(node => [node, ...flattenNodes(node.children ?? [])])
}

function metadataPreview(backup: YunjiTabBackup, currentUrls: Set<string>): ImportPreview {
  const urls = Object.keys(backup.bookmarkMeta)
  return {
    kind: 'metadata',
    bookmarkCount: urls.length,
    categoryCount: backup.categoryMeta.length,
    conflictCount: urls.filter(url => currentUrls.has(canonicalizeBookmarkUrl(url))).length,
    nodeCount: 0,
  }
}

export function createImportPreview(
  raw: string,
  currentBookmarkUrls: string[],
  kind: 'metadata' | 'full',
): ImportPreview {
  const currentUrls = new Set(currentBookmarkUrls.map(canonicalizeBookmarkUrl))
  if (kind === 'metadata')
    return metadataPreview(parseYunjiTabBackup(raw), currentUrls)

  const snapshot: FullBookmarkSnapshot = parseFullBookmarkSnapshot(raw)
  const nodes = flattenNodes(snapshot.roots)
  return {
    kind: 'full',
    bookmarkCount: nodes.filter(node => node.url).length,
    categoryCount: nodes.filter(node => !node.url).length,
    conflictCount: nodes.filter(node => node.url && currentUrls.has(canonicalizeBookmarkUrl(node.url))).length,
    nodeCount: nodes.length,
  }
}
