// Lightweight per-browser identity for the web dashboard.
//
// The management login is still a single shared token, but every browser gets
// its own client id so that agent sessions are not shared across viewers.
// The id is persisted in localStorage; when storage is unavailable we fall
// back to a stable in-memory id for the lifetime of the page.

const CLIENT_ID_KEY = 'cc_web_client_id';
const DISPLAY_NAME_KEY = 'cc_web_display_name';

let memoryClientId = '';
let memoryDisplayName = '';

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    }
  } catch {
    // fall through
  }
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getWebClientId(): string {
  if (memoryClientId) return memoryClientId;
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored) {
      memoryClientId = stored;
      return stored;
    }
    const id = randomId();
    localStorage.setItem(CLIENT_ID_KEY, id);
    memoryClientId = id;
    return id;
  } catch {
    memoryClientId = randomId();
    return memoryClientId;
  }
}

export function getWebDisplayName(): string {
  if (memoryDisplayName) return memoryDisplayName;
  try {
    const stored = localStorage.getItem(DISPLAY_NAME_KEY);
    if (stored) {
      memoryDisplayName = stored;
      return stored;
    }
  } catch {
    // ignore
  }
  memoryDisplayName = 'Web User';
  return memoryDisplayName;
}

export function setWebDisplayName(name: string): void {
  const trimmed = name.trim();
  memoryDisplayName = trimmed || 'Web User';
  try {
    if (trimmed) localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    else localStorage.removeItem(DISPLAY_NAME_KEY);
  } catch {
    // ignore
  }
}

export function webUserId(): string {
  return `web-${getWebClientId()}`;
}

export function webUserName(): string {
  return getWebDisplayName();
}

// webPlatformName is the unique bridge adapter name for this browser. Using a
// per-browser name keeps adapters from overwriting each other when several
// people open the dashboard at once.
export function webPlatformName(): string {
  return `web-${getWebClientId()}`;
}

// webSessionKey returns the bridge session key scoped to this browser.
// Shape: `{platform}:{scope}:{user}` as expected by the engine.
export function webSessionKey(project: string): string {
  const id = getWebClientId();
  return `${webPlatformName()}:${id}:${project}`;
}
