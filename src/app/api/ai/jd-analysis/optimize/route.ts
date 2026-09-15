import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { AIConfigError, extractAIConfig, getModel } from '@/lib/ai/provider';
import { jdOptimizeInputSchema } from '@/lib/ai/jd-analysis-schema';
import { generateJdOptimizedSections } from '@/lib/ai/jd-optimize';

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = jdOptimizeInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const requestedResume = await resumeRepository.findById(parsed.data.resumeId);
    if (!requestedResume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }
    if (requestedResume.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sourceId = requestedResume.kind === 'jd_optimized'
      ? requestedResume.sourceResumeId
      : requestedResume.id;
    if (!sourceId) {
      return NextResponse.json({ error: 'Source resume not found' }, { status: 409 });
    }

    const sourceResume = sourceId === requestedResume.id
      ? requestedResume
      : await resumeRepository.findById(sourceId);
    if (!sourceResume || sourceResume.userId !== user.id || sourceResume.kind === 'jd_optimized') {
      return NextResponse.json({ error: 'Source resume not found' }, { status: 409 });
    }

    const aiConfig = extractAIConfig(request);
    const optimized = await generateJdOptimizedSections(
      sourceResume.sections,
      parsed.data.jobDescription,
      parsed.data.analysis,
      getModel(aiConfig),
      aiConfig,
    );
    const title = sourceResume.language === 'en'
      ? `${optimized.targetRole} - JD Optimized`
      : `${optimized.targetRole} - JD优化`;

    const created = await resumeRepository.createJdOptimized({
      userId: user.id,
      title,
      template: sourceResume.template,
      themeConfig: sourceResume.themeConfig,
      language: sourceResume.language,
      sourceResumeId: sourceResume.id,
      targetJobDescription: parsed.data.jobDescription,
      sections: optimized.sections,
    });
    if (!created) {
      return NextResponse.json({ error: 'Failed to create optimized resume' }, { status: 500 });
    }

    return NextResponse.json({
      ...created,
      targetRole: optimized.targetRole,
      optimizationSummary: optimized.changes,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('POST /api/ai/jd-analysis/optimize error:', error);
    const detail = error instanceof Error && error.message ? error.message : '';
    return NextResponse.json(
      { error: detail ? `Failed to optimize resume: ${detail}` : 'Failed to optimize resume' },
      { status: 500 },
    );
  }
}
