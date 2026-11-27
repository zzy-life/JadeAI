'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getAIConfigIssue, hasCompleteAIConfig, useSettingsStore, type AICapability } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';

interface UseAIConfigOptions {
  capability?: AICapability;
}

/** 检查失败即中止本次操作并引导配置，不记录或恢复原业务弹窗。 */
export function useAIConfig({ capability = 'text' }: UseAIConfigOptions = {}) {
  const t = useTranslations('ai.config');
  const isHydrated = useSettingsStore((state) => state._hydrated);
  const hasAIConfig = useSettingsStore((state) => hasCompleteAIConfig(state, capability));
  const isSettingsOpen = useUIStore((state) => state.activeModal === 'settings');

  const ensureAIConfig = useCallback(() => {
    const settings = useSettingsStore.getState();
    // 异步恢复尚未完成时不能把已有配置误判为缺失，也不能提前发送请求。
    if (!settings._hydrated) {
      toast.info(t('loading'), { id: 'ai-config-required' });
      return false;
    }
    const issue = getAIConfigIssue(settings, capability);
    if (!issue) return true;

    toast.warning(t('required'), {
      id: 'ai-config-required',
      description: t(issue),
    });
    useUIStore.getState().openAISettings();
    return false;
  }, [capability, t]);

  return { isHydrated, hasAIConfig: isHydrated && hasAIConfig, isSettingsOpen, ensureAIConfig };
}
