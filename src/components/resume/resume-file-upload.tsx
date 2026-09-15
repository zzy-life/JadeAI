'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, FileText, Image, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasCompleteAIConfig, useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';

const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.webp';
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ResumeFileUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  onConfigureAI?: () => void;
}

/**
 * 仅负责简历文件的选择和本地校验；调用方决定解析 API 与后续业务流程。
 */
export function ResumeFileUpload({
  file,
  onFileChange,
  disabled = false,
  onConfigureAI,
}: ResumeFileUploadProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const aiApiKey = useSettingsStore((state) => state.aiApiKey);
  const aiModel = useSettingsStore((state) => state.aiModel);
  const settingsHydrated = useSettingsStore((state) => state._hydrated);
  const openAISettings = useUIStore((state) => state.openAISettings);
  const hasAIConfig = hasCompleteAIConfig({ aiApiKey, aiModel });
  const fileSelectionDisabled = disabled || !settingsHydrated || !hasAIConfig;

  const selectFile = (selectedFile: File) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError(t('dashboard.upload.invalidType'));
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(t('dashboard.upload.fileTooLarge'));
      return;
    }
    setError('');
    onFileChange(selectedFile);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (fileSelectionDisabled) return;
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) selectFile(droppedFile);
  };

  const handleConfigureAI = () => {
    if (onConfigureAI) {
      onConfigureAI();
      return;
    }
    openAISettings();
  };

  const FileIcon = file?.type === 'application/pdf' ? FileText : Image;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors',
          fileSelectionDisabled
            ? 'border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/40'
            : isDragging
              ? 'border-brand bg-brand-muted dark:bg-brand-muted'
              : file
                ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
                : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500',
        )}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          if (!fileSelectionDisabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
      >
        {file ? (
          <div className="flex w-full items-center gap-3">
            <FileIcon className="h-8 w-8 shrink-0 text-green-600 dark:text-green-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">{file.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              type="button"
              aria-label={t('common.delete')}
              disabled={disabled}
              className="cursor-pointer rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-700"
              onClick={() => {
                setError('');
                onFileChange(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-zinc-400" />
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('dashboard.upload.dropzone')}</p>
            <p className="mt-1 text-xs text-zinc-400">{t('dashboard.upload.acceptedTypes')}</p>
            <button
              type="button"
              disabled={fileSelectionDisabled}
              className="mt-3 cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('dashboard.upload.browse')}
            </button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          disabled={fileSelectionDisabled}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) selectFile(selectedFile);
            event.target.value = '';
          }}
        />
      </div>

      {settingsHydrated && (
        <div className={cn(
          'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
          hasAIConfig
            ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
        )}>
          {!hasAIConfig && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p>{t(hasAIConfig ? 'dashboard.upload.multimodalHint' : 'dashboard.upload.aiRequired')}</p>
            {!hasAIConfig && (
              <button
                type="button"
                onClick={handleConfigureAI}
                className="mt-1 cursor-pointer font-medium underline underline-offset-2"
              >
                {t('dashboard.upload.configureAI')}
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
