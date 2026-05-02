import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "Privacy Policy · Signal Strike",
  description: "Privacy Policy for Signal Strike, operated by Hilltop Ave LLC.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      effectiveDate="May 2, 2026"
      lastUpdated="May 2, 2026"
    >
      <p>
        This Privacy Policy explains what information Signal Strike (&quot;we,&quot; &quot;us&quot;) collects, how we use it, who we share it with, and what choices you have. Signal Strike is operated by <strong>Hilltop Ave LLC</strong>, an Iowa limited liability company.
      </p>
      <p>
        We&apos;ve tried to write this in plain language. If anything is unclear, email us at <a href="mailto:consulting@hilltopave.com">consulting@hilltopave.com</a>.
      </p>

      <hr />

      <h2>1. Information We Collect</h2>

      <h3>Information You Give Us</h3>
      <p>
        <strong>Account Information:</strong> Your name, email address, password (hashed, never stored in readable form), company name, and role.
      </p>
      <p>
        <strong>Payment Information:</strong> Billing name, address, and payment method. <strong>We never see or store full credit card numbers</strong> — Stripe handles that. We only see the last 4 digits, card brand, and expiration date for display purposes.
      </p>
      <p>
        <strong>Customer Data:</strong> The content you create and upload to Signal Strike — prospects, deals, notes, contacts, pipeline data, custom fields, integrations data, and similar information.
      </p>
      <p>
        <strong>Communications:</strong> When you email support, fill out a form, or chat with us, we keep records of those communications.
      </p>

      <h3>Information We Collect Automatically</h3>
      <p>
        <strong>Usage Data:</strong> Pages you view, features you use, buttons you click, time spent in the application, and similar product analytics.
      </p>
      <p>
        <strong>Device and Connection Data:</strong> IP address, browser type, operating system, device identifiers, and referring URLs.
      </p>
      <p>
        <strong>Cookies and Similar Technologies:</strong> Small data files that recognize your browser, keep you signed in, and remember preferences. See section 8 for details.
      </p>

      <h3>Information from Third Parties</h3>
      <p>
        If you sign in with a third-party identity provider (such as Google), we receive basic profile information from that provider as authorized by you.
      </p>
      <p>
        If you use the <strong>Apollo Prospect Finder</strong> feature, we receive prospect data from Apollo&apos;s database based on your search queries. This data may include names, job titles, company information, and contact details about people who are not Signal Strike users.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve Signal Strike</li>
        <li>Process payments and manage your subscription</li>
        <li>Authenticate users and protect against fraud or abuse</li>
        <li>Send service-related emails (account notifications, security alerts, billing receipts)</li>
        <li>Respond to support requests</li>
        <li>Generate the Daily Signal email and other automated reports you&apos;ve subscribed to</li>
        <li>Power AI features like Ask Signal (see section 4)</li>
        <li>Analyze usage patterns to improve features and performance</li>
        <li>Comply with legal obligations</li>
        <li>Send occasional product updates or marketing emails (you can opt out anytime)</li>
      </ul>
      <p>We <strong>do not</strong> sell your personal information to third parties.</p>

      <h2>3. Who We Share Information With</h2>
      <p>We share your information only as needed to operate the service or as required by law.</p>

      <h3>Service Providers</h3>
      <p>
        We use a small number of trusted vendors to run Signal Strike. They access your information only to perform their function and are contractually required to protect it:
      </p>
      <ul>
        <li><strong>Stripe</strong> — payment processing and subscription management</li>
        <li><strong>Supabase</strong> — database hosting, authentication, and file storage</li>
        <li><strong>Anthropic</strong> — AI model used for the Ask Signal feature</li>
        <li><strong>Apollo</strong> — prospect data for the Prospect Finder feature</li>
        <li><strong>Vercel</strong> — application hosting and deployment</li>
      </ul>

      <h3>Legal Requirements</h3>
      <p>
        We may disclose information when required by law, court order, or government request, or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
      </p>

      <h3>Business Transfers</h3>
      <p>
        If Signal Strike or Hilltop Ave LLC is acquired, merged, or sells substantially all assets, your information may transfer to the new entity. We&apos;ll notify you before that happens.
      </p>

      <h3>With Your Consent</h3>
      <p>We share information with other parties only when you ask us to (for example, when you connect a third-party integration).</p>

      <h2>4. AI Features and Your Data</h2>
      <p>When you use Ask Signal or other AI features:</p>
      <ul>
        <li>Your query and relevant context (such as the deal or prospect you&apos;re asking about) are sent to <strong>Anthropic&apos;s API</strong> to generate a response</li>
        <li>Anthropic processes the query to generate output and, per their policies, does not use API inputs to train their models</li>
        <li>We log your queries and AI responses to provide history, improve the feature, and debug issues</li>
        <li>AI features process Customer Data only as needed to answer your specific query</li>
      </ul>
      <p>You can avoid AI processing of specific data by not using AI features for that data.</p>

      <h2>5. Data Retention</h2>
      <p>We keep your information for as long as your account is active and as needed to provide the service.</p>
      <p>After you close your account:</p>
      <ul>
        <li><strong>Customer Data</strong> is retained for <strong>30 days</strong> to allow recovery, then permanently deleted</li>
        <li><strong>Account information</strong> (name, email) is retained for up to <strong>12 months</strong> for fraud prevention and legal compliance</li>
        <li><strong>Billing records</strong> are retained for <strong>7 years</strong> as required by tax and accounting regulations</li>
        <li><strong>Backups</strong> may persist for additional time but follow the same deletion timeline</li>
      </ul>
      <p>You can request earlier deletion of specific data — see section 7.</p>

      <h2>6. Security</h2>
      <p>We protect your information with reasonable technical and organizational measures, including:</p>
      <ul>
        <li>Encryption in transit (TLS/HTTPS) for all data sent between your browser and our servers</li>
        <li>Encryption at rest for stored Customer Data</li>
        <li>Hashed passwords (never stored in plain text)</li>
        <li>Access controls limiting which employees can access systems</li>
        <li>Regular security reviews and dependency updates</li>
      </ul>
      <p>
        No system is perfectly secure. If we discover a breach affecting your data, we&apos;ll notify you in accordance with applicable law.
      </p>

      <h2>7. Your Rights and Choices</h2>
      <p>Depending on where you live, you may have rights over your personal information:</p>

      <h3>Everyone</h3>
      <ul>
        <li><strong>Access:</strong> Request a copy of the information we have about you</li>
        <li><strong>Correction:</strong> Update or correct inaccurate information from your account settings</li>
        <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
        <li><strong>Export:</strong> Download your Customer Data anytime from your account</li>
        <li><strong>Marketing Opt-Out:</strong> Unsubscribe from marketing emails using the link in any email</li>
      </ul>

      <h3>European Economic Area, UK, and Switzerland (GDPR)</h3>
      <p>
        You have additional rights including the right to restrict processing, object to processing, and lodge a complaint with your local data protection authority.
      </p>

      <h3>California (CCPA/CPRA)</h3>
      <p>
        You have the right to know what personal information we collect, request deletion, opt out of &quot;sale&quot; of personal information (we don&apos;t sell it), and not be discriminated against for exercising these rights.
      </p>

      <h3>How to Exercise Rights</h3>
      <p>
        Email <a href="mailto:consulting@hilltopave.com">consulting@hilltopave.com</a> with your request. We&apos;ll respond within the timeframe required by applicable law (typically 30–45 days). We may need to verify your identity before fulfilling certain requests.
      </p>

      <h2>8. Cookies and Tracking</h2>
      <p>We use cookies and similar technologies for:</p>
      <ul>
        <li><strong>Essential cookies</strong> — required for the service to work (authentication, security)</li>
        <li><strong>Functional cookies</strong> — remember your preferences (theme, layout)</li>
        <li><strong>Analytics cookies</strong> — help us understand how the service is used (anonymized)</li>
      </ul>
      <p>
        You can disable cookies in your browser settings, but essential cookies are required for Signal Strike to function. We don&apos;t use third-party advertising cookies.
      </p>

      <h2>9. International Data Transfers</h2>
      <p>
        Signal Strike is operated from the United States. If you&apos;re outside the US, your information will be transferred to and processed in the US, where data protection laws may differ from your home jurisdiction. By using Signal Strike, you consent to this transfer.
      </p>
      <p>
        For users in the EEA, UK, or Switzerland, we rely on appropriate transfer mechanisms (such as Standard Contractual Clauses) to protect your data.
      </p>

      <h2>10. Children&apos;s Privacy</h2>
      <p>
        Signal Strike is not intended for anyone under 18. We don&apos;t knowingly collect information from children. If you believe a child has provided us with personal information, contact us and we&apos;ll delete it.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy occasionally. If we make material changes, we&apos;ll notify you by email or in the application at least <strong>30 days</strong> before they take effect. The &quot;Last Updated&quot; date at the top will always reflect the current version.
      </p>

      <h2>12. Contact</h2>
      <p>Questions, requests, or complaints about this Privacy Policy? Reach us at:</p>
      <p>
        <strong>Hilltop Ave LLC</strong><br />
        Email: <a href="mailto:consulting@hilltopave.com">consulting@hilltopave.com</a>
      </p>

      <hr />

      <p style={{ fontStyle: "italic", color: "#71717a" }}>
        By using Signal Strike, you acknowledge you&apos;ve read and understood this Privacy Policy.
      </p>
    </LegalLayout>
  );
}
