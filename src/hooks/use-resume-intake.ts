'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getAIHeaders } from '@/stores/settings-store';
import {
  resumeIntakeInputSchema, resumeIntakeOutputSchema,
  type ResumeBasicInfo, type ResumeIntakeMessage,
} from '@/lib/ai/resume-intake-schema';

const EMPTY_BASIC_INFO: ResumeBasicInfo = { fullName: '', jobTitle: '' };

// 状态由始终挂载的创建容器持有；AI 设置暂时替换弹窗时，不会卸载或丢失对话。
export function useResumeIntake(language: string, enabled: boolean) {
  const t = useTranslations('generateResume');
  const [messages, setMessages] = useState<ResumeIntakeMessage[]>([]);
  const [basicInfo, setBasicInfo] = useState<ResumeBasicInfo>(EMPTY_BASIC_INFO);
  const [draft, setDraft] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const needsReply = messages.at(-1)?.role === 'user';
  const canGenerate = basicInfo.fullName !== '' && basicInfo.jobTitle !== ''
    && messages.at(-1)?.role === 'assistant' && !isReplying && !draft.trim();

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const reset = () => {
    // 先让旧请求失效再 abort：即使供应商不响应取消，迟到结果也不能恢复已清空状态。
    const current = requestRef.current;
    requestRef.current = null;
    current?.abort();
    setMessages([]);
    setBasicInfo(EMPTY_BASIC_INFO);
    setDraft('');
    setError('');
    setIsReplying(false);
  };

  const requestReply = async (conversation: ResumeIntakeMessage[]) => {
    if (!enabled || requestRef.current) return;
    const parsed = resumeIntakeInputSchema.safeParse({ messages: conversation, language });
    if (!parsed.success) {
      setError(t('conversationLimit'));
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setMessages(conversation);
    setDraft('');
    setError('');
    setIsReplying(true);
    try {
      const fingerprint = localStorage.getItem('jade_fingerprint');
      const response = await fetch('/api/ai/resume-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
          ...getAIHeaders(),
        },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('chatError'));
      const output = resumeIntakeOutputSchema.parse(data);
      if (requestRef.current !== controller) return;
      setMessages([...conversation, { role: 'assistant', content: output.reply }]);
      setBasicInfo(output.basicInfo);
    } catch (err) {
      if (requestRef.current !== controller) return;
      setError(err instanceof Error ? err.message : t('chatError'));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsReplying(false);
      }
    }
  };

  const send = async () => {
    if (!draft.trim() || needsReply) return;
    await requestReply([...messages, { role: 'user', content: draft.trim() }]);
  };

  const retry = async () => {
    if (!needsReply) return;
    await requestReply(messages);
  };

  return {
    messages, basicInfo, draft, setDraft, isReplying, error, needsReply, canGenerate,
    hasContent: messages.length > 0 || draft.length > 0,
    send, retry, reset,
  };
}
