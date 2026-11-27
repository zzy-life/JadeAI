'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { InterviewReportView } from '@/components/interview/interview-report';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getAIHeaders } from '@/stores/settings-store';
import { useAIConfig } from '@/hooks/use-ai-config';
import type { InterviewReport, InterviewSession } from '@/types/interview';

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('ai.config');
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsConfig, setNeedsConfig] = useState(false);
  const { isHydrated, ensureAIConfig } = useAIConfig();

  const generateReport = useCallback(async () => {
    if (!ensureAIConfig()) {
      setNeedsConfig(true);
      setLoading(false);
      return;
    }
    setNeedsConfig(false);
    setLoading(true);
    try {
      const fp = localStorage.getItem('jade_fingerprint');
      const response = await fetch(`/api/interview/${id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fp ? { 'x-fingerprint': fp } : {}),
          ...getAIHeaders(),
        },
        body: JSON.stringify({ locale: document.documentElement.lang || 'zh' }),
      });
      if (!response.ok) throw new Error('Failed to generate report');
      setReport(await response.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, ensureAIConfig]);

  useEffect(() => {
    if (!isHydrated) return;
    const fp = localStorage.getItem('jade_fingerprint');
    // 已有报告只读历史数据，无需 AI 配置；只有缺少报告时才检查并生成。
    fetch(`/api/interview/${id}`, {
      headers: fp ? { 'x-fingerprint': fp } : {},
    })
      .then((response) => response.json())
      .then(({ session: savedSession, report: savedReport }) => {
        setSession(savedSession);
        if (savedReport) {
          setReport(savedReport);
          setLoading(false);
        } else {
          void generateReport();
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id, isHydrated, generateReport]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!report || !session) {
    return (
      <div className="space-y-4 py-20 text-center text-zinc-500">
        <p>{needsConfig ? t('required') : 'Failed to load report'}</p>
        {session && <Button onClick={() => void generateReport()} className="cursor-pointer">{t('retry')}</Button>}
      </div>
    );
  }

  return <InterviewReportView report={report} session={session} />;
}
