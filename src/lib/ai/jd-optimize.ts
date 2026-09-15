import { generateText, type LanguageModel } from 'ai';
import type { AIConfig } from '@/lib/ai/provider';
import { getJsonProviderOptions } from '@/lib/ai/provider';
import { extractJson } from '@/lib/ai/extract-json';
import { jdOptimizeOutputSchema, type JdAnalysisOutput } from '@/lib/ai/jd-analysis-schema';
import { normalizeSectionContent } from '@/lib/resume/normalize-content';

interface SourceSection {
  id: string;
  type: string;
  title: string;
  sortOrder: number;
  visible: boolean;
  content: unknown;
}

const PRESERVED_FIELDS: Record<string, string[]> = {
  personal_info: ['avatar'],
};

export const JD_OPTIMIZE_SYSTEM_PROMPT = `You are an expert resume writer tailoring an existing resume to one job description.

FACTUAL INTEGRITY IS MANDATORY:
- Use only facts already present in the source resume.
- Never invent or imply new employers, roles, dates, degrees, certifications, projects, skills, metrics, responsibilities, or experience.
- A keyword from the job description may be added only when the source resume already provides clear evidence for it.
- Apply the provided match analysis: address actionable suggestions and missing keywords only when supported by source facts.
- Improve wording, ordering, emphasis, concision, and ATS readability while preserving meaning.
- Make meaningful improvements instead of returning the source unchanged.
- Preserve every section and its sectionId. Do not add or remove sections.
- Preserve IDs, URLs, emails, phone numbers, dates, proper nouns, and JSON field names.
- Keep the resume's original language.

Return one JSON object with:
- targetRole: a concise role name inferred from the job description, in the resume language
- sections: every source section exactly once, each with sectionId, title, changeSummary, and content
- changeSummary: one concise, user-facing sentence in the resume language explaining what was changed in that section; say explicitly when a section was preserved

CRITICAL: Return JSON only. Do not use markdown or code fences.`;

function stripPreservedFields(section: SourceSection) {
  const preserved: Record<string, unknown> = {};
  const fields = PRESERVED_FIELDS[section.type] || [];
  const content: unknown = section.content && typeof section.content === 'object' && !Array.isArray(section.content)
    ? { ...(section.content as Record<string, unknown>) }
    : section.content;

  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const contentRecord = content as Record<string, unknown>;
    for (const field of fields) {
      if (field in contentRecord) {
        preserved[field] = contentRecord[field];
        delete contentRecord[field];
      }
    }
  }

  return { content, preserved };
}

export async function generateJdOptimizedSections(
  sections: SourceSection[],
  jobDescription: string,
  analysis: JdAnalysisOutput,
  model: LanguageModel,
  aiConfig: AIConfig,
) {
  const preservedById = new Map<string, Record<string, unknown>>();
  const inputSections = sections.map((section) => {
    const { content, preserved } = stripPreservedFields(section);
    preservedById.set(section.id, preserved);
    return { sectionId: section.id, type: section.type, title: section.title, content };
  });

  const result = await generateText({
    model,
    maxOutputTokens: 16384,
    system: JD_OPTIMIZE_SYSTEM_PROMPT,
    prompt: `Source resume sections:\n${JSON.stringify(inputSections)}\n\nJob description:\n${jobDescription}\n\nMatch analysis to apply:\n${JSON.stringify(analysis)}`,
    providerOptions: getJsonProviderOptions(aiConfig),
  });
  const generated = extractJson(result.text, jdOptimizeOutputSchema);

  const generatedById = new Map(generated.sections.map((section) => [section.sectionId, section]));
  if (
    generated.sections.length !== sections.length ||
    generatedById.size !== sections.length ||
    sections.some((section) => !generatedById.has(section.id))
  ) {
    throw new Error('AI returned an incomplete or mismatched section set');
  }

  const optimizedSections = sections.map((source) => {
    const optimized = generatedById.get(source.id)!;
    if (!optimized.content || typeof optimized.content !== 'object' || Array.isArray(optimized.content)) {
      throw new Error(`AI returned invalid content for section ${source.id}`);
    }

    const generatedContent = optimized.content as Record<string, unknown>;
    if (source.type === 'skills' && !Array.isArray(generatedContent.categories)) {
      throw new Error(`AI returned invalid skills content for section ${source.id}`);
    }
    const sourceContent = source.content && typeof source.content === 'object' && !Array.isArray(source.content)
      ? source.content as Record<string, unknown>
      : {};
    if (
      Array.isArray(sourceContent.items) &&
      sourceContent.items.length > 0 &&
      !Array.isArray(generatedContent.items)
    ) {
      throw new Error(`AI returned invalid items content for section ${source.id}`);
    }

    const preserved = preservedById.get(source.id) || {};
    const normalizedContent = normalizeSectionContent(source.type, { ...generatedContent, ...preserved });
    return {
      type: source.type,
      title: optimized.title,
      sortOrder: source.sortOrder,
      visible: source.visible,
      content: normalizedContent,
      changeSummary: optimized.changeSummary,
      changed: optimized.title !== source.title || JSON.stringify(normalizedContent) !== JSON.stringify(source.content),
    };
  });

  if (!optimizedSections.some((section) => section.changed)) {
    throw new Error('AI returned the source resume without any optimization');
  }

  return {
    targetRole: generated.targetRole.trim(),
    changes: optimizedSections
      .filter((section) => section.changed)
      .map((section) => ({ section: section.title, summary: section.changeSummary })),
    sections: optimizedSections.map((section) => ({
      type: section.type,
      title: section.title,
      sortOrder: section.sortOrder,
      visible: section.visible,
      content: section.content,
    })),
  };
}
