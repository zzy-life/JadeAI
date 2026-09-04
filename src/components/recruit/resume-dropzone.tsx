'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasCompleteAIConfig, useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';

interface ResumeDropzoneProps {
  uploading: boolean;
  onFile: (file: File) => void;
}

/**
 * 横向紧凑上传区。原来是 280px 高的空卡片，中间只放一个按钮——
 * 占了屏幕四分之一却只承载一个动作。
 */
export function ResumeDropzone({ uploading, onFile }: ResumeDropzoneProps) {
  const t = useTranslations('recruit.resume');
  const inputRef = useRef<HTMLInputElement>(null);
  const aiApiKey = useSettingsStore((state) => state.aiApiKey);
  const aiModel = useSettingsStore((state) => state.aiModel);
  const settingsHydrated = useSettingsStore((state) => state._hydrated);
  const openAISettings = useUIStore((state) => state.openAISettings);
  const hasAIConfig = hasCompleteAIConfig({ aiApiKey, aiModel });


  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-zinc-200 px-5 py-4 dark:border-zinc-700">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading || !settingsHydrated || !hasAIConfig}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            // 清空 input，否则同一个文件重传第二次不会触发 change
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
        {uploading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-400" />
        ) : (
          <Upload className="h-5 w-5 shrink-0 text-zinc-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{uploading ? t('parsing') : t('upload')}</p>
          {!uploading && <p className="mt-0.5 text-xs text-zinc-400">{t('uploadHint')}</p>}
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !settingsHydrated || !hasAIConfig}
          className="shrink-0 cursor-pointer gap-2 bg-brand hover:bg-brand-hover"
        >
          {t('upload')}
        </Button>
      </div>
      {settingsHydrated && (
        <div className={hasAIConfig ? 'text-xs text-zinc-500 dark:text-zinc-400' : 'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}>
          {!hasAIConfig && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div>
            <span>{t(hasAIConfig ? 'multimodalHint' : 'aiRequired')}</span>
            {!hasAIConfig && (
              <button
                type="button"
                onClick={openAISettings}
                className="ml-1 cursor-pointer font-medium underline underline-offset-2"
              >
                {t('configureAI')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
