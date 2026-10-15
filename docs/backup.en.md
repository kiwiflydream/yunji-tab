# Back up and restore

[简体中文](./backup.md) · English · [Back to README](../README.en.md)

Open **Settings › Data & Privacy** to export or import supplementary bookmark data, or use **Full snapshot** to back up the bookmark tree and related configuration. WebDAV uses the same full snapshot, with the following scope:

| Included | Excluded |
| -------- | -------- |
| Native bookmark tree, folder hierarchy, and order | Tab sessions, trash, operation history, and caches |
| Descriptions, tags, custom icons, alternate URLs, pinned state, and inbox state | AI API token, WebDAV connection settings, and backup encryption passphrase |
| Groups and member order, folder icons, open counts, last-opened times, and app settings | Browser sync encryption passphrase |

## What happens during a restore

A full snapshot restore shows a preview first. After confirmation, the native bookmark tree is imported into a new `Yunji Tab Restore ...` folder, keeping existing native bookmarks. **Supplementary data and usage records for matching URLs revert to the snapshot values. Groups are restored by ID: matching groups are replaced by the snapshot, while other existing groups are kept. App settings are replaced by the snapshot.** Restored data continues to participate in cross-device sync according to the browser and extension settings.

## Configure WebDAV

1. Enter a folder URL. The default is Jianguoyun (Nutstore), `https://dav.jianguoyun.com/dav/`. You can choose another WebDAV service or a subfolder. Create custom folders in your cloud drive first. Remote services must use HTTPS.
2. Enter your username and app password. For Jianguoyun, use your login email and create an app password under **账户信息 › 安全选项 › 第三方应用管理** (Account information › Security options › Third-party app management).
3. Optionally enter a **Backup encryption passphrase (optional)**, save the configuration, and test the connection. The first connection requests website access to that server.
4. Back up manually, or enable **Back up automatically on new-tab opens**. Automatic backup is off by default. When enabled, the minimum check interval defaults to 24 hours; 1, 6, and 72 hours are also available. An upload occurs only after the interval has elapsed and the content has changed. Nothing runs on a schedule while the home page is closed, and no `alarms` or notification permission is needed. Manual backups bypass the interval and content deduplication.

![WebDAV connection, encryption, and automatic backup settings](./images/webdav-backup.png)

## Encryption and passphrases

Leave the backup passphrase empty to upload plain JSON. Save a passphrase once to reuse it for later manual and automatic backups. The complete snapshot, including groups, is encrypted locally with AES-256-GCM before upload. This passphrase is separate from the supplementary data's browser sync passphrase. It stays on this device and is excluded from remote files and snapshots. Changing or clearing it affects future backups only; older files still need their original passphrase. Restore first tries the saved local passphrase. If it is missing or does not match, you can enter a temporary passphrase without changing the saved configuration. Successful decryption still requires a preview and confirmation. A forgotten passphrase makes the corresponding encrypted backups unrecoverable.

This passphrase applies only to WebDAV backups. Manually exported local JSON remains unencrypted.

## History and restoring on another device

Each backup uploads one separate JSON file, for example `yunji-tab-backup-20261011T114025123Z-<random-ID>.json`. Its name contains a UTC timestamp with millisecond precision and a random ID to avoid overwriting history. **Sync history** reads files directly from the remote folder, newest first. Refresh the list, restore the latest backup, or restore a specific record. Connect another device to the same folder to view the records; encrypted files also need the corresponding passphrase. Failed uploads or unchanged content only update the current status and create no file record.

History is not persisted locally, and no separate index is uploaded. Legacy files named `yunji-tab-full-snapshot.json` and `yunji-tab-snapshot-<random-ID>.json` also appear, using the server's modification time. The extension does not automatically delete remote files; manage them in your cloud drive. Clearing the connection configuration removes only local credentials, the passphrase, and check status, keeping remote files.

![Data and privacy settings for sync status, data export, and full snapshot restore](./images/backup-and-restore.png)
