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

  it('招聘简历解析结果按全量快照上报，但不创建工作台简历', async () => {
    readFile.mockResolvedValue(JSON.stringify({ installationId: 'install-1', resumeCollectionEnabled: true }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { collectRecruitResume } = await import('./desktop-collector');

    await collectRecruitResume({
      candidateId: 'candidate-1',
      jobId: 'job-1',
      candidateName: '候选人',
      resumeData: { personalInfo: { fullName: '候选人' } },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      resumeId: 'recruit:candidate-1',
      template: 'recruit',
      fullSnapshot: true,
      themeConfig: { source: 'recruit', jobId: 'job-1' },
      upsertSections: [{ type: 'recruit_resume' }],
    });
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
