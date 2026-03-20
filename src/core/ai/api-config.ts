export type ApiMode = 'direct' | 'proxy';

export interface ApiConfig {
  mode: ApiMode;
  baseUrl: string;
  apiKey?: string;
  sessionToken?: string;
}

const STORAGE_KEY = 'musicforge-api-config';
const DEFAULT_BASE_URL = 'https://api.replicate.com/v1';

export function getApiConfig(): ApiConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid JSON — use defaults
    }
  }

  return {
    mode: 'direct',
    baseUrl: DEFAULT_BASE_URL,
    apiKey: localStorage.getItem('replicate-api-key') || undefined,
  };
}

export function setApiConfig(config: Partial<ApiConfig>): void {
  const current = getApiConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // Keep legacy key in sync for backward compatibility
  if (updated.apiKey) {
    localStorage.setItem('replicate-api-key', updated.apiKey);
  }
}

export function isProxyMode(): boolean {
  return getApiConfig().mode === 'proxy';
}
