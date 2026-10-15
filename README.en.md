<p align="center">
  <img src="./assets/brand-mark.png" width="96" alt="Yunji Tab logo">
</p>

# Yunji Tab · 云吉 Tab

[简体中文](./README.md) · English

**Put the sites you have saved to work, every time you open a new tab.**

Yunji Tab is a free, open-source Chrome extension that turns native browser bookmarks into a searchable, organized home page. Keep daily tools within reach, collect pages in an inbox for later, and work through older bookmarks with rules, optional AI classification, and link checks.

It works directly with your existing bookmarks and folders, with no migration or extra account. Adding, editing, moving, or deleting a bookmark in Yunji Tab also changes it in the browser's bookmark manager.

[Chrome Web Store](https://chromewebstore.google.com/detail/mongacbicmimajjfljaaelfcchhkepbh) · [Download the latest release](https://github.com/kiwiflydream/yunji-tab/releases/latest) · [Release notes](https://github.com/kiwiflydream/yunji-tab/releases) · [Report an issue](https://github.com/kiwiflydream/yunji-tab/issues)

![Centered Clear Sky home: time, weather, search, pinned bookmarks and groups, with the bookmark collection below](./docs/images/yunji-tab-overview.png)

Screenshots show the current extension with public sample bookmarks and demo city and weather settings. They use the Chinese interface; English is available in settings.

[Install and get started](#install-and-get-started) · [Find and open](#find-and-open) · [Save and organize](#save-and-organize) · [Home and appearance](#home-and-appearance) · [Sync and backup](#sync-and-backup) · [Development and contributions](#development-and-contributions)

## Features at a glance

| What you want to do | What Yunji Tab provides |
| --- | --- |
| Reach daily tools from a new tab | Centered and Workspace layouts, pinned bookmarks and groups, time and weather |
| Find something you saved | Search names, URLs, descriptions, tags, and folder paths; fuzzy matching, Chinese Pinyin initials, and saved filters |
| Search your collection or the web | Bookmark and web modes, browser default search, keyword shortcuts, and custom engines |
| Keep related sites together | Groups, member aliases, custom icons, hover menus, and drag ordering |
| Save now and organize later | Toolbar popup, context menu, browser shortcut, and one-by-one inbox triage |
| Manage many bookmarks | Bulk move, open, delete, and description completion; drag bookmarks and folders |
| Add context to a bookmark | Descriptions, tags, emoji or image icons, and automatic selection between alternate URLs |
| Reduce repetitive sorting | Rules for names, domains, URLs, descriptions, and tags; optional AI classification previews |
| Maintain an older collection | Duplicate, broken, and redirected link checks; undo, 30-day trash, and sync recovery points |
| Set aside the pages for a task | Saved tab sessions, selective restore, and opening in a new window |
| Make the page your own | Eight styles, light and dark modes, navigation placement, card fields and density, shortcuts, and seven languages |
| Move between devices or keep backups | Browser sync, JSON import and export, full snapshots, and optionally encrypted WebDAV backups |

## Install and get started

Download a Chrome package from [GitHub Releases](https://github.com/kiwiflydream/yunji-tab/releases/latest):

1. Download `yunji-tab-<version>-chrome.zip`. The automatically generated `Source code` archives contain source files, not an installable extension.
2. Extract the ZIP and make sure the folder contains `manifest.json`.
3. Open `chrome://extensions` in Chrome and enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked** and select the extracted folder.
5. Open a new tab. Your existing browser bookmarks appear automatically.

To upgrade, replace the contents of the original installation folder with the new version, then click Reload on the extensions page. Keep that folder; there is no need to uninstall.

Start by pinning a few daily sites, clicking the time and weather widget to choose a city, and opening **More actions › Settings** in the upper-right corner to choose a layout, style, and default folder. All settings paths below start from that menu.

Chrome is the main supported browser. Edge, Brave, and Opera can try the same package, but compatibility has not been verified individually. Firefox and Safari do not currently have official packages.

## Find and open

### Search bookmarks, folders, and the web

Bookmark search covers names, URLs, descriptions, tags, and folder paths, with fuzzy matching and Chinese Pinyin initials. If you cannot remember the exact title, try the domain, purpose, or folder instead.

| Example | Find |
| --- | --- |
| `github` | Bookmarks or folders related to GitHub |
| `tag:AI` | Bookmarks tagged AI |
| `site:github.com` | Saved pages on GitHub |
| `folder:Development` | Content under a matching folder path |
| `tag:development site:github.com` | Bookmarks matching both the tag and the site |

![Tag search finds AI bookmarks across folders](./docs/images/bookmark-search.png)

Save recurring queries as filters: enable **Saved filters** under **Settings › General › Navigation & categories**, run a search, and click **Saved filters** above the results. Reopen saved queries from the category bar, or remove them in **Settings › Search**.

Switch to **Web** to enter a URL or send keywords to the browser's default search engine. Built-in engines include Google, Bing, DuckDuckGo, and GitHub, with `g`, `b`, `ddg`, and `gh` keyword shortcuts, such as `gh react`. Add custom engines, keywords, and search URL templates containing `%s` under **Settings › Search**.

### Run actions from the command palette

Press `Cmd/Ctrl + K` on the home page to find bookmarks and folders or run actions such as adding a bookmark, clearing search, checking links, and switching between light and dark themes. Use arrow keys to select, `Enter` to run, and `Esc` to close.

<p align="center">
  <img src="./docs/images/command-palette.png" width="640" alt="Command palette for bookmarks, folders, and actions">
</p>

You can also open a **global command palette** on regular web pages to find bookmarks, save the current page, or return home. It is off by default: enable it in **Settings › Keyboard shortcuts**, then assign its browser shortcut at `chrome://extensions/shortcuts`. Restricted pages, including browser internal pages, cannot host the palette and fall back to Yunji Tab's home page.

### Group the tools for a task

Put ChatGPT, Claude, and Perplexity in an “AI workspace,” or group a project repository, documentation, and design tools. Open **Bookmark groups › Create bookmark group**, choose existing bookmarks, and add a title and description. Members can have their own names and order within the group; the group can use an emoji or image icon.

![Hover or click a group to open its member list on the current page](./docs/images/bookmark-groups.png)

Hover or click to reveal members, then choose one to open. The default group graphic stacks member site icons like a hand of cards. Drag groups to reorder them, or pin them alongside regular bookmarks so they also appear in the centered home shortcuts.

Groups leave their members in their original folders. Deleting a group does not delete the bookmarks. Groups are enabled by default; turn them off under **Settings › General › Bookmark groups** while keeping the configuration.

## Save and organize

### Save a page now, file it later

Click the extension toolbar icon while browsing to save the current page, edit its title, choose a folder, and add tags. You can also use the page context menu or the quick-save browser shortcut. Already-saved URLs show a duplicate notice.

Quick-saved bookmarks appear under **Smart categories › Inbox** so you can organize them later. Choose **Organize one by one**, pick a destination folder, add tags, and select **Complete and continue**. Skip items you are not ready to file, or mark selected items as **Finish organizing** in bulk management.

<p align="center">
  <img src="./docs/images/inbox-triage.png" width="580" alt="Inbox triage: choose a folder, add tags, complete, or skip">
</p>

### Browse folders, smart categories, and bulk actions

The folder tree follows your browser's hierarchy. Expand and collapse folders, create, rename, move, or delete them, and assign folder icons. Drag bookmarks to reorder them or move them between folders; folders can also be reordered or moved within the hierarchy.

Six smart categories cover Inbox, Pinned, Frequent, Recent, Untagged, and No description. Frequent and Recent use visits made through Yunji Tab. Untagged and No description help you find bookmarks that need more context.

The **Organize** menu above the list switches between native order, name, recently added, and frequency. It also opens **Bulk manage** to move, open, or delete several bookmarks, with description completion under **More**. Switch between card and compact views at any time.

![Bulk management: move, open, delete, or complete descriptions for selected bookmarks](./docs/images/bookmark-bulk-actions.png)

### Descriptions, tags, icons, and alternate URLs

Use a bookmark card's **More actions › Edit bookmark** to change its name, URL, and folder. **More options** contains descriptions, tags, custom icons, and alternate URLs. Icons accept emoji or image URLs. You can also fetch website information when adding or editing a bookmark.

<p align="center">
  <img src="./docs/images/bookmark-editor.png" width="400" alt="A NAS bookmark with a description, tags, an emoji icon, and a local-network alternate URL">
</p>

Keep one bookmark when a service has multiple addresses. For example, use `https://nas.example.com/` as the primary URL and `http://nas.home.arpa/` as an alternate. On opening, Yunji Tab probes all addresses and selects the first to respond. The public address works away from home; local and VPN addresses participate when reachable. Put each alternate on its own line. If every probe fails, the primary URL opens.

**Settings › Content** fills in missing website descriptions in bulk. Maintain an ignored-domain list to skip sites you do not want accessed. This reads website information and does not require AI.

### Apply rules or ask AI for a classification proposal

**Rules suit repeatable filing habits.** Under **Settings › General › Advanced: Auto-organize rules**, match a title, URL, domain, description, or tag using contains, equals, or starts with. Choose a destination folder, append tags, and optionally remove matches from the inbox. For example, file `github.com` bookmarks in a development folder and add an “open source” tag. Review the match count and click **Apply rules** to run them. Rules do not run continuously in the background.

**AI helps sort a collection that is harder to classify.** Connect your own OpenAI-compatible service in **Settings › AI** with a Base URL, token, and model. Fetch available models, verify the connection, customize the classification prompt, and adjust batch size.

1. Generate a classification preview. You can pause, resume, or terminate analysis.
2. Review the source and destination folders and deselect unwanted suggestions.
3. Confirm the selected moves to change folders. The most recent AI classification can be undone within 24 hours.

Generating a preview does not modify bookmarks, and closing settings keeps completed results. AI receives titles, URLs with query parameters removed, descriptions, tags, and folder paths. Tokens are excluded from sync and backups, and can be kept only for the current browser session. AI is optional; ordinary bookmarking and organization work without it.

### Check links, undo changes, and recover history

Open **More actions › Bookmark health check** to find duplicate, unavailable, and redirected links. Filter results by issue, choose which duplicate to keep and merge the others, update a redirected address, or delete a bookmark you no longer need. A network error can differ from a permanently broken link, so review the results; scans do not delete bookmarks automatically.

Bookmarks and folders deleted through Yunji Tab can be undone immediately or restored within 30 days from **More actions › Trash & history**. That view also includes recent actions and recovery points saved before remote sync overwrites local supplementary data.

When tasks are running or have failed, **More actions** shows the **Task center** entry for sync, description fetching, checks, and restore status.

### Save a set of open tabs

When a task leaves many pages open, save the current window under **More actions › Tab sessions**. Exclude pinned tabs, update an existing session from the current window, restore selected pages, or open them in a new window. Pages reopen in their saved order.

Save up to 50 sessions, each with up to 100 deduplicated HTTP/HTTPS pages. Sessions stay in the current browser and are excluded from cross-device sync and full snapshot backups.

## Home and appearance

### Centered home and Workspace

First installs start with Clear Sky and the Centered layout: date, weather, a large clock, search, and pinned shortcuts in the middle of the page. The shortcut row includes bookmarks and groups, up to ten entries in total; hovering over a group reveals its members. Turn off both time and weather to collapse their area and keep search and shortcuts.

For more room to browse and manage bookmarks, switch to Workspace, which keeps search and the time and weather in the header.

![Workspace layout keeps search and time and weather in the header](./docs/images/workspace-layout.png)

Switch from **More actions** or **Settings › General › Home layout**, with a smooth transition between layouts. Older appearance settings without a layout choice keep Workspace; an explicit layout choice is retained. In Centered layout, scrolling search under the header temporarily moves search and the time and weather into the header.

General settings also control the default folder, left or top navigation, smart categories and counts, and whether to reuse a single home tab.

### Eight styles and detailed customization

**Settings › Appearance** offers **Clear Sky, Minimal, Balanced, Compact, Soft, Paper & Ink, Blue Engraving, and Electric Blue**. Most styles support light, dark, or system mode; Paper & Ink and Electric Blue are fixed to light, and Blue Engraving to dark. Advanced customization controls content width, grid density, card style, corners, icon size, and visible fields.

![Appearance settings with overall styles, theme modes, and advanced customization](./docs/images/appearance-settings.png)

Control descriptions, tags, folder paths, title and description line counts, visible tag limits, and when action buttons appear. **Card icons** affects bookmarks, folders, and groups together; **Menu icons** controls category navigation icons. These choices persist across reloads and theme changes.

Blue Engraving combines deep blue and warm cream, serif type, print grain, and an original astronaut cat illustration. The illustration stays at the bottom of the viewport while bookmarks scroll.

![Blue Engraving with deep blue, cream text, and an astronaut cat illustration](./docs/images/engraving-theme.png)

Electric Blue uses pale gray, electric blue text, and local monospace fonts, with a fixed light palette. Accent and background selection are disabled; navigation placement and icon preferences are retained. See the [Electric Blue theme guide](./docs/theme-electric-blue.en.md).

General and Appearance each offer a reset for their own settings, keeping bookmarks, groups, and auto-organize rules. Resetting General restores the browser language. Interface animations respect the system's reduced-motion setting.

### Time and weather

Click the widget or open **Settings › General › Time & weather** to toggle time and weather independently, show the date, choose 12/24-hour time, search for a city, and select Celsius or Fahrenheit. The clock follows the device time zone. Weather uses a city you choose, requests Open-Meteo access as needed, and never automatically reads your device location.

<p align="center">
  <img src="./docs/images/time-and-weather.png" width="360" alt="Time and weather preferences: time format, date, units, background, and city">
</p>

The centered Clear Sky layout changes its background with the weather: sunshine, a crescent and stars at night, drifting clouds, rain, snow, fog, or thunderstorms. It stays static without a city or available weather. You can also turn off **Weather background** independently.

## Sync and backup

### Cross-device sync

The browser syncs native bookmarks. Yunji Tab stores supplementary information such as descriptions, tags, icons, alternate URLs, pinned state, and inbox state, and syncs it through browser sync storage by default. Settings and groups also work across devices. Both devices need the same Chrome account, browser sync enabled, and Yunji Tab installed.

**Settings › Data & Privacy** shows sync status, offers immediate sync, and lets you select supplementary fields or enable passphrase encryption. **Groups use separate sync storage and are not covered by supplementary field selection or its passphrase encryption.** Usage records, sessions, trash, and operation history stay local; usage records can be included in full snapshot backups.

### Local files and WebDAV

| Method | Use it for |
| --- | --- |
| Export / import JSON | Supplementary data and configuration, including descriptions, tags, icons, and groups |
| Full snapshot / restore snapshot | Native bookmark tree, folder hierarchy, supplementary data, groups, usage records, and settings |
| WebDAV backup | Full snapshots on your own cloud drive or server, with separate historical files and optional encryption |

![Data and privacy settings: browser sync, local JSON export, and full snapshots](./docs/images/backup-and-restore.png)

Back up manually to WebDAV, or check at a chosen interval when opening a new tab and upload only when content has changed. Each upload creates a separate file you can restore from remote history. A backup passphrase enables AES-256-GCM encryption of the complete snapshot, including groups. It is separate from the browser sync passphrase; manually exported local JSON remains unencrypted.

Full snapshot restores show a preview first. Confirmation imports the native tree into a new `Yunji Tab Restore ...` folder, retaining existing native bookmarks. **Supplementary data and usage records for matching URLs, groups with matching IDs, and app settings revert to snapshot values; other existing groups remain.** Snapshots exclude tab sessions, trash, operation history, caches, AI tokens, WebDAV credentials, and encryption passphrases.

See the [Backup and restore guide](./docs/backup.en.md) for Jianguoyun/Nutstore and other WebDAV setup, automatic backup intervals, encryption, and historical restores.

### Privacy and permissions

No Yunji Tab account or analytics. Site icons send domains to Google Favicon as needed. Weather, website information, health checks, AI, and WebDAV contact their respective services when used and request the website permissions they need. Settings let you revoke optional access and clear caches and local records.

You choose the AI service; its token is excluded from sync and backups. WebDAV credentials and the backup passphrase stay on the current device. See [Privacy and permissions](./docs/privacy.en.md) for storage locations, network requests, and permission purposes.

## Shortcuts and languages

| Default shortcut | Action |
| --- | --- |
| `/` | Focus home page search |
| `Cmd/Ctrl + K` | Open the home page command palette |
| `N` | Add a bookmark |
| Arrow keys, `Enter` | Select and open bookmarks or commands |
| `Esc` | Clear search or close the current overlay |
| `Alt + Shift + B` (macOS: `Command + Shift + B`) | Quickly save the current page |
| Assign your own | Open the global command palette on a regular web page |

Record new home page shortcuts in **Settings › Keyboard shortcuts**, with conflict feedback and reset controls. Browser shortcuts are managed at `chrome://extensions/shortcuts`.

The interface supports Simplified Chinese, Traditional Chinese, English, Japanese, Korean, Spanish, and French. Switch languages in General settings.

## Development and contributions

Built with Plasmo, React 19, TypeScript, Tailwind CSS, and Zustand. With Node.js 22 or later and pnpm 10.34.4:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Load `build/chrome-mv3-dev/` for development. See the [Development guide](./docs/development.en.md) for production builds, unit and extension end-to-end tests, the code layout, and updating documentation screenshots.

Issues, suggestions, and contributions are welcome through [GitHub Issues](https://github.com/kiwiflydream/yunji-tab/issues). Include reproduction steps, the browser version, and screenshots. Hide private URLs and credentials before posting.

[Development guide](./docs/development.en.md) · [Backup and restore](./docs/backup.en.md) · [Privacy and permissions](./docs/privacy.en.md) · [Design notes](./DESIGN.md) · [Release notes](https://github.com/kiwiflydream/yunji-tab/releases)

## License

[MIT](./LICENSE) © 2026 KIWI
