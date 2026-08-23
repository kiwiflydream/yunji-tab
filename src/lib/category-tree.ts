import type { Category } from './types'

export interface CategoryTreeNode {
  category: Category
  children: CategoryTreeNode[]
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>()
  for (const category of categories)
    nodes.set(category.id, { category, children: [] })

  const roots: CategoryTreeNode[] = []
  for (const category of categories) {
    const node = nodes.get(category.id)
    const parent = nodes.get(category.parentId)
    if (!node)
      continue
    if (parent && parent !== node)
      parent.children.push(node)
    else
      roots.push(node)
  }
  return roots
}

export function getCategoryAncestorIds(
  categoryId: string,
  categories: Category[],
): Set<string> {
  const categoriesById = new Map(categories.map(category => [category.id, category]))
  const ancestors = new Set<string>()
  let current = categoriesById.get(categoryId)
  while (current) {
    const parent = categoriesById.get(current.parentId)
    if (!parent || ancestors.has(parent.id))
      break
    ancestors.add(parent.id)
    current = parent
  }
  return ancestors
}
