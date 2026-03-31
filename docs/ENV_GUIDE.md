# Environment Variables Guide

## Where to get each value

### SUPABASE
| Variable | Where to find |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key ⚠️ Never expose client-side |

### STRIPE
| Variable | Where to find |
|----------|--------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API Keys → Publishable key |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → your endpoint → Signing secret |
| `STRIPE_PLATFORM_FEE_PERCENT` | Set to `0.10` for 10% |

### OPENAI
| Variable | Where to find |
|----------|--------------|
| `OPENAI_API_KEY` | platform.openai.com → API Keys → Create new key |

> ⚠️ Requires GPT-4o access. Check your organization's model access at platform.openai.com/account/limits

### RESEND (Email)
| Variable | Where to find |
|----------|--------------|
| `RESEND_API_KEY` | resend.com → API Keys → Create API Key |
| `RESEND_FROM_EMAIL` | Must be from a verified domain in Resend |
| `RESEND_FROM_NAME` | Display name, e.g. "Cheetah Receipts" |

### APP
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_URL` | Your production URL, e.g. `https://cheetahreceipts.com` |
| `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` |
| `ADMIN_EMAIL` | Your admin email address |

### EXPO (Mobile)
| Variable | Where to find |
|----------|--------------|
| `EXPO_ACCESS_TOKEN` | expo.dev → Account Settings → Access Tokens |

## Security Notes

1. **Never commit `.env.local` or `.env`** — they're in `.gitignore`
2. **SUPABASE_SERVICE_ROLE_KEY** bypasses Row Level Security — only use server-side
3. **STRIPE_SECRET_KEY** — only use server-side, never in client code
4. Rotate keys immediately if accidentally exposed
5. Use different keys for development and production
