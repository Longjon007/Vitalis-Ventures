# MusicForge Investor Q&A

Use these as concise, grounded responses in investor meetings.

## 1) Why this instead of generic music AI tools?
Generic tools can produce output, but creators still need a repeatable workflow. MusicForge combines generation, project continuity, credits, and billing controls in one product loop so users can keep creating without tool fragmentation.

## 2) Why will users pay?
Users pay for higher monthly generation capacity and a smoother ongoing workflow. The credits model ties pricing to usage intensity, and paid tiers unlock more creative throughput for active users.

## 3) What is defensible?
Our defensibility is at the workflow and operating layer: integrated creation + billing + account state, data on real creator usage patterns, and reliability practices that increase trust and retention.

## 4) What stops incumbents?
Incumbents can copy isolated features, but stitching together a coherent creator workflow with reliable billing, usage controls, and operational discipline still takes focused execution. We are optimizing for that integrated experience.

## 5) How do credits and subscriptions work?
Users are assigned plan-based monthly credit capacity. Generations consume credits, and paid tiers provide higher limits. Checkout and subscription management run through Stripe, with webhook sync persisting subscription state in-app.

## 6) What are your variable costs?
Primary variable cost is generation provider usage (Replicate-backed execution). Billing infrastructure is mostly fixed SaaS overhead, so margin performance improves as conversion and retention increase relative to generation cost.

## 7) How do you manage generation reliability?
Generation requests run server-side through edge functions with validation and hardening controls. We track status lifecycle, capture failures safely, and maintain operational docs/runbooks for incident response.

## 8) Why this architecture?
The architecture is pragmatic and launch-oriented: React frontend, Supabase Auth/DB + Edge Functions, Stripe for billing, and Replicate for model execution. It balances iteration speed with production safeguards.

## 9) What are the biggest risks?
Key risks are third-party generation dependency, early funnel conversion uncertainty, and retention at scale. We mitigate with instrumentation, KPI-driven iteration, and operational readiness around billing and reliability.

## 10) What would funding unlock?
Funding would accelerate activation and conversion improvements, deepen creator workflow features, and expand GTM testing while strengthening reliability and cost controls as usage grows.

## Optional Follow-Up Questions

### Are you claiming product-market fit today?
No. We are claiming a working product loop with monetization and operations foundations, and a clear KPI framework to validate fit quickly.

### How should we evaluate progress over the next 6-12 months?
Track activation quality, paid conversion, retention/renewal, and reliability trends. We expect progress through measurable funnel improvements, not vanity volume alone.
