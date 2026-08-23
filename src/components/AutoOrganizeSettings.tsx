import type { MessageKey, TranslationParams } from '~/lib/i18n'
import type {
  AutoOrganizeField,
  AutoOrganizeOperator,
} from '~/lib/types'
import { Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import {
  AUTO_ORGANIZE_FIELDS,
  AUTO_ORGANIZE_OPERATORS,
  previewAutoOrganizeRules,
} from '~/lib/auto-organize'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

const FIELD_LABELS: Record<AutoOrganizeField, MessageKey> = {
  name: 'ruleFieldTitle',
  url: 'ruleFieldUrl',
  domain: 'ruleFieldDomain',
  description: 'ruleFieldDescription',
  tag: 'ruleFieldTag',
}

const OPERATOR_LABELS: Record<AutoOrganizeOperator, MessageKey> = {
  contains: 'ruleOperatorContains',
  equals: 'ruleOperatorEquals',
  startsWith: 'ruleOperatorStartsWith',
}

function parseTags(value: string): string[] {
  return [...new Set(value.split(/[\s,，#]+/).map(tag => tag.trim()).filter(Boolean))].slice(0, 12)
}

export function AutoOrganizeSettings() {
  const { categoryName, t } = useI18n()
  const bookmarks = useBookmarks()
  const categories = useCategories()
  const rules = useNavStore(state => state.settings.autoOrganizeRules)
  const addRule = useNavStore(state => state.addAutoOrganizeRule)
  const updateRule = useNavStore(state => state.updateAutoOrganizeRule)
  const removeRule = useNavStore(state => state.removeAutoOrganizeRule)
  const runRules = useNavStore(state => state.runAutoOrganizeRules)
  const [name, setName] = useState('')
  const [field, setField] = useState<AutoOrganizeField>('domain')
  const [operator, setOperator] = useState<AutoOrganizeOperator>('contains')
  const [value, setValue] = useState('')
  const [targetCategoryId, setTargetCategoryId] = useState('')
  const [tags, setTags] = useState('')
  const [clearInbox, setClearInbox] = useState(true)
  const [message, setMessage] = useState<{
    key: MessageKey
    params?: TranslationParams
  } | null>(null)
  const previewCount = useMemo(
    () => previewAutoOrganizeRules(bookmarks, rules, categories).length,
    [bookmarks, categories, rules],
  )

  const createRule = async () => {
    const normalizedValue = value.trim()
    if (!normalizedValue)
      return
    await addRule({
      name: name.trim() || normalizedValue,
      enabled: true,
      field,
      operator,
      value: normalizedValue,
      targetCategoryId: targetCategoryId || undefined,
      addTags: parseTags(tags),
      clearInbox,
    })
    setName('')
    setValue('')
    setTags('')
    setMessage({ key: 'ruleAdded' })
  }

  const applyRules = async () => {
    const count = await runRules()
    setMessage(count > 0
      ? { key: 'organizedBookmarkCount', params: { count } }
      : { key: 'noMatchingBookmarks' })
  }

  return (
    <section className="rounded-xl border border-border bg-muted/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('autoOrganizeRulesTitle')}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {t('autoOrganizeRulesDescription')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border">
          {t('ruleMatchCount', { count: previewCount })}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {rules.length === 0
          ? <p className="rounded-md bg-background px-3 py-3 text-sm text-muted-foreground ring-1 ring-border">{t('noRules')}</p>
          : rules.map(rule => (
              <div key={rule.id} className="flex items-center gap-2 rounded-md bg-background px-3 py-2 ring-1 ring-border">
                <Checkbox
                  checked={rule.enabled}
                  onCheckedChange={checked => void updateRule(rule.id, { enabled: checked === true })}
                  aria-label={t(rule.enabled ? 'disableNamedRule' : 'enableNamedRule', { name: rule.name })}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{rule.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(FIELD_LABELS[rule.field])}
                    {' '}
                    {t(OPERATOR_LABELS[rule.operator])}
                    {' '}
                    “
                    {rule.value}
                    ”
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t('deleteNamedRule', { name: rule.name })}
                  title={t('deleteRule')}
                  onClick={() => void removeRule(rule.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
      </div>

      <div className="mt-4 grid gap-2 border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Input value={name} onChange={event => setName(event.target.value)} placeholder={t('ruleName')} aria-label={t('ruleName')} />
          <Input value={value} onChange={event => setValue(event.target.value)} placeholder={t('matchContent')} aria-label={t('matchContent')} />
          <select value={field} onChange={event => setField(event.target.value as AutoOrganizeField)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label={t('matchField')}>
            {AUTO_ORGANIZE_FIELDS.map(item => (
              <option key={item} value={item}>{t(FIELD_LABELS[item])}</option>
            ))}
          </select>
          <select value={operator} onChange={event => setOperator(event.target.value as AutoOrganizeOperator)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label={t('matchMethod')}>
            {AUTO_ORGANIZE_OPERATORS.map(item => (
              <option key={item} value={item}>{t(OPERATOR_LABELS[item])}</option>
            ))}
          </select>
          <select value={targetCategoryId} onChange={event => setTargetCategoryId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label={t('targetFolder')}>
            <option value="">{t('doNotMoveFolder')}</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.emoji}
                {' '}
                {categoryName(category)}
              </option>
            ))}
          </select>
          <Input value={tags} onChange={event => setTags(event.target.value)} placeholder={t('addTags')} aria-label={t('addTags')} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={clearInbox} onCheckedChange={checked => setClearInbox(checked === true)} />
          {t('removeFromInboxAfterMatch')}
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {message ? t(message.key, message.params) : null}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void applyRules()}>
              <Play className="mr-1.5 h-4 w-4" />
              {t('applyRules')}
            </Button>
            <Button type="button" size="sm" onClick={() => void createRule()} disabled={!value.trim()}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('addRule')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
