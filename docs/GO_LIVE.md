# ⚡ Cheetah Receipts — Go-Live Checklist

Everything you need to do to take Cheetah Receipts from code to production.
Complete these steps in order. Each section builds on the last.

---

## Step 1 — Create Your Accounts

You need accounts with five services. All have free tiers to get started.

| Service | What it's for | URL |
|---------|--------------|-----|
| **Supabase** | Database, auth, file storage | supabase.com |
| **Stripe** | Payments, seller payouts | stripe.com |
| **OpenAI** | GPT-4o receipt scanning | platform.openai.com |
| **Resend** | Transactional email | resend.com |
| **AWS** | Hosting the web app | aws.amazon.com |

> **Stripe note:** After creating your account, go to **Stripe Dashboard → Connect → Settings** and enable Connect. Set your platform name, upload a logo, and configure your redirect URIs. This is required before sellers can receive payouts.

> **OpenAI note:** Make sure your account has access to **GPT-4o**. Check at platform.openai.com/account/limits. Without GPT-4o access the receipt scanning will fail.

> **Resend note:** You must verify a sending domain in Resend before emails will deliver. Go to Resend Dashboard → Domains → Add Domain and follow the DNS steps.

---

## Step 2 — Set Up Your Environment Variables

In the root of the project, copy the example file and fill in all values:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value. Here is where to find each one:

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Dashboard → Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase Dashboard → Settings → API → anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Settings → API → service_role key ⚠️ Never expose this client-side

**Stripe**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe Dashboard → Developers → API Keys → Publishable key
- `STRIPE_SECRET_KEY` — Stripe Dashboard → Developers → API Keys → Secret key
- `STRIPE_WEBHOOK_SECRET` — Generated in Step 4 below
- `STRIPE_PLATFORM_FEE_PERCENT` — Set this to `0.10` (10%)

**OpenAI**
- `OPENAI_API_KEY` — platform.openai.com → API Keys → Create new key

**Resend**
- `RESEND_API_KEY` — resend.com → API Keys → Create API Key
- `RESEND_FROM_EMAIL` — Must match your verified domain, e.g. `noreply@cheetahreceipts.com`
- `RESEND_FROM_NAME` — Set to `Cheetah Receipts`

**App**
- `NEXT_PUBLIC_APP_URL` — Your production URL, e.g. `https://cheetahreceipts.com`
- `NEXTAUTH_SECRET` — Generate by running: `openssl rand -base64 32`
- `ADMIN_EMAIL` — Your admin email address

**Mobile (in `mobile/.env`)**
```bash
cp mobile/.env.example mobile/.env
```
- `EXPO_PUBLIC_SUPABASE_URL` — Same as above
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Same as above
- `EXPO_PUBLIC_STRIPE_KEY` — Same as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL` — Your production URL, e.g. `https://cheetahreceipts.com`

---

## Step 3 — Set Up the Database

Install the Supabase CLI if you haven't already:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is in your Supabase Dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

Apply both migrations in order:

```bash
supabase db push
```

Or if you prefer to run them manually, paste the contents of these two files into the Supabase SQL editor in this order:
1. `infra/001_initial_schema.sql`
2. `infra/002_functions_and_views.sql`

After running the migrations, verify in your Supabase Dashboard → Storage that three buckets were created:
- `receipts` (private)
- `avatars` (public)
- `dispute-evidence` (private)

---

## Step 4 — Register the Stripe Webhook

Stripe needs to notify your app when payments are confirmed.

1. Go to **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. Set the endpoint URL to: `https://yourdomain.com/api/webhooks/stripe`
3. Select these four events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
   - `charge.refunded`
4. Click **Add endpoint**
5. Click **Reveal signing secret** and copy it into `STRIPE_WEBHOOK_SECRET` in your `.env.local`

> **For local development**, use the Stripe CLI to forward webhooks:
> ```bash
> stripe listen --forward-to localhost:3000/api/webhooks/stripe
> ```
> Copy the webhook signing secret it prints and use that for local `.env.local`.

---

## Step 5 — Install Dependencies and Test Locally

```bash
# Install web app dependencies
npm install

# Run local dev server
npm run dev
```

Open `http://localhost:3000` and verify:
- [ ] Home page loads
- [ ] Sign up creates an account
- [ ] Marketplace page loads
- [ ] Upload flow starts (scan page appears)

---

## Step 6 — Deploy to AWS Amplify

### Connect your repo
1. Push your code to a GitHub repository
2. Go to **AWS Amplify Console** → **New App** → **Host web app**
3. Connect your GitHub account and select your repo
4. Amplify will auto-detect the `amplify.yml` in the root — leave build settings as-is

### Add environment variables
In the Amplify Console for your app:
- Go to **App Settings → Environment variables**
- Add every variable from your `.env.local` (all the non-`EXPO_PUBLIC` ones)
- Click **Save**

### Deploy
Click **Save and deploy**. Your first build will take 3-5 minutes. Once it's done, Amplify gives you a URL like `https://main.abc123.amplifyapp.com`.

### Custom domain (optional but recommended)
In Amplify Console → **Domain management** → **Add domain**, connect your custom domain and Amplify handles the SSL certificate automatically.

---

## Step 7 — Make Yourself an Admin

After your app is deployed and you've signed up for an account:

1. Go to your **Supabase Dashboard → SQL Editor**
2. Run this query, replacing the email with yours:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

You should now see an **Admin** button in the navbar when logged in.

---

## Step 8 — Build and Deploy the Mobile App

### Prerequisites
```bash
cd mobile
npm install
npm install -g eas-cli
eas login
```

### Configure EAS
```bash
eas build:configure
```

This creates a project on expo.dev and updates `eas.json` with your real project ID. Copy that project ID and update it in `mobile/app.json` under `extra.eas.projectId`.

### Build for testing (TestFlight / internal track)
```bash
# iOS
eas build --platform ios --profile preview

# Android
eas build --platform android --profile preview
```

These builds can be distributed to testers via TestFlight (iOS) or directly as an APK (Android) before you submit to the App Store.

### Submit to stores
```bash
# Both platforms at once
eas build --platform all --profile production
eas submit --platform ios
eas submit --platform android
```

> **Apple requirement:** You need an Apple Developer account ($99/year) and the app must be reviewed before it appears on the App Store. Budget 1-3 days for review.

> **Google requirement:** You need a Google Play Developer account ($25 one-time) and the app must go through an initial review. Budget 3-7 days for the first submission.

---

## Step 9 — Full End-to-End Test

Before announcing, run through the complete flow yourself:

**As a seller:**
- [ ] Sign up for a new account
- [ ] Upload a receipt photo
- [ ] Confirm OCR extracted the data correctly (or fill in manual review fields)
- [ ] Set a listing price and publish
- [ ] Confirm the listing appears on the marketplace
- [ ] Connect Stripe (Dashboard → Settings → Connect Bank)

**As a buyer (use a second account or incognito):**
- [ ] Browse the marketplace and find your listing
- [ ] Click Buy It Now
- [ ] Complete checkout with Stripe test card `4242 4242 4242 4242`, any future date, any CVV
- [ ] Confirm the order appears in My Purchases
- [ ] Verify the full receipt data (items + UPCs) is visible

**Admin:**
- [ ] Go to `/admin`
- [ ] Confirm stats are showing
- [ ] Approve or reject a pending listing

**Notifications:**
- [ ] Confirm the seller received a sale email
- [ ] Confirm the buyer received a purchase confirmation email
- [ ] Confirm in-app notifications appear

---

## Step 10 — Post-Launch Monitoring

Keep an eye on these dashboards after you go live:

| Dashboard | What to watch |
|-----------|--------------|
| **Supabase Dashboard** | DB connections, storage usage, auth logs |
| **Stripe Dashboard** | Payment success rate, disputes, payouts |
| **OpenAI Platform** | Token usage per request, API error rate |
| **AWS Amplify** | Build logs, access logs, response times |
| **Resend Dashboard** | Email delivery rate, bounces, spam complaints |

Set up Stripe email alerts for failed payments and disputes at **Stripe Dashboard → Settings → Email notifications**.

---

## Quick Reference — Things That Will Break If Missed

| If you skip this | What breaks |
|-----------------|-------------|
| Stripe Connect not enabled | Sellers can't connect bank, payouts fail silently |
| Webhook not registered | Purchases complete on Stripe but receipt never unlocks for buyer |
| Both SQL migrations not applied | `increment_seller_stats` RPC call throws, breaking every purchase |
| `SUPABASE_SERVICE_ROLE_KEY` not set | All admin API routes return 500 |
| `OPENAI_API_KEY` without GPT-4o access | Every scan returns 0% confidence, all fields go to manual review |
| Admin role not set | You can't access `/admin` |
| Resend domain not verified | Emails go to spam or fail silently |

---

*Built with Next.js 14, Supabase, Stripe Connect, GPT-4o Vision, Resend, Expo, and AWS Amplify.*
