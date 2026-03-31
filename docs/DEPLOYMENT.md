# Cheetah Receipts — Deployment Guide

## Prerequisites
- Node.js 20+
- Supabase account + project
- Stripe account (with Connect enabled)
- OpenAI API key
- Resend account
- AWS account
- Expo account (for mobile)

---

## 1. Supabase Setup

```bash
# Install CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations (in order)
supabase db push

# Or run manually in Supabase SQL editor:
# infra/001_initial_schema.sql
# infra/002_functions_and_views.sql
```

### Enable Auth Providers
In Supabase Dashboard → Authentication → Providers:
- Enable **Email** (with confirm email = true)
- Enable **Google** (add OAuth credentials from Google Cloud Console)

### Storage
Buckets are created automatically by the migration. Verify in Storage tab:
- `receipts` (private)
- `avatars` (public)
- `dispute-evidence` (private)

---

## 2. Stripe Setup

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Enable Connect in Stripe Dashboard → Connect → Settings
# Set platform name, icon, and redirect URIs

# Webhook endpoint (add in Stripe Dashboard → Webhooks):
# URL: https://yourdomain.com/api/webhooks/stripe
# Events to listen for:
#   - payment_intent.succeeded
#   - payment_intent.payment_failed
#   - transfer.created
#   - charge.refunded

# For local dev:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 3. Environment Variables

```bash
cp .env.example .env.local
# Fill in all values
```

Required variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
OPENAI_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_APP_URL
```

---

## 4. Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev  # → http://localhost:3000

# Run Stripe webhook listener (separate terminal)
npm run stripe:listen

# Apply DB changes
npm run db:push
```

---

## 5. AWS Amplify Deployment

### Option A: Console
1. Go to AWS Amplify Console
2. Click "New App" → "Host web app"
3. Connect your GitHub repo
4. Set build settings (auto-detected from `amplify.yml`)
5. Add environment variables (all from `.env.example`)
6. Deploy

### Option B: CLI
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure
amplify configure

# Initialize in project root
amplify init

# Add hosting
amplify add hosting

# Deploy
amplify publish
```

### Environment Variables in Amplify
Add all variables from `.env.example` in:
Amplify Console → App → Environment variables

---

## 6. Make Yourself Admin

After creating your account via the app:
```sql
-- Run in Supabase SQL editor
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 7. Mobile App (Expo + EAS)

```bash
cd mobile

# Install dependencies
npm install

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project (updates eas.json with project ID)
eas build:configure

# Copy env
cp .env.example .env
# Fill in EXPO_PUBLIC_* values

# Run locally
npx expo start

# Build for TestFlight / internal testing
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production build + submit
eas build --platform all --profile production
eas submit --platform ios
eas submit --platform android
```

### Push Notifications
1. In Expo Dashboard → your project → Credentials
2. Generate iOS Push Certificate (APNs)
3. Upload Android FCM key
4. EAS handles the rest automatically

---

## 8. Post-Deploy Checklist

- [ ] Supabase migrations applied
- [ ] Storage buckets exist (receipts, avatars, dispute-evidence)
- [ ] Admin user role set in DB
- [ ] Stripe Connect enabled and webhook registered
- [ ] All env vars set in Amplify
- [ ] OpenAI API key active and has GPT-4o access
- [ ] Resend domain verified (for email delivery)
- [ ] Test full flow: signup → upload receipt → OCR → list → buy → payout
- [ ] Mobile app: push notifications working on physical device
- [ ] Admin panel: can approve/reject listings, resolve disputes

---

## 9. Monitoring

- **Supabase Dashboard**: DB usage, auth logs, storage
- **Stripe Dashboard**: payments, payouts, disputes
- **OpenAI Usage**: token usage per API call
- **AWS Amplify**: build logs, access logs
- **Resend Dashboard**: email delivery rates
