# Electric Blue theme

[简体中文](./theme-electric-blue.md) · English · [Back to README](../README.en.md)

Open **Settings › Appearance › Overall style › Electric Blue**.

The theme follows the reference image's pale gray background, electric blue primary text, pale purple secondary text, and monospace typography. It preserves the bookmark workspace layout, navigation, brand icon, and interaction flows.

## Visual specification

- The palette stays light, regardless of system or dark mode settings.
- The primary color is `240 100% 45.5%` (approximately `#0000E8`), the background is `0 0% 95%`, and secondary text is `246 33% 54%`. Secondary text must remain readable against page and control backgrounds.
- Use local system monospace fonts, falling back to local Chinese fonts for Chinese text. Do not load remote fonts or images for the theme.
- Headings and controls use font weight 400 and normal letter spacing. Selection backgrounds and borders stay subtle, avoiding heavy purple blocks.
- Bookmark, group, and folder cards have no persistent border. Hover uses a light background without lifting the card. Menus keep a light shadow; dialogs use small corner radii and a light backdrop.
- Retain the user's navigation position, cat decoration toggle, and card icon visibility preferences. Do not add the reference image's leaderboard content or winged logo.

## Maintenance constraints

Electric Blue is no longer the default; first installs use Clear Sky. Existing Electric Blue selections are retained. The Electric Blue preset uses its own `ELECTRIC_APPEARANCE_SETTINGS`, and Balanced and Blue Engraving keep a base configuration independent of the default preset.

Reuse existing color variables, overall style presets, and settings persistence. Disable accent color and background selection while the theme is active. These preferences must not override the fixed palette at runtime.

Types and normalized allowed values live in `src/lib/types.ts` and `src/lib/appearance.ts`. The palette uses `electricPalette`, and styles are scoped to `html.theme-electric`. Applying or leaving a theme must clean up `dark`, `theme-kami`, `theme-engraving`, and `theme-electric` together to avoid leftover styles. Appearance settings and hints must cover all supported languages.

## Verification

`e2e/electric-theme.spec.ts` covers selecting the theme in settings, persistence after reload, retained navigation position, system light/dark changes, protection against accent overrides, leaving the theme, group menus, and horizontal overflow in all seven languages at widths of 320 px and 1280 px. It also checks the Chinese and English settings interfaces for serious and critical axe violations.

After building as described in the [Development guide](./development.en.md), run `pnpm exec playwright test e2e/electric-theme.spec.ts` to verify the theme. Extension tests use temporary browser profiles and write screenshots to `/tmp/yunji-electric/`. See the development guide for pre-commit checks.

Browser profiles are reused across test files within the same worker. When theme tests finish, they remove only the bookmark folders and group records they created so other theme tests are unaffected.
