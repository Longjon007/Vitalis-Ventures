# MusicForge Ops Config Example

This is a non-secret template for production operations setup.

## Production Origins
- Primary app origin: `https://musicforge.app`
- Secondary app origin: `https://www.musicforge.app`
- Backend allowlist (`ALLOWED_ORIGINS`): `https://musicforge.app,https://www.musicforge.app`
- Optional single-origin override (`APP_ORIGIN`): `https://musicforge.app`

## Webhook URLs
- Stripe webhook endpoint:
- `https://<supabase-project-ref>.functions.supabase.co/stripe-webhook`

## Stripe Dashboard Links
- API keys: `https://dashboard.stripe.com/apikeys`
- Webhooks: `https://dashboard.stripe.com/webhooks`
- Events: `https://dashboard.stripe.com/events`
- Subscriptions: `https://dashboard.stripe.com/subscriptions`

## Supabase References
- Project dashboard: `https://supabase.com/dashboard/project/<project-ref>`
- Edge function logs:
- `create-checkout-session`
- `create-portal-session`
- `run-generation`
- `stripe-webhook`

## Suggested Function Deploy Order
1. `stripe-webhook`
2. `create-checkout-session`
3. `create-portal-session`
4. `run-generation`

## Alert Routing (Placeholders)
- Warning alerts channel: `#musicforge-warn`
- Critical alerts channel: `#musicforge-critical`
- Pager escalation: `PagerDuty Service: MusicForge Production`
- Billing incidents owner group: `@billing-oncall`
- Generation incidents owner group: `@ai-oncall`
- Auth incidents owner group: `@auth-oncall`

## Operations Ownership
- Primary on-call rotation: `Engineering On-Call`
- Backup rotation: `Platform On-Call`
- Product incident liaison: `Product Lead`
