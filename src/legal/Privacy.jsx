import LegalPage, { Contact } from './LegalPage';
import { LEGAL } from './config';

export default function Privacy() {
  const { appName: A } = LEGAL;
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what personal information {A} collects, how it is used, and the choices you have. {A} is operated
        by {LEGAL.operator} (“we”, “us”). In short: we collect only what we need to run your account and your meal plans, we do not
        sell your information, and we do not use advertising or analytics trackers.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><b>Account information:</b> your name and email address, and your password. Your password is never stored; we keep only a salted one-way hash of it.</li>
        <li><b>Information you add to the app:</b> your weekly meal plan, which meals you mark as eaten, your pantry items and any expiration dates you add, favorite and hidden recipes, grocery-list check marks, and your daily calorie goal. The calorie goal and eaten-meal records may reveal information about your diet or health, so we treat them as sensitive and use them only to provide the service to you.</li>
        <li><b>Consent record:</b> when you accepted our Terms and Privacy Policy, and which version.</li>
        <li><b>Technical information:</b> your IP address and basic request details are processed by our hosting provider to deliver the site, and briefly by our software to limit abuse (rate limiting and sign-in lockouts). Sign-in lockout records are stored under an irreversible hash, not your email address.</li>
      </ul>
      <p>We do not collect payment information, precise location, your contacts, photos from your device, or data from health or fitness devices.</p>

      <h2>2. How we use information</h2>
      <ul>
        <li>To create and secure your account and keep you signed in.</li>
        <li>To store and sync your plan, pantry and preferences across your devices.</li>
        <li>To protect the service from abuse, fraud and unauthorized access.</li>
        <li>To respond to your requests and to comply with the law.</li>
      </ul>
      <p>We do not sell your personal information, do not share it for cross-context behavioral advertising, and do not use it for profiling or automated decisions that affect you.</p>

      <h2>3. Cookies and local storage</h2>
      <p>
        {A} uses one cookie, a strictly necessary session cookie that keeps you logged in. It is marked HttpOnly and Secure, so
        scripts on the page cannot read it, and it expires after 14 days. We do not use advertising, analytics or tracking
        cookies, which is why there is no cookie banner. Your browser also keeps a copy of your latest plan on your device so the app
        opens quickly; it is erased when you log out.
      </p>

      <h2>4. Who we share information with</h2>
      <p>We use these service providers, who process information only on our behalf:</p>
      <ul>
        <li><b>Render</b> hosts the app’s servers (United States).</li>
        <li><b>Turso</b> hosts the database where your account and data are stored (United States).</li>
      </ul>
      <p>
        If you use the grocery list “Send to Notes” or “Copy” feature, the list leaves the app only at your direction, to the app you
        choose in your device’s share sheet. We may also disclose information if required by law or to protect rights, safety or
        security.
      </p>

      <h2>5. How long we keep information</h2>
      <p>
        We keep your account and data until you delete your account. Sessions expire after 14 days of inactivity. Sign-in lockout records
        are removed within about a day after they expire. When you delete your account, your account, plan, pantry and all related
        records are erased from our database right away; copies in our providers’ backups may remain for a limited period under their
        policies.
      </p>

      <h2>6. Security</h2>
      <p>
        We protect your information with encryption in transit (HTTPS), salted memory-hard password hashing, HttpOnly session
        cookies, sign-in lockouts and rate limits, and strict validation of everything stored. No online service is perfectly secure.
        If a breach affects you, we will notify you as the law requires.
      </p>

      <h2>7. Your choices and rights</h2>
      <ul>
        <li><b>Access and download:</b> Profile → Security → “Download my data” gives you a copy of your account and data.</li>
        <li><b>Correct:</b> edit your plan and pantry in the app, and change your password in Profile → Security.</li>
        <li><b>Delete:</b> Profile → Security → “Delete account” permanently erases your account and data.</li>
        <li><b>Anything else:</b> email <Contact /> and we will respond within 30 days (45 at most where the law allows an extension).</li>
      </ul>
      <p>
        Depending on where you live (for example California, the European Economic Area or the United Kingdom), you may have the right to
        know, access, correct, delete and port your information, to object to or restrict certain processing, to withdraw consent, and
        not to be discriminated against for using these rights. You may also complain to your local data-protection authority. Where
        the EU or UK GDPR applies, our legal bases are performing our contract with you (running your account) and our legitimate
        interest in keeping the service secure.
      </p>

      <h2>8. International use</h2>
      <p>{A} is hosted in the United States. If you use it from elsewhere, your information is transferred to and processed in the United States.</p>

      <h2>9. Children</h2>
      <p>
        {A} is not directed to children under 13, and you must be at least 13 to create an account. We do not knowingly collect
        information from children under 13. If you believe a child has given us information, email <Contact /> and we will delete it.
      </p>

      <h2>10. Third-party content</h2>
      <p>
        Food photos are stored on our own servers, so your browser does not contact any outside photo service to display them. They
        come from Wikimedia Commons under free licenses; see <a href="/credits">Photo credits</a>. If you follow a credit link, that
        site’s own privacy policy applies.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>We may update this policy. We will change the effective date above and, for material changes, ask you to review and accept the update in the app.</p>

      <h2>12. Contact</h2>
      <p>{LEGAL.operator} · <Contact /></p>
    </LegalPage>
  );
}
