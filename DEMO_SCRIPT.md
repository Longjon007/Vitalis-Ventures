# MusicForge Demo Script

Use this script for investor demos and advisor walkthroughs. Keep language factual and tied to implemented behavior.

## 3-Minute Version

### 0:00-0:20 | Opening
"MusicForge is an AI music creation workspace that helps creators move from idea to usable draft faster. What you’re seeing is a working product with auth, project and generation flow, credits, subscriptions, and operational diagnostics."

### 0:20-0:45 | Signup/Login + App Shell
- Show login/signup entry and transition into protected app routes.
- Call out that user identity and session state are Supabase-backed.

### 0:45-1:30 | Create Flow
- Open Create and submit a generation request.
- Narrate the lifecycle: queued -> processing -> completed/failed.
- Show where generation history appears and how users can revisit outputs.

### 1:30-2:00 | Credits + Upgrade Trigger
- Point to current credits context.
- Explain credits-based usage and how higher tiers unlock more monthly capacity.
- If relevant, show upgrade prompt moment when usage boundaries are reached.

### 2:00-2:35 | Billing and Subscription Logic
- Start checkout flow from pricing/account.
- Show billing portal entry point for payment method/subscription management.
- Explain webhook sync keeps in-app subscription state aligned with Stripe.

### 2:35-3:00 | Close with Credibility
- Mention backend generation runs server-side through edge functions.
- Mention diagnostics/observability as launch-readiness trust signals.
- Close: "We’re focused on reliable creator workflow, not one-off AI demos."

## 10-Minute Version

### 0:00-0:45 | Narrative Setup
"The problem we’re solving is workflow friction. Creators can generate audio in many places, but moving from idea to repeatable draft workflow is still fragmented. MusicForge is built to close that gap."

### 0:45-1:45 | Landing Value Proposition
- State target user: creators needing faster draft iteration.
- Explain product promise: reduce time from concept to usable draft.
- Clarify this demo reflects current implementation, not roadmap claims.

### 1:45-2:45 | Auth and Protected Experience
- Show signup/login.
- Show transition into authenticated app shell and protected routes.
- Note this creates a stable identity layer for projects, credits, and billing state.

### 2:45-5:00 | Create and Generation Workflow
- Open create workflow and enter prompt/config fields.
- Submit generation request and narrate status updates.
- Show generation record/history and explain how creators iterate in-session.
- If a failure appears, explain safe failure handling and retry path.

### 5:00-6:15 | Credits and Plan Mechanics
- Show where plan tier and monthly credits are visible.
- Explain credits as usage control, reset cadence, and plan differentiation.
- Clarify that upgrade decisions are tied to usage intensity, not feature confusion.

### 6:15-7:30 | Pricing, Checkout, and Billing Portal
- Open pricing/account views.
- Trigger checkout path and explain Stripe-hosted conversion flow.
- Open billing portal flow and explain user self-service controls.
- Emphasize that billing state is not hand-managed; it syncs through webhook events.

### 7:30-8:30 | Subscription Persistence and Backend Integrity
- Explain Stripe webhook signature verification.
- Explain subscription persistence into Supabase-backed profile state.
- Explain edge function boundaries for billing and generation operations.

### 8:30-9:20 | Operational Readiness
- Open diagnostics page and summarize readiness checks.
- Mention hardening patterns: input validation, CORS allowlists, and rate limiting.
- Mention runbooks/metrics docs exist for post-launch operations.

### 9:20-10:00 | Fundraising Close
- Restate what exists now: working product loop with monetization and ops foundations.
- State near-term execution goals: improve activation, paid conversion, and retention.
- Finish with clear ask: capital to accelerate product and growth loops from this base.

## Presenter Notes
- Keep all claims measurable or framed as hypotheses.
- Use placeholders instead of invented numbers (for example, "current activation is [insert %]").
- If live generation timing is variable, pre-stage one completed example in history as backup.
