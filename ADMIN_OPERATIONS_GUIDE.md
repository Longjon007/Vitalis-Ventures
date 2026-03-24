# MusicForge Admin Operations Guide

This guide is for day-to-day operators and non-engineering admins supporting a live MusicForge launch.

## 1) Daily Checks

- Review auth health:
  - login and signup success rates
  - unusual auth error spikes
- Review billing health:
  - checkout starts vs successful activations
  - billing portal success/failure trend
- Review generation health:
  - started/completed/failed ratio
  - median completion time
- Review edge function errors:
  - checkout
  - portal
  - run-generation
  - stripe-webhook
- Spot-check diagnostics page for readiness signals.

## 2) Weekly Checks

- Review cohort behavior:
  - first generation completion rate
  - return usage rate
- Review credit consumption patterns and support tickets.
- Validate top runbook scenarios with a quick tabletop review.
- Audit alert noise and tune thresholds.
- Confirm documentation links and owner contacts are current.

## 3) Monthly Checks

- Review paid conversion and renewal retention.
- Review plan-level usage against pricing assumptions.
- Audit secrets rotation dates and upcoming rotation tasks.
- Evaluate generation provider performance and cost trends.
- Refresh investor/admin KPI snapshots.

## 4) Billing Checks

- Confirm Stripe webhook deliveries are healthy.
- Confirm subscription updates persist in `profiles`.
- Investigate:
  - checkout failures
  - missing Stripe customer mappings
  - portal open failures
- Verify invoice/payment issue flow for support handoff.

## 5) Generation Pipeline Checks

- Track generation success and failure reasons.
- Monitor completion latency (median and p95).
- Confirm failed jobs persist safe, user-readable error messages.
- Watch for rate-limit spikes indicating abuse or client retry loops.
- Compare credit consumption trends with generation volumes.

## 6) Webhook Checks

- Verify signature failure count remains near baseline.
- Test one Stripe webhook event after major deploys.
- Confirm supported events are processed and unsupported events ignored safely.
- Validate request correlation IDs are present for incident tracing.

## 7) Diagnostics Page Usage

Use `/app/diagnostics` to quickly confirm:
- Supabase config readiness
- Billing endpoint readiness
- Generation endpoint readiness
- analytics configuration presence
- last-known subscription state and sync timestamp
- correlation ID support readiness

Note: diagnostics is non-secret by design and should not expose raw keys/tokens.

## 8) User Issue Triage Playbooks

## Login Issues
Inspect:
- Supabase auth status
- client-side auth errors
- route protection behavior
Escalate to:
- auth/frontend owner if reproducible in UI
- platform owner if provider-level outage

## Billing Issues
Inspect:
- checkout/portal endpoint logs
- Stripe dashboard event logs
- profile billing fields in Supabase
Escalate to:
- billing/backend owner

## Missing Credits
Inspect:
- `credit_wallets` row
- recent `credit_events`
- generation and consumption history
Escalate to:
- backend owner for wallet/event integrity checks

## Failed Generations
Inspect:
- `ai_generations` status and `error_message`
- run-generation logs around request timestamp
- provider health and rate-limit context
Escalate to:
- AI/backend owner

## 9) Escalation and Ownership Suggestions

- Primary on-call: engineering operations owner
- Billing incidents: billing/backend owner
- Generation incidents: AI/backend owner
- Auth incidents: frontend/auth owner
- Data incidents: database/platform owner

Escalation standards:
- Critical incident: acknowledge in <= 10 minutes
- High incident: acknowledge in <= 30 minutes
- Include request/correlation IDs in all engineering escalations
- Link every critical incident to a runbook and postmortem checklist
