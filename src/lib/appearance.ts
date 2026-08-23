import type {
  AccentColor,
  AppearanceSettings,
  AppearanceSize,
  BackgroundStyle,
  CardFieldSettings,
  CardStyle,
  ColorTheme,
  ContentWidth,
  DescriptionLineCount,
  GridDensity,
  NavItemSettings,
  NavLayout,
  TitleLineCount,
} from './types'

const NAV_LAYOUTS: NavLayout[] = ['sidebar', 'top']
const CONTENT_WIDTHS: ContentWidth[] = ['standard', 'wide', 'full']
const GRID_DENSITIES: GridDensity[] = ['comfortable', 'dense']
const CARD_STYLES: CardStyle[] = ['soft', 'outline', 'plain']
const SIZES: AppearanceSize[] = ['sm', 'md', 'lg']
const ACCENT_COLORS: AccentColor[] = [
  'neutral',
  'blue',
  'green',
  'orange',
  'rose',
]
const COLOR_THEMES: ColorTheme[] = [
  'default',
  'graphite',
  'meadow',
  'dawn',
  'berry',
  'kami',
]
const BACKGROUND_STYLES: BackgroundStyle[] = ['flat', 'subtle', 'panel']

export const DEFAULT_CARD_FIELDS: CardFieldSettings = {
  description: true,
  tags: true,
  categoryPath: true,
  categoryCards: true,
  actions: 'hover',
  titleLines: 1,
  descriptionLines: 2,
  maxVisibleTags: 3,
}

export const DEFAULT_NAV_ITEMS: NavItemSettings = {
  counts: true,
  smartCategories: true,
  savedSearches: false,
  categoryTree: true,
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  navLayout: 'sidebar',
  catDecorations: false,
  contentWidth: 'wide',
  gridDensity: 'comfortable',
  cardStyle: 'soft',
  iconSize: 'md',
  radius: 'lg',
  accentColor: 'neutral',
  colorTheme: 'default',
  backgroundStyle: 'flat',
  navItems: DEFAULT_NAV_ITEMS,
  cardFields: DEFAULT_CARD_FIELDS,
}

export const contentWidthClass: Record<ContentWidth, string> = {
  standard: 'mx-auto max-w-[1200px]',
  wide: 'mx-auto max-w-[1440px]',
  full: 'w-full',
}

export const gridClassByMode: Record<
  GridDensity,
  { grid: string, compact: string }
> = {
  comfortable: {
    grid: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
    compact: 'grid grid-cols-1 gap-2.5 xl:grid-cols-2',
  },
  dense: {
    grid: 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5',
    compact: 'grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3',
  },
}

export const cardStyleClass: Record<CardStyle, string> = {
  soft: 'border border-border/65 bg-card/95 shadow-[0_1px_3px_0_hsl(var(--foreground)/0.03)] hover:border-border hover:shadow-[0_10px_28px_-6px_hsl(var(--foreground)/0.08)] hover:-translate-y-0.5 transition-all duration-200',
  outline: 'border border-border/80 bg-card hover:border-foreground/20 hover:bg-accent/30 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200',
  plain: 'bg-card hover:bg-accent/40 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200',
}

export const backgroundStyleClass: Record<BackgroundStyle, string> = {
  flat: 'bg-background',
  subtle:
    'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--accent)/0.6),hsl(var(--background)))]',
  panel: 'bg-muted/30',
}

export const radiusClass: Record<AppearanceSize, string> = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
}

export const iconSizeClass: Record<
  AppearanceSize,
  { compact: string, grid: string, imageCompact: string, imageGrid: string }
> = {
  sm: {
    compact: 'size-8 rounded-md text-2xl',
    grid: 'size-11 rounded-lg text-2xl',
    imageCompact: 'h-5 w-5',
    imageGrid: 'size-7',
  },
  md: {
    compact: 'size-10 rounded-lg text-3xl',
    grid: 'size-12 rounded-xl text-3xl',
    imageCompact: 'size-6',
    imageGrid: 'size-8',
  },
  lg: {
    compact: 'size-11 rounded-xl text-3xl',
    grid: 'size-14 rounded-xl text-4xl',
    imageCompact: 'size-7',
    imageGrid: 'size-9',
  },
}

export const titleLineClass: Record<TitleLineCount, string> = {
  1: 'truncate',
  2: 'line-clamp-2',
}

export const descriptionLineClass: Record<DescriptionLineCount, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
}

export const accentColorVars: Record<AccentColor, Record<string, string>> = {
  neutral: {
    '--primary': '0 0% 9%',
    '--primary-foreground': '0 0% 98%',
    '--ring': '0 0% 3.9%',
  },
  blue: {
    '--primary': '217 91% 52%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '217 91% 52%',
  },
  green: {
    '--primary': '160 84% 32%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '160 84% 32%',
  },
  orange: {
    '--primary': '24 95% 47%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '24 95% 47%',
  },
  rose: {
    '--primary': '346 77% 49%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '346 77% 49%',
  },
}

export const colorThemeVars: Record<
  Exclude<ColorTheme, 'default'>,
  {
    light: Record<string, string>
    dark: Record<string, string>
  }
> = {
  graphite: {
    light: {
      '--background': '210 20% 98%',
      '--foreground': '220 15% 8%',
      '--card': '0 0% 100%',
      '--card-foreground': '220 15% 8%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '220 15% 8%',
      '--primary': '220 13% 18%',
      '--primary-foreground': '0 0% 98%',
      '--secondary': '210 16% 93%',
      '--secondary-foreground': '220 13% 18%',
      '--muted': '210 16% 93%',
      '--muted-foreground': '215 12% 34%',
      '--accent': '210 16% 92%',
      '--accent-foreground': '220 13% 18%',
      '--border': '214 14% 86%',
      '--input': '214 14% 86%',
      '--ring': '220 13% 18%',
    },
    dark: {
      '--background': '220 15% 7%',
      '--foreground': '210 20% 96%',
      '--card': '220 14% 9%',
      '--card-foreground': '210 20% 96%',
      '--popover': '220 14% 9%',
      '--popover-foreground': '210 20% 96%',
      '--primary': '210 20% 92%',
      '--primary-foreground': '220 15% 8%',
      '--secondary': '220 13% 14%',
      '--secondary-foreground': '210 20% 96%',
      '--muted': '220 13% 14%',
      '--muted-foreground': '215 13% 68%',
      '--accent': '220 13% 16%',
      '--accent-foreground': '210 20% 96%',
      '--border': '220 13% 18%',
      '--input': '220 13% 18%',
      '--ring': '210 20% 92%',
    },
  },
  meadow: {
    light: {
      '--background': '84 31% 97%',
      '--foreground': '165 24% 10%',
      '--card': '60 33% 99%',
      '--card-foreground': '165 24% 10%',
      '--popover': '60 33% 99%',
      '--popover-foreground': '165 24% 10%',
      '--primary': '158 59% 30%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '92 28% 91%',
      '--secondary-foreground': '158 36% 18%',
      '--muted': '94 24% 91%',
      '--muted-foreground': '156 16% 32%',
      '--accent': '142 31% 88%',
      '--accent-foreground': '158 36% 18%',
      '--border': '104 20% 82%',
      '--input': '104 20% 82%',
      '--ring': '158 59% 30%',
    },
    dark: {
      '--background': '164 28% 7%',
      '--foreground': '88 33% 94%',
      '--card': '160 25% 9%',
      '--card-foreground': '88 33% 94%',
      '--popover': '160 25% 9%',
      '--popover-foreground': '88 33% 94%',
      '--primary': '145 48% 63%',
      '--primary-foreground': '164 28% 7%',
      '--secondary': '158 23% 14%',
      '--secondary-foreground': '88 33% 94%',
      '--muted': '158 23% 14%',
      '--muted-foreground': '92 18% 68%',
      '--accent': '150 24% 17%',
      '--accent-foreground': '88 33% 94%',
      '--border': '156 19% 20%',
      '--input': '156 19% 20%',
      '--ring': '145 48% 63%',
    },
  },
  dawn: {
    light: {
      '--background': '42 38% 97%',
      '--foreground': '230 18% 12%',
      '--card': '0 0% 100%',
      '--card-foreground': '230 18% 12%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '230 18% 12%',
      '--primary': '24 88% 45%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '38 34% 91%',
      '--secondary-foreground': '230 18% 12%',
      '--muted': '36 31% 91%',
      '--muted-foreground': '230 10% 35%',
      '--accent': '21 52% 90%',
      '--accent-foreground': '24 54% 24%',
      '--border': '34 24% 82%',
      '--input': '34 24% 82%',
      '--ring': '24 88% 45%',
    },
    dark: {
      '--background': '235 18% 8%',
      '--foreground': '38 38% 94%',
      '--card': '235 16% 10%',
      '--card-foreground': '38 38% 94%',
      '--popover': '235 16% 10%',
      '--popover-foreground': '38 38% 94%',
      '--primary': '28 92% 62%',
      '--primary-foreground': '235 18% 8%',
      '--secondary': '235 14% 15%',
      '--secondary-foreground': '38 38% 94%',
      '--muted': '235 14% 15%',
      '--muted-foreground': '36 18% 70%',
      '--accent': '22 26% 18%',
      '--accent-foreground': '38 38% 94%',
      '--border': '235 12% 21%',
      '--input': '235 12% 21%',
      '--ring': '28 92% 62%',
    },
  },
  berry: {
    light: {
      '--background': '336 32% 98%',
      '--foreground': '225 18% 11%',
      '--card': '0 0% 100%',
      '--card-foreground': '225 18% 11%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '225 18% 11%',
      '--primary': '346 72% 45%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '334 28% 92%',
      '--secondary-foreground': '225 18% 11%',
      '--muted': '334 24% 92%',
      '--muted-foreground': '225 10% 36%',
      '--accent': '346 38% 91%',
      '--accent-foreground': '341 55% 24%',
      '--border': '334 20% 84%',
      '--input': '334 20% 84%',
      '--ring': '346 72% 45%',
    },
    dark: {
      '--background': '230 18% 8%',
      '--foreground': '334 32% 94%',
      '--card': '230 16% 10%',
      '--card-foreground': '334 32% 94%',
      '--popover': '230 16% 10%',
      '--popover-foreground': '334 32% 94%',
      '--primary': '346 78% 66%',
      '--primary-foreground': '230 18% 8%',
      '--secondary': '232 14% 15%',
      '--secondary-foreground': '334 32% 94%',
      '--muted': '232 14% 15%',
      '--muted-foreground': '333 16% 70%',
      '--accent': '334 24% 18%',
      '--accent-foreground': '334 32% 94%',
      '--border': '232 12% 21%',
      '--input': '232 12% 21%',
      '--ring': '346 78% 66%',
    },
  },
  kami: {
    light: {
      '--background': '52 29% 95%',
      '--foreground': '214 55% 24%',
      '--card': '48 33% 98%',
      '--card-foreground': '214 55% 24%',
      '--popover': '48 33% 98%',
      '--popover-foreground': '214 55% 24%',
      '--primary': '214 55% 24%',
      '--primary-foreground': '48 33% 98%',
      '--secondary': '44 24% 90%',
      '--secondary-foreground': '214 42% 22%',
      '--muted': '44 21% 89%',
      '--muted-foreground': '39 11% 40%',
      '--accent': '43 31% 88%',
      '--accent-foreground': '214 55% 24%',
      '--border': '42 18% 80%',
      '--input': '42 18% 80%',
      '--ring': '214 55% 24%',
    },
    dark: {
      '--background': '220 28% 8%',
      '--foreground': '48 31% 92%',
      '--card': '220 24% 10%',
      '--card-foreground': '48 31% 92%',
      '--popover': '220 24% 10%',
      '--popover-foreground': '48 31% 92%',
      '--primary': '213 42% 72%',
      '--primary-foreground': '220 28% 8%',
      '--secondary': '218 20% 16%',
      '--secondary-foreground': '48 31% 92%',
      '--muted': '218 20% 16%',
      '--muted-foreground': '42 15% 70%',
      '--accent': '214 26% 20%',
      '--accent-foreground': '48 31% 92%',
      '--border': '218 18% 22%',
      '--input': '218 18% 22%',
      '--ring': '213 42% 72%',
    },
  },
}

export const colorThemeVariableNames = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--ring',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pick<T extends string>(value: unknown, options: T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

export function normalizeAppearanceSettings(
  value?: Partial<Omit<AppearanceSettings, 'cardFields' | 'navItems'>> & {
    cardFields?: Partial<CardFieldSettings>
    navItems?: Partial<NavItemSettings>
  },
): AppearanceSettings {
  const cardFields = isRecord(value?.cardFields) ? value.cardFields : {}
  const navItems = isRecord(value?.navItems) ? value.navItems : {}
  const titleLines
    = cardFields.titleLines === 2 ? 2 : DEFAULT_CARD_FIELDS.titleLines
  const descriptionLines
    = cardFields.descriptionLines === 1
      || cardFields.descriptionLines === 2
      || cardFields.descriptionLines === 3
      ? cardFields.descriptionLines
      : DEFAULT_CARD_FIELDS.descriptionLines
  const maxVisibleTags
    = typeof cardFields.maxVisibleTags === 'number'
      ? Math.max(0, Math.min(5, Math.floor(cardFields.maxVisibleTags)))
      : DEFAULT_CARD_FIELDS.maxVisibleTags

  return {
    navLayout: pick(
      value?.navLayout,
      NAV_LAYOUTS,
      DEFAULT_APPEARANCE_SETTINGS.navLayout,
    ),
    catDecorations:
      typeof value?.catDecorations === 'boolean'
        ? value.catDecorations
        : DEFAULT_APPEARANCE_SETTINGS.catDecorations,
    contentWidth: pick(
      value?.contentWidth,
      CONTENT_WIDTHS,
      DEFAULT_APPEARANCE_SETTINGS.contentWidth,
    ),
    gridDensity: pick(
      value?.gridDensity,
      GRID_DENSITIES,
      DEFAULT_APPEARANCE_SETTINGS.gridDensity,
    ),
    cardStyle: pick(
      value?.cardStyle,
      CARD_STYLES,
      DEFAULT_APPEARANCE_SETTINGS.cardStyle,
    ),
    iconSize: pick(
      value?.iconSize,
      SIZES,
      DEFAULT_APPEARANCE_SETTINGS.iconSize,
    ),
    radius: pick(value?.radius, SIZES, DEFAULT_APPEARANCE_SETTINGS.radius),
    accentColor: pick(
      value?.accentColor,
      ACCENT_COLORS,
      DEFAULT_APPEARANCE_SETTINGS.accentColor,
    ),
    colorTheme: pick(
      value?.colorTheme,
      COLOR_THEMES,
      DEFAULT_APPEARANCE_SETTINGS.colorTheme,
    ),
    backgroundStyle: pick(
      value?.backgroundStyle,
      BACKGROUND_STYLES,
      DEFAULT_APPEARANCE_SETTINGS.backgroundStyle,
    ),
    navItems: {
      counts:
        typeof navItems.counts === 'boolean'
          ? navItems.counts
          : DEFAULT_NAV_ITEMS.counts,
      smartCategories:
        typeof navItems.smartCategories === 'boolean'
          ? navItems.smartCategories
          : DEFAULT_NAV_ITEMS.smartCategories,
      savedSearches:
        typeof navItems.savedSearches === 'boolean'
          ? navItems.savedSearches
          : DEFAULT_NAV_ITEMS.savedSearches,
      categoryTree:
        typeof navItems.categoryTree === 'boolean'
          ? navItems.categoryTree
          : DEFAULT_NAV_ITEMS.categoryTree,
    },
    cardFields: {
      description:
        typeof cardFields.description === 'boolean'
          ? cardFields.description
          : DEFAULT_CARD_FIELDS.description,
      tags:
        typeof cardFields.tags === 'boolean'
          ? cardFields.tags
          : DEFAULT_CARD_FIELDS.tags,
      categoryPath:
        typeof cardFields.categoryPath === 'boolean'
          ? cardFields.categoryPath
          : DEFAULT_CARD_FIELDS.categoryPath,
      categoryCards:
        typeof cardFields.categoryCards === 'boolean'
          ? cardFields.categoryCards
          : DEFAULT_CARD_FIELDS.categoryCards,
      actions: cardFields.actions === 'always' ? 'always' : 'hover',
      titleLines,
      descriptionLines,
      maxVisibleTags,
    },
  }
}
