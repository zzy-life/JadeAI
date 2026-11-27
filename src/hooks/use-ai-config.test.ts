// 运行：pnpm exec vitest run src/hooks/use-ai-config.test.ts
// 纯 Node 测试：不请求真实 AI、不读写 localStorage，也不依赖浏览器或其他测试。
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAIConfigIssue, hasCompleteAIConfig, useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';
import { useAIConfig } from '@/hooks/use-ai-config';
import { useAIChat } from '@/hooks/use-ai-chat';
import { useInterviewChat } from '@/hooks/use-interview-chat';
import { useResumeStore } from '@/stores/resume-store';

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TEST_CONFIG = {
  aiProvider: 'openai' as const,
  aiApiKey: 'test-key-not-a-real-secret',
  aiBaseURL: '',
  aiModel: 'test-text-model',
  aiImageModel: 'test-image-model',
  _hydrated: true,
};
const UI_INITIAL = { activeModal: null, settingsTab: 'appearance' } as const;
const CHAT_OPTIONS = { resumeId: 'test-resume', selectedModel: TEST_CONFIG.aiModel };
const INTERVIEW_OPTIONS = { sessionId: 'test-session', roundId: 'test-round' };
const DRAFT = '保留这段输入，配置完成后手动发送';
const TEST_MESSAGE = { text: DRAFT };
const MOCKS = vi.hoisted(() => ({
  info: vi.fn(), warning: vi.fn(), rawSendMessage: vi.fn(), setMessages: vi.fn(), setInput: vi.fn(),
  translate: (key: string) => key,
}));
const AI_ACTIONS = [
  ['src/hooks/use-ai-chat.ts', 'const sendMessage =', 'flushSave()'],
  ['src/hooks/use-interview-chat.ts', 'const sendMessage =', 'rawSendMessage(message)'],
  ['src/hooks/use-resume-intake.ts', 'const requestReply =', 'setMessages(conversation)'],
  ['src/components/dashboard/create-resume-dialog.tsx', 'const createFromFile =', 'setBusy('],
  ['src/components/dashboard/create-resume-dialog.tsx', 'const createWithAI =', 'setBusy('],
  ['src/components/editor/jd-analysis-dialog.tsx', 'const handleAnalyze =', 'setIsAnalyzing(true)'],
  ['src/components/editor/jd-analysis-dialog.tsx', 'const handleOptimize =', 'setIsOptimizing(true)'],
  ['src/components/editor/translate-dialog.tsx', 'const handleTranslate =', "setState('translating')"],
  ['src/components/editor/cover-letter-dialog.tsx', 'const handleGenerate =', 'setIsGenerating(true)'],
  ['src/components/editor/grammar-check-dialog.tsx', 'const handleCheck =', 'setIsChecking(true)'],
  ['src/components/editor/grammar-check-dialog.tsx', 'const handleCheckAgain =', 'setResult(null)'],
  ['src/components/editor/grammar-check-dialog.tsx', 'const handleFixAll =', 'onOpenChange(false)'],
  ['src/components/interview/interview-setup.tsx', 'const handleStart =', 'setIsCreating(true)'],
  ['src/components/interview/control-bar.tsx', 'const handleSkip =', 'addSkipped('],
  ['src/components/interview/control-bar.tsx', 'const handleHint =', 'addHinted('],
  ['src/components/interview/interview-room.tsx', 'const handleNextRound =', 'advanceToNextRound()'],
  ['src/components/interview/interview-room.tsx', 'const handleGenerateReport =', 'setIsGeneratingReport(true)'],
  ['src/app/[locale]/interview/[id]/report/page.tsx', 'const generateReport =', 'fetch('],
  ['src/components/recruit/job-form-dialog.tsx', 'async function recognizeDimensions()', 'setRecognizing(true)'],
  ['src/components/recruit/candidate-dialog.tsx', 'async function handleSubmit()', 'setFailedAt(null)'],
  ['src/components/recruit/candidate-list.tsx', 'async function handleGenerate(', 'setGeneratingFor(id)'],
  ['src/components/recruit/resume-panel.tsx', 'async function handleFile(', 'setUploading(true)'],
  ['src/components/recruit/interview-stage.tsx', 'async function doRegenerate()', 'setRegenerating(true)'],
  ['src/components/recruit/evaluation-panel.tsx', 'async function doGenerate()', 'setGenerating(true)'],
  ['src/app/[locale]/linkedin-photo/page.tsx', 'const handleGenerate =', 'setIsGenerating(true)'],
];
const LOCALES = ['zh', 'en'];

vi.mock('next-intl', () => ({
  useTranslations: () => MOCKS.translate,
  useLocale: () => 'zh',
}));
vi.mock('sonner', () => ({ toast: { info: MOCKS.info, warning: MOCKS.warning } }));
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({ messages: [], sendMessage: MOCKS.rawSendMessage, setMessages: MOCKS.setMessages, status: 'ready', error: null }),
}));
// 在 SSR 中调用真实 hook 与 Zustand selector；只替换输入状态，以验证失败时不清空草稿。
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (initial === '') return [DRAFT, MOCKS.setInput];
      return actual.useState(initial);
    },
  };
});

function renderHook<T>(hook: () => T): T {
  let result: T | undefined;
  function Probe() {
    result = hook();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return result as T;
}

function source(path: string) {
  return readFileSync(resolve(PROJECT_ROOT, path), 'utf8');
}

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState(TEST_CONFIG);
  useUIStore.setState(UI_INITIAL);
  MOCKS.rawSendMessage.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI 配置完整性规则', () => {
  it('文本功能要求 Key 和文本模型非空，不要求填写可选的自定义地址', () => {
    expect(hasCompleteAIConfig(TEST_CONFIG)).toBe(true);
    expect(getAIConfigIssue({ ...TEST_CONFIG, aiApiKey: ' \t' })).toBe('apiKeyMissing');
    expect(getAIConfigIssue({ ...TEST_CONFIG, aiModel: '  ' })).toBe('textModelMissing');
    expect(hasCompleteAIConfig({ ...TEST_CONFIG, aiImageModel: '' })).toBe(true);
  });

  it('图片生成单独检查支持的协议与图片模型，不依赖文本模型', () => {
    expect(hasCompleteAIConfig({ ...TEST_CONFIG, aiModel: '' }, 'image')).toBe(true);
    expect(hasCompleteAIConfig({ ...TEST_CONFIG, aiProvider: 'gemini' }, 'image')).toBe(true);
    expect(getAIConfigIssue({ ...TEST_CONFIG, aiProvider: 'anthropic' }, 'image')).toBe('imageProviderUnsupported');
    expect(getAIConfigIssue({ ...TEST_CONFIG, aiImageModel: '  ' }, 'image')).toBe('imageModelMissing');
    expect(getAIConfigIssue({ ...TEST_CONFIG, aiApiKey: '' }, 'image')).toBe('apiKeyMissing');
  });
});

describe('统一检查与设置引导', () => {
  it('配置未加载时仅提示等待，不误弹设置，也不允许请求', () => {
    useSettingsStore.setState({ _hydrated: false, aiApiKey: '' });
    const guard = renderHook(() => useAIConfig());
    expect(guard.hasAIConfig).toBe(false);
    expect(guard.ensureAIConfig()).toBe(false);
    expect(MOCKS.info).toHaveBeenCalledOnce();
    expect(MOCKS.warning).not.toHaveBeenCalled();
    expect(useUIStore.getState().activeModal).toBe(null);
  });

  it('缺 Key 时中止原操作并打开 AI 设置，关闭设置不恢复业务弹窗', () => {
    useSettingsStore.setState({ aiApiKey: '' });
    useUIStore.getState().openModal('cover-letter');
    const guard = renderHook(() => useAIConfig());
    expect(guard.ensureAIConfig()).toBe(false);
    expect(MOCKS.warning).toHaveBeenCalledWith('required', { id: 'ai-config-required', description: 'apiKeyMissing' });
    expect(useUIStore.getState()).toMatchObject({ activeModal: 'settings', settingsTab: 'ai' });
    expect(guard.ensureAIConfig()).toBe(false);
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBe(null);
    expect(MOCKS.rawSendMessage).not.toHaveBeenCalled();
  });

  it('即时读取 store：旧回调也能识别刚修改的配置，配置完成不自动执行业务', () => {
    const guard = renderHook(() => useAIConfig());
    useSettingsStore.setState({ aiModel: '' });
    expect(guard.ensureAIConfig()).toBe(false);
    expect(MOCKS.warning).toHaveBeenLastCalledWith('required', expect.objectContaining({ description: 'textModelMissing' }));
    useSettingsStore.setState({ aiModel: TEST_CONFIG.aiModel });
    expect(guard.ensureAIConfig()).toBe(true);
    expect(useUIStore.getState().activeModal).toBe('settings');
    expect(MOCKS.rawSendMessage).not.toHaveBeenCalled();
  });

  it('手动打开 AI 设置也不记录返回目标，无论是否完成配置都只关闭设置', () => {
    useUIStore.getState().openAISettings();
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBe(null);
    useUIStore.getState().openModal('create-resume');
    useUIStore.getState().openAISettings();
    useSettingsStore.setState(TEST_CONFIG);
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBe(null);
    expect(MOCKS.rawSendMessage).not.toHaveBeenCalled();
  });

  it('默认文本模型缺失时阻断文本功能，但不影响已配置的图片能力', () => {
    useSettingsStore.setState({ aiModel: '' });
    const chat = renderHook(() => useAIConfig());
    expect(chat.ensureAIConfig()).toBe(false);
    const image = renderHook(() => useAIConfig({ capability: 'image' }));
    expect(image.ensureAIConfig()).toBe(true);
    useSettingsStore.setState({ aiProvider: 'anthropic' });
    expect(image.ensureAIConfig()).toBe(false);
    expect(MOCKS.warning).toHaveBeenLastCalledWith('required', expect.objectContaining({ description: 'imageProviderUnsupported' }));
  });
});

describe('聊天操作实际阻断', () => {
  it('编辑器直接发送与表单发送都先阻断，既不保存简历也不清空输入', async () => {
    useSettingsStore.setState({ aiApiKey: '' });
    const flush = vi.spyOn(useResumeStore.getState(), 'flushSave');
    const chat = renderHook(() => useAIChat(CHAT_OPTIONS));
    expect(await chat.sendMessage(TEST_MESSAGE)).toBe(false);
    chat.handleSubmit({ preventDefault: vi.fn() } as unknown as Parameters<typeof chat.handleSubmit>[0]);
    expect(flush).not.toHaveBeenCalled();
    expect(MOCKS.rawSendMessage).not.toHaveBeenCalled();
    expect(MOCKS.setInput).not.toHaveBeenCalled();
  });

  it('聊天已选择模型但默认文本模型为空时仍阻断，避免内部工具缺模型', async () => {
    useSettingsStore.setState({ aiModel: '' });
    const flush = vi.spyOn(useResumeStore.getState(), 'flushSave');
    const chat = renderHook(() => useAIChat(CHAT_OPTIONS));
    expect(await chat.sendMessage(TEST_MESSAGE)).toBe(false);
    expect(flush).not.toHaveBeenCalled();
    expect(MOCKS.rawSendMessage).not.toHaveBeenCalled();
    expect(useUIStore.getState()).toMatchObject({ activeModal: 'settings', settingsTab: 'ai' });
  });

  it('编辑器配置完整时仍先保存简历再发消息', async () => {
    const flush = vi.spyOn(useResumeStore.getState(), 'flushSave').mockResolvedValue(undefined);
    const chat = renderHook(() => useAIChat(CHAT_OPTIONS));
    expect(await chat.sendMessage(TEST_MESSAGE)).toBe(true);
    expect(flush).toHaveBeenCalledOnce();
    expect(MOCKS.rawSendMessage).toHaveBeenCalledWith(TEST_MESSAGE);
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(MOCKS.rawSendMessage.mock.invocationCallOrder[0]);
  });

  it('面试自动首问和表单发送共用同一检查，未配置不发送、不清输入', () => {
    useSettingsStore.setState({ aiModel: '' });
    const chat = renderHook(() => useInterviewChat(INTERVIEW_OPTIONS));
    expect(chat.sendMessage(TEST_MESSAGE)).toBe(false);
    chat.handleSubmit({ preventDefault: vi.fn() } as unknown as Parameters<typeof chat.handleSubmit>[0]);
    expect(MOCKS.rawSendMessage).not.toHaveBeenCalled();
    expect(MOCKS.setInput).not.toHaveBeenCalled();
  });
});

describe('所有 AI 动作的前置检查契约', () => {
  it.each(AI_ACTIONS)('%s：%s 在副作用前检查', (path, action, firstSideEffect) => {
    const text = source(path);
    const start = text.indexOf(action);
    expect(start).toBeGreaterThanOrEqual(0);
    const body = text.slice(start);
    const sideEffect = body.indexOf(firstSideEffect);
    const check = body.indexOf('ensureAIConfig()');
    expect(sideEffect).toBeGreaterThanOrEqual(0);
    expect(check).toBeGreaterThanOrEqual(0);
    expect(check).toBeLessThan(sideEffect);
  });

  it('非 AI 创建与面试暂停/标记不拦截；已有报告先读历史再决定是否调用 AI', () => {
    const creation = source('src/components/dashboard/create-resume-dialog.tsx');
    const templateAction = creation.slice(creation.indexOf('const createFromTemplateOrBackup ='), creation.indexOf('const createFromFile ='));
    expect(templateAction).not.toContain('ensureAIConfig');
    const controls = source('src/components/interview/control-bar.tsx');
    expect(controls.slice(controls.indexOf('const handleEndRound ='), controls.indexOf('const controls ='))).not.toContain('ensureAIConfig');
    const report = source('src/app/[locale]/interview/[id]/report/page.tsx');
    expect(report).toMatch(/if \(savedReport\)\s*\{[\s\S]*?setReport\(savedReport\);[\s\S]*?\} else \{\s*void generateReport\(\);/);
  });

  it('聊天创建先检查再切换步骤，不保留设置关闭后恢复弹窗的逻辑', () => {
    const creation = source('src/components/dashboard/create-resume-dialog.tsx');
    const selectMethod = creation.slice(creation.indexOf('const selectMethod ='), creation.indexOf('const openAISettings ='));
    expect(selectMethod).toContain('if (!ensureAIConfig()) return;');
    expect(selectMethod.indexOf('ensureAIConfig()')).toBeLessThan(selectMethod.indexOf('resetInputs()'));
    expect(selectMethod.indexOf('ensureAIConfig()')).toBeLessThan(selectMethod.indexOf('setStep(nextStep)'));
    for (const path of ['src/stores/ui-store.ts', 'src/hooks/use-ai-config.ts', 'src/components/dashboard/create-resume-dialog.tsx']) {
      expect(source(path)).not.toMatch(/settingsReturnModal|openAISettingsWithReturn|resumeAfterSettings/);
    }
  });

  it('本地业务弹窗引导配置时真正关闭，不再只隐藏后自动重现', () => {
    for (const path of ['src/components/recruit/job-form-dialog.tsx', 'src/components/recruit/candidate-dialog.tsx']) {
      const text = source(path);
      expect(text).toMatch(/if \(!ensureAIConfig\(\)\) \{\s*onOpenChange\(false\);\s*return;/);
      expect(text).not.toMatch(/open=\{open &&/);
    }
    const room = source('src/components/interview/interview-room.tsx');
    expect(room).toContain('isHydrated &&');
    expect(room).toContain('setNeedsStart(!sent)');
    expect(room).toContain("t('startRound')");
  });

  it('纯 AI 弹窗与聊天气泡先检查再打开，历史分析与语法记录仍可查看', () => {
    const toolbar = source('src/components/editor/editor-toolbar.tsx');
    expect(toolbar).toMatch(/const openAIAction =[\s\S]*?if \(!ensureAIConfig\(\)\) return;\s*openModal\(modal\);/);
    expect(toolbar).toContain("openAIAction('translate')");
    expect(toolbar).toContain("openAIAction('cover-letter')");
    expect(toolbar).toContain("openModal('jd-analysis')");
    expect(toolbar).toContain("openModal('grammar-check')");
    const bubble = source('src/components/ai/ai-chat-bubble.tsx');
    expect(bubble).toMatch(/if \(!showAiChat && !ensureAIConfig\(\)\) return;\s*toggleAiChat\(\);/);
  });

  it('AI 设置打开期间暂停招聘面试台全局快捷键，且尊重弹窗已处理的事件', () => {
    const stage = source('src/components/recruit/interview-stage.tsx');
    const start = stage.indexOf('if (isSettingsOpen) return;');
    expect(start).toBeGreaterThanOrEqual(0);
    const keyboardEffect = stage.slice(start, stage.indexOf('}, [index, isLast', start));
    expect(keyboardEffect.indexOf('if (e.defaultPrevented) return;')).toBeLessThan(keyboardEffect.indexOf("e.key === 'Escape'"));
    expect(stage).toContain('[index, isLast, goTo, exit, finish, isSettingsOpen]');
  });

  it.each(LOCALES)('%s 中存在所有配置提示文案', (locale) => {
    const messages = JSON.parse(source(`messages/${locale}.json`));
    for (const key of ['required', 'apiKeyMissing', 'textModelMissing', 'imageModelMissing', 'imageProviderUnsupported', 'loading', 'retry']) {
      expect(messages.ai.config[key]).toBeTruthy();
    }
    expect(messages.interview.room.startRound).toBeTruthy();
  });
});
