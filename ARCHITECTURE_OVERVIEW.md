# MusicForge Architecture Overview

This overview is written for investors, technical advisors, and future operators. It reflects the current deployed product shape and avoids speculative architecture.

## 1) Frontend Stack

- Build/runtime: Vite + React + TypeScript
- State management: Zustand (auth/subscription/workspace state)
- Styling/UI: Tailwind CSS with existing component primitives
- Routing: React Router with protected app routes
- Observability: structured client logging + analytics events

What this enables:
- Fast iteration speed for product updates
- Clear separation of UI, state, and service integrations
- Type-safe frontend workflows for billing and generation actions

## 2) Backend and Service Dependencies

- Supabase Auth: user identity, session management
- Supabase Postgres: persistent app data (profiles, projects, generations, credits, billing sync fields)
- Supabase Edge Functions:
  - `create-checkout-session`
  - `create-portal-session`
  - `run-generation`
  - `stripe-webhook`
- Stripe:
  - Checkout session creation for upgrades
  - Billing portal sessions for self-serve billing management
  - Webhook-driven subscription sync
- Replicate:
  - Backend generation execution and polling lifecycle

## 3) Major Product Flows

## Auth Flow
1. User signs up or logs in via Supabase Auth.
2. Protected app routes require authenticated session.
3. Profile and subscription state are loaded from Supabase-backed stores.

## Create / Generation Flow
1. User submits generation request from Create page.
2. Credits are consumed and generation row is created in queued state.
3. `run-generation` validates payload, verifies user ownership, and triggers Replicate.
4. Generation status is updated (`queued` -> `processing` -> `completed`/`failed`).
5. UI polls and renders output or safe failure messaging.

## Credits Flow
1. Credits tracked via wallet/event tables.
2. Generation actions consume credits.
3. Remaining credits shape upgrade prompts and account guidance.

## Billing / Subscription Flow
1. Frontend calls checkout or portal edge functions.
2. Stripe handles payment UX and subscription lifecycle.
3. `stripe-webhook` persists subscription state to `profiles`.
4. Account and pricing pages reflect latest state.

## Webhook Sync Flow
1. Stripe sends signed events.
2. Webhook verifies signature before processing.
3. Subscription patch is persisted by user/customer mapping.
4. UI state refresh reflects canonical subscription data.

## 4) Data Flow Summary

- User actions originate in React UI.
- Billing and generation actions route through Edge Functions (server-side policy and secrets boundary).
- Postgres is the operational source of truth for app-level entities and subscription snapshots.
- Analytics and logs provide behavioral and operational observability.

## 5) Deployment Shape

- Frontend deployed as static SPA artifact (Vite build output).
- Backend logic deployed as Supabase Edge Functions.
- Managed services:
  - Supabase project for Auth/DB/functions
  - Stripe for billing
  - Replicate for generation inference execution

Release sequence (recommended):
1. Apply migrations
2. Deploy edge functions
3. Validate env/config
4. Deploy frontend
5. Run post-deploy smoke tests

## 6) Security Summary

- Secrets remain server-side in Supabase function environment.
- Browser-facing edge endpoints enforce CORS allowlist (`ALLOWED_ORIGINS` / `APP_ORIGIN`).
- Request validation is strict for billing and generation payloads.
- Rate limiting is active for checkout, portal, and generation endpoints.
- Stripe webhook verifies signature before processing.
- Request correlation IDs are propagated for traceable incident debugging.

## 7) Observability Summary

- Client-side analytics tracks auth, billing, project, and generation funnel events.
- Edge logs capture blocked origins, invalid payloads, missing auth, rate limits, and webhook signature failures.
- Diagnostics page provides non-secret readiness and runtime snapshots for operators.
- Operations docs define metrics, dashboards, runbooks, and smoke tests.

## 8) Known Scaling Considerations

- Current rate limiting is in-memory per edge runtime instance; durable distributed limiting is a recommended next step.
- Generation workload depends on third-party model provider latency and availability.
- Webhook reliability depends on correct Stripe endpoint and secret lifecycle management.
- As volume grows, dashboard/alert automation and centralized log retention should be formalized as IaC.

## 9) Practical Strengths for Stakeholders

- Lean managed-service architecture with clear service boundaries
- Fast product iteration with low operational overhead
- Revenue workflow already integrated (checkout, portal, webhook sync)
- Explicit hardening and post-launch operations framework in place
