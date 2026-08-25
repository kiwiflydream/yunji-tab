import type { SearchEngine } from './types'

import { describe, expect, it } from 'vitest'
import { searchEngines } from './default-data'
import {
  normalizeCustomSearchEngines,
  resolveSearchIntent,
  validateCustomSearchEngine,
} from './search-engines'

const customEngine: SearchEngine = {
  id: 'custom-docs',
  name: 'Docs',
  keyword: 'docs',
  url: 'https://docs.example.com/search?q=%s',
  emoji: '📚',
}

describe('search engine settings', () => {
  it('validates custom engine templates', () => {
    expect(
      validateCustomSearchEngine(
        {
          name: ' Docs ',
          keyword: ' DOCS ',
          url: 'https://docs.example.com/search?q=%s',
          emoji: '',
        },
        [],
      ),
    ).toEqual({
      name: 'Docs',
      keyword: 'docs',
      url: 'https://docs.example.com/search?q=%s',
      emoji: '🔎',
    })
  })

  it('drops invalid custom engines during normalization', () => {
    expect(
      normalizeCustomSearchEngines([
        customEngine,
        { id: 'bad', name: 'Bad', keyword: 'bad', url: 'https://x.test/%s' },
        { id: 'custom-bad', name: '', keyword: '', url: '' },
      ]),
    ).toEqual([customEngine])
  })

  it('routes keyword searches to the matching engine', () => {
    const intent = resolveSearchIntent('docs react', [customEngine], 'missing')

    expect(intent.engine?.id).toBe('custom-docs')
    expect(intent.query).toBe('react')
    expect(intent.usedKeyword).toBe(true)
  })

  it('falls back to the browser provider with the current built-ins', () => {
    const intent = resolveSearchIntent('react', searchEngines, 'browser-default')

    expect(intent.engine).toBeNull()
    expect(searchEngines.map(engine => engine.id)).toEqual([
      'google',
      'bing',
      'duckduckgo',
      'github',
    ])
  })
})
