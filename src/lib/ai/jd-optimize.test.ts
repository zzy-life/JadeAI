import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import { generateJdOptimizedSections, JD_OPTIMIZE_SYSTEM_PROMPT } from './jd-optimize';

vi.mock('ai', () => ({ generateText: vi.fn() }));
vi.mock('@/lib/ai/provider', () => ({ getJsonProviderOptions: vi.fn(() => ({})) }));

const mockedGenerateText = vi.mocked(generateText);
const analysis = {
  overallScore: 60,
  keywordMatches: ['Go'],
  missingKeywords: ['高并发'],
  suggestions: [{ section: 'skills', current: 'Go', suggested: '突出 Go 工程经验' }],
  atsScore: 65,
  summary: '需要突出相关经验',
};
const model = {} as Parameters<typeof generateJdOptimizedSections>[3];
const aiConfig = {} as Parameters<typeof generateJdOptimizedSections>[4];

const sections = [
  {
    id: 'personal',
    type: 'personal_info',
    title: '个人信息',
    sortOrder: 0,
    visible: true,
    content: { fullName: '张三', jobTitle: '工程师', avatar: 'data:image/png;base64,secret' },
  },
  {
    id: 'skills',
    type: 'skills',
    title: '技能',
    sortOrder: 1,
    visible: true,
    content: { categories: [{ id: 'category-1', name: '后端', skills: ['Go'] }] },
  },
];

describe('generateJdOptimizedSections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('约束模型不得虚构事实', () => {
    expect(JD_OPTIMIZE_SYSTEM_PROMPT).toContain('Use only facts already present');
    expect(JD_OPTIMIZE_SYSTEM_PROMPT).toContain('Never invent');
  });

  it('保留敏感字段并按原顺序生成完整模块', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify({
        targetRole: 'Go 工程师',
        sections: [
          { sectionId: 'skills', title: '核心技能', changeSummary: '突出与岗位相关的 Go 技能。', content: { categories: [{ name: '后端', skills: ['Go'] }] } },
          { sectionId: 'personal', title: '个人信息', changeSummary: '将求职方向调整为 Go 工程师。', content: { fullName: '张三', jobTitle: 'Go 工程师' } },
        ],
      }),
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateJdOptimizedSections(sections, '招聘 Go 工程师', analysis, model, aiConfig);

    expect(result.targetRole).toBe('Go 工程师');
    expect(result.sections.map((section) => section.type)).toEqual(['personal_info', 'skills']);
    expect(result.sections[0].content).toMatchObject({ avatar: 'data:image/png;base64,secret' });
    expect(result.changes).toContainEqual({ section: '个人信息', summary: '将求职方向调整为 Go 工程师。' });
    expect(mockedGenerateText.mock.calls[0][0].prompt).not.toContain('data:image/png;base64,secret');
    expect(mockedGenerateText.mock.calls[0][0].prompt).toContain('突出 Go 工程经验');
  });

  it('拒绝未执行任何优化的原样结果', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify({
        targetRole: '工程师',
        sections: sections.map((section) => ({
          sectionId: section.id,
          title: section.title,
          changeSummary: '保持原内容。',
          content: section.type === 'personal_info'
            ? { fullName: '张三', jobTitle: '工程师' }
            : section.content,
        })),
      }),
    } as Awaited<ReturnType<typeof generateText>>);

    await expect(generateJdOptimizedSections(sections, 'JD', analysis, model, aiConfig))
      .rejects.toThrow('without any optimization');
  });

  it('拒绝缺失、重复或未知的模块集合', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify({
        targetRole: 'Go 工程师',
        sections: [
          { sectionId: 'personal', title: '个人信息', changeSummary: '保持原内容。', content: {} },
          { sectionId: 'skills', title: '技能', changeSummary: '优化技能排序。', content: { categories: [] } },
          { sectionId: 'skills', title: '技能', changeSummary: '优化技能排序。', content: { categories: [] } },
        ],
      }),
    } as Awaited<ReturnType<typeof generateText>>);

    await expect(generateJdOptimizedSections(sections, 'JD', analysis, model, aiConfig))
      .rejects.toThrow('incomplete or mismatched section set');
  });

  it('拒绝会清空模块的非法内容', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify({
        targetRole: 'Go 工程师',
        sections: [
          { sectionId: 'personal', title: '个人信息', changeSummary: '优化求职方向。', content: 'invalid' },
          { sectionId: 'skills', title: '技能', changeSummary: '优化技能排序。', content: { categories: [] } },
        ],
      }),
    } as Awaited<ReturnType<typeof generateText>>);

    await expect(generateJdOptimizedSections(sections, 'JD', analysis, model, aiConfig))
      .rejects.toThrow('invalid content');
  });
});
