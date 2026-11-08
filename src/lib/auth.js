// Local-only accounts for the prototype. Passwords are salted + hashed with PBKDF2 (WebCrypto)
// and stored on-device in localStorage. To move to a real backend, replace signUp / logIn /
// currentUser / logOut with API calls; the UI only depends on these four functions.

const USERS_KEY = 'mp:users';
const SESSION_KEY = 'mp:session';

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

async function hash(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations: 120000, hash: 'SHA-256' },
    key,
    256
  );
  return toHex(bits);
}

const readUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
const writeUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));

export async function signUp({ name, email, password }) {
  const id = email.trim().toLowerCase();
  if (!name.trim()) throw new Error('Please enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(id)) throw new Error('Enter a valid email address.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const users = readUsers();
  if (users[id]) throw new Error('An account with that email already exists.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  users[id] = { name: name.trim(), salt, hash: await hash(password, salt) };
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, id);
  return { id, name: users[id].name };
}

export async function logIn({ email, password }) {
  const id = email.trim().toLowerCase();
  const u = readUsers()[id];
  if (!u || (await hash(password, u.salt)) !== u.hash) throw new Error('Incorrect email or password.');
  localStorage.setItem(SESSION_KEY, id);
  return { id, name: u.name };
}

export function currentUser() {
  const id = localStorage.getItem(SESSION_KEY);
  const u = id && readUsers()[id];
  return u ? { id, name: u.name } : null;
}

export const logOut = () => localStorage.removeItem(SESSION_KEY);
