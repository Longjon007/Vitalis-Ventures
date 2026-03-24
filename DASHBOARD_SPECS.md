# MusicForge Dashboard Specs

This spec maps recommended production dashboards to current MusicForge instrumentation and data sources.

## 1) Revenue / Billing

### Panel: Checkout Starts (15m, 1h, 24h)
- Analytics event: `checkout_started`
- Supabase query: optional cross-check via recent subscription state changes in `profiles`
- Edge logs: `create-checkout-session` success/failure events
- Stripe source: Checkout Sessions created

### Panel: Checkout Completion Rate
- Analytics event: none direct completion event today
- Supabase query:
  - Count `profiles` rows with `subscription_tier in ('pro','studio')` and recent `billing_updated_at`
- Edge logs: `stripe-webhook` processed `checkout.session.completed`
- Stripe source: successful completed checkout sessions / subscriptions created

### Panel: Billing Portal Opens
- Analytics event: `billing_portal_opened`
- Supabase query: optional `profiles` billing status changes
- Edge logs: `portal.created`, `portal.failed`, `portal.missing_customer`
- Stripe source: Billing portal session creations

### Panel: Webhook Reliability
- Analytics event: not required
- Supabase query: drift checks in `profiles.subscription_status`
- Edge logs: `stripe_webhook.signature_failed`, `stripe_webhook.processing_failed`
- Stripe source: webhook delivery failures and retries

## 2) Auth Funnel

### Panel: Login Attempts vs Success
- Analytics events: `login_attempt`, `login_success`
- Supabase query: optional Auth sign-in counts for validation
- Edge logs: N/A
- Stripe source: N/A

### Panel: Signup Attempts vs Success
- Analytics events: `signup_attempt`, `signup_success`
- Supabase query: new `auth.users` or `profiles` creation count
- Edge logs: N/A
- Stripe source: N/A

## 3) Create Funnel

### Panel: Generation Starts
- Analytics event: `generation_started`
- Supabase query: `ai_generations` rows created per interval
- Edge logs: `run-generation` request volume
- Stripe source: N/A

### Panel: Credit Consumption Trend
- Analytics event: optional secondary; use DB as primary
- Supabase query: `credit_events` where `delta < 0`, grouped by day/hour
- Edge logs: optional generation-related consumption traces
- Stripe source: N/A

### Panel: Project Creation Trend
- Analytics event: `project_created`
- Supabase query: `projects` created per day
- Edge logs: N/A
- Stripe source: N/A

## 4) Generation Performance

### Panel: Completion vs Failure Rate
- Analytics events: `generation_completed`, `generation_failed`
- Supabase query: `ai_generations.status` grouped by time bucket
- Edge logs: `generation.completed`, `generation.failed`
- Stripe source: N/A

### Panel: Median / p95 Generation Time
- Analytics event: optional computed metric from backend timings
- Supabase query: `updated_at - created_at` for completed rows in `ai_generations`
- Edge logs: start-to-complete request traces by `requestId`
- Stripe source: N/A

### Panel: Top Failure Reasons
- Analytics event: `generation_failed.reason` (if populated)
- Supabase query: group `ai_generations.error_message`
- Edge logs: `generation.failed` reason aggregation
- Stripe source: N/A

## 5) Edge Function Health

### Panel: Error Rate by Function
- Analytics event: N/A
- Supabase query: N/A
- Edge logs:
  - `create-checkout-session`
  - `create-portal-session`
  - `run-generation`
  - `stripe-webhook`
- Stripe source: N/A

### Panel: Latency by Function (p50/p95)
- Analytics event: N/A
- Supabase query: N/A
- Edge logs: function execution duration from Supabase logs and APM
- Stripe source: N/A

### Panel: Correlation ID Coverage
- Analytics event: N/A
- Supabase query: N/A
- Edge logs: proportion of entries containing `requestId`
- Stripe source: N/A

## 6) Error Trends

### Panel: Client Errors by Category
- Analytics event: optional custom error events if added
- Supabase query: N/A
- Edge logs: N/A
- Stripe source: N/A
- Frontend source: `reportError` and `reportOperationalError` logs with severity/category/tags

### Panel: Backend Validation / Abuse Events
- Analytics event: N/A
- Supabase query: N/A
- Edge logs:
  - blocked origins
  - invalid payload
  - missing auth
  - rate-limited
  - webhook signature failures
- Stripe source: webhook signature failures cross-check

## 7) Subscription State Trends

### Panel: Tier Distribution Over Time
- Analytics event: optional
- Supabase query: `profiles.subscription_tier` grouped by day
- Edge logs: webhook patch events for support context
- Stripe source: active subscriptions by product/price

### Panel: Churn / Downgrade Signals
- Analytics event: optional billing interaction context
- Supabase query: `profiles.subscription_status` and `subscription_tier` transitions
- Edge logs: `customer.subscription.deleted` handling
- Stripe source: canceled subscriptions

## Suggested Refresh Rates

- Auth and billing funnel panels: 1-minute refresh.
- Generation and edge-health panels: 1-minute refresh.
- Subscription trend and cost panels: 15-minute refresh.

## Minimum Dashboard Ownership

- Primary owner: engineering on-call.
- Secondary owners: growth/product for funnel panels, finance for billing and cost panels.
