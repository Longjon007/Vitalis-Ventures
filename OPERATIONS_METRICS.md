# MusicForge Operations Metrics

This document defines post-launch operational metrics for MusicForge. Thresholds are starting points and should be tuned after 2-4 weeks of production baseline.

## Auth Metrics

| Metric | Why It Matters | Source of Truth | Alert Threshold Suggestion | Dashboard Placement |
| --- | --- | --- | --- | --- |
| Login success rate | Detects auth friction or upstream auth outage. | Analytics events: `login_attempt`, `login_success`; Supabase Auth logs for verification. | Warn if < 90% for 15 min. Critical if < 75% for 10 min. | Auth Funnel panel: top-left. |
| Signup success rate | Detects onboarding breakage and email confirmation issues. | Analytics events: `signup_attempt`, `signup_success`; Supabase Auth signups/day. | Warn if < 70% for 30 min. Critical if < 50% for 15 min. | Auth Funnel panel: top-right. |

## Billing Metrics

| Metric | Why It Matters | Source of Truth | Alert Threshold Suggestion | Dashboard Placement |
| --- | --- | --- | --- | --- |
| Checkout start rate | Shows monetization intent and CTA health. | Analytics event: `checkout_started`; edge logs for `create-checkout-session`. | Informational anomaly alert if drops > 60% vs 7-day same-hour baseline. | Revenue/Billing section: starts panel. |
| Checkout completion rate | Detects payment drop-offs and Stripe checkout issues. | Stripe Dashboard successful subscriptions; `profiles.subscription_tier` transitions in Supabase. | Warn if completion/start ratio < 35% over 60 min. Critical if < 20%. | Revenue/Billing section: conversion panel. |
| Billing portal open rate | Confirms account billing self-serve health. | Analytics event: `billing_portal_opened`; `create-portal-session` success logs. | Warn if success/open ratio < 90% over 30 min. | Revenue/Billing section: portal panel. |
| Webhook failure count | Detects delayed subscription sync and billing drift risk. | Stripe webhook delivery failures + edge event `stripe_webhook.processing_failed` / signature failures. | Warn at >= 5 failures in 15 min. Critical at >= 20 in 15 min. | Edge Function Health + Billing drilldown. |

## Generation Metrics

| Metric | Why It Matters | Source of Truth | Alert Threshold Suggestion | Dashboard Placement |
| --- | --- | --- | --- | --- |
| Generation start rate | Indicates creator engagement and form/backend availability. | Analytics `generation_started`; inserts into `public.ai_generations`. | Anomaly alert if down > 50% vs 7-day same-hour baseline. | Create Funnel panel: starts. |
| Generation completion rate | Core quality/success signal for AI workflow. | Analytics `generation_completed`; `ai_generations.status='completed'`. | Warn if completion rate < 80% for 30 min. Critical if < 60% for 15 min. | Generation Performance panel: completion ratio. |
| Generation failure rate | Detects Replicate or orchestration degradation. | Analytics `generation_failed`; `ai_generations.status='failed'`. | Warn if > 15% for 15 min. Critical if > 30% for 10 min. | Generation Performance panel: failure ratio. |
| Median time to completion | Detects latency regressions and backlog pressure. | `ai_generations.updated_at - created_at` for completed rows; edge logs for `generation.completed`. | Warn if p50 > 90 sec for 30 min. Critical if p50 > 180 sec for 15 min. | Generation Performance panel: latency chart. |
| Credits consumed per day | Tracks usage intensity and revenue pressure. | `public.credit_events` where `delta < 0` grouped by day. | Informational anomaly alert if day-to-day swing > 2.5x baseline. | Create Funnel panel: consumption trend. |

## Infrastructure Metrics

| Metric | Why It Matters | Source of Truth | Alert Threshold Suggestion | Dashboard Placement |
| --- | --- | --- | --- | --- |
| Edge function error rate | Early warning for backend instability. | Supabase function logs per function (`create-checkout-session`, `create-portal-session`, `run-generation`, `stripe-webhook`). | Warn if 5xx > 3% for 15 min. Critical if > 8% for 10 min. | Edge Function Health: first panel. |
| Edge function latency | Detects slow dependencies and cold start impact. | Supabase function execution duration; custom log timings where available. | Warn if p95 > 2.5s for billing endpoints or > 35s for generation orchestration. | Edge Function Health: latency panel. |
| Rate limit hit count | Detects abuse and accidental client retry storms. | Edge log events: `checkout.rate_limited`, `portal.rate_limited`, `generation.rate_limited`. | Warn if spikes 3x baseline for 10 min. | Abuse/Security panel: rate limiting. |
| Webhook signature failure count | Detects attack/noise and webhook secret drift. | Edge log event: `stripe_webhook.signature_failed`; Stripe delivery diagnostics. | Warn at >= 3 in 10 min. Critical at >= 10 in 10 min. | Abuse/Security + Billing panel. |

## Implementation Notes

- Keep metric names stable in dashboards and alerts to avoid pager churn.
- Pair every critical alert with a linked runbook step in `INCIDENT_RUNBOOKS.md`.
- During first month, tune thresholds weekly as traffic baselines stabilize.
