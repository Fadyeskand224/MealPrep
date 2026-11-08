// Accounts live on the server. The browser only holds an HttpOnly session cookie, which
// JavaScript cannot read, so no password, hash or token is ever stored in the page.
import { api, ApiError } from './api';
import { clearLocalData } from './sync';

export const signUp = async ({ name, email, password, acceptTerms }) =>
  (await api('/auth/signup', { method: 'POST', body: { name, email, password, acceptTerms } })).user;

/** Downloads everything we hold about the user as a JSON file. */
export async function downloadMyData() {
  const res = await fetch('/api/auth/export', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Could not download your data. Please try again.');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: 'emsmeals-my-data.json' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const logIn = async ({ email, password }) =>
  (await api('/auth/login', { method: 'POST', body: { email, password } })).user;

/** The logged-in user, or null when there is no valid session. Network errors are thrown. */
export async function fetchCurrentUser() {
  try {
    return (await api('/auth/me')).user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function logOut(user) {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    /* even if the server is unreachable, wipe what is stored on this device */
  }
  clearLocalData(user?.id);
}

export const changePassword = (currentPassword, newPassword) =>
  api('/auth/password', { method: 'POST', body: { currentPassword, newPassword } });

export async function deleteAccount(user, password) {
  await api('/auth/account', { method: 'DELETE', body: { password } });
  clearLocalData(user?.id);
}
