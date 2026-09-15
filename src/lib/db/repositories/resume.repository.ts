import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../index';
import { resumes, resumeSections } from '../schema';
import { resolveDatabaseKind } from '../database-kind';

interface JdOptimizedSection {
  type: string;
  title: string;
  sortOrder: number;
  visible: boolean;
  content: unknown;
}

async function insertResumeWithSections(
  resumeValues: typeof resumes.$inferInsert,
  sectionValues: (typeof resumeSections.$inferInsert)[],
) {
  if (resolveDatabaseKind(process.env) === 'sqlite') {
    db.transaction((tx: typeof db) => {
      tx.insert(resumes).values(resumeValues).run();
      if (sectionValues.length > 0) {
        tx.insert(resumeSections).values(sectionValues).run();
      }
    });
    return;
  }

  await db.transaction(async (tx: typeof db) => {
    await tx.insert(resumes).values(resumeValues);
    if (sectionValues.length > 0) {
      await tx.insert(resumeSections).values(sectionValues);
    }
  });
}

export const resumeRepository = {
  async findAllByUserId(userId: string) {
    return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.updatedAt));
  },

  async findById(id: string) {
    const resume = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
    if (!resume[0]) return null;
    const sections = await db.select().from(resumeSections).where(eq(resumeSections.resumeId, id)).orderBy(resumeSections.sortOrder);
    return { ...resume[0], sections };
  },

  async create(data: { userId: string; title?: string; template?: string; themeConfig?: unknown; language?: string }) {
    const id = crypto.randomUUID();
    await db.insert(resumes).values({
      id,
      userId: data.userId,
      title: data.title || '未命名简历',
      template: data.template || 'classic',
      themeConfig: data.themeConfig,
      language: data.language || 'zh',
    });
    return this.findById(id);
  },

  async update(id: string, data: Partial<{ title: string; template: string; themeConfig: unknown; language: string }>) {
    await db.update(resumes).set({ ...data, updatedAt: new Date() } as any).where(eq(resumes.id, id));
    return this.findById(id);
  },

  async createJdOptimized(data: {
    userId: string;
    title: string;
    template: string;
    themeConfig: unknown;
    language: string;
    sourceResumeId: string;
    targetJobDescription: string;
    sections: JdOptimizedSection[];
  }) {
    const id = crypto.randomUUID();

    await insertResumeWithSections(
      {
        id,
        userId: data.userId,
        title: data.title,
        template: data.template,
        themeConfig: data.themeConfig,
        language: data.language,
        kind: 'jd_optimized',
        sourceResumeId: data.sourceResumeId,
        targetJobDescription: data.targetJobDescription,
      },
      data.sections.map((section) => ({
        id: crypto.randomUUID(),
        resumeId: id,
        type: section.type,
        title: section.title,
        sortOrder: section.sortOrder,
        visible: section.visible,
        content: section.content,
      })),
    );

    return this.findById(id);
  },

  async delete(id: string) {
    await db.delete(resumes).where(eq(resumes.id, id));
  },

  async duplicate(id: string, userId: string, titleOverride?: string) {
    const original = await this.findById(id);
    if (!original) return null;

    const newId = crypto.randomUUID();
    await insertResumeWithSections(
      {
        id: newId,
        userId,
        title: titleOverride ?? `${original.title} (副本)`,
        template: original.template,
        themeConfig: original.themeConfig,
        language: original.language,
        kind: original.kind,
        sourceResumeId: original.sourceResumeId,
        targetJobDescription: original.targetJobDescription,
      },
      original.sections.map((section: JdOptimizedSection) => ({
        id: crypto.randomUUID(),
        resumeId: newId,
        type: section.type,
        title: section.title,
        sortOrder: section.sortOrder,
        visible: section.visible,
        content: section.content,
      })),
    );

    return this.findById(newId);
  },

  // Share operations
  async findByShareToken(token: string) {
    const resume = await db.select().from(resumes).where(eq(resumes.shareToken, token)).limit(1);
    if (!resume[0]) return null;
    const sections = await db.select().from(resumeSections).where(eq(resumeSections.resumeId, resume[0].id)).orderBy(resumeSections.sortOrder);
    return { ...resume[0], sections };
  },

  async incrementViewCount(id: string) {
    await db.update(resumes).set({ viewCount: sql`${resumes.viewCount} + 1` } as any).where(eq(resumes.id, id));
  },

  async updateShareSettings(id: string, settings: { isPublic?: boolean; shareToken?: string | null; sharePassword?: string | null }) {
    await db.update(resumes).set({ ...settings, updatedAt: new Date() } as any).where(eq(resumes.id, id));
  },

  // Section operations
  async createSection(data: { id?: string; resumeId: string; type: string; title: string; sortOrder: number; visible?: boolean; content?: unknown }) {
    const id = data.id || crypto.randomUUID();
    await db.insert(resumeSections).values({
      id,
      resumeId: data.resumeId,
      type: data.type,
      title: data.title,
      sortOrder: data.sortOrder,
      visible: data.visible ?? true,
      content: data.content || {},
    } as any);
    return db.select().from(resumeSections).where(eq(resumeSections.id, id)).limit(1).then((r: any[]) => r[0]);
  },

  async updateSection(id: string, data: Partial<{ title: string; sortOrder: number; visible: boolean; content: unknown }>) {
    await db.update(resumeSections).set({ ...data, updatedAt: new Date() } as any).where(eq(resumeSections.id, id));
  },

  async deleteSection(id: string) {
    await db.delete(resumeSections).where(eq(resumeSections.id, id));
  },

  async updateSectionOrder(sections: { id: string; sortOrder: number }[]) {
    for (const s of sections) {
      await db.update(resumeSections).set({ sortOrder: s.sortOrder, updatedAt: new Date() }).where(eq(resumeSections.id, s.id));
    }
  },
};
