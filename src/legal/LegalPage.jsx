import { LEGAL } from './config';

const isPlaceholder = (v) => /^\[.*\]$/.test(v);

/** Shared shell for public legal pages (readable without logging in). */
export default function LegalPage({ title, children }) {
  const unfilled = Object.values({ a: LEGAL.operator, b: LEGAL.contactEmail, c: LEGAL.governingState }).some(isPlaceholder);
  return (
    <div className="legal">
      <header>
        <a className="legal-back" href="/">← Back to {LEGAL.appName}</a>
        <h1>{title}</h1>
        <p className="muted">Effective {LEGAL.effectiveDate}</p>
      </header>
      {unfilled && import.meta.env.DEV && (
        <div className="form-error">Fill in the placeholders in src/legal/config.js before publishing.</div>
      )}
      <main>{children}</main>
      <footer>
        <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/credits">Credits</a>
      </footer>
    </div>
  );
}

export const Contact = () => <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
