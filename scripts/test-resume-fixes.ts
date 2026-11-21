// 运行：pnpm exec tsx scripts/test-resume-fixes.ts（无需启动应用或连接数据库）
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { generateDocxBuffer } from '../src/app/api/resume/[id]/export/docx';
import { buildMinimalHtml } from '../src/app/api/resume/[id]/export/templates/minimal';
import { buildPageMarginCSS } from '../src/lib/constants';
import type { ResumeWithSections } from '../src/app/api/resume/[id]/export/utils';

const CUSTOM_PRIMARY = '#123456';
const CUSTOM_ACCENT = '#abcdef';
const AVATAR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const BASE_RESUME = {
  id: 'regression', title: '回归测试', template: 'modern', language: 'zh',
  themeConfig: {
    primaryColor: '#1a1a1a', accentColor: '#3b82f6', fontFamily: 'SimSun',
    fontSize: 'medium', lineSpacing: 1.5, sectionSpacing: 16,
    margin: { top: 0, right: 12, bottom: 24, left: 36 },
  },
  sections: [
    { id: 'personal', type: 'personal_info', title: '个人信息', visible: true, sortOrder: 0,
      content: { fullName: '测试姓名', website: 'https://example.com/?a=1&b=2', avatar: AVATAR } },
    { id: 'summary', type: 'summary', title: '个人简介', visible: true, sortOrder: 1,
      content: { text: '测试内容' } },
  ],
} as unknown as ResumeWithSections;

// 直接读取 DOCX 的 ZIP 中央目录，不增加解压依赖，也不写临时文件。
function unzip(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'DOCX 应包含 ZIP 中央目录');
  let offset = buffer.readUInt32LE(end + 16);
  const count = buffer.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const compressed = buffer.subarray(start, start + size);
    assert.ok(method === 0 || method === 8, '仅支持普通或 deflate ZIP 条目');
    entries.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function main() {
  const defaultFiles = unzip(await generateDocxBuffer(BASE_RESUME));
  const xml = defaultFiles.get('word/document.xml')!.toString('utf8');
  assert.match(xml, /w:fill="16213e"/i, '默认主色不得覆盖现代模板背景');
  assert.match(xml, /w:color="e94560"/i, '默认强调色不得覆盖现代模板强调色');
  assert.match(xml, /w:eastAsia="SimSun"/, '中文字体应使用宋体');
  assert.match(xml, /w:ascii="Times New Roman"/);
  for (const [direction, value] of Object.entries({ top: 0, right: 180, bottom: 360, left: 540 })) {
    assert.match(xml, new RegExp(`w:${direction}="${value}"`), `页边距 ${direction} 应保留配置`);
  }

  const customized = structuredClone(BASE_RESUME);
  customized.themeConfig = { ...customized.themeConfig, primaryColor: CUSTOM_PRIMARY, accentColor: CUSTOM_ACCENT };
  customized.sections.push({
    id: 'education', type: 'education', title: '教育背景', visible: true, sortOrder: 2,
    content: { items: [{ id: 'school', institution: '测试大学', degree: '本科', startDate: '2020-09', endDate: '2024-06' }] },
  } as ResumeWithSections['sections'][number]);
  const customXml = unzip(await generateDocxBuffer(customized)).get('word/document.xml')!.toString('utf8');
  assert.doesNotMatch(customXml, /w:color="0f3460"/i, '自定义强调色应同时覆盖教育条目边框');
  assert.match(customXml, /w:fill="123456"/i);
  assert.match(customXml, /w:color="abcdef"/i);

  for (const template of ['classic', 'minimal']) {
    const light = structuredClone(BASE_RESUME);
    light.template = template;
    const files = unzip(await generateDocxBuffer(light));
    assert.match(files.get('word/document.xml')!.toString('utf8'), /<w:drawing>/, `${template} 应导出头像`);
    assert.ok([...files.keys()].some((name) => name.startsWith('word/media/') && name.endsWith('.png')));
  }

  const partial = structuredClone(BASE_RESUME);
  partial.themeConfig = { ...partial.themeConfig, margin: { top: 0 } } as typeof partial.themeConfig;
  const partialXml = unzip(await generateDocxBuffer(partial)).get('word/document.xml')!.toString('utf8');
  assert.match(partialXml, /w:top="0"/);
  assert.match(partialXml, /w:right="300"/, '缺失方向应回退为 20px');
  assert.ok(buildMinimalHtml(BASE_RESUME).includes('https://example.com/?a=1&amp;b=2'), '网站应显示并转义');
  assert.ok(buildPageMarginCSS('.resume', 'two-column').includes('var(--base-margin-left)'));
  assert.equal(buildPageMarginCSS('.resume', 'minimal'), '');
  console.log('简历回归检查通过：Word 模板配色、自定义色、字体、头像、边距及网站导出。');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
