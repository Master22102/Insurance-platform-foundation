const EFFECTIVE_DATE = 'March 15, 2026';

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of terms',
    content: `By accessing or using the Wayfarer service — including our web and mobile applications, APIs, and related services — you agree to be bound by these Terms of Service. If you are using Wayfarer on behalf of an organization, you agree to these terms on behalf of that organization.

If you do not agree to these terms, do not use the service.`,
  },
  {
    id: 'description',
    title: '2. Service description',
    content: `Wayfarer provides software tools for:

- Organizing travel records and itineraries
- Uploading and analyzing travel insurance, credit card benefit, and carrier policy documents
- Documenting travel incidents and collecting evidence
- Routing claims to applicable insurance and carrier recipients

**Important limitation**: Wayfarer is a documentation and guidance tool. We do not provide legal advice, insurance advice, or claims representation. Our analysis of your policies is informational only. The accuracy of extracted policy terms depends on the quality and completeness of uploaded documents. Always verify coverage terms directly with your insurer or card issuer.`,
  },
  {
    id: 'accounts',
    title: '3. Accounts',
    content: `You must provide a valid email address and accurate information when registering. You are responsible for maintaining the security of your account credentials. You must notify us immediately if you suspect unauthorized access to your account.

We reserve the right to suspend or terminate accounts that violate these terms, engage in fraud, or are used in ways that harm other users or the integrity of the service.`,
  },
  {
    id: 'content',
    title: '4. Your content',
    content: `You retain ownership of all content you upload to Wayfarer, including policy documents, evidence files, and incident records. By uploading content, you grant Wayfarer a limited license to process, store, and display that content for the purpose of providing the service to you.

You are responsible for ensuring you have the right to upload any documents you submit. Do not upload documents you are not authorized to share (e.g., confidential third-party documents).

We do not sell, license, or share your uploaded documents with third parties. Your documents are used exclusively to provide the service to you.`,
  },
  {
    id: 'prohibited',
    title: '5. Prohibited uses',
    content: `You agree not to use Wayfarer to:

- Submit false claims or fabricate evidence
- Circumvent any technical measures that restrict access
- Attempt to access other users' accounts or data
- Use the service in any way that violates applicable laws
- Reverse engineer, decompile, or extract source code from the application
- Use automated scripts or bots to interact with the service without permission

Violation of these terms may result in immediate account termination and, where appropriate, referral to law enforcement.`,
  },
  {
    id: 'subscriptions',
    title: '6. Subscriptions and payment',
    content: `Paid plans are billed monthly or annually, as selected. Payments are processed by Stripe. By providing payment information, you authorize Stripe to charge your payment method on a recurring basis.

Subscriptions renew automatically unless cancelled before the renewal date. To cancel, visit account settings. Cancellation takes effect at the end of the current billing period — there are no prorated refunds for partial periods.

**Lifetime plans**: A one-time payment grants permanent access to all features included at the time of purchase, plus future updates as described on the pricing page. Lifetime access does not include features added to a higher-tier plan after your purchase date.`,
  },
  {
    id: 'liability',
    title: '7. Limitation of liability',
    content: `To the maximum extent permitted by applicable law, Wayfarer shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:

- Loss of data or documents
- Missed claim filing deadlines
- Denial of insurance claims
- Inaccurate policy interpretation

Our total liability to you for any claim arising from use of the service shall not exceed the greater of (a) the amount you paid to Wayfarer in the 12 months preceding the claim or (b) $100.

Wayfarer is a documentation tool. Claim outcomes depend on insurer decisions, jurisdictional law, and many factors outside our control.`,
  },
  {
    id: 'disclaimers',
    title: '8. Disclaimers',
    content: `The service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that:

- The service will be uninterrupted or error-free
- Policy extractions will be complete or accurate
- Claim routing recommendations will result in successful claim outcomes
- The service will meet your specific requirements

Your use of the service is at your sole risk.`,
  },
  {
    id: 'termination',
    title: '9. Termination',
    content: `You may delete your account at any time from account settings. Upon deletion, we initiate a 30-day grace period before permanent deletion — contact support during this period to recover your account.

We may suspend or terminate your access if you violate these terms. We will provide reasonable notice before termination except in cases of fraud, abuse, or legal requirement.`,
  },
  {
    id: 'governing-law',
    title: '10. Governing law',
    content: `These terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved through binding arbitration administered under the rules of the American Arbitration Association, except that either party may seek injunctive relief in a court of competent jurisdiction.

EU users: Nothing in these terms limits your rights under applicable EU consumer protection law.`,
  },
  {
    id: 'changes',
    title: '11. Changes to these terms',
    content: `We may update these terms from time to time. Material changes will be communicated by email and in-app notice at least 14 days before taking effect. Continued use of the service after the effective date constitutes acceptance of the revised terms.`,
  },
  {
    id: 'contact',
    title: '12. Contact',
    content: `For questions about these terms, contact us at:

**Email**: legal@wayfarer.app

We will respond within 5 business days.`,
  },
];

function renderContent(content: string) {
  const lines = content.split('\n').filter(Boolean);
  return lines.map((line, i) => {
    if (line.startsWith('- ')) {
      const bullet = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return <li key={i} dangerouslySetInnerHTML={{ __html: bullet }} style={{ fontSize: 15, color: '#555', lineHeight: 1.7, marginBottom: 4 }} />;
    }
    const processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return <p key={i} dangerouslySetInnerHTML={{ __html: processed }} style={{ fontSize: 15, color: '#555', lineHeight: 1.8, margin: '0 0 14px' }} />;
  });
}

export default function TermsPage() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: 'white' }}>
      <section style={{
        background: 'linear-gradient(160deg, #0d1b2a 0%, #0f2518 50%, #0d1b2a 100%)',
        padding: '140px 24px 80px',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 16 }}>
            Legal
          </span>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: 'white', margin: '0 0 14px', letterSpacing: '-1px', lineHeight: 1.1 }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      <section style={{ padding: '64px 24px 96px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 48 }} className="legal-layout">
          <nav style={{ width: 220, flexShrink: 0, position: 'sticky', top: 96, alignSelf: 'flex-start', height: 'fit-content' }} className="legal-toc">
            <p style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Contents</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} style={{ fontSize: 13, color: '#666', textDecoration: 'none', padding: '4px 0', lineHeight: 1.4 }}>
                  {s.title}
                </a>
              ))}
            </div>
          </nav>
          <div style={{ flex: 1, minWidth: 0 }}>
            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} style={{ marginBottom: 48 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0d1b2a', margin: '0 0 16px', letterSpacing: '-0.3px' }}>
                  {section.title}
                </h2>
                <div>
                  {renderContent(section.content)}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .legal-layout { flex-direction: column !important; }
          .legal-toc { display: none !important; }
        }
      `}</style>
    </div>
  );
}
