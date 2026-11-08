import LegalPage, { Contact } from './LegalPage';
import { LEGAL } from './config';

export default function Terms() {
  const { appName: A } = LEGAL;
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {LEGAL.operator} (“we”, “us”) about your use of {A} at {LEGAL.siteUrl} (the
        “Service”). By creating an account or using the Service you agree to these terms and to our <a href="/privacy">Privacy Policy</a>.
        If you do not agree, do not use the Service.
      </p>

      <h2>1. Who can use {A}</h2>
      <p>You must be at least 13 years old. If you are under the age of majority where you live, you may use the Service only with a parent or guardian’s permission.</p>

      <h2>2. Your account</h2>
      <p>
        Give accurate information and keep your password secret. You are responsible for activity under your account. Tell us promptly at{' '}
        <Contact /> if you think someone else has access. We may suspend or close accounts that break these terms.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>break the law or violate anyone’s rights using the Service;</li>
        <li>try to access other users’ accounts or data, or probe, scan or test the Service’s security without our written permission;</li>
        <li>use bots, scrapers or other automated means beyond ordinary use, or do anything that overloads or disrupts the Service;</li>
        <li>copy, resell or republish the Service or its content for commercial purposes, or reverse engineer it except where the law allows;</li>
        <li>upload malware or content you have no right to share.</li>
      </ul>

      <h2>4. Nutrition, health and allergy disclaimer</h2>
      <p>
        {A} is a meal-planning tool, <b>not medical, nutritional or dietary advice</b>. Calorie, protein, carbohydrate and fat figures are
        estimates for one serving and will differ with the ingredients and amounts you actually use. Recipes and meal plans do not
        account for allergies, intolerances, medical conditions, pregnancy or other individual needs. If you have a food allergy or a
        health condition, or if you are making changes to your diet, check ingredient labels and talk to a doctor or registered
        dietitian first. Follow safe food-handling and cooking practices; you prepare and eat food at your own risk.
      </p>

      <h2>5. Your data</h2>
      <p>
        You keep ownership of the information you put into {A} (your plans, pantry items, favorites and settings). You give us
        permission to store and process it only as needed to run the Service for you, as described in the Privacy Policy. You can export
        or delete your data at any time from your Profile.
      </p>

      <h2>6. Our content</h2>
      <p>
        The app, its design, code, recipe text and selection are owned by us or our licensors and are protected by law. Food photos are
        provided by third parties under the free licenses listed on the <a href="/credits">Credits</a> page; those licenses, not
        these terms, govern your use of the photos.
      </p>

      <h2>7. The Service is provided free and “as is”</h2>
      <p>
        {A} is offered free of charge. It may be slow, unavailable, changed or discontinued at any time, and we do not promise it will be
        error-free or that your data will never be lost. Please use “Download my data” to keep your own copy of anything important.
      </p>

      <h2>8. Ending your use</h2>
      <p>You can stop using {A} and delete your account at any time in Profile → Security. We may suspend or end access for anyone who violates these terms or puts the Service or other users at risk.</p>

      <h2>9. Disclaimer of warranties</h2>
      <p>
        To the fullest extent the law allows, the Service is provided “as is” and “as available” without warranties of any kind, whether
        express or implied, including merchantability, fitness for a particular purpose, accuracy and non-infringement.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, we are not liable for any indirect, incidental, special, consequential or punitive damages,
        or for lost data, profits or goodwill, arising from your use of the Service, and our total liability for any claim is limited to
        US $50. Nothing in these terms limits liability that cannot be limited by law, or any rights you have as a consumer under
        mandatory local law.
      </p>

      <h2>11. Indemnity</h2>
      <p>You agree to cover reasonable losses we suffer from claims caused by your violation of these terms or your misuse of the Service, to the extent the law allows.</p>

      <h2>12. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of the State of {LEGAL.governingState}, without regard to conflict-of-law rules. Please contact
        us first so we can try to resolve any dispute informally. If that fails, disputes will be handled in the state or federal courts
        located in {LEGAL.governingState}, and you and we consent to those courts, except where the law of your home country gives you
        the right to bring a claim elsewhere.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms. We will change the effective date above, and for material changes we will ask you to accept the new
        version. Continuing to use the Service after a change means you accept it.
      </p>

      <h2>14. General</h2>
      <p>If any part of these terms is unenforceable, the rest stays in effect. These terms and the Privacy Policy are our entire agreement with you about the Service.</p>

      <h2>15. Contact</h2>
      <p>{LEGAL.operator} · <Contact /></p>
    </LegalPage>
  );
}
