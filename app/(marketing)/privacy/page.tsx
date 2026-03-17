const EFFECTIVE_DATE = 'March 15, 2026';

const SECTIONS = [
  {
    id: 'overview',
    title: '1. Overview',
    content: `Wayfarer, Inc. ("Wayfarer," "we," "our," or "us") provides travel protection intelligence software through our mobile and web applications. This Privacy Policy explains what personal data we collect, why we collect it, how it is used, and the rights you have with respect to your data.

By using Wayfarer, you agree to the practices described in this policy. If you do not agree, please discontinue use and contact us to request deletion of your data.`,
  },
  {
    id: 'data-collected',
    title: '2. Data we collect',
    content: `**Account information**: When you register, we collect your email address, display name, and optionally your phone number. We do not collect payment card numbers — payment is processed by Stripe, which maintains its own data practices.

**Trip and itinerary data**: Trip names, destinations, dates, travel companions, and itinerary segments you create in the app.

**Policy documents**: Insurance policy certificates, credit card benefit guides, airline contracts of carriage, and other documents you upload for extraction. These may contain your name, policy number, coverage limits, and other personal identifiers present in the document.

**Incident and claim records**: Incident narratives, evidence files (photos, receipts, carrier notices), claim routing decisions, and filing records.

**Technical data**: IP addresses, browser or device type, session tokens, and application event logs. We do not track your behavior across third-party websites.`,
  },
  {
    id: 'use',
    title: '3. How we use your data',
    content: `We use the data we collect to:

- Provide and operate the Wayfarer service
- Extract and analyze policy documents using our document intelligence pipeline
- Match incidents to applicable coverage sources and generate claim routing recommendations
- Send transactional communications (account verification, password reset, claim status updates)
- Improve the accuracy of our extraction engine and coverage taxonomy
- Comply with legal obligations

We do not sell your personal data to third parties. We do not use your data to train external AI models without your explicit consent. Clause extraction models are trained on synthetic and anonymized datasets only.`,
  },
  {
    id: 'retention',
    title: '4. Data retention',
    content: `We retain your data for as long as your account is active. Upon account deletion, we initiate a 30-day deletion window during which data can be recovered by contacting support, after which all personal data is permanently deleted from our systems.

Trip records are subject to jurisdiction-specific retention defaults:

- **Default**: 3 years for trips, 5 years for incidents and evidence, 7 years for claims records
- **EU/EEA (GDPR)**: 2 years for trips, 3 years for incidents and evidence, 6 years for claims
- **California (CCPA)**: Same as EU/EEA defaults

Users on Frequent and Lifetime plans can configure custom retention periods in account settings.`,
  },
  {
    id: 'sharing',
    title: '5. Data sharing',
    content: `We share your data only with:

**Service providers**: We use Supabase for database hosting, Stripe for payment processing, and Vercel/Netlify for web hosting. Each operates under a data processing agreement with Wayfarer.

**Legal compliance**: We may disclose your data when required by law, subpoena, or other legal process, or to protect the rights and safety of our users.

We do not share your data with insurers, airlines, travel companies, or any other commercial third parties without your explicit instruction (e.g., when you use the claim routing feature to file with a specific insurer).`,
  },
  {
    id: 'rights',
    title: '6. Your rights',
    content: `Depending on your jurisdiction, you may have the following rights:

**Access**: Request a copy of all personal data we hold about you. You can export your data from account settings at any time.

**Correction**: Request correction of inaccurate data.

**Erasure**: Request deletion of your account and all associated data. Requests can be submitted via account settings or by emailing privacy@wayfarer.app.

**Portability**: Receive your data in a machine-readable format (JSON). Available via the data export feature.

**Objection**: Object to certain types of processing, including profiling.

For EU/EEA users: These rights are provided under GDPR Articles 15–22. We will respond to verified requests within 30 days.

For California users: CCPA rights including the right to know, delete, and opt-out of sale (we do not sell data) are fully honored.`,
  },
  {
    id: 'security',
    title: '7. Security',
    content: `We implement industry-standard security measures including:

- Row-level security on all database tables (no cross-account data access)
- Encryption at rest and in transit (TLS 1.3)
- Immutable audit logs for all data mutations
- Integrity hashes on all ingested documents
- MFA support for all accounts

We are currently pursuing SOC 2 Type II certification. Our full security posture is documented at wayfarer.app/security.`,
  },
  {
    id: 'cookies',
    title: '8. Cookies and tracking',
    content: `We use session cookies necessary for authentication. We do not use advertising cookies, tracking pixels, or third-party analytics. We do not track users across websites.

The only first-party analytics we collect are aggregated, non-identifiable usage metrics (e.g., total trips created, documents processed) used solely to improve the product.`,
  },
  {
    id: 'children',
    title: '9. Children',
    content: `Wayfarer is not directed at children under 16. We do not knowingly collect personal data from children under 16. If we learn that we have collected personal data from a child under 16, we will delete it promptly.`,
  },
  {
    id: 'changes',
    title: '10. Changes to this policy',
    content: `We will notify you of material changes to this policy by email and by displaying a notice in the app at least 14 days before the changes take effect. The effective date of the most recent version is shown at the top of this page.`,
  },
  {
    id: 'contact',
    title: '11. Contact',
    content: `For privacy-related questions, data requests, or to report a concern, contact us at:

**Email**: privacy@wayfarer.app
**Subject**: "Privacy Request — [your request type]"

We respond to all requests within 5 business days and to formal legal requests within 30 days.`,
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

export default function PrivacyPage() {
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
            Privacy Policy
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
