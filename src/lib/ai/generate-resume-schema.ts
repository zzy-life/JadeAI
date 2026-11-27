import { z } from 'zod/v4';
import { TEMPLATES } from '@/lib/constants';
import { resumeBasicInfoSchema, resumeGenerationConversationSchema } from './resume-intake-schema';

export const generateResumeInputSchema = z.object({
  messages: resumeGenerationConversationSchema,
  basicInfo: resumeBasicInfoSchema.refine((info) => info.fullName.length > 0 && info.jobTitle.length > 0, {
    message: 'A name and career goal are required',
  }),
  template: z.enum(TEMPLATES).default('classic'),
  language: z.enum(['zh', 'en']).default('zh'),
}).superRefine(({ messages, basicInfo }, context) => {
  // 两项必须来自用户原话，不能仅凭助手回复或客户端填入的状态启动制作。
  const userMessages = messages.filter((message) => message.role === 'user');
  for (const field of ['fullName', 'jobTitle'] as const) {
    const value = basicInfo[field].toLowerCase();
    if (!userMessages.some((message) => message.content.toLowerCase().includes(value))) {
      context.addIssue({ code: 'custom', path: ['basicInfo', field], message: 'Basic information must come from user messages' });
    }
  }
});

export type GenerateResumeInput = z.infer<typeof generateResumeInputSchema>;

// 缺项补空，不把错误类型降级为合法内容；六类模块必须全部通过后才能落库。
export const generateResumeOutputSchema = z.object({
  personal_info: z.object({
    fullName: z.string().default(''),
    jobTitle: z.string().default(''),
    email: z.string().default(''),
    phone: z.string().default(''),
    location: z.string().default(''),
    website: z.string().default(''),
    linkedin: z.string().default(''),
    github: z.string().default(''),
  }),
  summary: z.object({ text: z.string().default('') }),
  work_experience: z.object({
    items: z.array(z.object({
      company: z.string().default(''),
      position: z.string().default(''),
      location: z.string().default(''),
      startDate: z.string().default(''),
      endDate: z.string().nullable().default(''),
      current: z.boolean().default(false),
      description: z.string().default(''),
      technologies: z.array(z.string()).default([]),
      highlights: z.array(z.string()).default([]),
    })).default([]),
  }),
  education: z.object({
    items: z.array(z.object({
      institution: z.string().default(''),
      degree: z.string().default(''),
      field: z.string().default(''),
      location: z.string().default(''),
      startDate: z.string().default(''),
      endDate: z.string().default(''),
      gpa: z.string().default(''),
      highlights: z.array(z.string()).default([]),
    })).default([]),
  }),
  skills: z.object({
    categories: z.array(z.object({
      name: z.string().default(''),
      skills: z.array(z.string()).default([]),
    })).default([]),
  }),
  projects: z.object({
    items: z.array(z.object({
      name: z.string().default(''),
      url: z.string().default(''),
      startDate: z.string().default(''),
      endDate: z.string().default(''),
      description: z.string().default(''),
      technologies: z.array(z.string()).default([]),
      highlights: z.array(z.string()).default([]),
    })).default([]),
  }),
});

export type GenerateResumeOutput = z.infer<typeof generateResumeOutputSchema>;
