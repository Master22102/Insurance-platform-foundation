/*
  # Blog and Marketing Tables

  ## New Tables

  ### blog_posts
  Stores all blog content for the public marketing site.
  - slug (unique URL identifier)
  - title, excerpt, content (markdown)
  - author name and optional avatar initials
  - category tag for filtering
  - read_minutes estimate
  - published_at timestamp (null = draft)
  - cover_image_url for optional header image

  ### marketing_subscribers
  Captures email newsletter signups from the marketing site footer.
  - email (unique)
  - subscribed_at
  - source (e.g. 'footer', 'pricing', 'blog')

  ## Security
  - blog_posts: publicly readable (no auth required), no RLS write access from client
  - marketing_subscribers: insert-only via service role in API; no client reads
*/

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT 'Wayfarer Team',
  author_initials text NOT NULL DEFAULT 'WT',
  category text NOT NULL DEFAULT 'Travel',
  read_minutes int NOT NULL DEFAULT 5,
  published_at timestamptz,
  cover_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text NOT NULL DEFAULT 'footer',
  subscribed_at timestamptz DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published blog posts"
  ON blog_posts FOR SELECT
  USING (published_at IS NOT NULL AND published_at <= now());

CREATE POLICY "Service role can insert marketing subscribers"
  ON marketing_subscribers FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read marketing subscribers"
  ON marketing_subscribers FOR SELECT
  TO service_role
  USING (true);

INSERT INTO blog_posts (slug, title, excerpt, content, author, author_initials, category, read_minutes, published_at) VALUES
(
  'how-to-document-a-flight-delay',
  'How to Document a Flight Delay for Insurance',
  'A step-by-step guide to collecting the right evidence when your flight is delayed — so your claim doesn''t get denied.',
  E'# How to Document a Flight Delay for Insurance\n\nFlight delays are one of the most common travel disruptions — and one of the most commonly underclaimed. Most travelers know they *might* be entitled to compensation, but few collect the right evidence in the moment, and their claims are delayed or denied as a result.\n\nHere''s a practical guide to what you should do within the first few hours of a delay.\n\n## Step 1: Get the official delay notice in writing\n\nAirlines are required to provide written notice for delays over a certain threshold in most jurisdictions. Ask the gate agent for a written statement including the cause of the delay and the flight number. Screenshot the departure board showing the new departure time.\n\nThis is the single most important piece of evidence. Without a carrier-issued delay notification, many insurers will reject claims outright.\n\n## Step 2: Photograph the departure board\n\nYes, even if you have a digital boarding pass. Physical evidence of the displayed delay time and reason (weather, mechanical, crew) supplements the airline''s records and prevents disputes about when the delay was announced.\n\n## Step 3: Keep all receipts for expenses incurred\n\nMost travel insurance policies and many airline programs cover "consequential expenses" during delays — meals, hotel accommodation, ground transport. These only pay out if you have receipts. Keep everything, even a $4 airport coffee.\n\nUse your phone to photograph receipts immediately rather than saving paper copies.\n\n## Step 4: Note the reason for the delay\n\nThis matters enormously. A mechanical failure is typically covered by travel insurance and qualifies for EU261 compensation. "Air traffic control" is often covered. Weather is a wildcard — many policies exclude it, others cover trip interruption caused by severe weather.\n\nAsk the gate agent directly: "Is this delay classified as mechanical, weather, or ATC?"\n\n## Step 5: File with the right entity\n\nDepending on your situation, you may have claims with up to three different parties:\n\n1. **The airline** — for delays over 2 hours (or 3 hours under EU261), or for missed connections that are the airline''s fault\n2. **Your travel insurer** — for consequential expenses, trip interruption, and downstream missed bookings\n3. **Your credit card** — if you paid with a card that has trip delay coverage, you may have a separate claim for meals and accommodation\n\nWayfarer''s claim routing engine will identify all applicable policies and guide you through each filing.\n\n## The bottom line\n\nDocumentation is everything. The first 30 minutes after a delay is announced are the most important window. Travelers who act immediately and keep their records organized are significantly more likely to receive full compensation.',
  'The Wayfarer Team',
  'WT',
  'Insurance',
  8,
  now() - interval '7 days'
),
(
  'what-credit-card-travel-protection-actually-covers',
  'What Your Credit Card Travel Policy Actually Covers',
  'Premium travel cards advertise extensive protections — but the fine print is dense. Here''s what you actually get and what typically falls through the cracks.',
  E'# What Your Credit Card Travel Policy Actually Covers\n\nIf you carry a premium travel credit card — Chase Sapphire Reserve, Amex Platinum, Citi Prestige — you''ve probably seen the marketing: "Comprehensive travel protection." But what does that actually mean when something goes wrong?\n\nWe reviewed the benefit guides for the top 12 premium travel cards and summarized what you can realistically expect to claim.\n\n## Trip delay reimbursement\n\nMost premium cards cover trip delay expenses after a threshold — typically 6 or 12 hours, or an overnight stay required. Coverage typically caps at $200–$500 per day, for meals and accommodation only. Ground transport is sometimes included.\n\n**Key requirement**: The delay must be caused by a covered reason. Mechanical failure and severe weather usually qualify. "Schedule changes" typically do not.\n\n**What falls through**: Delays under the threshold. Delays caused by airline schedule changes (as opposed to day-of disruptions). Pre-trip cancellations.\n\n## Trip cancellation / interruption\n\nThis is where credit card coverage diverges significantly from standalone travel insurance. Card cancellation coverage typically only applies to:\n\n- Accidental injury or death of the cardholder or immediate family\n- Severe weather making the destination inaccessible\n- Jury duty or military deployment\n\nIt does *not* typically cover "cancel for any reason," supplier bankruptcy, or illness without hospitalization.\n\n**Coverage amounts**: Most cards cap at $5,000–$10,000 per trip, with a per-person sub-limit.\n\n## Baggage delay\n\nIf your checked baggage is delayed by more than 6 hours (sometimes 12), most premium cards reimburse reasonable expenses for essential items — toiletries, a change of clothes. Typical coverage: $100–$300.\n\n**What falls through**: Carry-on luggage. Valuables (electronics, jewelry). Baggage that was lost (not delayed) — that falls under separate lost luggage coverage.\n\n## Emergency medical\n\nMost credit cards do *not* provide significant emergency medical coverage. This is the biggest misconception. The medical benefit on most cards is either non-existent or limited to $2,500–$10,000 — far below the cost of a serious hospitalization or medical evacuation abroad.\n\nIf you travel internationally, you need standalone travel medical insurance.\n\n## How to file a credit card travel claim\n\n1. Call the number on the back of your card and ask for the benefits administrator (often a third party like Allianz or AIG)\n2. Request a claim form\n3. Submit all documentation: boarding passes, receipts, delay notice from carrier, and any correspondence with the airline\n4. Most cards require claims within 60–180 days of the incident\n\nWayfarer automatically extracts the key benefit terms from your card''s benefit guide so you know your actual limits before you need to file.',
  'The Wayfarer Team',
  'WT',
  'Coverage',
  7,
  now() - interval '14 days'
),
(
  'group-travel-and-insurance',
  'Group Travel and Insurance: What Changes When You''re Not Traveling Alone',
  'Traveling with friends or family introduces coverage gaps that solo travelers never face. Here''s what to know before you book a group trip.',
  E'# Group Travel and Insurance: What Changes When You''re Not Traveling Alone\n\nGroup travel is increasingly popular — multi-generational family vacations, friend group trips, corporate retreats. But most people assume that travel insurance works the same whether you''re solo or in a group. It doesn''t.\n\n## Each traveler needs their own coverage\n\nThis seems obvious but is frequently misunderstood. Your travel insurance policy covers *you*, not your travel companions. If your companion gets sick and can''t travel, your trip cancellation coverage only applies if the policy considers your companion a "traveling companion" under the specific terms.\n\nSome policies define "traveling companion" as someone you share accommodation with. Others require a formal definition on enrollment. If your companion isn''t properly documented, their illness doesn''t trigger *your* cancellation benefit.\n\n## The pre-existing conditions wrinkle\n\nMany travel insurance policies exclude pre-existing conditions unless you purchase within a set window of your initial trip deposit (often 14–21 days). In group travel, this window applies to each individual. If anyone in your group books late, they may not qualify for the pre-existing condition waiver.\n\n## What "cancel for any reason" actually requires\n\nCancel for any reason (CFAR) coverage is one of the most powerful add-ons available — but it typically requires:\n\n1. All travelers on the itinerary to be covered under policies that include CFAR\n2. Purchase within 14–21 days of the first trip deposit\n3. Cancellation at least 48–72 hours before departure\n\nIf one traveler doesn''t purchase CFAR, the entire group may lose the benefit.\n\n## Shared costs and who can claim them\n\nWhen you book a vacation rental or group tour and pay a shared deposit, the question of who can claim a refund if one person cancels is complex. The person whose card was charged is typically the only one who can file a credit card claim. Each insured traveler can only claim their own portion of the trip cost.\n\n## Wayfarer for group trips\n\nWayfarer supports group trips with shared trip records, so all travelers can document the same itinerary independently. Each traveler maintains their own incident records, evidence, and claim routing — while benefiting from shared trip context.',
  'Sarah Chen',
  'SC',
  'Travel',
  6,
  now() - interval '21 days'
),
(
  'soc2-and-travel-data',
  'SOC 2 and Why It Matters for Travel Data',
  'Your travel records contain some of the most sensitive personal data you generate. Here''s why SOC 2 compliance matters for apps that hold it.',
  E'# SOC 2 and Why It Matters for Travel Data\n\nWhen you use a travel app, you''re sharing more than your flight details. You''re sharing your location history, your insurance policies, your medical coverage limits, financial records, and in some cases your passport information. This is among the most sensitive data a consumer app can hold.\n\nSo why do so few travel apps take security certifications seriously?\n\n## What SOC 2 actually requires\n\nSOC 2 is an auditing framework developed by the American Institute of CPAs (AICPA). It evaluates a company against five Trust Services Criteria:\n\n- **Security**: Systems are protected against unauthorized access\n- **Availability**: Systems are available as committed\n- **Processing integrity**: System processing is complete, accurate, and authorized\n- **Confidentiality**: Information designated as confidential is protected\n- **Privacy**: Personal information is collected, used, retained, and disclosed appropriately\n\nA Type I report certifies that controls are *designed* appropriately at a point in time. A Type II report certifies that controls *operated effectively* over a period (usually 6–12 months).\n\n## Why it matters for travel apps specifically\n\nTravel data intersects with multiple regulatory frameworks:\n\n- **GDPR** (EU): If you have EU users, you are subject to GDPR regardless of where you''re incorporated\n- **CCPA** (California): Covers any business with California users above revenue thresholds\n- **HIPAA-adjacent**: Travel medical insurance data, while not directly covered by HIPAA, often includes health information that deserves equivalent protection\n\nA company pursuing SOC 2 is building the controls infrastructure that underlies compliance with all of these.\n\n## What we''re doing at Wayfarer\n\nWayfarer is currently pursuing SOC 2 Type II certification. In the meantime, we''ve implemented the core technical controls:\n\n- Row-level security on all database tables (no cross-account data access)\n- Immutable audit logs for all data writes\n- SHA-256 integrity hashes on document ingestion\n- Retention policies aligned with GDPR and CCPA requirements\n- Zero PII logging in application infrastructure\n\nYou can review our current security posture in the Trust & Safety section of your account settings.',
  'The Wayfarer Team',
  'WT',
  'Security',
  9,
  now() - interval '28 days'
)
ON CONFLICT (slug) DO NOTHING;
