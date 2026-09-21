# Digital Heroes — Golf Performance & Charitable Draw Platform

Digital Heroes is a full-stack subscription platform that combines golf performance tracking, charitable fundraising, and monthly prize draws. Members track their Stableford golf scores, contribute a portion of every membership fee to verified charities, and qualify for algorithmically weighted monthly draws.

---

## 1. Project Overview

Digital Heroes bridges amateur golf engagement and philanthropic impact:
* **Golf Performance Tracking**: Players record their Stableford scores (1–45 points). The platform automatically retains each player's latest 5 scores on a rolling basis.
* **Charity Empowerment**: Members designate a partner charity upon signup or through their profile, allocating a customizable percentage (minimum 10%) of their subscription directly to charity.
* **Monthly Prize Draws**: Transparent, lottery-style prize draws conducted monthly. The platform supports standard random draws as well as an algorithmically weighted mode that uses participant score frequencies.
* **Prize Pool & Rollover**: 40% (Tier 5 - 5 matches), 35% (Tier 4 - 4 matches), and 25% (Tier 3 - 3 matches). Unclaimed Tier 5 jackpots automatically roll over into the next monthly draw.
* **Winner Verification**: Scorecard proof upload to private Supabase Storage, audited by administrators before payouts are disbursed.
* **Administrative Control**: Comprehensive admin portal for managing users, subscriptions, charities, monthly draw simulations, winner verification, and platform analytics.

---

## 2. Core Features

* **Public Experience**:
  * Marketing homepage with platform mechanics, prize tier breakdown, and FAQ.
  * Searchable and filterable Charity Directory with dedicated charity profiles and upcoming charity events.
  * Direct independent donation capability with Stripe Checkout.
* **Subscriber Dashboard**:
  * Real-time subscription status and Stripe Billing Portal integration.
  * Rolling 5-score golf retention system with date uniqueness validation.
  * Monthly draw eligibility checklist (active subscription + 5 retained scores).
  * Recent draw results and personal match history.
  * Winnings ledger with proof screenshot upload modal.
* **Draw Engine**:
  * 5 winning numbers drawn from 1 to 45.
  * Algorithmic mode weighted by participant score frequency.
  * Safe administrative draw simulation before publication.
  * Atomic draw publication enforced via transactional PostgreSQL stored procedures (`publish_draw`).
  * Automatic rollover tracking for unclaimed Tier 5 jackpots.
* **Winner Auditing & Payouts**:
  * Private, authenticated storage for scorecard proof images.
  * Admin review queue with approve/reject actions (rejections require mandatory audit notes).
  * Signed URL generation with strict row-level security.
  * Compare-and-swap (CAS) concurrency protection for recording payouts.
* **Role & User Administration**:
  * Master user directory with role and subscription filters.
  * Atomic role promotion/demotion protected against self-demotion and last-admin removal.
  * Admin score override and subscription cancellation at period end.

---

## 3. User Roles

* **Subscriber**:
  * Default role assigned upon registration.
  * Can manage profile, select charity, submit scores, subscribe, enter draws, view winnings, and upload winner verification proofs.
* **Administrator**:
  * Elevated privileges to access `/admin`.
  * Can manage charities and events, simulate and publish monthly draws, verify winner proof scorecards, record payouts, manage user accounts, and view platform KPIs.
  * Multi-layer defense: protected by Next.js Edge Middleware, Server Layout checks, Server Action validations, and PostgreSQL Row-Level Security (`public.is_admin()`).

---

## 4. Tech Stack

* **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React icons.
* **Backend**: Next.js Server Actions & Route Handlers, TypeScript (strict mode), Zod validation.
* **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS), Supabase SSR Auth, PostgreSQL stored procedures (PL/pgSQL).
* **Storage**: Supabase Storage (`winner-proofs` private bucket).
* **Payments & Billing**: Stripe API (Checkout Sessions, Customer Billing Portal, and Webhooks).
* **Testing & Quality**: Node.js Test Runner (`node:test`), `tsx`, ESLint, Turbopack.

---

## 5. Application Architecture

```
                                  +---------------------------------------+
                                  |         Next.js App Router            |
                                  +---------------------------------------+
                                         /            |             \
                                        /             |              \
                    +----------------------+   +--------------+   +----------------------+
                    | Public / Subscriber  |   |  Middleware  |   |     Admin Portal     |
                    |     Route Pages      |   | (Auth Guard) |   |   (/admin/* Pages)   |
                    +----------------------+   +--------------+   +----------------------+
                               \                      |                      /
                                \                     |                     /
                                 +--------------------+--------------------+
                                                      |
                                           Server Actions / Routes
                                 (/actions/*, /api/webhooks/stripe/route.ts)
                                                      |
                                          Domain Service Layer (Zod)
                                 (DrawService, ScoreService, WinnerService...)
                                         /                         \
                                        /                           \
                        +----------------------+             +----------------------+
                        |   Supabase Postgres  |             |      Stripe API      |
                        |   - 9 Tables + RLS   |             |   - Checkout / Portal|
                        |   - Advisory Locks   |             |   - Webhook Delivery |
                        |   - 4 Atomic RPCs    |             |   - Subscriptions    |
                        |   - Private Storage  |             +----------------------+
                        +----------------------+
```

---

## 6. Main Routes

| Route | Access | Purpose |
| :--- | :--- | :--- |
| `/` | Public | Homepage, How It Works, Draw Mechanics, Pricing |
| `/charities` | Public | Searchable Charity Directory |
| `/charities/[slug]` | Public | Charity detail profile, upcoming events, direct donation |
| `/login` | Public | Subscriber/Admin authentication with redirect support |
| `/signup` | Public | Registration with charity selection and password scoring |
| `/auth/callback` | Public | PKCE & token hash email verification handler |
| `/dashboard` | Subscriber | Master subscriber hub, draw entry status, winnings history |
| `/scores` | Subscriber | Golf score recording and rolling 5-score management |
| `/profile` | Subscriber | Profile settings, designated charity, and contribution percentage |
| `/admin` | Admin | Administrative KPI dashboard |
| `/admin/users` | Admin | User ledger, subscription review, and atomic role management |
| `/admin/charities` | Admin | Charity management, creation, edit, and event scheduling |
| `/admin/draws` | Admin | Monthly draw ledger and creation |
| `/admin/draws/[id]` | Admin | Draw simulation audit, participant matches, and publishing |
| `/admin/winners` | Admin | Winner verification queue, proof inspection, and payout recording |
| `/api/webhooks/stripe` | Server | Webhook handler with raw-body signature verification |

---

## 7. Local Development Setup

### Prerequisites
* **Node.js**: v20.x or v22.x+
* **npm**: v10.x+
* **Supabase Project**: Cloud instance or local Supabase CLI
* **Stripe Account**: Test mode enabled
* **Stripe CLI**: For local webhook forwarding

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/codewithayush7/Digital-Heroes-Full-Stack-Internship-Assignment.git
   cd "Digital Heroes — Full Stack Internship Assignment"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env.local` file based on `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase credentials and Stripe Test Mode keys.

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. Required Environment Variables

Configure these variables in `.env.local` (and in Vercel project settings for production):

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Public | Base application URL (e.g. `http://localhost:3000` or production domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (`https://<project-id>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Secret** | Supabase service-role key (bypasses RLS for webhooks & admin tasks; **never expose to browser**) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | Public | Storage bucket name for winner score proofs (default: `winner-proofs`) |
| `STRIPE_SECRET_KEY` | **Server Secret** | Stripe secret API key (`sk_test_...` or `sk_live_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Stripe publishable API key (`pk_test_...` or `pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | **Server Secret** | Webhook signing secret (`whsec_...`) from Stripe CLI or dashboard |
| `STRIPE_MONTHLY_PRICE_ID` | Server | Stripe recurring Price ID for the monthly subscription plan (`price_...`) |
| `STRIPE_YEARLY_PRICE_ID` | Server | Stripe recurring Price ID for the yearly subscription plan (`price_...`) |
| `SUBSCRIPTION_PRIZE_POOL_PERCENTAGE` | Server | Percentage of subscription revenue allocated to the monthly prize pool (default: `30`) |

---

## 9. Supabase Setup & Migration Instructions

Execute the migrations in order in the Supabase SQL Editor (or apply them via Supabase CLI):

1. **`supabase/migrations/20260301000000_initial_schema.sql`**:
   Creates all 9 core tables (`profiles`, `charities`, `charity_events`, `subscriptions`, `golf_scores`, `draws`, `draw_entries`, `winners`, `donations`), indexes, RLS policies, and the `on_auth_user_created` trigger.
2. **`supabase/migrations/20260302000000_publish_draw.sql`**:
   Defines the atomic `publish_draw` stored procedure with cluster advisory locks, stale rollover validation, accounting audits, and winner row insertion.
3. **`supabase/migrations/20260303000000_winner_storage.sql`**:
   Initializes the private `winner-proofs` Supabase Storage bucket and configures security policies on `storage.objects`.
4. **`supabase/migrations/20260304000000_admin_role_management.sql`**:
   Defines the atomic `update_user_role_atomic` stored procedure with concurrency controls, self-demotion prevention, and last-admin protection.
5. **`supabase/migrations/20260305000000_donation_concurrency_hardening.sql`**:
   Adds the partial unique index on `donations(stripe_payment_id)` and the `record_independent_donation_atomic` stored procedure.

### Seed Initial Charity Data
Run [`supabase/seed.sql`](supabase/seed.sql) to seed sample featured charities and upcoming charity golf events.

### Initial Administrator Bootstrapping
By default, all user registrations receive the `subscriber` role. Because self-elevation is prohibited, promote your initial administrator account directly in the Supabase SQL Editor:
```sql
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE email = 'your-email@example.com';
```

---

## 10. Stripe Test Mode Setup

1. Log into your [Stripe Dashboard](https://dashboard.stripe.com/) and ensure **Test Mode** is toggled on.
2. Under **Product Catalog**, create a subscription product (e.g. *Digital Heroes Membership*):
   * Add a **Monthly** recurring price (e.g. ₹499/month). Copy the resulting Price ID (`price_...`) to `STRIPE_MONTHLY_PRICE_ID`.
   * Add a **Yearly** recurring price (e.g. ₹4,999/year). Copy the resulting Price ID (`price_...`) to `STRIPE_YEARLY_PRICE_ID`.
3. In **Settings &rarr; Billing &rarr; Customer Portal**:
   * Enable the Customer Portal so subscribers can update payment methods and manage cancellations.

---

## 11. Stripe Webhook Setup

### Local Webhook Forwarding (Stripe CLI)
To forward Stripe events to your local Next.js server:
```bash
stripe listen --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed --forward-to http://localhost:3000/api/webhooks/stripe
```
Copy the webhook signing secret printed by the CLI (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in `.env.local`. Keep the terminal process running.

### Production Webhooks
In the Stripe Dashboard under **Developers &rarr; Webhooks**:
* Add endpoint: `https://<your-production-domain>/api/webhooks/stripe`.
* Select events:
  * `checkout.session.completed`
  * `customer.subscription.created`
  * `customer.subscription.updated`
  * `customer.subscription.deleted`
  * `invoice.payment_succeeded`
  * `invoice.payment_failed`
* Copy the endpoint signing secret to `STRIPE_WEBHOOK_SECRET` in your production hosting environment.

---

## 12. Running Tests

Run the full automated test suite using the Node.js test runner and `tsx`:
```bash
npm test
```

To run a specific test suite:
```bash
npx tsx --env-file=.env.local --test tests/score.test.ts
npx tsx --env-file=.env.local --test tests/draw-service.test.ts
npx tsx --env-file=.env.local --test tests/admin-user.test.ts
```

### ⚠️ Testing Caveat Regarding the Shared Development Supabase Database
The test suites execute integration tests directly against the Supabase database configured in `.env.local`. When tests are run against a database that already contains pre-existing published draws, active subscriptions, or manual test accounts:
* Tests that assert exact global user counts (e.g. `COUNT(*) FROM profiles`) or exact draw IDs (e.g. `getLatestPublishedDraw()`) will reflect existing live rows.
* For completely clean test runs, execute `npm test` against a dedicated test project or freshly migrated database branch.

---

## 13. Quality & Build Commands

* **TypeScript Type Checking**:
  ```bash
  npx tsc --noEmit
  ```
* **Linting**:
  ```bash
  npm run lint
  ```
* **Production Build**:
  ```bash
  npm run build
  ```

---

## 14. Vercel Deployment Instructions

1. Push your repository to GitHub / GitLab / Bitbucket.
2. In the [Vercel Dashboard](https://vercel.com/new), import the repository.
3. Configure the **Environment Variables** in the Vercel project settings:
   * `NEXT_PUBLIC_APP_URL` = `https://<your-production-domain>.vercel.app`
   * `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anonymous key
   * `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role secret
   * `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` = `winner-proofs`
   * `STRIPE_SECRET_KEY` = your Stripe secret key
   * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = your Stripe publishable key
   * `STRIPE_WEBHOOK_SECRET` = your production Stripe webhook secret
   * `STRIPE_MONTHLY_PRICE_ID` = your monthly Price ID
   * `STRIPE_YEARLY_PRICE_ID` = your yearly Price ID
   * `SUBSCRIPTION_PRIZE_POOL_PERCENTAGE` = `30`
4. Deploy.
5. In your **Supabase Dashboard &rarr; Authentication &rarr; URL Configuration**, add your production URL (`https://<your-production-domain>.vercel.app/auth/callback`) to the **Redirect URLs** list.

---

## 15. Known & Documented PRD Deviations

1. **Subscription Prize Pool Percentage**: The PRD specifies the 40%/35%/25% prize tier split, but is silent on the exact proportion of each subscription fee allocated to the prize pool. The platform uses an explicit demo default of 30% (`SUBSCRIPTION_PRIZE_POOL_PERCENTAGE = 30`).
2. **Unclaimed Tier 3 and Tier 4 Prize Funds**: The PRD explicitly mandates that unclaimed Tier 5 jackpots roll over into the next draw. Because the PRD is silent on unclaimed Tier 3 and Tier 4 amounts, the platform records them in `unclaimed_tier_3` and `unclaimed_tier_4` rather than rolling them into the jackpot.
3. **Charity Contribution Maximum**: The PRD mandates a minimum 10% charity contribution. The implementation sets a maximum cap of 100% (`MIN_CHARITY_CONTRIBUTION_PCT = 10`, `MAX_CHARITY_CONTRIBUTION_PCT = 100`).
4. **Charity Selection during Signup**: The platform supports charity selection during signup and allows subscribers to modify their designated charity and contribution percentage at any time from their profile dashboard.
