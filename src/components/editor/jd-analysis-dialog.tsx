'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/routing';
import {
  Loader2, RotateCcw, Target, ShieldCheck, Lightbulb, AlertTriangle,
  Wand2, Trash2, FileSearch, ArrowUp, ArrowDown, Minus, ChevronLeft,
  Briefcase, ChevronDown, CheckCircle2, FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useResumeStore } from '@/stores/resume-store';
import { getAIHeaders } from '@/stores/settings-store';
import { MAX_JOB_DESCRIPTION_LENGTH } from '@/lib/ai/jd-analysis-schema';

interface JdAnalysisResult {
  overallScore: number;
  keywordMatches: string[];
  missingKeywords: string[];
  suggestions: { section: string; current: string; suggested: string }[];
  atsScore: number;
  summary: string;
}

interface OptimizationResult {
  resumeId: string;
  targetRole: string;
  changes: { section: string; summary: string }[];
}

interface HistoryItem {
  id: string;
  overallScore: number;
  atsScore: number;
  jobDescription: string;
  createdAt: string | number;
}

interface JdAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string;
}

function getScoreColor(score: number): string {
  if (score < 40) return 'text-red-500';
  if (score <= 70) return 'text-yellow-500';
  return 'text-emerald-500';
}

function getScoreStroke(score: number): string {
  if (score < 40) return 'stroke-red-500';
  if (score <= 70) return 'stroke-yellow-500';
  return 'stroke-emerald-500';
}

function getScoreTrack(score: number): string {
  if (score < 40) return 'stroke-red-100';
  if (score <= 70) return 'stroke-yellow-100';
  return 'stroke-emerald-100';
}

function ScoreCircle({ score, label, size = 'lg' }: { score: number; label: string; size?: 'sm' | 'lg' }) {
  const isSm = size === 'sm';
  const radius = isSm ? 16 : 40;
  const viewBox = isSm ? '0 0 40 40' : '0 0 100 100';
  const cx = isSm ? 20 : 50;
  const strokeWidth = isSm ? 3 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${isSm ? 'h-10 w-10' : 'h-24 w-24'}`}>
        <svg className={`${isSm ? 'h-10 w-10' : 'h-24 w-24'} -rotate-90`} viewBox={viewBox}>
          <circle
            cx={cx} cy={cx} r={radius}
            fill="none" strokeWidth={strokeWidth}
            className={getScoreTrack(score)}
          />
          <circle
            cx={cx} cy={cx} r={radius}
            fill="none" strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${getScoreStroke(score)} transition-all duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${getScoreColor(score)} ${isSm ? 'text-xs' : 'text-2xl'}`}>
            {score}
          </span>
        </div>
      </div>
      {!isSm && <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>}
    </div>
  );
}

function JdOptimizeProgress({ t }: { t: any }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="relative mb-7 h-48 w-36 overflow-hidden rounded-xl border border-brand/20 bg-white shadow-[0_24px_70px_-28px_rgba(59,130,246,0.55)] dark:bg-zinc-900">
        <div className="space-y-3 p-5">
          <div className="h-2 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-1.5 w-24 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="mt-5 h-1.5 w-full rounded-full bg-brand/20" />
          <div className="h-1.5 w-5/6 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="mt-4 h-1.5 w-3/4 rounded-full bg-brand/20" />
          <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-1.5 w-4/5 rounded-full bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="absolute inset-x-0 top-0 h-16 animate-[jd-scan_2.2s_ease-in-out_infinite] border-b border-brand/60 bg-gradient-to-b from-transparent via-brand/15 to-brand/30 motion-reduce:animate-none" />
        <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30">
          <Wand2 className="h-4 w-4 animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('optimizingTitle')}</h3>
      <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t('optimizingDescription')}
      </p>

      <div className="mt-7 grid w-full max-w-lg grid-cols-3 gap-3">
        {[
          [FileText, 'optimizingStepAnalyze'],
          [Target, 'optimizingStepTailor'],
          [CheckCircle2, 'optimizingStepValidate'],
        ].map(([Icon, key], index) => {
          const StepIcon = Icon as typeof FileText;
          return (
            <div
              key={key as string}
              className="flex flex-col items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/70 px-2 py-3 text-center dark:border-zinc-800 dark:bg-zinc-900/70"
              style={{ animation: `pulse 1.8s ease-in-out ${index * 0.3}s infinite` }}
            >
              <StepIcon className="h-4 w-4 text-brand" />
              <span className="text-xs text-zinc-600 dark:text-zinc-300">{t(key as string)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5" />
        {t('mainResumeProtected')}
      </div>
      <style jsx>{`
        @keyframes jd-scan {
          0%, 100% { transform: translateY(-4rem); opacity: 0.35; }
          50% { transform: translateY(12rem); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function JdOptimizeResult({ result, t, onOpen }: { result: OptimizationResult; t: any; onOpen: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-7">
        <div className="mx-auto max-w-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t('resultTitle')}</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t('resultDescription', { role: result.targetRole })}
          </p>

          <div className="mt-6 space-y-3">
            {result.changes.map((change, index) => (
              <div key={`${change.section}-${index}`} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{change.section}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{change.summary}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {t('mainResumeProtected')}
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <Button onClick={onOpen} className="cursor-pointer gap-1.5 bg-brand hover:bg-brand-hover">
          {t('openOptimizedResume')}
        </Button>
      </div>
    </div>
  );
}

function ScoreTrend({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  const diff = current - previous;
  if (diff > 0) return <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (diff < 0) return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-zinc-400" />;
}

function formatDate(value: string | number): string {
  const d = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Result view (shared between new analysis & history detail) ── */
function JdAnalysisResultView({ result, jobDescription, t }: { result: JdAnalysisResult; jobDescription?: string; t: any }) {
  const [jdExpanded, setJdExpanded] = useState(false);

  return (
    <div className="px-6 py-4 space-y-6">
      {/* Job Description */}
      {jobDescription && (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={() => setJdExpanded(!jdExpanded)}
            className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left cursor-pointer"
          >
            <Briefcase className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex-1 truncate">
              {t('jobDescriptionLabel')}
            </span>
            <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${jdExpanded ? 'rotate-180' : ''}`} />
          </button>
          {jdExpanded && (
            <div className="border-t border-zinc-100 px-3.5 py-3 dark:border-zinc-800">
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {jobDescription}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Score Dashboard */}
      <div className="flex items-center justify-center gap-10 rounded-xl border border-zinc-100 bg-zinc-50/50 py-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <ScoreCircle score={result.overallScore} label={t('overallScore')} />
        <ScoreCircle score={result.atsScore} label={t('atsScore')} />
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Target className="h-4 w-4 text-zinc-400" />
          {t('summary')}
        </h4>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {result.summary}
        </p>
      </div>

      {/* Keyword Matches */}
      {result.keywordMatches.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            {t('keywordMatches')}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {result.keywordMatches.map((keyword) => (
              <Badge
                key={keyword}
                className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Missing Keywords */}
      {result.missingKeywords.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            {t('missingKeywords')}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {result.missingKeywords.map((keyword) => (
              <Badge
                key={keyword}
                className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            {t('suggestions')}
          </h4>
          <div className="space-y-2.5">
            {result.suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-zinc-150 bg-white p-3.5 space-y-2 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Badge variant="secondary" className="text-xs font-medium">
                  {suggestion.section}
                </Badge>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                      {t('currentState')}
                    </span>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {suggestion.current}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-brand">
                      {t('suggestedChange')}
                    </span>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      {suggestion.suggested}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results fallback */}
      {!result.summary &&
        result.keywordMatches.length === 0 &&
        result.missingKeywords.length === 0 &&
        result.suggestions.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">
            {t('noResults')}
          </p>
        )}
    </div>
  );
}

export function JdAnalysisDialog({ open, onOpenChange, resumeId }: JdAnalysisDialogProps) {
  const t = useTranslations('jdAnalysis');
  const ct = useTranslations('common');
  const router = useRouter();
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<JdAnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);

  // History state
  const [activeTab, setActiveTab] = useState<string>('new');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<JdAnalysisResult | null>(null);
  const [historyDetailJd, setHistoryDetailJd] = useState<string>('');
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [deleteToConfirm, setDeleteToConfirm] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('jade_fingerprint') : null;
    return {
      'Content-Type': 'application/json',
      ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
      ...getAIHeaders(),
    };
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/ai/jd-analysis/history?resumeId=${resumeId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  }, [resumeId]);

  // Load history when dialog opens or tab switches to history
  useEffect(() => {
    if (open && activeTab === 'history') {
      fetchHistory();
    }
  }, [open, activeTab, fetchHistory]);

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) return;
    setIsAnalyzing(true);
    setError('');

    try {
      // 服务端按 resumeId 回库读简历，先把未保存的改动落库，否则匹配的是上一版
      await useResumeStore.getState().flushSave();
      const res = await fetch('/api/ai/jd-analysis', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resumeId, jobDescription }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }

      const data: JdAnalysisResult = await res.json();
      setResult(data);
      // Refresh history count
      fetchHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeAgain = () => {
    setResult(null);
    setJobDescription('');
    setError('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setResult(null);
      setJobDescription('');
      setError('');
      setActiveTab('new');
      setHistoryDetail(null);
      setHistoryDetailJd('');
      setOptimizationResult(null);
    }, 200);
  };

  const handleOptimize = async (targetJd: string, targetAnalysis: JdAnalysisResult | null) => {
    if (!targetJd.trim() || !targetAnalysis || isOptimizing) return;
    setIsOptimizing(true);
    setError('');
    try {
      await useResumeStore.getState().flushSave();
      const res = await fetch('/api/ai/jd-analysis/optimize', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          resumeId,
          jobDescription: targetJd,
          analysis: targetAnalysis,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('optimizeError'));
      }
      const optimized = await res.json();
      setOptimizationResult({
        resumeId: optimized.id,
        targetRole: optimized.targetRole,
        changes: optimized.optimizationSummary || [],
      });
      toast.success(t('optimizeSuccess'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('optimizeError');
      setError(message);
      toast.error(t('optimizeError'));
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await fetch(`/api/ai/jd-analysis/history?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (historyDetail) {
        setHistoryDetail(null);
      }
    } catch { /* ignore */ }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        {!isOptimizing && !optimizationResult && (
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
        )}

        {isOptimizing ? (
          <JdOptimizeProgress t={t} />
        ) : optimizationResult ? (
          <JdOptimizeResult
            result={optimizationResult}
            t={t}
            onOpen={() => {
              const targetId = optimizationResult.resumeId;
              handleClose();
              router.push(`/editor/${targetId}`);
            }}
          />
        ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0 min-h-0 flex-1">
          <div className="px-6 pt-3">
            <TabsList className="w-full">
              <TabsTrigger value="new" className="flex-1 cursor-pointer">
                {t('newAnalysis')}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 cursor-pointer gap-1.5">
                {t('historyTab')}
                {history.length > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 px-1 text-xs bg-brand text-white">
                    {history.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── New Analysis Tab ── */}
          <TabsContent value="new" className="flex flex-col min-h-0">
            {!result ? (
              <div className="px-6 py-4 space-y-4">
                <Textarea
                  placeholder={t('placeholder')}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  maxLength={MAX_JOB_DESCRIPTION_LENGTH}
                  rows={6}
                  className="h-[200px] max-h-[200px] overflow-y-auto resize-none text-sm"
                  disabled={isAnalyzing}
                />

                {error && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose} className="cursor-pointer">
                    {t('close')}
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !jobDescription.trim()}
                    className="cursor-pointer bg-brand hover:bg-brand-hover"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        {t('analyzing')}
                      </>
                    ) : (
                      t('analyze')
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <JdAnalysisResultView result={result} jobDescription={jobDescription} t={t} />
                </div>
                <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
                  <Button variant="outline" onClick={handleClose} className="cursor-pointer">
                    {t('close')}
                  </Button>
                  <Button variant="outline" onClick={handleAnalyzeAgain} className="cursor-pointer gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('analyzeAgain')}
                  </Button>
                  <Button
                    onClick={() => handleOptimize(jobDescription, result)}
                    disabled={isOptimizing}
                    className="cursor-pointer gap-1.5 bg-brand hover:bg-brand-hover"
                  >
                    {isOptimizing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {isOptimizing ? t('optimizing') : t('optimize')}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="flex flex-col min-h-0">
            {historyDetail ? (
              /* Detail View */
              <>
                <div className="px-6 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setHistoryDetail(null); setHistoryDetailJd(''); }}
                    className="cursor-pointer gap-1 text-zinc-500 -ml-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('historyTab')}
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <JdAnalysisResultView result={historyDetail} jobDescription={historyDetailJd} t={t} />
                </div>
                <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
                  <Button variant="outline" onClick={handleClose} className="cursor-pointer">
                    {t('close')}
                  </Button>
                  <Button
                    onClick={() => handleOptimize(historyDetailJd, historyDetail)}
                    disabled={isOptimizing}
                    className="cursor-pointer gap-1.5 bg-brand hover:bg-brand-hover"
                  >
                    {isOptimizing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {isOptimizing ? t('optimizing') : t('optimize')}
                  </Button>
                </div>
              </>
            ) : historyLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-brand mb-2" />
                <p className="text-sm text-zinc-500">{t('loadingHistory')}</p>
              </div>
            ) : history.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <FileSearch className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noHistory')}</p>
              </div>
            ) : (
              /* History List */
              <>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="px-6 py-4 space-y-2.5">
                    {history.map((item, idx) => {
                      const prevScore = idx < history.length - 1 ? history[idx + 1].overallScore : undefined;
                      return (
                        <div
                          key={item.id}
                          className="group flex items-center gap-3 rounded-lg border border-zinc-100 bg-white p-3 transition-colors hover:border-zinc-200 hover:bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50 cursor-pointer"
                          onClick={async () => {
                            setHistoryDetailLoading(true);
                            try {
                              // Fetch full detail via individual record endpoint
                              const res = await fetch(`/api/ai/jd-analysis/history?resumeId=${resumeId}&id=${item.id}`, {
                                headers: getAuthHeaders(),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.result) {
                                  setHistoryDetail(typeof data.result === 'string' ? JSON.parse(data.result) : data.result);
                                  setHistoryDetailJd(data.jobDescription || '');
                                }
                              }
                            } catch { /* ignore */ } finally {
                              setHistoryDetailLoading(false);
                            }
                          }}
                        >
                          {/* Score circle */}
                          <div className="flex items-center gap-1">
                            <ScoreCircle score={item.overallScore} label="" size="sm" />
                            <ScoreTrend current={item.overallScore} previous={prevScore} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                {formatDate(item.createdAt)}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                ATS {item.atsScore}
                              </Badge>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                              {item.jobDescription}
                            </p>
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteToConfirm(item.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
                  <Button variant="outline" onClick={handleClose} className="cursor-pointer">
                    {t('close')}
                  </Button>
                </div>
              </>
            )}
            {historyDetailLoading && !historyDetail && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-950/50">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            )}
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteToConfirm} onOpenChange={(o) => { if (!o) setDeleteToConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteConfirm')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteConfirmDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">{ct('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 cursor-pointer"
            onClick={() => {
              if (deleteToConfirm) handleDeleteHistory(deleteToConfirm);
              setDeleteToConfirm(null);
            }}
          >
            {ct('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
