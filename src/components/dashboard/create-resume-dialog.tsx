'use client';

import { useState, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TEMPLATES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { getAIHeaders, hasCompleteAIConfig, useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';
import { ArrowLeft, ArrowRight, Check, FileJson, LayoutTemplate, Loader2, Sparkles, Upload } from 'lucide-react';
import { TemplateThumbnail } from './template-thumbnail';
import { ImportJsonStep } from './import-json-dialog';
import { ResumeIntakeChat } from './generate-resume-dialog';
import { useResumeIntake } from '@/hooks/use-resume-intake';
import { useAIConfig } from '@/hooks/use-ai-config';
import { ResumeFileUpload } from '@/components/resume/resume-file-upload';
import { templateLabelsMap } from '@/lib/template-labels';
import { resumeBackupSchema, type CreateResumeInput, type ResumeBackup } from '@/lib/resume/create-schema';
import type { Resume } from '@/types/resume';

interface CreateResumeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateResumeInput) => Promise<Resume | null>;
  onCreated: () => void;
}

type CreationStep = 'choose' | 'template' | 'upload' | 'backup' | 'ai';
type BusyState = 'reading' | 'creating' | 'parsing' | 'generating' | null;

const METHOD_GROUPS = [
  { key: 'fromScratch', methods: [{ step: 'ai', icon: Sparkles }, { step: 'template', icon: LayoutTemplate }] },
  { key: 'existingInfo', methods: [{ step: 'upload', icon: Upload }, { step: 'backup', icon: FileJson }] },
] as const;

export function CreateResumeDialog({ open, onClose, onCreate, onCreated }: CreateResumeDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const aiApiKey = useSettingsStore((state) => state.aiApiKey);
  const aiModel = useSettingsStore((state) => state.aiModel);
  const settingsHydrated = useSettingsStore((state) => state._hydrated);
  const openAISettingsModal = useUIStore((state) => state.openAISettings);
  const hasAIConfig = hasCompleteAIConfig({ aiApiKey, aiModel });
  const { ensureAIConfig } = useAIConfig();
  const intake = useResumeIntake(locale, settingsHydrated && hasAIConfig);
  const [step, setStep] = useState<CreationStep>('choose');
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('classic');
  const [file, setFile] = useState<File | null>(null);
  const [backupFileName, setBackupFileName] = useState('');
  const [backup, setBackup] = useState<ResumeBackup | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState('');
  const requestInProgressRef = useRef(false);
  const isBusy = busy !== null;

  const resetInputs = () => {
    setTitle('');
    setTemplate('classic');
    setFile(null);
    setBackupFileName('');
    setBackup(null);
    intake.reset();
    setError('');
  };

  const close = () => {
    resetInputs();
    setStep('choose');
    onClose();
  };

  const leave = (destination: 'close' | 'choose') => {
    if (requestInProgressRef.current) return;
    if (step === 'ai' && intake.hasContent && !window.confirm(t('generateResume.discardConfirm'))) return;
    if (destination === 'close') {
      close();
    } else {
      resetInputs();
      setStep('choose');
    }
  };

  const selectMethod = (nextStep: CreationStep) => {
    if (nextStep === 'ai' || nextStep === 'upload') {
      if (!ensureAIConfig()) return;
    }
    resetInputs();
    setStep(nextStep);
  };

  const openAISettings = () => {
    if (requestInProgressRef.current) return;
    openAISettingsModal();
  };

  const readBackup = async (selectedFile: File) => {
    if (requestInProgressRef.current) return;
    setBackup(null);
    setTitle('');
    setTemplate('');
    setBackupFileName(selectedFile.name);
    setError('');
    if (!selectedFile.name.toLowerCase().endsWith('.json')) {
      setError(t('import.invalidFormat'));
      return;
    }

    requestInProgressRef.current = true;
    setBusy('reading');
    try {
      const data = resumeBackupSchema.safeParse(JSON.parse(await selectedFile.text()));
      if (!data.success) {
        setError(t('import.invalidFormat'));
        return;
      }
      setBackup(data.data);
      setTitle(data.data.title);
      if (TEMPLATES.some((value) => value === data.data.template)) {
        setTemplate(data.data.template);
      }
    } catch {
      setError(t('import.invalidFormat'));
    } finally {
      requestInProgressRef.current = false;
      setBusy(null);
    }
  };

  const createFromTemplateOrBackup = async () => {
    if (requestInProgressRef.current || !template) return;
    if (step === 'backup' && !backup) return;
    requestInProgressRef.current = true;
    setBusy('creating');
    setError('');
    try {
      const data: CreateResumeInput = { title: title.trim() || undefined, template, language: locale };
      if (step === 'backup' && backup) {
        data.language = backup.language;
        data.themeConfig = backup.themeConfig;
        data.sections = backup.sections;
      }
      const resume = await onCreate(data);
      if (!resume) {
        setError(t('dashboard.creation.createFailed'));
        return;
      }
      close();
      router.push(`/editor/${resume.id}`);
    } catch {
      setError(t('dashboard.creation.createFailed'));
    } finally {
      requestInProgressRef.current = false;
      setBusy(null);
    }
  };

  const createFromFile = async () => {
    if (requestInProgressRef.current || !file || !ensureAIConfig()) return;
    requestInProgressRef.current = true;
    setBusy('parsing');
    setError('');
    try {
      const fingerprint = localStorage.getItem('jade_fingerprint');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('template', template);
      formData.append('language', locale);
      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}), ...getAIHeaders() },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('dashboard.upload.parseFailed'));
      onCreated();
      close();
      router.push(`/editor/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.upload.parseFailed'));
    } finally {
      requestInProgressRef.current = false;
      setBusy(null);
    }
  };

  const createWithAI = async () => {
    if (requestInProgressRef.current || !intake.canGenerate || !ensureAIConfig()) return;
    requestInProgressRef.current = true;
    setBusy('generating');
    setError('');
    try {
      const fingerprint = localStorage.getItem('jade_fingerprint');
      const res = await fetch('/api/ai/generate-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          messages: intake.messages,
          basicInfo: intake.basicInfo,
          template: 'classic',
          language: locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('generateResume.error'));
      onCreated();
      close();
      router.push(`/editor/${data.resumeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateResume.error'));
    } finally {
      requestInProgressRef.current = false;
      setBusy(null);
    }
  };

  let description = t('dashboard.createResumeDescription');
  if (step !== 'choose') description = t(`dashboard.creation.${step}Description`);
  let actionLabel = t('dashboard.creation.create');
  if (step === 'upload') actionLabel = t('dashboard.upload.uploadAndParse');
  if (busy === 'reading') actionLabel = t('import.reading');
  if (busy === 'creating') actionLabel = t('dashboard.creation.creating');
  if (busy === 'parsing') actionLabel = t('dashboard.upload.parsing');

  let cannotCreate = isBusy;
  if (step === 'backup') cannotCreate = isBusy || !backup || !template;
  if (step === 'upload') cannotCreate = isBusy || !file || !settingsHydrated;
  const showTemplateSelector = step === 'template' || step === 'upload' || (step === 'backup' && backup !== null);
  const backupTemplateMissing = backup !== null && !TEMPLATES.some((value) => value === backup.template);

  const submit = () => {
    if (step === 'upload') {
      void createFromFile();
    } else {
      void createFromTemplateOrBackup();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) leave('close'); }}>
      <DialogContent
        showCloseButton={!isBusy}
        className={cn('flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl', step === 'ai' && 'h-[min(760px,calc(100dvh-2rem))]')}
        onEscapeKeyDown={(event) => { if (requestInProgressRef.current) event.preventDefault(); }}
        onInteractOutside={(event) => { if (requestInProgressRef.current) event.preventDefault(); }}
      >
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6 text-left">
          <DialogTitle>{step === 'choose' ? t('dashboard.createResume') : t(`dashboard.creation.${step}`)}</DialogTitle>
          <DialogDescription className="pr-4">{description}</DialogDescription>
        </DialogHeader>

        {step === 'ai' && (
          <>
            {settingsHydrated && !hasAIConfig && (
              <div className="mx-6 mb-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <p>{t('dashboard.creation.aiRequired')}</p>
                <Button variant="link" className="h-auto cursor-pointer px-0 pt-1 text-inherit" onClick={openAISettings}>
                  {t('dashboard.upload.configureAI')}
                </Button>
              </div>
            )}
            <ResumeIntakeChat
              intake={intake}
              generating={busy === 'generating'}
              generationError={error}
            />
          </>
        )}

        <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 pb-5', step === 'ai' && 'hidden')}>
          {step === 'choose' && (
            <div className="space-y-5">
              {METHOD_GROUPS.map((group) => (
                <section key={group.key} aria-labelledby={`creation-${group.key}`}>
                  <h3 id={`creation-${group.key}`} className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {t(`dashboard.creation.${group.key}`)}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.methods.map(({ step: method, icon: Icon }) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => selectMethod(method)}
                        className="group flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-brand hover:bg-brand-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none dark:border-zinc-700"
                      >
                        <span className="rounded-lg bg-brand-muted p-2 text-brand"><Icon className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{t(`dashboard.creation.${method}`)}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t(`dashboard.creation.${method}Description`)}</span>
                        </span>
                        <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-zinc-400 group-hover:text-brand" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('dashboard.creation.newResumeHint')}</p>
            </div>
          )}

          {step !== 'choose' && step !== 'ai' && (
            <div className="space-y-4">
              {step === 'backup' && <ImportJsonStep fileName={backupFileName} disabled={isBusy} onFileSelect={readBackup} />}
              {step === 'upload' && (
                <>
                  <ResumeFileUpload
                    file={file}
                    disabled={isBusy}
                    onConfigureAI={openAISettings}
                    onFileChange={(selectedFile) => { setError(''); setFile(selectedFile); }}
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('dashboard.creation.fileStyleHint')}</p>
                </>
              )}
              {showTemplateSelector && (
                <fieldset disabled={isBusy} className="min-w-0 space-y-4">
                  {step !== 'upload' && (
                    <div className="space-y-1.5">
                      <label htmlFor="new-resume-title" className="text-sm font-medium">{t('dashboard.creation.resumeName')}</label>
                      <Input
                        id="new-resume-title"
                        placeholder={t('dashboard.creation.resumeNamePlaceholder')}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                      />
                    </div>
                  )}
                  {backupTemplateMissing && (
                    <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      {t('import.missingTemplate', { template: backup.template || t('import.unknownTemplate') })}
                    </p>
                  )}
                  <div>
                    <p className="mb-3 text-sm font-medium">{t('dashboard.creation.chooseTemplate')}</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {TEMPLATES.map((value) => {
                        const selected = template === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setTemplate(value)}
                            className={cn(
                              'relative cursor-pointer overflow-hidden rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                              selected ? 'border-brand' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600',
                            )}
                          >
                            <div className="relative bg-zinc-50 p-2 dark:bg-zinc-800/50">
                              <TemplateThumbnail template={value} className="mx-auto h-[100px] w-[71px] shadow-sm ring-1 ring-zinc-200/50" />
                              {selected && <span className="absolute right-1.5 top-1.5 rounded-full bg-brand p-1 text-brand-foreground"><Check className="h-3 w-3" /></span>}
                            </div>
                            <div className={cn('px-2 py-1.5 text-center text-xs font-medium', selected ? 'bg-brand-muted text-brand' : 'text-zinc-600 dark:text-zinc-400')}>
                              {t(templateLabelsMap[value])}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </fieldset>
              )}
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
          )}
        </div>

        {step !== 'choose' && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <Button variant="ghost" disabled={isBusy} className="cursor-pointer gap-1.5 px-0" onClick={() => leave('choose')}>
              <ArrowLeft className="h-4 w-4" />{t('dashboard.creation.back')}
            </Button>
            <div className="ml-auto flex gap-2">
              {step === 'ai' ? (
                <Button
                  disabled={!settingsHydrated || !intake.canGenerate || isBusy}
                  aria-describedby="resume-intake-status"
                  onClick={() => void createWithAI()}
                  className="cursor-pointer bg-brand hover:bg-brand-hover"
                >
                  {isBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                  {isBusy ? t('generateResume.generating') : t('generateResume.generate')}
                </Button>
              ) : (
                <>
                  <Button variant="outline" disabled={isBusy} onClick={() => leave('close')} className="cursor-pointer">{t('common.cancel')}</Button>
                  <Button disabled={cannotCreate} onClick={submit} className="cursor-pointer bg-brand hover:bg-brand-hover">
                    {isBusy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{actionLabel}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
