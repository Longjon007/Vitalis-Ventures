# MusicForge Post-Launch Smoke Tests

Run this checklist immediately after each production deploy and again during the first business day after release.

## 1) Auth Smoke Tests
- [ ] Login succeeds with valid credentials.
- [ ] Signup succeeds with valid credentials.
- [ ] Protected route `/app` redirects to `/login` when unauthenticated.
- [ ] Authenticated session can access `/app/create`, `/app/account`, `/app/diagnostics`.

## 2) Pricing + Checkout Smoke Tests
- [ ] Pricing page renders without console/runtime errors.
- [ ] Checkout starts from pricing page.
- [ ] Checkout starts from account page.
- [ ] Checkout endpoint returns a URL and includes `X-Request-Id` response header.
- [ ] Invalid origin test to checkout returns `403` with safe error payload.

## 3) Billing Portal Smoke Tests
- [ ] Billing portal opens from account page for subscribed user.
- [ ] Portal endpoint returns a URL and includes `X-Request-Id`.
- [ ] Portal rejects invalid `returnUrl` origin with `400`.
- [ ] Portal rejects unauthenticated access with `401`.

## 4) Generation Smoke Tests
- [ ] Create page can queue a generation.
- [ ] `run-generation` executes and updates status to `processing` then `completed` or `failed`.
- [ ] Completed generation has usable `output_url` or `preview_url`.
- [ ] Failed generation writes readable `error_message`.
- [ ] Generation response/error includes `X-Request-Id`.

## 5) Webhook State Sync Smoke Tests
- [ ] Stripe test event `checkout.session.completed` succeeds.
- [ ] Stripe test event `customer.subscription.updated` succeeds.
- [ ] Stripe test event `customer.subscription.deleted` succeeds.
- [ ] `profiles` row updates for tier/status/customer/subscription IDs.
- [ ] Invalid webhook signature is rejected with `400` and request ID in response details/header.

## 6) Diagnostics Smoke Tests
- [ ] Diagnostics page loads and displays configuration readiness.
- [ ] Diagnostics page shows billing and generation endpoint readiness.
- [ ] Diagnostics page shows analytics configured state.
- [ ] Diagnostics page shows correlation ID support readiness.
- [ ] Diagnostics page shows last-known subscription sync timestamp.

## 7) Abuse / Rate-Limit Smoke Tests
- [ ] Rapid checkout requests trigger `429` safely.
- [ ] Rapid portal requests trigger `429` safely.
- [ ] Rapid generation requests trigger `429` safely.
- [ ] `Retry-After` and `X-RateLimit-*` headers are present on rate-limited responses.
- [ ] Logs show `requestId` on rate-limit events for traceability.

## 8) Rollback Sanity Checks
- [ ] Previous function versions are available and documented.
- [ ] Rollback command sequence is validated before starting rollback.
- [ ] Webhook endpoint stability is maintained during rollback.
- [ ] Post-rollback smoke tests re-run for auth, checkout, portal, generation, and webhook sync.
