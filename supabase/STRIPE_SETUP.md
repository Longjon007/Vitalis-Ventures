# Stripe Integration Setup

## 1. Create Stripe Products & Prices

In [Stripe Dashboard](https://dashboard.stripe.com/test/products) (test mode):

1. Create product **"Pro Plan"** with a recurring price (e.g., $19/mo)
   - Add metadata: `tier = pro`
   - Note the `price_id` (e.g., `price_1Abc...`)

2. Create product **"Studio Plan"** with a recurring price (e.g., $49/mo)
   - Add metadata: `tier = studio`
   - Note the `price_id`

## 2. Set Supabase Edge Function Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_PRO_ID=price_...
supabase secrets set STRIPE_PRICE_STUDIO_ID=price_...
```

## 3. Deploy Edge Functions

```bash
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy create-portal-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy run-generation --no-verify-jwt
```

## 4. Configure Stripe Webhook

In [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks):

1. Add endpoint: `https://<your-project>.supabase.co/functions/v1/stripe-webhook`
2. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

## 5. Local Development with Stripe CLI

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to local Supabase
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# The CLI prints a webhook signing secret (whsec_...) — use it locally
```

## 6. Frontend Environment

In `.env.local`:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

The checkout and portal endpoints are auto-detected from `VITE_SUPABASE_URL`.

## 7. Test the Flow

1. Start the app: `npm run dev`
2. Sign up / sign in
3. Go to `/pricing` and click upgrade
4. Use Stripe test card: `4242 4242 4242 4242`
5. Verify subscription in Supabase `profiles` table
