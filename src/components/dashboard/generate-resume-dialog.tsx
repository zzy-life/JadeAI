'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RESUME_INTAKE_LIMITS } from '@/lib/ai/resume-intake-schema';
import type { useResumeIntake } from '@/hooks/use-resume-intake';

interface ResumeIntakeChatProps {
  intake: ReturnType<typeof useResumeIntake>;
  configured: boolean;
  generating: boolean;
  generationError: string;
  onGenerate: () => void;
}

export function ResumeIntakeChat({ intake, configured, generating, generationError, onGenerate }: ResumeIntakeChatProps) {
  const t = useTranslations('generateResume');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, basicInfo, draft, setDraft, isReplying, needsReply, canGenerate, error, send, retry } = intake;
  const missing = [];
  if (!basicInfo.fullName) missing.push(t('fullName'));
  if (!basicInfo.jobTitle) missing.push(t('jobTitle'));
  let status = t('readyHint');
  if (missing.length > 0) status = t('missingHint', { fields: missing.join(' / ') });
  if (draft.trim()) status = t('unsentHint');
  if (needsReply && !isReplying) status = t('retryHint');
  if (isReplying) status = t('replying');
  if (generating) status = t('generating');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, isReplying, error, generationError]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 收集状态与制作按钮在滚动区之外，手机长对话也能随时看到门槛。 */}
      <section aria-label={t('collectedInfo')} className="shrink-0 border-y border-zinc-100 bg-brand-muted/20 px-6 py-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <dl className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2 text-sm">
            {(['fullName', 'jobTitle'] as const).map((field) => (
              <div key={field} className="min-w-0">
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">{t(field)}</dt>
                <dd className="mt-1 flex items-start gap-1 break-words font-medium [overflow-wrap:anywhere]">
                  {basicInfo[field] && <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />}
                  {basicInfo[field] || t('notProvided')}
                </dd>
              </div>
            ))}
          </dl>
          <Button
            disabled={!configured || !canGenerate || generating}
            aria-describedby="resume-intake-status"
            onClick={onGenerate}
            className="shrink-0 cursor-pointer bg-brand hover:bg-brand-hover"
          >
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {generating ? t('generating') : t('generate')}
          </Button>
        </div>
        <p id="resume-intake-status" role="status" className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{status}</p>
      </section>

      <div role="log" aria-label={t('conversation')} aria-busy={isReplying} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
        <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-zinc-100 px-4 py-3 text-sm leading-relaxed dark:bg-zinc-800">
          <p className="mb-1 text-xs font-medium text-brand">{t('assistant')}</p>
          <p>{t('welcome')}</p>
        </div>
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn('w-fit max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed',
              message.role === 'user' ? 'ml-auto rounded-tr-sm bg-brand-muted/60' : 'rounded-tl-sm bg-zinc-100 dark:bg-zinc-800')}
          >
            <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{message.role === 'user' ? t('you') : t('assistant')}</p>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
          </div>
        ))}
        {isReplying && <p role="status" className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />{t('replying')}</p>}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-red-600 dark:text-red-400">
            <p>{error}</p>
            {needsReply && <Button variant="outline" disabled={!configured || isReplying || generating} onClick={() => void retry()}>{t('retryReply')}</Button>}
          </div>
        )}
        {generationError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{generationError}</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="shrink-0 space-y-2 border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
        <label htmlFor="resume-intake-message" className="sr-only">{t('inputLabel')}</label>
        <div className="flex items-end gap-2">
          <Textarea
            id="resume-intake-message"
            aria-describedby="resume-intake-privacy"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={isReplying || generating || needsReply}
            maxLength={RESUME_INTAKE_LIMITS.maxMessageLength}
            rows={2}
            placeholder={t('placeholder')}
            className="max-h-32 min-h-16 resize-none"
          />
          <Button type="submit" disabled={!configured || !draft.trim() || isReplying || generating || needsReply} className="cursor-pointer bg-brand hover:bg-brand-hover">
            <Send className="mr-1.5 h-4 w-4" />{t('send')}
          </Button>
        </div>
        <p id="resume-intake-privacy" className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t('privacyHint')}</p>
      </form>
    </div>
  );
}
