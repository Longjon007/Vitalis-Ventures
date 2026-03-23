export interface AnalyticsEventMap {
  page_view: {
    pathname: string;
    search?: string;
  };
  login_attempt: {
    method: 'password';
  };
  login_success: {
    method: 'password';
  };
  signup_attempt: {
    method: 'password';
  };
  signup_success: {
    method: 'password';
    emailConfirmationRequired: boolean;
  };
  checkout_started: {
    tier: string;
  };
  payouts_initiated: {
    source: 'account_page' | 'admin';
    hasExistingAccount: boolean;
    accountId?: string;
  };
  purchase_started: {
    listingId: string;
    generationId: string;
    priceCents: number;
    source: 'marketplace' | 'generation_page' | 'account_page' | 'pricing_page';
    placeholder?: boolean;
  };
  purchase_completed: {
    listingId: string;
    generationId: string;
    priceCents: number;
    source: 'marketplace' | 'generation_page' | 'account_page' | 'pricing_page';
    placeholder?: boolean;
  };
  track_listed: {
    listingId: string;
    generationId: string;
    priceCents: number;
  };
  track_sold: {
    listingId: string;
    generationId: string;
    priceCents: number;
    placeholder?: boolean;
  };
  creator_earnings: {
    listingId: string;
    generationId: string;
    grossAmountCents: number;
    creatorShareCents: number;
    platformFeeCents: number;
    source: 'marketplace' | 'webhook' | 'manual';
  };
  license_type_selected: {
    generationId: string;
    listingId?: string;
    licenseType: 'personal' | 'commercial';
  };
  collaboration_invited: {
    projectId: string;
    inviteCode: string;
  };
  collaboration_joined: {
    projectId: string;
    via: 'invite_code';
  };
  billing_portal_opened: {
    returnPath: string;
  };
  generation_started: {
    generationId: string;
    mode: string;
  };
  generation_completed: {
    generationId: string;
    mode: string;
  };
  generation_failed: {
    generationId: string;
    mode: string;
    reason?: string;
  };
  generation_shared: {
    generationId: string;
    method: 'modal_opened' | 'copy_link' | 'copy_text' | 'native_share';
    hadAudio: boolean;
  };
  generation_played: {
    generationId: string;
    source: 'public_generation' | 'explore';
  };
  generation_liked: {
    generationId: string;
    liked: boolean;
    source: 'public_generation' | 'explore';
  };
  generation_remixed: {
    parentGenerationId: string;
    source: 'generation_page' | 'create_page';
  };
  credits_low_shown: {
    remainingCredits: number;
    threshold: number;
  };
  project_created: {
    projectId: string;
  };
  upgrade_prompt_viewed: {
    feature: string;
    requiredTier: string;
    path: string;
  };
  upgrade_prompt_clicked: {
    feature: string;
    requiredTier: string;
    path: string;
    targetPath: string;
  };
  referral_interest_clicked: {
    placement: 'account';
    tier: string;
  };
  public_page_view: {
    generationId: string;
    creatorUsername?: string;
  };
  public_to_signup_click: {
    source: 'generation_page' | 'profile_page' | 'explore_page';
    generationId?: string;
    username?: string;
    referralCode?: string;
  };
  profile_view: {
    username: string;
  };
  explore_page_view: {
    sort: 'newest' | 'trending' | 'for_you';
  };
  explore_scroll_depth: {
    loadedCount: number;
    sort: 'newest' | 'trending' | 'for_you';
  };
  referral_link_clicked: {
    placement: 'account';
    referralCode: string;
  };
  referral_signup: {
    referralCode: string;
    applied: boolean;
  };
  api_usage: {
    endpoint: 'api_generate';
    status: 'success' | 'error';
    durationMs?: number;
  };
  api_errors: {
    endpoint: 'api_generate';
    reason: string;
    statusCode?: number;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsEventProps<T extends AnalyticsEventName> =
  Partial<AnalyticsEventMap[T]> & Record<string, unknown>;
