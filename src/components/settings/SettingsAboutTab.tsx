import { AtSign, Code2, ExternalLink } from 'lucide-react'
import logoUrl from 'url:~assets/brand-mark.png'
import { useI18n } from '~/lib/use-i18n'

const links = [
  {
    href: 'https://github.com/kiwiflydream/yunji-tab',
    labelKey: 'projectRepository' as const,
    value: 'github.com/kiwiflydream/yunji-tab',
    Icon: Code2,
  },
  {
    href: 'https://x.com/kiwiflysky',
    labelKey: 'followKiwi' as const,
    value: '@kiwiflysky',
    Icon: AtSign,
  },
]

export function SettingsAboutTab() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-5">
      <section className="surface-panel flex flex-col items-center px-6 py-8 text-center">
        <img src={logoUrl} alt="" className="size-20" />
        <h2 className="mt-4 text-xl font-semibold">{t('brandName')}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {t('aboutDescription')}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, labelKey, value, Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="surface-panel flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t(labelKey)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {value}
              </span>
            </span>
            <ExternalLink
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </div>
  )
}
