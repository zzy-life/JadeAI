import { z } from 'zod/v4';

export const RESUME_INTAKE_LIMITS = {
  maxMessages: 200,
  maxMessageLength: 12000,
  maxTotalLength: 120000,
} as const;

export const resumeIntakeMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(RESUME_INTAKE_LIMITS.maxMessageLength),
});

const conversationSchema = z.array(resumeIntakeMessageSchema)
  .min(1)
  .max(RESUME_INTAKE_LIMITS.maxMessages)
  .superRefine((messages, context) => {
    let totalLength = 0;
    for (const [index, message] of messages.entries()) {
      const expectedRole = index % 2 === 0 ? 'user' : 'assistant';
      if (message.role !== expectedRole) {
        context.addIssue({ code: 'custom', path: [index, 'role'], message: 'Messages must alternate, starting with user' });
      }
      totalLength += message.content.length;
    }
    if (totalLength > RESUME_INTAKE_LIMITS.maxTotalLength) {
      context.addIssue({ code: 'custom', message: 'Conversation is too long' });
    }
  });

export const resumeBasicInfoSchema = z.object({
  fullName: z.string().trim().max(120),
  jobTitle: z.string().trim().max(200),
});

export const resumeIntakeInputSchema = z.object({
  messages: conversationSchema.refine((messages) => messages.at(-1)?.role === 'user', {
    message: 'The last message must be from the user',
  }).refine((messages) => {
    // 为即将追加的助手回复预留预算，确保采集成功后的完整历史仍能提交制作。
    const totalLength = messages.reduce((total, message) => total + message.content.length, 0);
    return totalLength <= RESUME_INTAKE_LIMITS.maxTotalLength - RESUME_INTAKE_LIMITS.maxMessageLength;
  }, { message: 'Leave enough room for the intake reply' }),
  language: z.enum(['zh', 'en']).default('zh'),
});

export const resumeIntakeOutputSchema = z.object({
  reply: z.string().trim().min(1).max(RESUME_INTAKE_LIMITS.maxMessageLength),
  basicInfo: resumeBasicInfoSchema,
});

// 制作接口另行验证两项门槛，不接受前端传入的 ready 标记代替校验。
export const resumeGenerationConversationSchema = conversationSchema.refine(
  (messages) => messages.at(-1)?.role === 'assistant',
  { message: 'Wait for the intake reply before creating the resume' },
);

export type ResumeIntakeMessage = z.infer<typeof resumeIntakeMessageSchema>;
export type ResumeBasicInfo = z.infer<typeof resumeBasicInfoSchema>;
export type ResumeIntakeOutput = z.infer<typeof resumeIntakeOutputSchema>;
