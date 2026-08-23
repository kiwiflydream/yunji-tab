const SITE_ORIGINS = ['http://*/*', 'https://*/*']

export async function ensureSitePermissions(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions) {
    return true
  }

  try {
    if (await chrome.permissions.contains({ origins: SITE_ORIGINS })) {
      return true
    }
    return await chrome.permissions.request({ origins: SITE_ORIGINS })
  }
  catch {
    return false
  }
}
