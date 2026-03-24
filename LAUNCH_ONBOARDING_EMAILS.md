# MusicForge Launch Onboarding Emails

This pack is designed for quick implementation in lifecycle tools (Customer.io, Postmark, Resend, Braze, HubSpot).

Suggested global variables:
- `{{first_name}}`
- `{{creator_name}}` (fallback to account name)
- `{{plan_name}}`
- `{{credits_remaining}}`
- `{{monthly_credits}}`
- `{{generation_count}}`
- `{{app_url}}`
- `{{pricing_url}}`
- `{{account_url}}`
- `{{create_url}}`
- `{{support_url}}`

---

## 1) Welcome / Account Created

### Purpose
Confirm account creation and drive the first meaningful session.

### Trigger Suggestion
Immediately after successful signup confirmation.

### Subject Line Options
1. Welcome to MusicForge, {{first_name}}
2. Your MusicForge workspace is ready
3. You’re in, let’s make your first track

### Preview Text
Start your first project and generate your first idea in minutes.

### Body Copy
Hi {{first_name}},

Welcome to MusicForge. Your account is live and your workspace is ready.

Here’s the fastest path to value:
1. Create a project
2. Describe the sound you want
3. Run your first AI generation

You can always manage your plan and billing from your account page as your workflow grows.

### CTA Text
Start Creating

### Optional Personalization Variables
`{{first_name}}`, `{{create_url}}`, `{{account_url}}`

### Notes On When Not To Send
Do not send if signup is incomplete or account is blocked.

---

## 2) First-Generation Nudge

### Purpose
Convert signed-up users into activated creators.

### Trigger Suggestion
Send 6-24 hours after signup if no generation has started.

### Subject Line Options
1. Ready for your first generation?
2. Turn your idea into a playable draft
3. Your first MusicForge output is one prompt away

### Preview Text
Describe your sound and generate a first concept in the Create workspace.

### Body Copy
Hi {{first_name}},

You’ve got everything you need to create your first result in MusicForge.

Open Create, write a short prompt, choose your settings, and run a generation. Even a rough draft helps you move faster on arrangement and iteration.

If you want, start with a simple structure:
"Cinematic electronic build, warm bass, 120 BPM, minor key."

### CTA Text
Generate First Draft

### Optional Personalization Variables
`{{first_name}}`, `{{create_url}}`

### Notes On When Not To Send
Skip if user already started a generation.

---

## 3) Credits Low / Upgrade Nudge

### Purpose
Prevent drop-off when a user approaches credit limits.

### Trigger Suggestion
Send when remaining credits fall below a threshold (for example <= 20% of monthly credits).

### Subject Line Options
1. You’re almost out of credits
2. Keep your sessions moving this month
3. Need more generations for your workflow?

### Preview Text
Upgrade any time to increase monthly credits and generation capacity.

### Body Copy
Hi {{first_name}},

You currently have {{credits_remaining}} credits left this cycle.

If you’re actively generating, upgrading now gives you more room to iterate without interruption. Your account page shows your current tier, billing status, and available options.

### CTA Text
Review Plans

### Optional Personalization Variables
`{{first_name}}`, `{{credits_remaining}}`, `{{monthly_credits}}`, `{{pricing_url}}`, `{{account_url}}`

### Notes On When Not To Send
Do not send to Studio users with unlimited generation allowance.

---

## 4) Billing Activated / Subscription Confirmation

### Purpose
Confirm successful subscription activation and set expectations clearly.

### Trigger Suggestion
After successful webhook sync for `checkout.session.completed`.

### Subject Line Options
1. Your MusicForge {{plan_name}} plan is active
2. Subscription confirmed: {{plan_name}}
3. You’re upgraded and ready to create

### Preview Text
Your billing and plan access are active. Here’s what changed.

### Body Copy
Hi {{first_name}},

Your MusicForge subscription is now active on the {{plan_name}} plan.

What’s next:
- Access your updated generation capacity and features immediately
- Manage payment methods and billing details in your account portal
- Continue all existing projects with no workflow disruption

Thanks for supporting MusicForge. We’re excited to help you ship better work faster.

### CTA Text
Open Account

### Optional Personalization Variables
`{{first_name}}`, `{{plan_name}}`, `{{account_url}}`

### Notes On When Not To Send
Do not send until webhook sync confirms subscription persistence.

---

## 5) Failed Generation Recovery / Try Again

### Purpose
Recover confidence and drive retry after a failed generation event.

### Trigger Suggestion
When generation status is `failed` and user has not retried within 30-90 minutes.

### Subject Line Options
1. That generation failed, let’s get you back on track
2. Quick retry tips for your last generation
3. Your draft didn’t complete, here’s the fastest recovery

### Preview Text
A few small prompt tweaks usually fix failed runs.

### Body Copy
Hi {{first_name}},

One of your recent generations didn’t complete. This can happen with ambiguous prompts, high service load, or temporary provider issues.

Try this:
1. Keep the prompt specific and concise
2. Reduce complexity in one pass
3. Re-run from your Create workspace

If the issue continues, contact support and include the time of the failed attempt.

### CTA Text
Retry Generation

### Optional Personalization Variables
`{{first_name}}`, `{{create_url}}`, `{{support_url}}`

### Notes On When Not To Send
Skip if user already completed a successful generation after the failure.

---

## 6) Re-Engagement After Inactivity

### Purpose
Bring creators back with a low-friction next step.

### Trigger Suggestion
Send after 7-14 days with no login or generation activity.

### Subject Line Options
1. Ready to pick up your next idea?
2. Your MusicForge workspace is waiting
3. Come back and finish what you started

### Preview Text
Open your projects, continue your drafts, and generate new concepts.

### Body Copy
Hi {{first_name}},

Your projects are still here and ready when you are.

If you want to get back into flow quickly:
- Open your latest project
- Run one new generation
- Save the best result and iterate

A short 15-minute session is usually enough to restart momentum.

### CTA Text
Return to Workspace

### Optional Personalization Variables
`{{first_name}}`, `{{app_url}}`, `{{create_url}}`

### Notes On When Not To Send
Do not send if account is paused, canceled with do-not-email, or currently in an unresolved support incident.

---

## 7) Creator Success Milestone

### Purpose
Reinforce progress and encourage continued creation.

### Trigger Suggestion
First completed generation or first export event.

### Subject Line Options
1. Nice work, your first output is complete
2. Milestone unlocked in MusicForge
3. You just shipped your first MusicForge result

### Preview Text
You’re building momentum. Here’s your next best step.

### Body Copy
Hi {{first_name}},

Great milestone: you completed your first MusicForge output.

Creators who get the most from MusicForge usually do this next:
1. Save standout outputs into project versions
2. Run variations on the same prompt direction
3. Use credits strategically for arrangement alternatives

Keep going, your next few iterations are where quality compounds.

### CTA Text
Create Next Version

### Optional Personalization Variables
`{{first_name}}`, `{{generation_count}}`, `{{create_url}}`

### Notes On When Not To Send
Skip if user already received this milestone email for the same event type.

---

## 8) Subscription Renewal Reminder / Value Reminder

### Purpose
Reduce preventable churn and reinforce monthly value.

### Trigger Suggestion
3-5 days before renewal date for paid users.

### Subject Line Options
1. Your MusicForge plan renews soon
2. Quick reminder: renewal coming up
3. Keep your generation workflow uninterrupted

### Preview Text
Review plan usage and billing details before renewal.

### Body Copy
Hi {{first_name}},

Your {{plan_name}} subscription renews soon.

Before renewal, this is a good time to:
- Review this month’s usage
- Confirm billing details
- Decide if your current plan still matches your output volume

You can manage everything in the billing portal from your account page.

### CTA Text
Review Billing

### Optional Personalization Variables
`{{first_name}}`, `{{plan_name}}`, `{{account_url}}`

### Notes On When Not To Send
Do not send if subscription is already canceled, unpaid, or in dunning flow.
