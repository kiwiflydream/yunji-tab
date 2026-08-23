import { describe, expect, it } from 'vitest'
import { createImportPreview } from './import-preview'

describe('import preview', () => {
  it('counts canonical metadata conflicts', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      settings: {},
      bookmarkMeta: { 'https://example.com/': {} },
      categoryMeta: [],
      usage: {},
    })
    expect(createImportPreview(raw, ['https://EXAMPLE.com/#x'], 'metadata').conflictCount).toBe(1)
  })
})
