import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const intentionalRuntimeHan = new Map<string, Set<string>>([
  ['src/lib/bookmark-search.ts', new Set([
    '阿',
    '芭',
    '擦',
    '搭',
    '蛾',
    '发',
    '噶',
    '哈',
    '击',
    '喀',
    '垃',
    '妈',
    '拿',
    '哦',
    '啪',
    '期',
    '然',
    '撒',
    '塌',
    '挖',
    '昔',
    '压',
    '匝',
  ])],
  ['src/lib/default-data.ts', new Set([
    '全部',
    '常用',
    '最近',
    '收件箱',
    '置顶',
    '无标签',
    '无描述',
    '百度',
  ])],
])

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(absolute) : [absolute]
  })
}

describe('i18n hard-coded copy gate', () => {
  it('keeps Han UI copy inside translation catalogs', () => {
    const unexpected: string[] = []
    const files = sourceFiles(path.resolve('src')).filter((file) => {
      const name = path.basename(file)
      return /\.(?:ts|tsx)$/.test(file)
        && !name.includes('.test.')
        && !name.startsWith('i18n')
    })

    for (const file of files) {
      const relative = path.relative(process.cwd(), file)
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      )
      const visit = (node: ts.Node) => {
        const value = ts.isStringLiteral(node)
          || ts.isNoSubstitutionTemplateLiteral(node)
          ? node.text
          : ts.isJsxText(node)
            ? node.getText(source).trim()
            : ''
        if (/\p{Script=Han}/u.test(value)
          && !intentionalRuntimeHan.get(relative)?.has(value)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
          unexpected.push(`${relative}:${line + 1}: ${JSON.stringify(value)}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }

    expect(unexpected).toEqual([])
  })
})
