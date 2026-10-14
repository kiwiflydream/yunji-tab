<p align="center">
  <img src="./assets/brand-mark.png" width="96" alt="Yunji Tab logo">
</p>

# Yunji Tab · 云吉 Tab

[简体中文](./README.md) · English

Find the sites you have already bookmarked, every time you open a new tab.

Yunji Tab is an open-source Chrome extension that works with your existing browser bookmarks and folders. Search, tag, group, and organize bookmarks in bulk, or choose a theme for your home page. Start using it after installation, without migrating bookmarks or creating another account.

[Chrome Web Store](https://chromewebstore.google.com/detail/mongacbicmimajjfljaaelfcchhkepbh) · [Download the latest release](https://github.com/kiwiflydream/yunji-tab/releases/latest) · [Release notes](https://github.com/kiwiflydream/yunji-tab/releases) · [Report an issue](https://github.com/kiwiflydream/yunji-tab/issues) · [Development guide](./docs/development.en.md)

The screenshots below show the Chinese interface. English is also available in the language settings.

![Yunji Tab home page: folders on the left, pinned bookmarks and bookmark groups on the right](./docs/images/yunji-tab-overview.png)

## Installation

Chrome packages are currently distributed through GitHub Releases.

1. Open the [download page](https://github.com/kiwiflydream/yunji-tab/releases/latest) and download the attachment named `yunji-tab-<version>-chrome.zip`. The automatically generated `Source code` archives contain source files, not an installable extension.
2. Extract the ZIP and make sure the folder contains `manifest.json`.
3. Open `chrome://extensions` in Chrome and enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked** and select the extracted folder.
5. Open a new tab to get started.

To upgrade, replace the contents of the original installation folder with the new version, then click Reload on the extensions page. Keep the installation folder; there is no need to uninstall the extension.

Chrome is the main supported browser. You can try loading the same package in Chromium browsers such as Edge, Brave, and Opera, but compatibility has not been verified individually. Official packages for Firefox and Safari are not currently available.

## Everyday use

### Find a saved site

The categories on the left follow your existing bookmark folders. Pin sites you use often, or continue organizing through smart categories such as **Recent**, **Untagged**, and **No description**.

Use the search box at the top to find bookmarks and folders. Filters such as `tag:AI`, `site:github.com`, and `folder:Documentation` are also supported. Switch to **Web** to search with the browser's default search engine or choose another engine.

![Searching with tag:AI finds tagged bookmarks across folders](./docs/images/bookmark-search.png)

### Group sites you use together

For example, put your chat, reading, and research tools in an “AI workspace” group. Open **Bookmark groups**, click **Create bookmark group**, enter a title and description, and choose members from saved bookmarks. Each member can have its own title within the group. You can also change the member order and set a custom group icon.

Hover over a group card or click it to expand the member list on the current page, then select a link to open it. Groups can be pinned alongside regular bookmarks without moving their members out of the original folders. Deleting a group keeps the original bookmarks.

![A bookmark group expands its member names on the current page](./docs/images/bookmark-groups.png)

Bookmark groups are enabled by default. Turn them off under **Settings › General › Bookmark groups** if you do not need them; saved group configurations are retained.

### Add your own bookmark details

Open **More actions › Edit bookmark** on a card to change its name, URL, or category. Expand **More options** to add a description, tags, a custom icon, or alternate URLs for the same service. Icons can be emoji or image URLs.

<p align="center">
  <img src="./docs/images/bookmark-editor.png" width="400" alt="Bookmark editor with description, tags, custom icon, and alternate URLs">
</p>

### Choose an entry point automatically with alternate URLs

A service can have several addresses. For example, a home NAS might have both a public domain and a local network domain. Save them in one bookmark, and Yunji Tab probes the primary and alternate URLs together when you click it, opening the first address that responds. This avoids choosing an entry point manually after switching networks.

For example, set `https://nas.example.com` as the primary URL and add `http://nas.home.arpa` under **More options › Alternate URLs (optional)**. Enter one alternate address per line.

| Network | What opens |
| ------- | ---------- |
| Away from home, on a public network | The responding public domain when the local address is unreachable |
| At home, on the local network | The local address if it responds faster |
| Connected to a VPN or private network | Private addresses also participate once they are reachable |

This also works for internal and external company service addresses, public and VPN addresses for self-hosted services, or other equivalent entry points. A single bookmark chooses an address based on the current network response.

Selection uses probe response time. If every probe fails, Yunji Tab opens the primary URL.

### Organize several bookmarks at once

Click **Bulk manage**, select bookmarks, and move, open, or delete them together. You can also drag bookmarks to change their positions.

Drag a group card or its handle to reorder bookmark groups. Under **Pinned**, groups and regular bookmarks can be sorted together. Manual order is saved, participates in browser sync, and is included in backups.

Undo a deletion immediately, or restore its snapshot within 30 days through **More actions › Trash & history**. For larger collections, use the bookmark health check to find duplicate, unavailable, and redirected links.

![Bulk management: select several bookmarks to move, open, or delete them together](./docs/images/bookmark-bulk-actions.png)

### Choose a home page style

Under **Settings › Appearance**, choose Clear Sky, Minimal, Balanced, Compact, Soft, Paper & Ink, Blue Engraving, or Electric Blue. Place the category bar on the left or at the top, and switch bookmarks to a compact view if you prefer.

Clear Sky is the default on first install or when no style is configured: white cards with sky-blue accents that follow light and dark mode. Existing style choices are retained.

**Settings › General › Home layout** switches between two layouts. Centered puts the time, weather, search, and pinned bookmarks in the middle of the page; Workspace keeps search and the time and weather in the header. First installs start centered and existing settings keep the workspace layout. With the time and weather turned off, the centered layout shows only search and pinned bookmarks. The layout button in the header switches between the two layouts, moving search, the clock and bookmarks smoothly to their new places. When you scroll the centered layout until the search box slides under the header, the header shows search and the time and weather until you scroll back up.

In the centered Clear Sky layout, the background follows the current weather: a slowly turning sun on clear days, a crescent and stars at night, drifting clouds when it is cloudy, and matching effects for rain, snow, fog, and thunderstorms. Without a city, or when weather fails to load, the background stays static. Turn off **Weather background** under **Time & weather**; animations also stop when the system asks for reduced motion.

Electric Blue uses a pale gray background, electric blue text, and local monospace fonts with a fixed light palette. Accent color and background selection are disabled for this theme. Your navigation position and icon visibility preferences are retained.

Under **Settings › Appearance › Advanced customization › Visible fields**, **Card icons** controls icons on bookmark, folder, and group cards together. **Menu icons** controls category navigation icons. Both are enabled by default, and your choices persist across reloads and theme changes.

The **General** and **Appearance** pages each have a **Restore defaults** button at the top. It resets and saves the settings on that page. Bookmarks, groups, and auto-organize rules are retained; resetting General also resets the interface language to the browser language.

Blue Engraving combines deep blue and warm cream, serif type, print grain, and an original astronaut cat illustration. The illustration stays at the bottom of the viewport while you scroll through bookmarks.

![Blue Engraving theme with a deep blue background, cream text, and an astronaut cat illustration](./docs/images/engraving-theme.png)

### Time and weather

The top-right widget shows the time, date, and weather. Click it or open **Settings › General › Time & weather** to toggle time and weather independently, show the date, choose 12/24-hour time, search for a city, and switch between Celsius and Fahrenheit. Weather requires selecting a city and granting access to Open-Meteo; it never automatically reads your device location.

Open **Settings › About › Release notes** to visit [GitHub Releases](https://github.com/kiwiflydream/yunji-tab/releases).

### Back up and restore

Open **Settings › Data & Privacy** to export or import supplementary bookmark data, or use **Full snapshot** to back up the bookmark tree and related configuration. WebDAV uses the same full snapshot, with the following scope:

| Included | Excluded |
| -------- | -------- |
| Native bookmark tree, folder hierarchy, and order | Tab sessions, trash, operation history, and caches |
| Descriptions, tags, custom icons, alternate URLs, pinned state, and inbox state | AI API token, WebDAV connection settings, and backup encryption passphrase |
| Groups and member order, folder icons, open counts, last-opened times, and app settings | Browser sync encryption passphrase |

A full snapshot restore shows a preview first. After confirmation, the native bookmark tree is imported into a new `Yunji Tab Restore ...` folder, keeping existing native bookmarks. **Supplementary data and usage records for matching URLs revert to the snapshot values. Groups are restored by ID: matching groups are replaced by the snapshot, while other existing groups are kept. App settings are replaced by the snapshot.** Restored data continues to participate in cross-device sync according to the browser and extension settings.

To configure WebDAV:

1. Enter a folder URL. The default is Jianguoyun (Nutstore), `https://dav.jianguoyun.com/dav/`. You can choose another WebDAV service or a subfolder. Create custom folders in your cloud drive first. Remote services must use HTTPS.
2. Enter your username and app password. For Jianguoyun, use your login email and create an app password under **账户信息 › 安全选项 › 第三方应用管理** (Account information › Security options › Third-party app management).
3. Optionally enter a **Backup encryption passphrase (optional)**, save the configuration, and test the connection. The first connection requests website access to that server.
4. Back up manually, or enable **Back up automatically on new-tab opens**. Automatic backup is off by default. When enabled, the minimum check interval defaults to 24 hours; 1, 6, and 72 hours are also available. An upload occurs only after the interval has elapsed and the content has changed. Nothing runs on a schedule while the home page is closed, and no `alarms` or notification permission is needed. Manual backups bypass the interval and content deduplication.

Leave the backup passphrase empty to upload plain JSON. Save a passphrase once to reuse it for later manual and automatic backups. The complete snapshot, including groups, is encrypted locally with AES-256-GCM before upload. This passphrase is separate from the supplementary data's browser sync passphrase. It stays on this device and is excluded from remote files and snapshots. Changing or clearing it affects future backups only; older files still need their original passphrase. Restore first tries the saved local passphrase. If it is missing or does not match, you can enter a temporary passphrase without changing the saved configuration. Successful decryption still requires a preview and confirmation. A forgotten passphrase makes the corresponding encrypted backups unrecoverable.

This passphrase applies only to WebDAV backups. Manually exported local JSON remains unencrypted.

Each backup uploads one separate JSON file, for example `yunji-tab-backup-20261011T114025123Z-<random-ID>.json`. Its name contains a UTC timestamp with millisecond precision and a random ID to avoid overwriting history. **Sync history** reads files directly from the remote folder, newest first. Refresh the list, restore the latest backup, or restore a specific record. Connect another device to the same folder to view the records; encrypted files also need the corresponding passphrase. Failed uploads or unchanged content only update the current status and create no file record.

History is not persisted locally, and no separate index is uploaded. Legacy files named `yunji-tab-full-snapshot.json` and `yunji-tab-snapshot-<random-ID>.json` also appear, using the server's modification time. The extension does not automatically delete remote files; manage them in your cloud drive. Clearing the connection configuration removes only local credentials, the passphrase, and check status, keeping remote files.

![Data and privacy settings for sync status, data export, and full snapshot restore](./docs/images/backup-and-restore.png)

### More tools

- **AI classification**: Configure your own service under **Settings › AI** to generate a bookmark organization proposal. Review the move preview and confirm before applying it.
- **Tab sessions**: Open session management from **More actions** on the home page to save a set of open tabs for later.

## Cross-device sync and privacy

The browser syncs native bookmarks. Yunji Tab syncs supplementary data such as descriptions, tags, icons, and alternate URLs by default, and also supports group sync. Both devices need the same Chrome account, browser sync enabled, and Yunji Tab installed.

Under **Settings › Data & Privacy**, view sync status, choose supplementary fields to sync, or enable their passphrase encryption. **Groups use separate browser sync storage and are not protected by this supplementary data encryption.**

Yunji Tab collects no analytics. Site icon requests send website domains to Google Favicon. AI classification is optional and requires an OpenAI-compatible service that you configure. Proposals are previewed and applied only after confirmation; API tokens are excluded from sync and backups. See [Privacy and permissions](./docs/privacy.en.md) for storage locations, external requests, and permission purposes.

## Common shortcuts

| Shortcut | Action |
| -------- | ------ |
| `/` | Focus search |
| `Cmd/Ctrl + K` | Open the command palette |
| `N` | Add a bookmark |
| Arrow keys, `Enter` | Select and open a bookmark |
| `Esc` | Clear search or close the current overlay |
| `Alt + Shift + B` (macOS: `Command + Shift + B`) | Quickly save the current page |

Change home page shortcuts in **Settings › Keyboard shortcuts**. Configure browser shortcuts at `chrome://extensions/shortcuts`.

The interface supports Simplified Chinese, Traditional Chinese, English, Japanese, Korean, Spanish, and French.

## Development and contributions

The project uses Plasmo, React, and TypeScript. With Node.js 22 or later and pnpm 10.34.4 installed, run from source:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

In development mode, load `build/chrome-mv3-dev/`. See the [Development guide](./docs/development.en.md) for builds, tests, and the code layout.

Issues, suggestions, and code contributions are welcome through [GitHub Issues](https://github.com/kiwiflydream/yunji-tab/issues). Include reproduction steps, your browser version, and screenshots when reporting a problem. Hide private URLs and credentials before posting.

## License

[MIT](./LICENSE) © 2026 KIWI
