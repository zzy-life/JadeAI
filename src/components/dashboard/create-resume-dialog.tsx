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
import { Loader2, Check } from 'lucide-react';
import { TemplateThumbnail } from './template-thumbnail';
import { ResumeFileUpload } from '@/components/resume/resume-file-upload';
import { templateLabelsMap } from '@/lib/template-labels';

interface CreateResumeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title?: string; template?: string; language?: string }) => Promise<any>;
}

type Tab = 'template' | 'upload';

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
              <ResumeFileUpload
                file={file}
                disabled={isParsing}
                onConfigureAI={openAISettings}
                onFileChange={(selectedFile) => {
                  setParseError('');
                  setFile(selectedFile);
                }}
              />

              {parseError && <p className="text-sm text-red-500">{parseError}</p>}

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
