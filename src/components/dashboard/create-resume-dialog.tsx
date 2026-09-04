'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TEMPLATES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { getAIHeaders, hasCompleteAIConfig, useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';
import { Upload, FileText, Image, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { TemplateThumbnail } from './template-thumbnail';
import { templateLabelsMap } from '@/lib/template-labels';

interface CreateResumeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title?: string; template?: string; language?: string }) => Promise<any>;
}

type Tab = 'template' | 'upload';

const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.webp';

export function CreateResumeDialog({ open, onClose, onCreate }: CreateResumeDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const aiApiKey = useSettingsStore((state) => state.aiApiKey);
  const aiModel = useSettingsStore((state) => state.aiModel);
  const settingsHydrated = useSettingsStore((state) => state._hydrated);
  const activeModal = useUIStore((state) => state.activeModal);
  const openModal = useUIStore((state) => state.openModal);
  const openAISettingsModal = useUIStore((state) => state.openAISettings);
  const hasAIConfig = hasCompleteAIConfig({ aiApiKey, aiModel });
  const [tab, setTab] = useState<Tab>('template');
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<string>('classic');
  const [isCreating, setIsCreating] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeAfterSettingsRef = useRef(false);

  useEffect(() => {
    if (resumeAfterSettingsRef.current && activeModal === null) {
      resumeAfterSettingsRef.current = false;
      openModal('create-resume');
    }
  }, [activeModal, openModal]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const resume = await onCreate({ title: title || undefined, template });
      if (resume) {
        resetAndClose();
        router.push(`/editor/${resume.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setParseError('');
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      setParseError(t('dashboard.upload.invalidType'));
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setParseError(t('dashboard.upload.fileTooLarge'));
      return;
    }
    setFile(selectedFile);
  };

  const openAISettings = () => {
    resumeAfterSettingsRef.current = true;
    openAISettingsModal();
  };

  const handleUploadParse = async () => {
    if (!file || !hasAIConfig) return;
    setIsParsing(true);
    setParseError('');

    try {
      const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('jade_fingerprint') : null;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('template', template);

      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}), ...getAIHeaders() },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Parse failed');
      }

      const resume = await res.json();
      resetAndClose();
      router.push(`/editor/${resume.id}`);
    } catch (err: any) {
      setParseError(err.message || t('dashboard.upload.parseFailed'));
    } finally {
      setIsParsing(false);
    }
  };

  const resetAndClose = () => {
    onClose();
    setTitle('');
    setTemplate('classic');
    setTab('template');
    setFile(null);
    setParseError('');
  };

  const fileSelectionDisabled = !settingsHydrated || !hasAIConfig;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (fileSelectionDisabled) return;
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!fileSelectionDisabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const fileIcon = file?.type === 'application/pdf' ? FileText : Image;
  const FileIcon = fileIcon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-0 gap-0 sm:max-w-4xl">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{t('dashboard.createResume')}</DialogTitle>
          <DialogDescription>{t('dashboard.createResumeDescription')}</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="mx-6 mt-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            className={cn(
              'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === 'template'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
            onClick={() => setTab('template')}
          >
            {t('dashboard.upload.fromTemplate')}
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === 'upload'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
            onClick={() => setTab('upload')}
          >
            {t('dashboard.upload.fromFile')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {tab === 'template' ? (
            <div className="space-y-4">
              <Input
                placeholder={t('editor.fields.fullName')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div>
                <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t('editor.toolbar.template')}
                </p>
                <div className="max-h-[400px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {TEMPLATES.map((tpl) => {
                      const isSelected = template === tpl;
                      return (
                        <button
                          key={tpl}
                          type="button"
                          className={cn(
                            'group/tpl relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200',
                            isSelected
                              ? 'border-brand shadow-md shadow-brand/10'
                              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                          )}
                          onClick={() => setTemplate(tpl)}
                        >
                          {/* Thumbnail */}
                          <div className="relative bg-zinc-50 p-2 dark:bg-zinc-800/50">
                            <TemplateThumbnail
                              template={tpl}
                              className="mx-auto h-[100px] w-[71px] shadow-sm ring-1 ring-zinc-200/50"
                            />
                            {/* Selected check */}
                            {isSelected && (
                              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow-sm">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          {/* Label */}
                          <div className={cn(
                            'px-2 py-1.5 text-center text-xs font-medium transition-colors',
                            isSelected
                              ? 'bg-brand-muted text-brand dark:bg-brand-muted dark:text-brand'
                              : 'text-zinc-600 dark:text-zinc-400'
                          )}>
                            {t(templateLabelsMap[tpl])}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors',
                  fileSelectionDisabled
                    ? 'border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/40'
                    : isDragging
                      ? 'border-brand bg-brand-muted dark:bg-brand-muted'
                      : file
                        ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20'
                        : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500'
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {file ? (
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">{file.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t('common.delete')}
                      className="cursor-pointer rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700"
                      onClick={() => setFile(null)}
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
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {settingsHydrated && (
                <div className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
                  hasAIConfig
                    ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                )}>
                  {!hasAIConfig && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p>{t(hasAIConfig ? 'dashboard.upload.multimodalHint' : 'dashboard.upload.aiRequired')}</p>
                    {!hasAIConfig && (
                      <button
                        type="button"
                        onClick={openAISettings}
                        className="mt-1 cursor-pointer font-medium underline underline-offset-2"
                      >
                        {t('dashboard.upload.configureAI')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {parseError && (
                <p className="text-sm text-red-500">{parseError}</p>
              )}

              {/* Template selector for uploaded file */}
              <div>
                <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t('editor.toolbar.template')}
                </p>
                <div className="max-h-[400px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {TEMPLATES.map((tpl) => {
                      const isSelected = template === tpl;
                      return (
                        <button
                          key={tpl}
                          type="button"
                          className={cn(
                            'group/tpl relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200',
                            isSelected
                              ? 'border-brand shadow-md shadow-brand/10'
                              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                          )}
                          onClick={() => setTemplate(tpl)}
                        >
                          <div className="relative bg-zinc-50 p-2 dark:bg-zinc-800/50">
                            <TemplateThumbnail
                              template={tpl}
                              className="mx-auto h-[100px] w-[71px] shadow-sm ring-1 ring-zinc-200/50"
                            />
                            {isSelected && (
                              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow-sm">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          <div className={cn(
                            'px-2 py-1.5 text-center text-xs font-medium transition-colors',
                            isSelected
                              ? 'bg-brand-muted text-brand dark:bg-brand-muted dark:text-brand'
                              : 'text-zinc-600 dark:text-zinc-400'
                          )}>
                            {t(templateLabelsMap[tpl])}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <Button variant="outline" onClick={resetAndClose} className="cursor-pointer">
            {t('common.cancel')}
          </Button>
          {tab === 'template' ? (
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="cursor-pointer bg-brand hover:bg-brand-hover"
            >
              {isCreating ? t('common.loading') : t('common.create')}
            </Button>
          ) : (
            <Button
              onClick={handleUploadParse}
              disabled={!file || isParsing || !settingsHydrated || !hasAIConfig}
              className="cursor-pointer bg-brand hover:bg-brand-hover"
            >
              {isParsing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  {t('dashboard.upload.parsing')}
                </>
              ) : (
                t('dashboard.upload.uploadAndParse')
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
