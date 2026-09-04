import { create } from 'zustand';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

interface SettingsStore {
  // AI settings
  aiProvider: AIProvider;
  aiApiKey: string; // stored locally only, never sent to server
  aiBaseURL: string;
  aiModel: string;
  aiImageModel: string;
  // Editor settings
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds

  // Hydration state
  _hydrated: boolean;
  _syncing: boolean;

  // Actions
  setAIProvider: (provider: AIProvider) => void;
  setAIApiKey: (key: string) => void;
  setAIBaseURL: (url: string) => void;
  setAIModel: (model: string) => void;
  setAIImageModel: (model: string) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  hydrate: () => void;
}

const API_KEY_STORAGE_KEY = 'jade_api_key';
const PROVIDER_CONFIGS_KEY = 'jade_provider_configs';

interface ProviderConfig {
  baseURL: string;
  model: string;
  imageModel?: string;
  apiKey: string;
}

const PROVIDER_DEFAULTS: Record<AIProvider, ProviderConfig> = {
  openai: { baseURL: 'https://api.deepseek.com', model: '', imageModel: '', apiKey: '' },
  anthropic: { baseURL: 'https://api.anthropic.com', model: '', imageModel: '', apiKey: '' },
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta', model: '', imageModel: '', apiKey: '' },
};

function loadProviderConfigs(): Partial<Record<AIProvider, ProviderConfig>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROVIDER_CONFIGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProviderConfigs(configs: Partial<Record<AIProvider, ProviderConfig>>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PROVIDER_CONFIGS_KEY, JSON.stringify(configs)); } catch { /* ignore */ }
}

function getFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jade_fingerprint');
}

function getHeaders(): Record<string, string> {
  const fp = getFingerprint();
  return {
    'Content-Type': 'application/json',
    ...(fp ? { 'x-fingerprint': fp } : {}),
  };
}

// Sync settings to server (debounced)
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function syncToServer(state: SettingsStore) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          aiProvider: state.aiProvider,
          aiBaseURL: state.aiBaseURL,
          aiModel: state.aiModel,
          aiImageModel: state.aiImageModel,
          autoSave: state.autoSave,
          autoSaveInterval: state.autoSaveInterval,
        }),
      });
    } catch {
      // silently fail, local state is still correct
    }
  }, 500);
}

function syncProviderConfig(state: SettingsStore) {
  const configs = loadProviderConfigs();
  configs[state.aiProvider] = {
    baseURL: state.aiBaseURL,
    model: state.aiModel,
    imageModel: state.aiImageModel,
    apiKey: state.aiApiKey,
  };
  saveProviderConfigs(configs);
}

export function migrateLegacyGeminiConfig(apiKey: string) {
  const state = useSettingsStore.getState();
  const configs = loadProviderConfigs();
  const existing = configs.gemini || PROVIDER_DEFAULTS.gemini;
  const migrated = {
    ...existing,
    apiKey: existing.apiKey || apiKey,
    imageModel: existing.imageModel || 'gemini-3.1-flash-image-preview',
  };
  configs.gemini = migrated;
  saveProviderConfigs(configs);

  if (state.aiProvider === 'gemini') {
    if (!state.aiApiKey) state.setAIApiKey(migrated.apiKey);
    if (!state.aiImageModel) state.setAIImageModel(migrated.imageModel);
  }
}

function saveApiKeyLocally(key: string) {
  if (typeof window === 'undefined') return;
  try {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

function loadApiKeyLocally(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function hasCompleteAIConfig(config: { aiApiKey: string; aiModel: string }): boolean {
  return Boolean(config.aiApiKey.trim() && config.aiModel.trim());
}

export function getAIHeaders(): Record<string, string> {
  const { aiProvider, aiApiKey, aiBaseURL, aiModel, aiImageModel } = useSettingsStore.getState();
  const headers: Record<string, string> = {};
  if (aiProvider) headers['x-provider'] = aiProvider;
  if (aiApiKey) headers['x-api-key'] = aiApiKey;
  if (aiBaseURL) headers['x-base-url'] = aiBaseURL;
  if (aiModel) headers['x-model'] = aiModel;
  if (aiImageModel) headers['x-image-model'] = aiImageModel;
  return headers;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  aiProvider: 'openai',
  aiApiKey: '',
  aiBaseURL: 'https://api.deepseek.com',
  aiModel: '',
  aiImageModel: '',
  autoSave: true,
  autoSaveInterval: 500,
  _hydrated: false,
  _syncing: false,

  setAIProvider: (provider) => {
    const { aiProvider: prev, aiBaseURL, aiModel, aiImageModel, aiApiKey } = get();

    // Save current provider's config before switching
    const configs = loadProviderConfigs();
    configs[prev] = { baseURL: aiBaseURL, model: aiModel, imageModel: aiImageModel, apiKey: aiApiKey };
    saveProviderConfigs(configs);

    // Restore target provider's cached config, or use defaults
    const cached = configs[provider];
    const defaults = PROVIDER_DEFAULTS[provider];
    const restored = cached || defaults;

    set({
      aiProvider: provider,
      aiBaseURL: restored.baseURL,
      aiModel: restored.model,
      aiImageModel: restored.imageModel || '',
      aiApiKey: restored.apiKey,
    });
    saveApiKeyLocally(restored.apiKey);
    syncToServer(get());
  },

  setAIApiKey: (key) => {
    set({ aiApiKey: key });
    saveApiKeyLocally(key);
    syncProviderConfig(get());
  },

  setAIBaseURL: (url) => {
    set({ aiBaseURL: url });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setAIModel: (model) => {
    set({ aiModel: model });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setAIImageModel: (model) => {
    set({ aiImageModel: model });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setAutoSave: (enabled) => {
    set({ autoSave: enabled });
    syncToServer(get());
  },

  setAutoSaveInterval: (interval) => {
    set({ autoSaveInterval: interval });
    syncToServer(get());
  },

  hydrate: async () => {
    if (get()._hydrated) return;

    // Load API key from localStorage immediately
    const apiKey = loadApiKeyLocally();
    set({ aiApiKey: apiKey });

    // Load other settings from server
    try {
      const res = await fetch('/api/user/settings', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Backward compat: map legacy 'custom' provider to 'openai'
        const provider = (data.aiProvider === 'custom' || data.aiProvider === 'azure') ? 'openai' : data.aiProvider;
        const cachedProvider = provider ? loadProviderConfigs()[provider as AIProvider] : undefined;
        const cachedProviderKey = cachedProvider?.apiKey || (provider === get().aiProvider ? apiKey : '');
        set({
          ...(provider && { aiProvider: provider }),
          aiApiKey: cachedProviderKey,
          ...(data.aiBaseURL && { aiBaseURL: data.aiBaseURL }),
          ...(data.aiModel && { aiModel: data.aiModel }),
          ...(typeof data.aiImageModel === 'string'
            ? { aiImageModel: data.aiImageModel }
            : cachedProvider?.imageModel
              ? { aiImageModel: cachedProvider.imageModel }
              : {}),
          ...(typeof data.autoSave === 'boolean' && { autoSave: data.autoSave }),
          ...(typeof data.autoSaveInterval === 'number' && { autoSaveInterval: data.autoSaveInterval }),
          _hydrated: true,
        });
        // Seed provider config cache with hydrated values
        syncProviderConfig(get());
        return;
      }
    } catch { /* fall through */ }

    set({ _hydrated: true });
  },
}));

// Auto-hydrate on client side so settings are ready before any component uses them
if (typeof window !== 'undefined') {
  useSettingsStore.getState().hydrate();
}
