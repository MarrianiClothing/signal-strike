# Signal Strike — Credit Wallet Setup

## New Environment Variables to add in Vercel

Go to: Vercel → hill-top-ave → signal-strike → Settings → Environment Variables

| Variable | Value | Notes |
|---|---|---|
| STRIPE_SECRET_KEY | sk_live_... | From Stripe dashboard |
| STRIPE_WEBHOOK_SECRET | whsec_... | From Stripe webhook settings |
| APOLLO_COMMERCIAL_API_KEY | your_second_apollo_key | New Apollo account for commercial use |
| NEXT_PUBLIC_APP_URL | https://strike.hilltopave.com | Already set? Confirm this exists |

## Stripe Setup Steps

1. Create account at stripe.com if you don't have one
2. Go to Developers → API Keys → copy Secret Key
3. Go to Developers → Webhooks → Add endpoint
   - URL: https://strike.hilltopave.com/api/credits/webhook
   - Events: checkout.session.completed
   - Copy the Signing Secret → STRIPE_WEBHOOK_SECRET

## Supabase Setup Steps

1. Go to Supabase → SQL Editor
2. Run: supabase/migrations/20260412_credits.sql
3. Run: supabase/migrations/20260412_deduct_credit_fn.sql
4. Add yourself as internal user:
   INSERT INTO internal_users (user_id, note)
   VALUES ('<your-user-id>', 'Douglas Noga - owner');
   (Get your user ID from Supabase → Authentication → Users)

## How It Works

- Internal users (you + your team): zero credit checks, full Apollo access
- Commercial users: balance checked before each enrichment
- On checkout.session.completed → Stripe webhook → credits added to wallet
- Credits deducted atomically using the deduct_credit() function
- All transactions logged in credit_transactions table
