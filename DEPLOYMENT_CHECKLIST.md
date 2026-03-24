# MusicForge Deployment Checklist

## 1) Apply database migrations
- Run existing schema migrations in order, including:
- `supabase/migrations/20240322_credits_project_enrichment_ai_history.sql`
- `supabase/migrations/20260322_subscription_persistence.sql`

## 2) Deploy Supabase Edge Functions
- `supabase functions deploy stripe-webhook --no-verify-jwt`
- `supabase functions deploy create-checkout-session --no-verify-jwt`
- `supabase functions deploy create-portal-session --no-verify-jwt`
- `supabase functions deploy run-generation --no-verify-jwt`

## 3) Set backend secrets (Supabase project)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_ID`
- `STRIPE_PRICE_PRO_ID`
- `STRIPE_PRICE_STUDIO_ID`
- `REPLICATE_API_TOKEN`
- Optional: `REPLICATE_MODEL_VERSION`

## 4) CORS allowlist setup (required)
- Set one of:
- `ALLOWED_ORIGINS` as a comma-separated list, for example:
- `https://musicforge.app,https://www.musicforge.app`
- Or set `APP_ORIGIN` for single-origin deployments.
- Ensure checkout/portal/frontend origins are present in this allowlist.

## 5) Configure Stripe webhook
- Endpoint: your deployed `stripe-webhook` function URL
- Events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 6) Set frontend environment variables
- `VITE_APP_BASE_URL`
- `VITE_STRIPE_CHECKOUT_ENDPOINT`
- `VITE_STRIPE_PORTAL_ENDPOINT`
- `VITE_RUN_GENERATION_ENDPOINT`
- Optional (fallback auto-detect): `VITE_SUPABASE_URL`
- Optional analytics:
- `VITE_ANALYTICS_PROVIDER`
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`

## 7) Rate limit expectations
- `create-checkout-session`: 10 requests / 10 minutes / IP
- `create-portal-session`: 20 requests / 10 minutes / user and IP
- `run-generation`: 20 requests / 10 minutes / user, 40 requests / 10 minutes / IP
- Expect `429` with retry headers:
- `Retry-After`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## 8) Manual verification flow
- Pricing page loads for free/guest users.
- Paid plan CTA opens Stripe checkout.
- After checkout completes, Stripe webhook updates `profiles` subscription fields.
- Account page shows updated tier/status and opens Stripe billing portal.
- Auth-required routes still protect `/app/*`.
- Create page loads projects/generations/wallet.
- Generate flow order is preserved:
- validate prompt/credits -> consume credits -> create queued generation -> trigger backend run.
- Generation status transitions appear via polling:
- `queued` -> `processing` -> `completed`/`failed`.
- Completed generations render audio controls from `output_url`.
- Failure path writes readable `error_message` in `ai_generations`.

## 9) Security smoke tests
- Send checkout request with disallowed `Origin` header -> expect `403`.
- Send portal request with disallowed `Origin` header -> expect `403`.
- Send portal request with disallowed `returnUrl` origin -> expect `400`.
- Send checkout request with disallowed `successUrl`/`cancelUrl` origin -> expect `400`.
- Send malformed run-generation payload (invalid `bpm`/`duration`/missing fields) -> expect `400`.
- Burst run-generation requests beyond limits -> expect `429`.
- Send stripe-webhook call with invalid signature -> expect `400` with safe error.

## 10) Abuse testing
- Repeat checkout calls from same client rapidly until limit triggers.
- Repeat portal calls as same user rapidly until limit triggers.
- Repeat generation calls with same user and same IP rapidly until user limit then IP limit triggers.
- Verify application UI surfaces friendly errors and does not crash on `429`.

## 11) Post-deploy smoke test
- Open `/`, `/pricing`, `/login`, `/signup`, `/app`, `/app/create`, `/app/account`, `/app/diagnostics`.
- Confirm unauthenticated requests to `/app/*` redirect to `/login`.
- Confirm authentication succeeds and protected routes become accessible.
- Start checkout from pricing or account and verify redirect URL is returned.
- Open billing portal from account and verify redirect URL is returned.

## 12) Monitoring suggestions
- Monitor Supabase Edge Function logs for:
- `stripe-webhook`
- `create-checkout-session`
- `create-portal-session`
- `run-generation`
- Track blocked origin events and rate-limit events in logs.
- Monitor `ai_generations` status distribution (`queued`, `processing`, `completed`, `failed`).
- Track Stripe webhook delivery health and retry counts in Stripe Dashboard.
- Monitor Replicate usage/cost and prediction failure rates.

## 13) Webhook verification
- In Stripe Dashboard, send test webhook events to `stripe-webhook`.
- Confirm events are accepted with `2xx`.
- Verify profile subscription fields update:
- `subscription_tier`
- `subscription_status`
- `subscription_expires_at`
- `stripe_customer_id`
- `stripe_subscription_id`
- `billing_updated_at`

## 14) Generation endpoint verification
- Create a generation from `/app/create`.
- Confirm row transitions to `processing` and then `completed` or `failed`.
- Confirm `output_url`/`preview_url` are persisted for successful runs.
- Confirm `error_message` is persisted for failed runs.

## 15) Rollback notes
- If one function deploy fails, redeploy the previous known-good version for that function only.
- Keep webhook endpoint stable during rollback to avoid dropped Stripe events.
- Temporarily disable paid CTA buttons in frontend env if checkout/portal endpoints are unstable.
- If `run-generation` is unstable, keep generation creation enabled but return clear failure messages.

## 16) Recommended tightening after launch
- Move rate limiting from in-memory edge runtime storage to durable shared storage (Redis/KV).
- Restrict allowlist origins to exact production hostnames only.
- Rotate secrets regularly (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REPLICATE_API_TOKEN`).
- Monitor Stripe replay/signature verification failure spikes.
- Add budget and anomaly alerts for Replicate and Stripe.

## 17) Monitoring ownership
- Define primary production on-call owner for MusicForge.
- Define secondary backup owner for off-hours handoff.
- Assign explicit service owners:
- Auth
- Billing/Stripe
- Generation/Replicate
- Database/Supabase
- Store ownership in runbook tooling and shared team docs.

## 18) Alert routing recommendations
- Route warning alerts to team chat channel.
- Route critical alerts to pager service with escalation.
- Route billing alerts to billing owner and on-call.
- Route generation outage alerts to AI/backend owner and on-call.
- Route auth outage alerts to auth/frontend owner and on-call.

## 19) Secret rotation cadence
- `STRIPE_SECRET_KEY`: rotate every 90 days or immediately after exposure concern.
- `STRIPE_WEBHOOK_SECRET`: rotate every 90 days and after webhook endpoint changes.
- `REPLICATE_API_TOKEN`: rotate every 60-90 days and after access changes.
- `SUPABASE_SERVICE_ROLE_KEY`: rotate on strict change windows with rollback plan.
- Document rotation date, owner, and verification result after each rotation.

## 20) Stripe webhook secret rotation procedure
- Add new signing secret in Stripe webhook settings (keep old active briefly).
- Update `STRIPE_WEBHOOK_SECRET` in Supabase project secrets.
- Deploy `stripe-webhook` function.
- Send Stripe test webhook and verify success.
- Remove old webhook signing secret after verification window.
- Audit logs for `stripe_webhook.signature_failed` spikes during rotation window.

## 21) Replicate cost watch procedure
- Review daily generation volume and failure rates.
- Track `credit_events` usage trend and compare with Replicate billed usage.
- Set budget alert thresholds at:
- 50% of monthly budget
- 75% of monthly budget
- 90% of monthly budget
- Investigate sharp cost spikes against generation retry/failure incidents.

## 22) Stripe incident fallback procedure
- If checkout fails globally, temporarily disable paid CTA entry points.
- If portal fails, provide temporary support escalation for billing actions.
- Keep webhook endpoint stable during Stripe incidents to avoid replay mismatch.
- After provider recovery, replay missed events and verify `profiles` sync.

## 23) Deploy verification with correlation IDs
- Confirm `X-Request-Id` response header on:
- `create-checkout-session`
- `create-portal-session`
- `run-generation`
- `stripe-webhook`
- Trigger one controlled failure per endpoint and confirm error payload includes `details.requestId`.
- Verify matching `requestId` appears in edge function logs for traceability.
