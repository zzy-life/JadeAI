'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface JdDerivedResumeNoticeProps {
  jobDescription: string;
  sourceTitle?: string;
  variant?: 'badge' | 'banner';
}

export function JdDerivedResumeNotice({
  jobDescription,
  sourceTitle,
  variant = 'badge',
}: JdDerivedResumeNoticeProps) {
  const t = useTranslations('jdDerivedResume');
  const [open, setOpen] = useState(false);

  const openDetails = (event: React.MouseEvent) => {
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <Briefcase className="h-4 w-4 shrink-0" />
          <span>{t('editorNotice')}</span>
          <button type="button" onClick={openDetails} className="cursor-pointer">
            <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-300 dark:bg-amber-900 dark:text-amber-100">
              {t('badge')}
            </Badge>
          </button>
        </div>
      ) : (
        <Badge
          asChild
          className="h-5 w-full bg-amber-100 px-1.5 py-0 text-[11px] text-amber-800 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
        >
          <button type="button" onClick={openDetails} className="cursor-pointer">
            {t('badge')}
          </button>
        </Badge>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          {sourceTitle && (
            <div className="text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">{t('sourceLabel')}</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{sourceTitle}</span>
            </div>
          )}
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {jobDescription}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
