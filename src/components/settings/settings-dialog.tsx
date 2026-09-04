'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { Settings, Cpu, Paintbrush, PenTool, Eye, EyeOff, Sun, Moon, Monitor, ChevronsUpDown, Check, Loader2, ExternalLink, KeyRound, Gift, MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUIStore } from '@/stores/ui-store';
import { useSettingsStore, getAIHeaders, type AIProvider } from '@/stores/settings-store';
import { useTourStore } from '@/stores/tour-store';
import { usePathname, useRouter } from '@/i18n/routing';
import { locales, localeNames } from '@/i18n/config';
import { cn } from '@/lib/utils';

const AI_PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
];

const API_KEY_PROVIDERS = [
  {
    name: 'DeepSeek',
    href: 'https://platform.deepseek.com/',
    accent: 'bg-indigo-500',
  },
  {
    name: '智谱 AI',
    href: 'https://www.bigmodel.cn/invite?icode=En%2FPGR1ZoTBon45zbbib3pmwcr074zMJTpgMb8zZZvg%3D',
    accent: 'bg-sky-500',
  },
  {
    name: 'Kimi',
    href: 'https://platform.kimi.com/',
    accent: 'bg-zinc-900 dark:bg-zinc-100',
  },
  {
    name: '阿里云百炼',
    href: 'https://www.aliyun.com/minisite/goods?userCode=o4bkn12u',
    accent: 'bg-orange-500',
  },
] as const;

export function SettingsDialog() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme: currentTheme, setTheme } = useTheme();
  const { activeModal, closeModal, settingsTab, setSettingsTab } = useUIStore();
  const {
    aiProvider,
    aiApiKey,
    aiBaseURL,
    aiModel,
    autoSave,
    autoSaveInterval,
    setAIProvider,
    setAIApiKey,
    setAIBaseURL,
    setAIModel,
    setAutoSave,
    setAutoSaveInterval,
    hydrate,
    _hydrated,
  } = useSettingsStore();

  const startTour = useTourStore((s) => s.startTour);
  const [showApiKey, setShowApiKey] = useState(false);
  const [freeTrialOpen, setFreeTrialOpen] = useState(false);
  const [resumeCollectionEnabled, setResumeCollectionEnabled] = useState(true);
  const isOpen = activeModal === 'settings';

  // Model combobox state
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [modelsFetching, setModelsFetching] = useState(false);
  const [modelsFetched, setModelsFetched] = useState(false);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const modelRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen && !_hydrated) {
      hydrate();
    }
    if (isOpen && window.jade) {
      void window.jade.getSettings().then((settings) => {
        setResumeCollectionEnabled(settings.resumeCollectionEnabled !== false);
      });
    }
  }, [isOpen, _hydrated, hydrate]);

  const handleResumeCollectionChange = (enabled: boolean) => {
    setResumeCollectionEnabled(enabled);
    void window.jade?.patchSettings({ resumeCollectionEnabled: enabled });
  };

  const fetchModels = useCallback(async () => {
    if (!aiApiKey.trim() || !aiBaseURL.trim()) return;

    modelRequestRef.current?.abort();
    const controller = new AbortController();
    modelRequestRef.current = controller;
    setModelsFetching(true);

    try {
      const res = await fetch('/api/ai/models', {
        headers: getAIHeaders(),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted) return;

      const ids = (data.models || []).map((m: { id: string }) => m.id);
      setFetchedModels(ids);
      setModelsFetched(true);
    } catch {
      if (controller.signal.aborted) return;
      setFetchedModels([]);
      setModelsFetched(true);
    } finally {
      if (modelRequestRef.current === controller) {
        modelRequestRef.current = null;
        setModelsFetching(false);
      }
    }
  }, [aiApiKey, aiBaseURL, aiProvider]);

  // Fetch available models after both credentials fields have settled.
  useEffect(() => {
    modelRequestRef.current?.abort();
    modelRequestRef.current = null;
    setModelsFetching(false);
    setModelsFetched(false);
    setFetchedModels([]);

    if (!aiApiKey.trim() || !aiBaseURL.trim()) return;

    const timeout = setTimeout(() => {
      void fetchModels();
    }, 400);

    return () => {
      clearTimeout(timeout);
      modelRequestRef.current?.abort();
    };
  }, [aiApiKey, aiBaseURL, aiProvider, fetchModels]);

  // Focus search input when popover opens
  useEffect(() => {
    if (modelOpen) {
      setTimeout(() => modelSearchRef.current?.focus(), 50);
    } else {
      setModelSearch('');
    }
  }, [modelOpen]);

  const filteredModels = fetchedModels.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const handleThemeChange = (theme: string) => {
    setTheme(theme);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-500" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={settingsTab} onValueChange={setSettingsTab} className="mt-4">
          <div className="px-6">
            <TabsList className="w-full">
              <TabsTrigger value="ai" className="flex-1 gap-1.5 cursor-pointer">
                <Cpu className="h-3.5 w-3.5" />
                {t('ai.title')}
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex-1 gap-1.5 cursor-pointer">
                <Paintbrush className="h-3.5 w-3.5" />
                {t('appearance.title')}
              </TabsTrigger>
              <TabsTrigger value="editor" className="flex-1 gap-1.5 cursor-pointer">
                <PenTool className="h-3.5 w-3.5" />
                {t('editorTab.title')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* AI Configuration Tab */}
          <TabsContent value="ai" className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 pb-6 pt-4 space-y-5">
            {/* Provider */}
            <div className="space-y-2">
              <Label>{t('ai.provider')}</Label>
              <Select value={aiProvider} onValueChange={(v) => setAIProvider(v as AIProvider)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label>{t('ai.apiKey')}</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={aiApiKey}
                  onChange={(e) => setAIApiKey(e.target.value)}
                  placeholder={t('ai.apiKeyPlaceholder')}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-400">{t('ai.apiKeyHint')}</p>
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label>{t('ai.baseURL')}</Label>
              <Input
                value={aiBaseURL}
                onChange={(e) => setAIBaseURL(e.target.value)}
                placeholder="https://api.deepseek.com"
              />
            </div>

            {/* Model — Combobox */}
            <div className="space-y-2">
              <Label>{t('ai.model')}</Label>
              <Popover open={modelOpen} onOpenChange={setModelOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={modelOpen}
                    className="w-full justify-between cursor-pointer font-normal"
                  >
                    <span className="truncate">{aiModel || t('ai.modelPlaceholder')}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  {/* Search input */}
                  <div className="border-b px-3 py-2">
                    <Input
                      ref={modelSearchRef}
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder={tCommon('search')}
                      className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  {/* Model list */}
                  <div className="max-h-48 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
                    {modelsFetching && (
                      <div className="flex items-center justify-center py-4 text-sm text-zinc-400">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tCommon('loading')}
                      </div>
                    )}

                    {!modelsFetching && filteredModels.length === 0 && modelsFetched && (
                      <div className="py-3 text-center text-xs text-zinc-400">
                        {t('ai.noModelsFound')}
                      </div>
                    )}

                    {filteredModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={cn(
                          'flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
                          aiModel === m && 'bg-zinc-100 dark:bg-zinc-800'
                        )}
                        onClick={() => {
                          setAIModel(m);
                          setModelOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', aiModel === m ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{m}</span>
                      </button>
                    ))}
                  </div>

                  {/* Manual entry */}
                  <div className="border-t px-3 py-2">
                    <Input
                      value={aiModel}
                      onChange={(e) => setAIModel(e.target.value)}
                      placeholder={t('ai.modelPlaceholder')}
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setModelOpen(false);
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {t('ai.modelHint')}
              </p>
            </div>

            <Separator />

            {/* Official API key registration links */}
            <section
              className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50"
              aria-labelledby="api-key-providers-title"
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 id="api-key-providers-title" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('ai.getApiKeyTitle')}
                  </h3>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t('ai.getApiKeyDescription')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 border-t border-zinc-200 dark:border-zinc-800">
                {API_KEY_PROVIDERS.map((provider, index) => (
                  <a
                    key={provider.name}
                    href={provider.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'group flex min-w-0 items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset dark:hover:bg-zinc-800',
                      index % 2 !== 0 && 'border-l border-zinc-200 dark:border-zinc-800',
                      index >= 2 && 'border-t border-zinc-200 dark:border-zinc-800'
                    )}
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full ring-4 ring-white dark:ring-zinc-900', provider.accent)} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      {provider.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-emerald-600 dark:text-zinc-600 dark:group-hover:text-emerald-400" />
                  </a>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setFreeTrialOpen(true)}
                className="group flex w-full cursor-pointer items-center justify-center gap-2 border-t border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
              >
                <Gift className="h-4 w-4 transition-transform group-hover:-rotate-6" />
                {t('ai.freeTrialButton')}
              </button>
            </section>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="px-6 pb-6 pt-4 space-y-5">
            {/* Theme */}
            <div className="space-y-3">
              <Label>{t('appearance.theme')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light', icon: Sun, label: t('appearance.themeLight') },
                  { value: 'dark', icon: Moon, label: t('appearance.themeDark') },
                  { value: 'system', icon: Monitor, label: t('appearance.themeSystem') },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleThemeChange(value)}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                      currentTheme === value
                        ? 'border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Language */}
            <div className="space-y-2">
              <Label>{t('appearance.language')}</Label>
              <Select value={locale} onValueChange={handleLocaleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {localeNames[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Editor Tab */}
          <TabsContent value="editor" className="px-6 pb-6 pt-4 space-y-5">
            {/* Auto Save */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('editorTab.autoSave')}</Label>
                <p className="text-xs text-zinc-400">{t('editorTab.autoSaveDescription')}</p>
              </div>
              <Switch
                checked={autoSave}
                onCheckedChange={setAutoSave}
              />
            </div>

            <Separator />

            {/* Auto Save Interval */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('editorTab.autoSaveInterval')}</Label>
                <span className="text-sm text-zinc-500">
                  {(autoSaveInterval / 1000).toFixed(1)}s
                </span>
              </div>
              <Slider
                value={[autoSaveInterval]}
                onValueChange={([v]) => setAutoSaveInterval(v)}
                min={300}
                max={5000}
                step={100}
                disabled={!autoSave}
              />
              <div className="flex justify-between text-xs text-zinc-400">
                <span>0.3s</span>
                <span>5.0s</span>
              </div>
            </div>
            {typeof window !== 'undefined' && window.jade && (
              <>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label>{t('editorTab.resumeCollection')}</Label>
                    <p className="text-xs text-zinc-400">
                      {t('editorTab.resumeCollectionDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={resumeCollectionEnabled}
                    onCheckedChange={handleResumeCollectionChange}
                  />
                </div>
              </>
            )}

            <Separator />

            {/* Restart Tour */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('editorTab.restartTour')}</Label>
                <p className="text-xs text-zinc-400">{t('editorTab.restartTourDescription')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  closeModal();
                  setTimeout(() => startTour('editor', 5), 300);
                }}
              >
                {t('editorTab.restartTour')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      </Dialog>

      <Dialog open={freeTrialOpen} onOpenChange={setFreeTrialOpen}>
        <DialogContent className="sm:max-w-[400px] overflow-hidden p-0 gap-0">
          <div className="bg-gradient-to-b from-emerald-50 to-white px-6 pb-6 pt-7 dark:from-emerald-950/50 dark:to-zinc-950">
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                <MessageCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl">{t('ai.freeTrialTitle')}</DialogTitle>
              <DialogDescription className="max-w-xs leading-5">
                {t('ai.freeTrialDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="mx-auto mt-5 w-fit rounded-2xl border border-emerald-100 bg-white p-2.5 shadow-[0_12px_35px_-15px_rgba(5,150,105,0.35)] dark:border-emerald-900 dark:bg-white">
              <img
                src="https://demo-html-zip.oss-cn-hangzhou.aliyuncs.com/SourceDocx/img/webarcx_wechat_mini.jpg"
                alt={t('ai.wechatQrAlt')}
                width={200}
                height={200}
                className="h-[200px] w-[200px] rounded-lg object-cover"
              />
            </div>

            <div className="mt-5 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 text-center dark:border-emerald-900 dark:bg-zinc-900/80">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('ai.freeTrialInstruction')}
              </p>
              <p className="mt-1 font-mono text-base font-semibold tracking-wide text-emerald-700 dark:text-emerald-300">
                {t('ai.freeTrialKeyword')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
