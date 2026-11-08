import { createClient } from '@libsql/client';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id            INTEGER PRIMARY KEY,
     email         TEXT NOT NULL UNIQUE,
     name          TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     created_at    INTEGER NOT NULL
   )`,
  // Only a SHA-256 of the session token is stored, never the token itself.
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id    INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     last_used  INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
  `CREATE TABLE IF NOT EXISTS user_data (
     user_id    INTEGER PRIMARY KEY,
     json       TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  // Failed-attempt counters for lockout. Keys are hashed, so no emails are stored here.
  `CREATE TABLE IF NOT EXISTS attempts (
     key          TEXT PRIMARY KEY,
     count        INTEGER NOT NULL,
     first_at     INTEGER NOT NULL,
     locked_until INTEGER NOT NULL
   )`,
];

/**
 * Opens a libSQL database: a local file / ':memory:' for development and tests, or a
 * hosted Turso database (libsql://...) in production. Small async helpers keep call sites tidy.
 */
export async function openDb({ url, authToken } = {}) {
  const client = createClient({ url, authToken });
  await client.batch(SCHEMA, 'write');

  const rowsOf = (r) => r.rows.map((row) => Object.fromEntries(r.columns.map((c) => [c, row[c]])));
  return {
    async get(sql, args = []) {
      return rowsOf(await client.execute({ sql, args }))[0];
    },
    async all(sql, args = []) {
      return rowsOf(await client.execute({ sql, args }));
    },
    async run(sql, args = []) {
      const r = await client.execute({ sql, args });
      return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
    },
    /** Runs several statements atomically: batch([[sql, args], ...]). */
    batch(statements) {
      return client.batch(statements.map(([sql, args = []]) => ({ sql, args })), 'write');
    },
    close: () => client.close(),
  };
}
