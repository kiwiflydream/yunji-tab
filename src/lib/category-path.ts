import type { Category } from './types'

export function getCategoryPath(
  categoryId: string,
  categories: Category[],
): string[] | undefined {
  const byId = new Map(categories.map(category => [category.id, category]))
  const path: string[] = []
  const visited = new Set<string>()
  let current = byId.get(categoryId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.unshift(current.name)
    current = byId.get(current.parentId)
  }

  return path.length > 0 ? path : undefined
}

export function buildCategoryPathMap(
  categories: Category[],
): Map<string, string[]> {
  const categoriesById = new Map(
    categories.map(category => [category.id, category]),
  )
  const paths = new Map<string, string[]>()

  for (const category of categories) {
    if (paths.has(category.id))
      continue
    const chain: Category[] = []
    const visited = new Set<string>()
    let current: Category | undefined = category
    while (current && !paths.has(current.id) && !visited.has(current.id)) {
      visited.add(current.id)
      chain.push(current)
      current = categoriesById.get(current.parentId)
    }

    let path = current ? [...(paths.get(current.id) ?? [])] : []
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const item = chain[index]
      path = [...path, item.name]
      paths.set(item.id, path)
    }
  }
  return paths
}

export function findCategoryByPath(
  path: string[] | undefined,
  categories: Category[],
): Category | undefined {
  if (!path?.length)
    return undefined
  let parentId = 'all'
  let match: Category | undefined
  for (const name of path) {
    match = categories.find(
      category => category.parentId === parentId && category.name === name,
    )
    if (!match)
      return undefined
    parentId = match.id
  }
  return match
}
