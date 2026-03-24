# MusicForge KPI Definitions

This document defines core business and operational KPIs for launch and post-launch tracking.

## 1) Acquisition KPIs

## Visitors
- Definition: number of unique visitors reaching public entry points (landing/pricing/signup) in a time window.
- Why it matters: top-of-funnel demand signal.
- Formula: `count(distinct anonymous_visitor_id)` per period.
- Likely data source: analytics provider page events.
- Recommended dashboard placement: Acquisition panel, top row.
- Caveats: depends on cookie/consent handling and bot filtering.

## Signup Conversion Rate
- Definition: percentage of visitors who complete signup.
- Why it matters: validates landing-to-account funnel quality.
- Formula: `signup_success / visitors`.
- Likely data source: analytics events `signup_attempt`, `signup_success`; Supabase Auth new users for cross-check.
- Recommended dashboard placement: Acquisition + Auth Funnel.
- Caveats: attribution windows and multi-session users can skew numerator/denominator.

## 2) Activation KPIs

## First Project Created
- Definition: percentage of new users who create at least one project.
- Why it matters: first concrete product commitment moment.
- Formula: `users_with_first_project / new_signups`.
- Likely data source: `projects` table (`created_at` and `user_id`).
- Recommended dashboard placement: Activation section.
- Caveats: may be delayed if users explore before creating.

## First Generation Started
- Definition: percentage of new users who start at least one generation.
- Why it matters: confirms entry into core AI value loop.
- Formula: `users_with_generation_started / new_signups`.
- Likely data source: analytics `generation_started`, `ai_generations` inserts.
- Recommended dashboard placement: Activation section.
- Caveats: event loss in analytics should be cross-checked with DB records.

## First Generation Completed
- Definition: percentage of new users with at least one completed generation.
- Why it matters: strongest early proof of delivered value.
- Formula: `users_with_generation_completed / new_signups`.
- Likely data source: analytics `generation_completed`; `ai_generations.status='completed'`.
- Recommended dashboard placement: Activation section.
- Caveats: completion can occur outside day-0 cohort window.

## 3) Engagement KPIs

## Generations per Active User
- Definition: average number of generations per active user in period.
- Why it matters: indicates depth of creative usage.
- Formula: `total_generations_started / active_users`.
- Likely data source: `ai_generations`; analytics generation events.
- Recommended dashboard placement: Engagement section.
- Caveats: distinguish started vs completed when interpreting quality.

## Projects per Active User
- Definition: average projects created/maintained per active user.
- Why it matters: measures sustained workspace usage.
- Formula: `count(projects_created) / active_users` (or active projects snapshot).
- Likely data source: `projects` table.
- Recommended dashboard placement: Engagement section.
- Caveats: teams/power users can skew means; also track median.

## Return Usage Rate
- Definition: share of users returning for another active session in a defined window.
- Why it matters: leading signal of habit formation.
- Formula: `returning_active_users / prior_period_active_users`.
- Likely data source: authenticated session logs + analytics page events.
- Recommended dashboard placement: Engagement + Retention bridge panel.
- Caveats: requires stable active-user definition.

## 4) Monetization KPIs

## Checkout Start Rate
- Definition: share of eligible users initiating checkout.
- Why it matters: direct signal of purchase intent.
- Formula: `checkout_started / eligible_active_users`.
- Likely data source: analytics `checkout_started`; edge logs on checkout endpoint.
- Recommended dashboard placement: Revenue/Billing section.
- Caveats: eligibility rules must be explicit (for example free users only).

## Paid Conversion Rate
- Definition: share of users becoming paid subscribers in period.
- Why it matters: primary early revenue efficiency metric.
- Formula: `new_paid_users / eligible_users` (or `/ checkout_started` for checkout conversion).
- Likely data source: `profiles.subscription_tier` transitions + Stripe subscription events.
- Recommended dashboard placement: Revenue/Billing section.
- Caveats: choose one canonical denominator and keep it consistent.

## ARPU (Placeholder)
- Definition: average revenue per active user.
- Why it matters: combines monetization and usage base.
- Formula: `recognized_revenue / active_users`.
- Likely data source: Stripe revenue exports + active user counts.
- Recommended dashboard placement: Revenue section.
- Caveats: requires clear revenue recognition policy.

## MRR (Placeholder)
- Definition: monthly recurring revenue run-rate.
- Why it matters: core SaaS growth and stability signal.
- Formula: `sum(active_subscription_monthly_value)`.
- Likely data source: Stripe subscriptions/prices.
- Recommended dashboard placement: Revenue top-line panel.
- Caveats: upgrades/downgrades/churn timing can introduce lag.

## Credit Consumption per Paid User
- Definition: average credits consumed by paid users in period.
- Why it matters: measures paid plan utilization and value realization.
- Formula: `abs(sum(credit_events.delta where delta<0 and user is paid)) / paid_active_users`.
- Likely data source: `credit_events`, `profiles.subscription_tier`.
- Recommended dashboard placement: Monetization + Product Value panel.
- Caveats: heavy users may distort average; track percentiles.

## 5) Retention KPIs

## Day 1 / Day 7 / Day 30 Retention
- Definition: percentage of cohort returning on D1, D7, D30.
- Why it matters: standard product stickiness benchmark.
- Formula: `retained_users_on_day_n / cohort_size`.
- Likely data source: auth sessions + analytics activity events.
- Recommended dashboard placement: Retention section.
- Caveats: define return activity threshold consistently.

## Renewal Retention
- Definition: percentage of paid subscriptions renewing at cycle boundary.
- Why it matters: direct revenue durability indicator.
- Formula: `renewed_subscriptions / subscriptions_up_for_renewal`.
- Likely data source: Stripe subscription lifecycle + `profiles.subscription_status`.
- Recommended dashboard placement: Monetization + Retention panel.
- Caveats: dunning flows and grace periods must be normalized.

## 6) Operational Quality KPIs

## Generation Success Rate
- Definition: percent of generation attempts ending in `completed`.
- Why it matters: core product reliability indicator.
- Formula: `completed_generations / total_generation_attempts`.
- Likely data source: `ai_generations.status`; analytics completion/failure events.
- Recommended dashboard placement: Generation Performance panel.
- Caveats: exclude canceled/test events if applicable.

## Generation Median Completion Time
- Definition: median time from generation created to completion.
- Why it matters: user-perceived speed and creative flow continuity.
- Formula: `median(ai_generations.updated_at - created_at where status='completed')`.
- Likely data source: `ai_generations` timestamps.
- Recommended dashboard placement: Generation Performance latency panel.
- Caveats: outliers and provider outages should also track p95.

## Billing Failure Rate
- Definition: rate of failed billing endpoint actions and unsuccessful checkout attempts.
- Why it matters: protects conversion and reduces support burden.
- Formula: `billing_failures / billing_attempts`.
- Likely data source: edge logs (`checkout.failed`, `portal.failed`) + Stripe checkout outcomes.
- Recommended dashboard placement: Edge Health + Billing panel.
- Caveats: separate validation failures from provider failures.

## Webhook Error Rate
- Definition: percent of webhook events that fail signature or processing.
- Why it matters: subscription state consistency risk indicator.
- Formula: `(signature_failed + processing_failed) / total_webhook_events`.
- Likely data source: `stripe-webhook` logs + Stripe delivery metrics.
- Recommended dashboard placement: Billing Reliability panel.
- Caveats: replay traffic can inflate totals during incident recovery.

## 7) Dashboard Placement Summary

- Acquisition: visitors, signup conversion
- Activation: first project, first generation started/completed
- Engagement: generations/user, projects/user, return rate
- Monetization: checkout starts, paid conversion, ARPU/MRR placeholders, credit consumption
- Retention: D1/D7/D30, renewal retention
- Operations: generation success/latency, billing failure, webhook error
