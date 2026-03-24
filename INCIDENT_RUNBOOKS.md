# MusicForge Incident Runbooks

Use this file during active incidents. Prefer fast containment first, then deep diagnosis.

## 1) Stripe Webhook Failures

### Symptom
- Stripe dashboard shows failed deliveries to `stripe-webhook`.
- Subscription status in `profiles` is stale after checkout.

### Likely Causes
- Invalid or rotated `STRIPE_WEBHOOK_SECRET`.
- Function deploy regression in `stripe-webhook`.
- Supabase service role or DB update errors.

### Immediate Triage Steps
- Check Stripe event delivery logs and HTTP status/body.
- Check Supabase function logs for `stripe_webhook.signature_failed` and `stripe_webhook.processing_failed`.
- Validate `STRIPE_WEBHOOK_SECRET` and function URL in Stripe dashboard.
- Send one Stripe test event and verify DB write in `profiles`.

### Rollback / Mitigation
- Roll back `stripe-webhook` to previous known-good version.
- Reprocess failed Stripe events from Stripe dashboard after fix.
- Temporarily disable paid upgrade CTA if state sync is unreliable.

### Owner / Systems Touched
- Owner: Backend on-call.
- Systems: Stripe, Supabase Edge Functions, Supabase `profiles`.

### Postmortem Notes Checklist
- Time to detect and time to recover.
- Number of failed events and affected users.
- Root cause category (config, deploy, dependency).
- Permanent fix and test coverage gap.

## 2) Checkout Endpoint Failures

### Symptom
- Users cannot start checkout from pricing/account.
- Elevated 4xx/5xx on `create-checkout-session`.

### Likely Causes
- CORS origin mismatch (`ALLOWED_ORIGINS`/`APP_ORIGIN`).
- Stripe API key/price misconfiguration.
- Validation rejection for malformed redirect URLs.

### Immediate Triage Steps
- Check edge logs for `checkout.blocked_origin`, `checkout.invalid_payload`, `checkout.failed`.
- Verify Stripe price IDs and secret are set.
- Run a known-good checkout request from production origin.
- Confirm returned `X-Request-Id` and trace logs with that ID.

### Rollback / Mitigation
- Roll back `create-checkout-session`.
- If needed, hide paid CTA temporarily while checkout is unstable.
- Correct env vars and redeploy function only.

### Owner / Systems Touched
- Owner: Billing/backend on-call.
- Systems: Frontend billing actions, Supabase function, Stripe Checkout.

### Postmortem Notes Checklist
- Exact failing stage (origin validation, Stripe API, response handling).
- Blast radius (all tiers or specific tier).
- Which verification test would have caught this pre-deploy.

## 3) Billing Portal Failures

### Symptom
- Users cannot open billing portal from account page.
- Increased `portal.failed` or `portal.missing_customer`.

### Likely Causes
- Missing `stripe_customer_id` in `profiles`.
- Stripe portal API errors.
- Return URL origin validation mismatch.

### Immediate Triage Steps
- Check logs for `portal.missing_auth`, `portal.invalid_return_url_origin`, `portal.failed`.
- Inspect affected user row in `profiles` for `stripe_customer_id`.
- Validate `returnUrl` origin and function env allowlist.
- Validate Stripe secret key and portal configuration.

### Rollback / Mitigation
- Roll back `create-portal-session`.
- For isolated users, backfill `stripe_customer_id` using Stripe customer mapping.
- Communicate temporary support path for billing changes.

### Owner / Systems Touched
- Owner: Billing/backend on-call.
- Systems: Account page billing action, Supabase `profiles`, Stripe Billing Portal.

### Postmortem Notes Checklist
- Was issue global or user-segment specific.
- Data mismatch details (if any).
- Needed monitoring gap for earlier detection.

## 4) Generation Failure Spike

### Symptom
- Failure rate spikes for `run-generation`.
- Users see repeated failed generation statuses.

### Likely Causes
- Replicate degradation/outage.
- Invalid input pattern changes after deploy.
- Supabase update errors to `ai_generations`.

### Immediate Triage Steps
- Check logs for `generation.failed`, payload validation errors, and status transitions.
- Query `ai_generations` status counts for recent 15-30 minutes.
- Validate Replicate API responsiveness using one controlled test request.
- Verify no recent schema drift affecting generation updates.

### Rollback / Mitigation
- Roll back `run-generation` function.
- Temporarily degrade gracefully: keep create flow but return clear failure quickly.
- Pause aggressive retries on client if retry storm observed.

### Owner / Systems Touched
- Owner: AI/backend on-call.
- Systems: Create flow, Supabase `ai_generations`, Replicate API.

### Postmortem Notes Checklist
- Primary failure source (validation, provider, persistence).
- Recovery actions that worked fastest.
- Model/version specific behavior noted.

## 5) Replicate API Outage or Degraded Behavior

### Symptom
- Timeouts or 5xx from Replicate.
- Generation latency and failure rate both increase.

### Likely Causes
- External provider outage.
- Regional/API quota or account issue.
- Model version instability.

### Immediate Triage Steps
- Validate provider status page and API response tests.
- Check `run-generation` logs for replicate create/poll failures.
- Confirm `REPLICATE_API_TOKEN` validity and quota.

### Rollback / Mitigation
- Shift to failure-fast messaging in generation endpoint if provider remains unstable.
- Reduce generation load via temporary UI messaging or queued retry policy.
- Escalate to provider support with request IDs and timestamps.

### Owner / Systems Touched
- Owner: AI/backend on-call.
- Systems: Replicate, run-generation function, create UX messaging.

### Postmortem Notes Checklist
- Provider SLA impact duration.
- Internal fallback effectiveness.
- Cost/usage anomalies during incident.

## 6) Supabase Auth Outage

### Symptom
- Login/signup failures spike.
- Protected routes unusable for valid users.

### Likely Causes
- Supabase auth service incident.
- Incorrect project URL/key configuration in deployment.
- Browser-side token/session handling regressions.

### Immediate Triage Steps
- Verify Supabase status page.
- Check client logs/events for login/signup failures.
- Validate `VITE_SUPABASE_URL` and anon key deployment consistency.
- Test auth in a clean browser session.

### Rollback / Mitigation
- Roll back recent auth-related frontend changes.
- If external outage, post status notice and suspend non-critical auth-affecting releases.

### Owner / Systems Touched
- Owner: Frontend/auth on-call.
- Systems: Supabase Auth, app route guards, auth pages.

### Postmortem Notes Checklist
- Auth provider vs app regression determination.
- User impact duration and count.
- Incident communication quality.

## 7) Supabase DB Migration Issue

### Symptom
- Runtime errors after deployment referencing missing columns/functions.
- Billing or generation writes fail after schema change.

### Likely Causes
- Partial migration application.
- Unexpected migration order.
- Backward-incompatible schema change.

### Immediate Triage Steps
- Compare applied migrations to expected release list.
- Validate required columns/functions exist (`profiles`, `ai_generations`, `credit_wallets`).
- Check function logs for SQL error messages.

### Rollback / Mitigation
- Roll back app/functions to schema-compatible version.
- Apply corrective migration (forward fix) rather than destructive rollback when possible.
- Freeze additional deploys until schema parity is restored.

### Owner / Systems Touched
- Owner: Database/backend on-call.
- Systems: Supabase Postgres schema, edge functions, frontend data access.

### Postmortem Notes Checklist
- Missing guardrails in migration verification.
- Staging/prod drift details.
- Follow-up checks to add to release gates.

## 8) Rate Limiting False Positives

### Symptom
- Legitimate users receive frequent 429s.
- Support reports failed checkout/portal/generation actions despite normal behavior.

### Likely Causes
- Shared IP concentration (office/school/mobile carrier NAT).
- Retry loops from frontend or network middleware.
- In-memory limiter behavior across instance boundaries.

### Immediate Triage Steps
- Review rate-limit hit logs by user and IP.
- Check for client retry loops and duplicate submissions.
- Validate thresholds against real traffic patterns.

### Rollback / Mitigation
- Temporarily raise limits conservatively for impacted endpoint.
- Add client-side guard against repeated rapid submissions.
- Plan durable distributed limiter implementation.

### Owner / Systems Touched
- Owner: Backend on-call with frontend support.
- Systems: Edge rate-limit helper, billing/generation endpoints, client request flow.

### Postmortem Notes Checklist
- False positive root pattern (IP concentration vs client retry bug).
- Threshold tuning outcome.
- Durable limiter roadmap update.

## 9) CORS Misconfiguration After Deploy

### Symptom
- Browser requests to billing/generation endpoints fail with CORS errors.
- Preflight failures on checkout/portal/generation routes.

### Likely Causes
- `ALLOWED_ORIGINS`/`APP_ORIGIN` missing production domain.
- Typo in protocol/domain/port.
- Unexpected deploy environment origin.

### Immediate Triage Steps
- Reproduce with browser devtools and inspect preflight response headers.
- Check edge logs for blocked origin events.
- Validate deployed frontend origin against backend allowlist.

### Rollback / Mitigation
- Correct allowlist env and redeploy affected functions.
- Revert to previous env snapshot if needed.
- Keep a canonical source-of-truth origin list in ops config docs.

### Owner / Systems Touched
- Owner: Backend/on-call release owner.
- Systems: Edge function CORS config, frontend deployment host settings.

### Postmortem Notes Checklist
- Which environment had mismatch.
- Why pre-deploy checks missed it.
- Add origin validation to release checklist.
