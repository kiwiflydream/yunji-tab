import type { Bookmark, Category } from './types'

import { DEFAULT_CATEGORY_EMOJI } from './default-data'

export type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode

export function bookmarkTreeContainsNode(
  root: BookmarkTreeNode,
  nodeId: string,
): boolean {
  if (root.id === nodeId)
    return true
  return (
    root.children?.some(child => bookmarkTreeContainsNode(child, nodeId))
    ?? false
  )
}

/**
 * 读取浏览器原生书签并转换为统一数据结构：
 * - 每个文件夹（含书签栏 / 其他书签）→ 一个分类，并保留父目录关系
 * - 每个书签 → 归属其直接父文件夹
 * 非扩展环境（chrome.bookmarks 不可用）返回空映射数据，便于预览/降级。
 */
export async function loadBookmarkTreeData(): Promise<{
  categories: Category[]
  bookmarks: Bookmark[]
}> {
  const categories: Category[] = []
  const bookmarks: Bookmark[] = []

  if (typeof chrome === 'undefined' || !chrome.bookmarks) {
    return { categories, bookmarks }
  }

  const [tree] = await chrome.bookmarks.getTree()

  const walk = (nodes: BookmarkTreeNode[], parentCategoryId: string) => {
    for (const node of nodes) {
      if (node.url) {
        // 书签节点
        bookmarks.push({
          id: `bm-${node.id}`,
          name: node.title || node.url,
          url: node.url,
          categoryId: parentCategoryId,
          dateAdded: node.dateAdded,
          index: node.index,
        })
      }
      else {
        // 文件夹节点 → 作为一个分类，空文件夹也需要在主区可见
        const catId = `cat-${node.id}`
        categories.push({
          id: catId,
          name: node.title,
          emoji: DEFAULT_CATEGORY_EMOJI,
          parentId: parentCategoryId,
          modifiable: parentCategoryId !== 'all' && !node.unmodifiable,
        })
        walk(node.children ?? [], catId)
      }
    }
  }

  // tree 为虚拟根节点（id=0），从其子节点（书签栏 / 其他书签）开始遍历
  walk(tree.children ?? [], 'all')
  return { categories, bookmarks }
}

// 去除分类/书签前缀，还原浏览器书签节点 id（cat-1 / bm-100 → 1 / 100）
export function toNodeId(prefixedId: string): string {
  return prefixedId.replace(/^(cat-|bm-)/, '')
}
