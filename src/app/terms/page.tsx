import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "Terms of Service · Signal Strike",
  description: "Terms of Service for Signal Strike, operated by Hilltop Ave LLC.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      effectiveDate="May 2, 2026"
      lastUpdated="May 2, 2026"
    >
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Signal Strike, a revenue CRM software-as-a-service product operated by <strong>Hilltop Ave LLC</strong>, an Iowa limited liability company doing business as Signal Strike (&quot;Signal Strike,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
      </p>
      <p>
        By creating an account, starting a trial, or otherwise using Signal Strike, you agree to these Terms. If you don&apos;t agree, don&apos;t use the service.
      </p>

      <hr />

      <h2>1. The Service</h2>
      <p>
        Signal Strike is a revenue CRM platform that helps sales teams manage pipelines, track deals, find prospects, and analyze performance. Specific features depend on the subscription tier you choose (Scout, Strike, or Command), and we may add, change, or remove features over time.
      </p>
      <p>
        We provide the service &quot;as is.&quot; We work hard to keep it running, but we don&apos;t promise uninterrupted access or that every feature will work perfectly all the time.
      </p>

      <h2>2. Your Account</h2>
      <p>You need an account to use Signal Strike. When you create one, you agree to:</p>
      <ul>
        <li>Provide accurate and current information</li>
        <li>Keep your password confidential</li>
        <li>Take responsibility for everything that happens under your account</li>
        <li>Notify us promptly if you suspect unauthorized access</li>
      </ul>
      <p>
        You must be at least 18 years old to use Signal Strike. The service is intended for business use, not personal use.
      </p>

      <h2>3. Trials and Subscriptions</h2>

      <h3>Trial Activation</h3>
      <p>
        When you start a trial, we charge a one-time <strong>$1.00 trial activation fee</strong> to verify your payment method. You then receive <strong>14 days of full access</strong> to your selected tier (Scout, Strike, or Command).
      </p>

      <h3>Conversion to Paid Subscription</h3>
      <p>On day 15, your subscription automatically converts to a paid monthly plan at the published rate for your tier:</p>
      <ul>
        <li><strong>Scout:</strong> $29 per user per month</li>
        <li><strong>Strike:</strong> $79 per user per month</li>
        <li><strong>Command:</strong> $129 per user per month</li>
        <li><strong>Team Management Add-on:</strong> $25 per managed seat per month (where applicable)</li>
      </ul>

      <h3>Cancellation and Refunds</h3>
      <p>
        You can cancel anytime from your account billing page. If you cancel before day 15, you only pay the $1 activation fee — no monthly charge. After day 15, cancellation stops future billing but doesn&apos;t refund the current month. We don&apos;t offer prorated refunds for partial months.
      </p>

      <h3>Price Changes</h3>
      <p>
        We may change subscription prices with at least <strong>30 days&apos; notice</strong> by email. If you don&apos;t agree to a price change, you can cancel before it takes effect.
      </p>

      <h3>Failed Payments</h3>
      <p>
        If your payment fails, we&apos;ll attempt to charge again and notify you. If we can&apos;t collect within a reasonable window, we may suspend or cancel your access.
      </p>

      <h2>4. Acceptable Use</h2>
      <p>You may not:</p>
      <ul>
        <li>Use Signal Strike for anything illegal</li>
        <li>Upload content that violates someone else&apos;s rights (copyright, trademark, privacy, etc.)</li>
        <li>Send spam, phishing, or unsolicited messages through the platform</li>
        <li>Reverse engineer, decompile, or attempt to extract our source code</li>
        <li>Resell, sublicense, or redistribute Signal Strike to third parties</li>
        <li>Use the service to build a competing product</li>
        <li>Scrape data from us in volumes that strain our infrastructure</li>
        <li>Bypass usage limits, rate limits, or access controls</li>
        <li>Impersonate another person or entity</li>
      </ul>
      <p>If you violate these rules, we may suspend or terminate your account without refund.</p>

      <h2>5. Your Data</h2>

      <h3>What You Own</h3>
      <p>
        You own all the data you put into Signal Strike — your prospects, deals, notes, pipeline data, and other content (&quot;Customer Data&quot;). We don&apos;t claim ownership of it.
      </p>

      <h3>License to Us</h3>
      <p>
        You grant us a limited license to host, store, transmit, and display your Customer Data solely to provide the service to you. This license ends when you delete the data or close your account.
      </p>

      <h3>Aggregated Data</h3>
      <p>
        We may use anonymized, aggregated data (where it can&apos;t be traced back to you or any individual) to improve the service, generate benchmarks, or for research. Customer Data itself is never sold or shared except as described in our Privacy Policy.
      </p>

      <h3>Data Export</h3>
      <p>
        You can export your data at any time during your subscription. We retain your data for <strong>30 days</strong> after account closure to allow recovery, after which it&apos;s permanently deleted.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        Signal Strike — including its software, design, brand, logos, and documentation — is owned by Hilltop Ave LLC and protected by copyright, trademark, and other laws. We grant you a limited, non-exclusive, non-transferable license to use the service during your subscription.
      </p>
      <p>You don&apos;t get any ownership rights in Signal Strike itself, just the right to use it.</p>

      <h2>7. Third-Party Services</h2>
      <p>Signal Strike integrates with third-party services to provide functionality, including:</p>
      <ul>
        <li><strong>Stripe</strong> for payment processing</li>
        <li><strong>Supabase</strong> for data storage and authentication</li>
        <li><strong>Anthropic</strong> for the &quot;Ask Signal&quot; AI chat feature</li>
        <li><strong>Apollo</strong> for prospect finder data</li>
        <li><strong>Vercel</strong> for application hosting</li>
      </ul>
      <p>
        Your use of these features is also subject to those providers&apos; terms. We&apos;re not responsible for third-party service outages, data practices, or changes to their offerings.
      </p>

      <h2>8. AI Features</h2>
      <p>Signal Strike includes AI-powered features (such as Ask Signal). When you use them:</p>
      <ul>
        <li>Your queries and relevant context are sent to our AI provider (Anthropic) to generate responses</li>
        <li>AI outputs may contain errors, omissions, or fabricated details — verify important information before relying on it</li>
        <li>We don&apos;t guarantee accuracy, fitness for purpose, or any specific outcome from AI features</li>
        <li>AI usage may be subject to per-tier credit limits</li>
      </ul>

      <h2>9. Termination</h2>
      <p>You can cancel your subscription anytime. We can also terminate or suspend your account if:</p>
      <ul>
        <li>You materially breach these Terms</li>
        <li>Required by law or court order</li>
        <li>Continued service creates legal or security risk for us or other users</li>
        <li>You haven&apos;t paid</li>
      </ul>
      <p>
        On termination, your right to use Signal Strike ends immediately. Sections that should survive termination (data ownership, dispute resolution, limitation of liability, etc.) continue to apply.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        <strong>Signal Strike is provided &quot;as is&quot; and &quot;as available.&quot;</strong> To the fullest extent permitted by law, we disclaim all warranties — express, implied, or statutory — including warranties of merchantability, fitness for a particular purpose, non-infringement, and that the service will be uninterrupted or error-free.
      </p>
      <p>
        We don&apos;t guarantee any particular sales outcome, revenue increase, deal closure rate, or business result from using Signal Strike. CRM software helps you organize work; it doesn&apos;t replace doing the work.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>To the fullest extent permitted by law:</p>
      <ul>
        <li>Our total liability for any claim related to Signal Strike is limited to the amount you paid us in the <strong>12 months</strong> before the event giving rise to the claim</li>
        <li>We are not liable for indirect, incidental, consequential, special, or punitive damages — including lost profits, lost revenue, lost data, or business interruption — even if we&apos;ve been advised of the possibility</li>
      </ul>
      <p>
        These limits apply regardless of the legal theory (contract, tort, statute, or otherwise) and even if a remedy fails its essential purpose.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless Hilltop Ave LLC and its officers, employees, and agents from any claim arising out of:
      </p>
      <ul>
        <li>Your use of Signal Strike</li>
        <li>Your Customer Data</li>
        <li>Your violation of these Terms</li>
        <li>Your violation of any law or third-party right</li>
      </ul>

      <h2>13. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the <strong>laws of the State of Iowa</strong>, without regard to conflict-of-laws principles.
      </p>

      <h3>Mandatory Arbitration</h3>
      <p>
        Any dispute arising out of or relating to these Terms or Signal Strike will be resolved by <strong>binding arbitration</strong> administered by the <strong>American Arbitration Association (AAA)</strong> under its Commercial Arbitration Rules. The arbitration will take place in <strong>Iowa</strong>, and the arbitrator&apos;s decision is final.
      </p>

      <h3>No Class Actions</h3>
      <p>
        You and Signal Strike each waive the right to bring claims as a class action, collective action, or in any representative capacity.
      </p>

      <h3>Exception for Small Claims and IP</h3>
      <p>
        Either party may bring an individual claim in small claims court (if it qualifies) or seek injunctive relief in court for intellectual property infringement.
      </p>

      <h2>14. Changes to These Terms</h2>
      <p>
        We may update these Terms occasionally. If we make material changes, we&apos;ll notify you by email or in the application at least <strong>30 days</strong> before they take effect. Continued use after the effective date means you accept the updated Terms.
      </p>

      <h2>15. Miscellaneous</h2>
      <ul>
        <li><strong>Entire Agreement:</strong> These Terms (along with our Privacy Policy) are the complete agreement between you and Signal Strike on this subject.</li>
        <li><strong>Severability:</strong> If any part is found unenforceable, the rest stays in effect.</li>
        <li><strong>No Waiver:</strong> If we don&apos;t enforce a right, that doesn&apos;t waive our right to enforce it later.</li>
        <li><strong>Assignment:</strong> You can&apos;t transfer these Terms without our written consent. We can transfer them in connection with a merger, acquisition, or sale of assets.</li>
        <li><strong>Force Majeure:</strong> We&apos;re not liable for delays or failures caused by events beyond our reasonable control (natural disasters, internet outages, government actions, etc.).</li>
      </ul>

      <h2>16. Contact</h2>
      <p>Questions about these Terms? Reach us at:</p>
      <p>
        <strong>Hilltop Ave LLC</strong><br />
        Email: <a href="mailto:consulting@hilltopave.com">consulting@hilltopave.com</a>
      </p>

      <hr />

      <p style={{ fontStyle: "italic", color: "#71717a" }}>
        By using Signal Strike, you confirm you&apos;ve read, understood, and agree to these Terms.
      </p>
    </LegalLayout>
  );
}
