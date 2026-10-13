# Privacy and permissions

[简体中文](./privacy.md) · English · [Back to README](../README.en.md)

Yunji Tab requires no additional account and collects no analytics. This document explains where bookmarks, supplementary data, and settings are stored, and which actions make network requests.

## Data storage and sync

| Data | Storage and sync |
| ---- | ---------------- |
| Native bookmark names, URLs, and folders | Managed by the browser; cross-device sync depends on the browser's bookmark sync settings |
| Descriptions, tags, custom icons, alternate URLs, pinned and inbox state, and folder icons | Stored locally and synced through browser sync storage by default; fields can be selected and optionally encrypted with a passphrase |
| Group titles, descriptions, icons, member URLs, member display names, order, and pinned state | Separate browser sync storage; not covered by supplementary data field selection or passphrase encryption |
| Interface and feature settings | Browser sync storage; API tokens are excluded |
| Usage records, tab sessions, trash, operation history, and caches | Stored in the current browser |
| AI service API token | Stored locally; excluded from sync and backups |
| WebDAV folder URL, username, app password, optional backup passphrase, and automatic backup check status | Stored only on this device; excluded from browser sync and exported backups |

Cross-device sync requires the same Chrome account on both devices, browser sync enabled, and the same extension installed. Sync status and advanced supplementary data settings are under **Settings › Data & Privacy**. An uploaded status does not mean another device has received the data, or that Yunji Tab provides a separate cloud account or server.

Groups reference existing bookmarks by URL, avoiding reliance on bookmark IDs that differ across devices. Deleting a group keeps native bookmarks. Group configuration is included in supplementary data backups and full snapshots.

## Actions that make network requests

### Time and weather

The clock uses your device's local time zone. Weather uses a city you select manually and never reads your device location. City search requests optional access to Open-Meteo's two domains and sends the search text to `geocoding-api.open-meteo.com`. Once configured, weather requests send the selected city's coordinates and temperature unit to `api.open-meteo.com`. The service receives the normal connection IP address, but no bookmarks or browsing history.

City and display preferences sync with browser settings and are included in backups. Weather readings are cached locally for 15 minutes. Disabling weather stops automatic requests; no weather requests are sent before a city is selected. Configure the widget by clicking it or through **Settings › General › Time & weather**. Optional website access can be revoked in Data & Privacy settings.

### Site icons

When displaying bookmark cards, the extension requests icons from Google Favicon as needed, sending bookmark domains. It does not send bookmark paths, query parameters, or page content. If the remote request fails, it falls back to the browser's site icon API.

If you set a custom image URL for a bookmark or group, the browser requests that image resource.

### Alternate URL selection

When a bookmark has alternate URLs, clicking it sends requests to the primary and alternate addresses together and selects the first one that responds. Requests go to the addresses you entered.

### Page information and health checks

The extension requests access to a site when you actively fetch a page description or check a link. These requests read page information or check for unavailable and redirected links. Optional permissions can be revoked in settings.

### AI classification

AI classification requires an OpenAI-compatible service that you configure. Running it sends bookmark titles, URLs with query parameters removed, descriptions, tags, and folder paths to that service. The selected service processes the data; consult its privacy policy before use.

The extension previews classification and moves before changing bookmark folders. Changes require your confirmation. The API token is stored locally and excluded from sync and backups.

### Web search

Switching to web search and submitting keywords sends the query to the selected search engine. If no engine is specified, it uses the browser's default search service.

### WebDAV backups

WebDAV is off by default. Configuring a connection requests optional website access for the server address; the username and app password are sent only to that address. Remote servers must use HTTPS, with HTTP allowed only for localhost testing. Requests do not follow redirects. Testing a connection queries the folder. Manual backups, or automatic backups once enabled, upload a full snapshot containing the bookmark tree, supplementary data, groups, usage records, and interface settings. WebDAV credentials and AI tokens are excluded from the snapshot.

Automatic backup is off by default. It checks only after the Yunji Tab home page opens and local data loads successfully. It uploads only when the minimum interval has elapsed and content has changed. It uses no background timer, `alarms`, or system notifications.

The backup passphrase is empty by default, which uploads an unencrypted snapshot. Save a passphrase once to reuse it for later manual and automatic backups. PBKDF2-SHA-256 derives a key, then AES-256-GCM encrypts the full snapshot on this device. This includes groups, unlike browser sync encryption, which protects only supplementary data. The two passphrases are independent. The WebDAV passphrase stays on this device and is excluded from sync, backup files, and request headers. Changing or clearing it resets the automatic backup checkpoint and affects future backups only. Older files still need their original passphrase. Restore first tries the saved local passphrase. If it is missing or does not match, a temporary passphrase can be entered. It stays in the current interface's memory and does not change the saved configuration. Failed decryption does not proceed to import. Files encrypted with a forgotten passphrase cannot be recovered.

You control access on the server. Each backup uploads one `yunji-tab-backup-<UTC-timestamp>-<random-ID>.json`, keeping older files and avoiding a second upload to a fixed latest-backup file. Files are retained until you manage them in your cloud drive; the extension does not delete them automatically.

Sync history queries the WebDAV folder and displays results in interface memory. It is not persisted locally, and no separate history index is uploaded. Other devices connected to the same folder can read the list. Legacy fixed-name and UUID history files are also recognized. Restore reads the selected file, restricting it to the same folder configured for the current account. When the server provides a strong ETag, a conditional request detects file changes. After snapshot validation, a preview is shown; import into a new folder requires confirmation. Folder query failures display an error. Failed uploads and unchanged content create no remote record. Locally, only the connection configuration, last-check and last-success times, content fingerprint, and current result are retained to control check frequency and avoid duplicate uploads. Obsolete local history is cleared. Clearing connection settings removes local credentials and status while keeping remote files. Optional website access can be revoked separately under Data & Privacy.

## Permission purposes

| Permission | Purpose |
| ---------- | ------- |
| `storage` | Save settings, local supplementary data, and cross-device sync data |
| `bookmarks` | Read and manage native browser bookmarks |
| `favicon` | Get site icons through the browser API |
| `activeTab` | Read the current page when you trigger quick save or a global command |
| `scripting` | Inject the isolated global command palette into ordinary web pages as needed |
| `contextMenus` | Provide a context menu action to save the current page |
| `tabs` | Save and restore tab sessions, and reuse the home page tab |
| `search` | Run web searches through the browser's default search service |
| `https://www.google.com/*` | Request Google Favicon icons |
| `https://*.gstatic.com/*` | Load icon resources returned by Google |
| Optional `http://*/*` and `https://*/*` | Access selected sites or services for page descriptions, link checks, AI classification, or WebDAV backups |

The global command palette is disabled by default. To use it with a browser shortcut, enable it and assign a key combination on the extension shortcuts page.

## Backups, restore, and cleanup

**Settings › Data & Privacy** provides supplementary data JSON export and import, plus full snapshots. WebDAV uses the same full snapshot. Snapshots contain the native bookmark tree, supplementary data such as alternate URLs, groups, folder icons, usage records, and app settings. They exclude tab sessions, trash, operation history, caches, AI tokens, WebDAV configuration, and all encryption passphrases.

Imports can be previewed for conflicts. After confirmation, a full snapshot restores into a new `Yunji Tab Restore ...` folder without clearing or overwriting existing native bookmarks. Supplementary data and usage records for matching URLs revert to the snapshot values. Groups are restored by ID: matching groups are replaced by the snapshot, while other existing groups are kept. App settings are replaced by the snapshot. Newly created native bookmarks and restored extension data continue to sync to other devices according to their respective settings. WebDAV does not take over browser sync.

The WebDAV passphrase protects uploaded remote snapshots only. It does not encrypt manually exported local JSON. Store exported files securely.

When you delete a bookmark or folder through Yunji Tab, the extension first saves a local snapshot. Undo the deletion immediately or restore through **Trash & history**. Deletion snapshots are retained for 30 days.

Settings provide separate actions to clear usage records, the site icon cache, tab sessions, trash and history, supplementary metadata, and optional website access. Clearing supplementary metadata keeps native browser bookmarks but removes its sync copies. Groups are separate data and can be managed or deleted through the group entry.

Hide API tokens, private URLs, and browsing records when reporting a problem. Screenshots and exported backups can reveal private data, so avoid attaching them directly to a public issue.
