function getBookmarksApi(): typeof chrome.bookmarks {
  if (typeof chrome === 'undefined' || !chrome.bookmarks)
    throw new Error('bookmarks.api_unavailable')
  return chrome.bookmarks
}

export function assertBookmarksApi(): void {
  getBookmarksApi()
}

export const bookmarkApi = {
  create(details: chrome.bookmarks.CreateDetails) {
    return getBookmarksApi().create(details)
  },
  get(idOrIds: string | [string, ...string[]]) {
    return getBookmarksApi().get(idOrIds)
  },
  getSubTree(id: string) {
    return getBookmarksApi().getSubTree(id)
  },
  getTree() {
    return getBookmarksApi().getTree()
  },
  move(id: string, destination: chrome.bookmarks.MoveDestination) {
    return getBookmarksApi().move(id, destination)
  },
  remove(id: string) {
    return getBookmarksApi().remove(id)
  },
  removeTree(id: string) {
    return getBookmarksApi().removeTree(id)
  },
  update(id: string, changes: chrome.bookmarks.UpdateChanges) {
    return getBookmarksApi().update(id, changes)
  },
}
