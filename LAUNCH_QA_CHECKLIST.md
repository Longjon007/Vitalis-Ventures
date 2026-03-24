# MusicForge Launch QA Checklist

## Core routes
- [ ] Landing page loads (`/`)
- [ ] Pricing page loads (`/pricing`)
- [ ] Projects page loads (`/projects`)
- [ ] Login page loads (`/login`)
- [ ] Signup page loads (`/signup`)
- [ ] Reset password page loads (`/reset-password`)
- [ ] App dashboard loads when authenticated (`/app`)
- [ ] Create page loads when authenticated (`/app/create`)
- [ ] Account page loads when authenticated (`/app/account`)
- [ ] Diagnostics page loads when authenticated (`/app/diagnostics`)

## Auth and route protection
- [ ] Login works with valid credentials
- [ ] Signup works with valid credentials
- [ ] Unauthenticated user is redirected from `/app/*` to `/login`
- [ ] Authenticated user can access protected app routes

## Billing flow
- [ ] Account page shows billing controls
- [ ] Checkout starts from pricing/account
- [ ] Billing portal opens from account
- [ ] Stripe webhook events are delivered successfully
- [ ] Subscription fields persist in `profiles` after webhook processing

## Create + generation flow
- [ ] Create page loads projects, generations, and credits
- [ ] Project creation works and appears in project selector
- [ ] Generation starts from create form
- [ ] Generation status transitions are visible:
- [ ] `queued`
- [ ] `processing`
- [ ] `completed` or `failed`
- [ ] Audio player renders when `output_url` exists
- [ ] Failed generation shows readable error

## Diagnostics and readiness
- [ ] Diagnostics page shows readiness booleans (no secrets exposed)
- [ ] Diagnostics page shows auth state summary
- [ ] Diagnostics page shows subscription tier/status
- [ ] Diagnostics page shows wallet presence + recent generation count
- [ ] Diagnostics page shows app origin configured state

## Analytics and observability
- [ ] `page_view` tracked on route changes
- [ ] `login_attempt` / `login_success` tracked
- [ ] `signup_attempt` / `signup_success` tracked
- [ ] `checkout_started` tracked
- [ ] `billing_portal_opened` tracked
- [ ] `project_created` tracked
- [ ] `generation_started` tracked
- [ ] `generation_completed` / `generation_failed` tracked
- [ ] `upgrade_prompt_viewed` / `upgrade_prompt_clicked` tracked
- [ ] Error boundary fallback renders on forced UI crash

## Security and abuse prevention
- [ ] Edge function CORS allowlist configured (`ALLOWED_ORIGINS` or `APP_ORIGIN`)
- [ ] Checkout rejects disallowed request origins (`403`)
- [ ] Checkout rejects disallowed `successUrl`/`cancelUrl` origins (`400`)
- [ ] Portal rejects disallowed request origins (`403`)
- [ ] Portal rejects disallowed `returnUrl` origin (`400`)
- [ ] Portal requires authenticated identity (`401`/`403` on mismatch)
- [ ] Run-generation rejects malformed payload fields (`400`)
- [ ] Run-generation rejects disallowed request origins (`403`)
- [ ] Repeated checkout/portal/generation burst attempts hit `429`
- [ ] Stripe webhook invalid signature is rejected safely (`400`)
- [ ] Logs show blocked origin/rate-limited/invalid payload events without leaking secrets

## Sign-off
- [ ] Product QA approved
- [ ] Engineering QA approved
- [ ] Security hardening approved
- [ ] Launch readiness approved
