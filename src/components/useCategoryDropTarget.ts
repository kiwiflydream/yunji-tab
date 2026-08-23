import type { Category } from '~/lib/types'

import { useDndContext, useDroppable } from '@dnd-kit/core'
import { readDragItemData, validateCategoryDrop } from '~/lib/drag-drop'
import { useCategories } from '~/lib/store'

export function useCategoryDropTarget(
  category: Category,
  surface: 'card' | 'sidebar',
) {
  const categories = useCategories()
  const { active } = useDndContext()
  const { isOver, setNodeRef } = useDroppable({
    id: `category-drop:${surface}:${category.id}`,
    data: {
      type: 'category-drop',
      categoryId: category.id,
      label: category.name,
    },
  })
  const item = readDragItemData(active?.data.current)
  const validation
    = isOver && item ? validateCategoryDrop(item, category.id, categories) : null

  return { isOver, setDropNodeRef: setNodeRef, validation }
}
