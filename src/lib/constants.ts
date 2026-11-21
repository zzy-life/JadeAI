export const APP_NAME = '简鹿AI简历';

export const SECTION_TYPES = [
  'personal_info',
  'summary',
  'work_experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'languages',
  'github',
  'qr_codes',
  'custom',
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const DEFAULT_SECTIONS: { type: SectionType; titleZh: string; titleEn: string }[] = [
  { type: 'personal_info', titleZh: '个人信息', titleEn: 'Personal Info' },
  { type: 'summary', titleZh: '个人简介', titleEn: 'Summary' },
  { type: 'work_experience', titleZh: '工作经历', titleEn: 'Work Experience' },
  { type: 'education', titleZh: '教育背景', titleEn: 'Education' },
  { type: 'skills', titleZh: '技能特长', titleEn: 'Skills' },
  { type: 'qr_codes', titleZh: '二维码', titleEn: 'QR Codes' },
];

export const TEMPLATES = [
  'classic', 'modern', 'minimal', 'professional', 'two-column', 'creative', 'ats', 'academic', 'elegant', 'executive',
  'developer', 'designer', 'startup', 'formal', 'infographic', 'compact', 'euro', 'clean', 'bold', 'timeline',
  // Batch 1: Industry/Professional
  'nordic', 'corporate', 'consultant', 'finance', 'medical',
  // Batch 2: Modern/Tech
  'gradient', 'metro', 'material', 'coder', 'blocks',
  // Batch 3: Creative/Artistic
  'magazine', 'artistic', 'retro', 'neon', 'watercolor',
  // Batch 4: Style/Culture
  'swiss', 'japanese', 'berlin', 'luxe', 'rose',
  // Batch 5: Specialized
  'architect', 'legal', 'teacher', 'scientist', 'engineer',
  // Batch 6: Layout Variants
  'sidebar', 'card', 'zigzag', 'ribbon', 'mosaic',
] as const;
export type Template = (typeof TEMPLATES)[number];

/** Templates with full-bleed background headers — no outer padding needed */
export const BACKGROUND_TEMPLATES: ReadonlySet<string> = new Set([
  'modern', 'creative', 'two-column', 'executive', 'developer',
  'designer', 'startup', 'infographic', 'compact', 'bold',
  'corporate', 'finance', 'gradient', 'material', 'coder',
  'artistic', 'neon', 'berlin', 'engineer', 'sidebar', 'ribbon',
]);

/** 预览与导出共用内容边界规则；背景容器保持铺满，仅调整靠纸张边缘的留白。 */
export function buildPageMarginCSS(scope: string, template: string): string {
  if (!BACKGROUND_TEMPLATES.has(template)) return '';

  // 背景模板根节点的首/尾 div 分别为页头与正文；整页双栏则对应左右栏。
  const root = `${scope} > div`;
  const header = `${root} > div:first-child`;
  const body = `${root} > div:last-child`;
  const horizontal = 'padding-left: var(--base-margin-left) !important; padding-right: var(--base-margin-right) !important;';
  const top = 'padding-top: var(--base-margin-top) !important;';
  const bottom = 'padding-bottom: var(--base-margin-bottom) !important;';

  if (template === 'two-column' || template === 'sidebar' || template === 'coder') {
    // 两栏交界处不是页边距，保留各栏原有的内部 padding。
    return `
      ${header} { ${top} ${bottom} padding-left: var(--base-margin-left) !important; }
      ${body} { ${top} ${bottom} padding-right: var(--base-margin-right) !important; }
    `;
  }

  if (template === 'compact') {
    return `
      ${header} { ${horizontal} ${top} }
      ${body} > div:first-child { padding-left: var(--base-margin-left) !important; ${bottom} }
      ${body} > div:last-child { padding-right: var(--base-margin-right) !important; ${bottom} }
    `;
  }

  if (template === 'material') {
    // 卡片外边缘遵循页边距，卡片自身的内容留白不变。
    return `
      ${header} { margin-top: var(--base-margin-top) !important; margin-left: var(--base-margin-left) !important; margin-right: var(--base-margin-right) !important; }
      ${body} { ${horizontal} ${bottom} }
    `;
  }

  let css = `
    ${header} { ${horizontal} ${top} }
    ${body} { ${horizontal} ${bottom} }
  `;
  if (template === 'designer') {
    // 头像与文字是兄弟节点，将边距放到整个页头，避免头像贴着纸张边缘。
    css += `
      ${header} { padding-bottom: 32px; gap: 24px; }
      ${header} > div:first-child { padding: 0 !important; min-width: 0; }
    `;
  }
  return css;
}

/** Two-column templates with dark sidebar — sidebar bg + width for QR bar continuity */
export const TWO_COLUMN_TEMPLATES: Record<string, { bg: string; width: string }> = {
  'two-column': { bg: '#16213e', width: '35%' },
  sidebar:      { bg: '#1e40af', width: '35%' },
  coder:        { bg: '#0d1117', width: '32%' },
};

export const AUTOSAVE_DELAY = 500;
export const MAX_UNDO_STACK = 50;
