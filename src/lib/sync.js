// Loads and saves a user's meal data (plan, pantry, favorites...) on the server.
// A copy of the last good state is cached on the device so the app still opens if the
// network drops after login. The cache is wiped on logout.
import { api, ApiError } from './api';
import { defaultData } from './store';

const cacheKey = (id) => `mp:cache:${id}`;
const legacyKey = (email) => `mp:data:${email}`;

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeCache = (id, data) => {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(data));
  } catch {
    /* storage full or unavailable */
  }
};

/** Wipe everything this app stored on the device (used on logout / account deletion). */
export function clearLocalData(userId) {
  try {
    if (userId != null) localStorage.removeItem(cacheKey(userId));
    for (const k of Object.keys(localStorage)) {
      if (k === 'mp:users' || k === 'mp:session' || k.startsWith('mp:cache:')) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** One-time cleanup of the old on-device accounts (password hashes) from earlier versions. */
export function removeLegacyAccounts() {
  try {
    localStorage.removeItem('mp:users');
    localStorage.removeItem('mp:session');
  } catch {
    /* ignore */
  }
}

export async function loadServerData(user) {
  try {
    const { data } = await api('/data');
    if (data) {
      const merged = { ...defaultData(), ...data };
      writeCache(user.id, merged);
      return merged;
    }
    // First time on the server: bring over meal data from an old on-device account with this email.
    const legacy = readJson(legacyKey(user.email));
    let initial = defaultData();
    if (legacy) {
      try {
        const candidate = { ...defaultData(), ...legacy };
        await api('/data', { method: 'PUT', body: { data: candidate } });
        initial = candidate;
        localStorage.removeItem(legacyKey(user.email));
      } catch {
        /* server rejected it; start fresh */
      }
    }
    writeCache(user.id, initial);
    return initial;
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      const cached = readJson(cacheKey(user.id));
      if (cached) return { ...defaultData(), ...cached };
    }
    throw e;
  }
}

export const saveServerData = (data, opts) => api('/data', { method: 'PUT', body: { data }, ...opts });
