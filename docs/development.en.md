# Development guide

[简体中文](./development.md) · English · [Back to README](../README.en.md)

Yunji Tab is built with Plasmo. Chrome Manifest V3 is the main build and test target.

## Environment and installation

- Node.js 22 or later
- pnpm 10.34.4
- Chrome or Chromium

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Local development

```bash
pnpm dev
```

After the first run, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `build/chrome-mv3-dev/`. Plasmo watches source changes, rebuilds, and reloads the extension.

Use a separate browser test profile and sample bookmarks. The extension manages native bookmarks directly, so adding, moving, or deleting items in tests also changes the bookmarks in that browser profile.

## Build and package

```bash
pnpm build
pnpm package
```

`pnpm build` generates `build/chrome-mv3-prod/`. Load that folder to verify the production build. `pnpm package` generates a ZIP package. Extension attachments on GitHub Releases are named `yunji-tab-<version>-chrome.zip`; the automatically generated source archives cannot be loaded directly as extensions.

Chrome is the main verified target. Other Chromium browsers have no separate compatibility guarantee. Firefox and Safari do not currently have formal release or verification workflows.

## Verify changes

```bash
pnpm typecheck
pnpm lint
pnpm test

# Install Chromium before running end-to-end tests for the first time
pnpm exec playwright install chromium
pnpm test:e2e
```

End-to-end tests build and load the real extension. They cover bookmark management, groups, keyboard navigation, themes, settings resets, WebDAV backup and restore, AI classification, site icons, memory, and accessibility. Run the tests relevant to a feature change and complete the checks above before committing.

## Internationalization

The interface supports `zh-CN`, `zh-TW`, `en`, `ja`, `ko`, `es`, and `fr`. Runtime copy lives in `src/lib/i18n.ts` and `src/lib/i18n-*.ts`. Components use `useI18n()` to get `t` and the current `language`; `MessageKey` constrains message keys. The separate `locales/` directory contains browser extension metadata such as the name, description, and browser shortcut descriptions. It does not replace the runtime catalogs.

Add new user-visible copy in all seven languages, including errors, statuses, placeholders, confirmations, and `aria-label` values. Keep interpolation parameter names identical across languages, and format dates and numbers using the current interface language. Keep user-entered bookmark titles and folder names unchanged. WebDAV settings, sync history, encryption, and restore messages live in `src/lib/i18n-webdav.ts`.

Run the focused checks first, then complete the pre-commit checks under “Verify changes”:

```bash
pnpm exec vitest run src/lib/i18n.test.ts src/lib/i18n-hardcoded.test.ts
pnpm typecheck
```

Internationalization tests verify consistent interpolation parameters. An AST check prevents Chinese interface copy from being written directly into components and business logic. These checks do not replace translation review or interface verification. After changing longer copy, check wrapping, buttons, and dialogs on narrow screens.

## Implementation notes

Time and weather preferences live in the synced `headerWidget` settings field. `normalizeHeaderWidget` supplies defaults for legacy data, and the field participates in backups and General settings reset. Weather uses manually selected city coordinates; city search requests optional access to Open-Meteo's two domains. Results are cached locally for 15 minutes. Disabling or unmounting the widget clears timers and aborts pending weather requests. Tests are in `e2e/header-widget.spec.ts` and `src/lib/weather.test.ts`.

First installs and missing appearance settings use the complete Clear Sky preset (`DEFAULT_APPEARANCE_SETTINGS`); the Electric Blue preset uses `ELECTRIC_APPEARANCE_SETTINGS`. Balanced and Blue Engraving use the separate `BALANCED_APPEARANCE_SETTINGS` base so changing the default does not change those presets.

The home layout is stored in `appearance.homeLayout`. It is `centered` when no appearance settings exist and `workspace` when saved appearance settings lack the field, so updating does not change an existing user's home page. Like the category bar position, it is reset by General and kept by an Appearance reset. Visual rules are in [DESIGN.md](../DESIGN.md).

Production builds use the root `.parcelrc` to extract common dependencies with Parcel's default bundler while retaining the other Plasmo build plugins. Its configuration paths depend on pnpm's current default `node_modules/.pnpm/node_modules` layout. After upgrading Plasmo or Parcel, or changing `node-linker`, verify all extension entry points and shared resources again. Using a file path for `extends` triggers a Plasmo configuration notice but still inherits its full configuration.

Before a release, complete the checks under "Verify changes" locally, then run `pnpm package` to create the installation package and upload it to GitHub Release.

WebDAV connection configuration and automatic check status use separate local storage, outside synced settings and snapshots. Automatic backup checks run asynchronously after successful startup, without blocking the first render or uploading when initialization fails. All pages share one Web Lock for saving, clearing, folder queries, reads, and uploads. Configuration and intervals are read again after acquiring the lock. Fingerprints ignore both `exportedAt` fields and stabilize object key order while retaining native tree and array order. Each backup makes one PUT of a JSON file with a UTC millisecond timestamp and UUID, using `If-None-Match: *` to prevent overwrites. Checkpoints update only on success. Failures keep the last successful time and fingerprint and limit automatic retries. Manual backups bypass the interval and content deduplication. Changing the destination or credentials clears the checkpoint.

The optional `encryptionPassphrase` is stored only in local storage with the WebDAV configuration. It defaults to an empty string and does not reuse the browser sync passphrase. When set, it reuses PBKDF2-SHA-256 (150,000 iterations) and AES-256-GCM from `metadata-crypto.ts`, with a fresh random salt and IV, to encrypt the full snapshot. The outer file contains `kind: yunji-tab-encrypted-full-snapshot`, `schemaVersion: 1`, and a `payload` encryption envelope. File naming stays the same. Fingerprints use the plaintext snapshot so random ciphertext does not affect deduplication. Enabling, changing, or clearing the passphrase clears the checkpoint so the next automatic run uploads a new backup. Reads support both plain and encrypted files. They validate the envelope version, salt and IV lengths, and KDF iteration range (100,000 to 1,000,000) before decryption, then validate the decrypted full snapshot. A missing or incorrect passphrase prompts for the original passphrase temporarily, without changing saved configuration or bypassing preview confirmation.

History uses PROPFIND with Depth 1, parsing DAV-namespaced 207 XML and reading properties only from successful `propstat` elements. It filters out directories, other origins, paths outside the configured folder, invalid filenames, and duplicate `href` values. Timestamped files are sorted by their filename's UTC time; legacy fixed-name and UUID files use `getlastmodified`. Files without a time sort last. The interface displays records in batches and supports manual refresh. The list stays in memory, with no local persistence, separate uploaded index, or automatic remote deletion. Loading configuration clears obsolete local history. Restore checks the selected file's folder and account inside the lock, sends an If-Match conditional request when a strong ETag is available, validates the full snapshot, and reuses import preview and confirmation. Clearing the connection removes only local configuration and check status. WebDAV browser tests use simulated protocol responses at an already authorized address. They cover the real extension flow and folder parsing without connecting to a real cloud account.

`restoreFullBackup` handles full snapshot restore: it imports the native tree into a new folder, takes supplementary data and usage records for matching URLs from the snapshot, restores groups by ID with the `replace` strategy (replacing matching groups and keeping other existing groups), and replaces app settings. Restored data continues to participate in normal browser and extension sync. WebDAV encryption wraps uploaded content only; `exportBackup` and `exportFullBackup` still export local plaintext JSON.

Bookmarks and categories use immutable object snapshots. Updating one item retains object references for the others, and full native refreshes also reuse unchanged objects. Search indexes are reused by bookmark object and category path. Renaming or moving a category invalidates affected paths. Regular view sorting does not depend on open counts, and changes to open counts do not recompute search scoring. Native title events prefer local updates; unknown nodes, URL changes, and structural changes still trigger a full refresh. If a title event arrives during a refresh, the old tree snapshot is discarded and read again.

Groups render in batches of 50 by default, both in the regular group view and when mixed with pinned bookmarks. Navigation counts and search match counts still include the full list. Search or view mode changes reset the batch. Group drag positions use indexes in the complete sorted list. The group load-more button has its own accessible name so it can be distinguished from regular bookmark pagination.

Asynchronous loading on the groups page uses a grid loading state instead of a dialog overlay. Group member lists must avoid the card action buttons whether they expand upward or downward. Hover expansion waits 100 ms. Pointer movement within the card updates positioning without restarting the delay; leaving allows a 200 ms closing buffer.

Buttons in group member menus must fill the area inside the border, with text spacing inside each button. Containers must not leave unclickable padding, and buttons must not shrink when pressed, so edge clicks still work.

## Code layout

```text
src/
├── newtab.tsx                 # New tab entry point
├── popup.tsx                  # Toolbar popup
├── background.ts              # Background events, shortcuts, and messages
├── tabs/
│   └── global-command-palette.tsx
├── components/                # Bookmarks, folders, search, and dialogs
│   ├── bookmark-grid/         # Bookmark grid components and hooks
│   ├── settings/              # Settings tabs
│   └── ui/                    # Shared UI components
└── lib/                       # Bookmarks, search, backup, sync, and state

e2e/                           # Playwright end-to-end tests
locales/                       # Browser extension metadata translations
assets/                        # Brand icons and decorative assets
docs/                          # Screenshots, development, and privacy docs
```

## Technology stack

- Plasmo: extension builds and development tools
- React 19 and TypeScript: interface and type checking
- Tailwind CSS, shadcn/ui, and Radix UI: styling and interface components
- Zustand and @plasmohq/storage: state and browser storage
- dnd-kit: drag-and-drop interactions
- Vitest, Playwright, and axe-core: unit, end-to-end, and accessibility tests

## Relationship with browser bookmarks

The extension directly modifies the native bookmark tree and listens for creation, modification, movement, deletion, and ordering changes. Changes made in the browser bookmark manager or on another device update the home page through events.

| Action | Browser API |
| ------ | ----------- |
| Add a bookmark or folder | `chrome.bookmarks.create` |
| Edit a name or URL | `chrome.bookmarks.update` |
| Move a bookmark or folder | `chrome.bookmarks.move` |
| Delete a bookmark | `chrome.bookmarks.remove` |
| Delete a folder | `chrome.bookmarks.removeTree` |

The extension stores supplementary fields such as descriptions, tags, icons, and alternate URLs. See [Privacy and permissions](./privacy.en.md) for storage and sync boundaries.

## Update documentation and screenshots

When changing a user-visible feature, update the README instructions and all seven product descriptions in `description.md`. Keep the Chinese and English README, development guide, privacy document, and Electric Blue theme document in sync. Update privacy documentation for data, network request, or permission changes, and the development guide for new configuration, storage, or testing constraints. Theme-specific guidance is in [Electric Blue](./theme-electric-blue.en.md) and the [theme asset documentation](../assets/themes/README.md). Store screenshots in `docs/images/`. Use test data and public sites so real users' bookmarks, accounts, and credentials are not exposed.

Current screenshots come from the actual extension interface and cover the home page, search, groups, bookmark editing, bulk management, Blue Engraving, and backup settings. See the [theme asset documentation](../assets/themes/README.md) for Blue Engraving assets.
