import { z } from 'zod';
import { SECTION_TYPES, TEMPLATES, type SectionType } from '@/lib/constants';

const stringList = z.array(z.string());

// 空白模块可以没有字段；已有字段必须符合编辑器的数据结构，不修复或丢弃备份内容。
const contentSchemas: Record<SectionType, z.ZodType> = {
  personal_info: z.looseObject({
    fullName: z.string(), jobTitle: z.string(), email: z.string(), phone: z.string(),
    location: z.string(), age: z.string(), gender: z.string(), politicalStatus: z.string(),
    ethnicity: z.string(), hometown: z.string(), maritalStatus: z.string(),
    yearsOfExperience: z.string(), educationLevel: z.string(), wechat: z.string(),
    website: z.string(), linkedin: z.string(), github: z.string(), avatar: z.string(),
    customLinks: z.array(z.object({ label: z.string(), url: z.string() })),
  }).partial(),
  summary: z.looseObject({ text: z.string() }).partial(),
  work_experience: z.looseObject({
    items: z.array(z.looseObject({
      id: z.string(), company: z.string(), position: z.string(), location: z.string(),
      startDate: z.string(), endDate: z.string().nullable(), current: z.boolean(),
      description: z.string(), technologies: stringList, highlights: stringList,
    }).partial()),
  }).partial(),
  education: z.looseObject({
    items: z.array(z.looseObject({
      id: z.string(), institution: z.string(), degree: z.string(), field: z.string(),
      location: z.string(), startDate: z.string(), endDate: z.string(), gpa: z.string(),
      highlights: stringList,
    }).partial()),
  }).partial(),
  skills: z.looseObject({
    categories: z.array(z.looseObject({ id: z.string(), name: z.string(), skills: stringList }).partial()),
  }).partial(),
  projects: z.looseObject({
    items: z.array(z.looseObject({
      id: z.string(), name: z.string(), url: z.string(), startDate: z.string(),
      endDate: z.string(), description: z.string(), technologies: stringList, highlights: stringList,
    }).partial()),
  }).partial(),
  certifications: z.looseObject({
    items: z.array(z.looseObject({
      id: z.string(), name: z.string(), issuer: z.string(), date: z.string(), url: z.string(),
    }).partial()),
  }).partial(),
  languages: z.looseObject({
    items: z.array(z.looseObject({
      id: z.string(), language: z.string(), proficiency: z.string(), description: z.string(),
    }).partial()),
  }).partial(),
  github: z.looseObject({
    items: z.array(z.looseObject({
      id: z.string(), repoUrl: z.string(), name: z.string(), stars: z.number(),
      language: z.string(), description: z.string(),
    }).partial()),
  }).partial(),
  qr_codes: z.looseObject({
    items: z.array(z.looseObject({ id: z.string().optional(), label: z.string().optional(), url: z.string() })),
  }).partial(),
  custom: z.looseObject({
    items: z.array(z.looseObject({
      id: z.string(), title: z.string(), subtitle: z.string(), date: z.string(), description: z.string(),
    }).partial()),
  }).partial(),
};

const sectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  title: z.string(),
  sortOrder: z.number().int().nonnegative(),
  visible: z.boolean(),
  content: z.record(z.string(), z.unknown()),
}).superRefine((section, ctx) => {
  const result = contentSchemas[section.type].safeParse(section.content);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ code: 'custom', path: ['content', ...issue.path], message: issue.message });
    }
  }
});

const themeConfigSchema = z.looseObject({
  primaryColor: z.string(),
  accentColor: z.string(),
  fontFamily: z.string(),
  fontSize: z.string(),
  lineSpacing: z.number(),
  margin: z.looseObject({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }).partial(),
  sectionSpacing: z.number(),
  avatarStyle: z.enum(['circle', 'oneInch']),
}).partial().nullable();

// 只提取创建字段；旧用户、分享关系、来源简历与数据库 ID 不进入创建请求。
export const resumeCreateSchema = z.object({
  title: z.string().optional(),
  template: z.string().refine((value) => TEMPLATES.some((template) => template === value)).optional(),
  language: z.string().min(1).optional(),
  // 数据库的历史默认值会导出为字符串 "{}"，仅将这个空主题转换为对象。
  themeConfig: z.union([themeConfigSchema, z.literal('{}').transform(() => ({}))]).optional(),
  sections: z.array(sectionSchema).optional(),
});

export const resumeBackupSchema = resumeCreateSchema.extend({
  title: z.string(),
  // 允许读取已下线模板的备份，由界面明确要求用户重新选择，而不是丢弃内容。
  template: z.string().default(''),
  language: z.string().min(1),
  sections: z.array(sectionSchema),
});

export type CreateResumeInput = z.infer<typeof resumeCreateSchema>;
export type ResumeBackup = z.infer<typeof resumeBackupSchema>;
