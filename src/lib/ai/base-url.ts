import type { AIProvider } from '@/stores/settings-store';

export function normalizeAIBaseURL(baseURL: string): string {
  return baseURL.trim().replace(/\/+$/, '');
}

export function getAIRequestURL(
  provider: AIProvider,
  baseURL: string,
  model = ''
): string {
  const normalizedBaseURL = normalizeAIBaseURL(baseURL);
  if (!normalizedBaseURL) return '';

  if (provider === 'openai') {
    return `${normalizedBaseURL}/chat/completions`;
  }

  if (provider === 'anthropic') {
    return `${normalizedBaseURL}/messages`;
  }

  const modelId = model.trim();
  const modelPath = modelId.includes('/') ? modelId : `models/${modelId || '{model}'}`;
  return `${normalizedBaseURL}/${modelPath}:generateContent`;
}
