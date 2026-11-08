# EmsMeals

A mobile-first PWA (works on iPhone and Android, installable from the browser) that plans a week of
easy meals, tracks macros, builds a grocery list, and suggests recipes from what's in your fridge.

## Features
- **One-tap weekly plan**: 7 days of breakfast / lunch / dinner from 84 recipes, tuned to your calorie goal.
- **Browse and pick**: search, filter, favorite, and add any dish to any day. Replace any meal with any other.
- **Grocery list**: combined across the week, sorted by aisle, minus what's in your pantry; send it to Apple Notes.
- **Pantry tab**: recipes ranked by what you already own, with "You have this" badges.
- **Macro dashboard**: calories, protein, carbs and fat per day (eaten vs planned).
- **Accounts**: server-side login; your plan and pantry follow you across devices.

## Run locally
```bash
npm install
npm run dev        # web on http://localhost:5173, API on :3001 (proxied, same-origin)
npm test           # security test suite for the API
npm run build && npm start    # production-style, one server on :3001
```

## How login is secured
| Area | What it does |
|---|---|
| Passwords | Hashed with scrypt (N=2^15, r=8, p=3), unique salt per user, constant-time compare. Never stored or logged in plaintext. |
| Policy | 8 to 128 characters, common passwords and passwords containing your name/email are rejected. |
| Sessions | 256-bit random token in an **HttpOnly, SameSite=Lax, Secure** cookie (`__Host-` prefixed in production). Only a SHA-256 of the token is stored server-side. 14-day sliding expiry, new token on every login, destroyed on logout. |
| Brute force | 5 failed logins locks that email for 15 minutes (the same for unknown emails, so lockouts don't reveal accounts), plus per-IP rate limits on login and signup. Failed logins return one generic message and take the same time whether or not the account exists. |
| CSRF | SameSite cookies, plus every state-changing request must come from this site's own origin and be JSON. |
| Headers | Strict Content-Security-Policy (scripts only from this site, no framing), HSTS, `nosniff`, no-referrer, `no-store` on API responses. |
| Data | Per-user rows only; every write is validated against a strict schema (unknown keys, wrong types and oversized payloads are rejected). SQL uses parameterized queries. |
| Account control | Changing your password needs the current one and signs out every other device. Deleting your account needs your password and erases all of your data. |
| On device | The browser holds no password, hash or token JavaScript can read. Local cache is wiped on logout. |

Known limits: there is no email verification or "forgot password" yet (that needs an email service), and
signup reveals whether an email is already registered.

## Deploy for free (Render + Turso)
Render hosts the app (free web service) and Turso hosts the database (free, no time limit). Render's free disk is wiped on
every restart, which is why the database is on Turso. In production the server refuses to start without `TURSO_DATABASE_URL`.

1. **Turso**: create a free account, create a database, then copy its URL (`libsql://...`) and create a database auth token.
2. **Render**: New > Blueprint > pick this GitHub repo (it reads `render.yaml`). When prompted, paste `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Open the `onrender.com` URL Render gives you (HTTPS, which the secure session cookie needs).

Free-tier behaviour: the service sleeps after 15 idle minutes and takes roughly a minute to wake on the next visit.
Lockout counters and sessions are stored in the database, so sleeping never resets them.

## Notes
- Food photos come from Wikimedia Commons under free licenses; credits are in the Profile tab.
