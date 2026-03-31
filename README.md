# ⚡ Cheetah Receipt Marketplace

A full-stack marketplace for buying and selling cash receipts — with OCR scanning, fraud detection, Stripe Connect payments, and React Native mobile app.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Mobile | React Native (Expo) |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Payments | Stripe Connect |
| OCR | OpenAI GPT-4o Vision |
| Email | Resend |
| Push Notifications | Expo Push + Supabase Realtime |
| Deployment | AWS Amplify (web) + EAS Build (mobile) |
| Fraud Detection | Custom scoring engine |

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/yourorg/cheetah-receipts
cd cheetah-receipts
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env.local
# Fill in all values — see docs/ENV_GUIDE.md
```

### 3. Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push  # applies all migrations
```

### 4. Stripe Setup
```bash
# Install Stripe CLI for webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 5. Run Development
```bash
npm run dev          # Next.js on :3000
npm run mobile       # Expo on :8081
```

---

## Project Structure

```
cheetah/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # Auth endpoints
│   │   │   ├── receipts/       # Receipt CRUD + OCR
│   │   │   ├── orders/         # Purchase flow
│   │   │   ├── disputes/       # Dispute system
│   │   │   ├── admin/          # Admin endpoints
│   │   │   ├── notifications/  # Push + email
│   │   │   └── webhooks/       # Stripe webhooks
│   │   ├── marketplace/        # Browse page
│   │   ├── sell/               # Upload + list flow
│   │   ├── dashboard/          # Seller dashboard
│   │   ├── orders/             # Buyer orders
│   │   ├── admin/              # Admin panel
│   │   └── auth/               # Login/signup
│   ├── components/             # React components
│   ├── lib/                    # Core services
│   │   ├── supabase/           # DB client + queries
│   │   ├── stripe/             # Payment logic
│   │   ├── ocr/                # GPT-4o receipt scanning
│   │   ├── email/              # Resend templates
│   │   ├── notifications/      # Push notifications
│   │   └── fraud/              # Fraud scoring engine
│   ├── hooks/                  # React hooks
│   └── types/                  # TypeScript types
├── mobile/                     # React Native (Expo)
├── infra/                      # AWS + DB migrations
└── docs/                       # Documentation
```

---

## Key Features

- **OCR Pipeline**: GPT-4o Vision extracts store, date, items, UPCs — asks user for manual input on low-confidence fields
- **Fraud Detection**: Duplicate receipt hashing, UPC validation, seller behavior scoring
- **Stripe Connect**: Marketplace split payments — buyer pays, Cheetah takes 10%, seller gets 90%
- **Dispute System**: Buyer opens dispute → seller responds → admin mediates → auto-resolution rules
- **Email Notifications**: Transactional emails via Resend for every order/dispute event
- **Push Notifications**: Real-time via Expo Push + Supabase Realtime

---

## Deployment

See `docs/DEPLOYMENT.md` for full AWS Amplify + EAS Build guide.
