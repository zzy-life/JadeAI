import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readFile = vi.fn();
vi.mock('node:fs/promises', () => ({ readFile }));

const originalEnv = { ...process.env };

function snapshot(kind: 'standard' | 'jd_optimized') {
  return {
    id: 'resume-1',
    title: '简历',
    template: 'classic',
    language: 'zh',
    kind,
    themeConfig: {},
    sections: [],
  };
}

describe('desktop resume collector', () => {
  beforeEach(() => {
    vi.resetModules();
    readFile.mockReset();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.JADE_RUNTIME = 'desktop';
    process.env.JADE_SETTINGS_PATH = '/tmp/settings.json';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('开发测试环境不上报', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { collectResumeChange } = await import('./desktop-collector');

    await collectResumeChange(null, snapshot('standard'));

    expect(readFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('正式桌面环境中的标准简历仍按现有规则上报', async () => {
    readFile.mockResolvedValue(JSON.stringify({ installationId: 'install-1', resumeCollectionEnabled: true }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { collectResumeChange } = await import('./desktop-collector');

    await collectResumeChange(null, snapshot('standard'));

    expect(readFile).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('JD 派生简历的变更不读取设置且不上报', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { collectResumeChange } = await import('./desktop-collector');

    await collectResumeChange(null, snapshot('jd_optimized'));

    expect(readFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('JD 派生简历的删除不上报', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { collectResumeDeletion } = await import('./desktop-collector');

    await collectResumeDeletion({ id: 'resume-1', kind: 'jd_optimized' });

    expect(readFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
