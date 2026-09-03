import { readFile } from 'node:fs/promises';

interface DesktopCollectorSettings {
  installationId?: unknown;
  resumeCollectionEnabled?: unknown;
}

interface ResumeSectionSnapshot {
  id: string;
  type: string;
  title: string;
  sortOrder: number;
  visible: boolean;
  content: unknown;
}

interface ResumeSnapshot {
  id: string;
  title: string;
  template: string;
  language: string;
  themeConfig: unknown;
  sections: ResumeSectionSnapshot[];
}

const DEFAULT_COLLECTOR_URL = 'https://api.webarcx.com';
const REQUEST_TIMEOUT_MS = 5_000;
let sendChain: Promise<void> = Promise.resolve();
let lastClientTimestamp = 0;

function nextClientUpdatedAt(): string {
  const timestamp = Math.max(Date.now(), lastClientTimestamp + 1);
  lastClientTimestamp = timestamp;
  return new Date(timestamp).toISOString();
}

function getCollectorBaseUrl(): string {
  const value = process.env.JADE_RESUME_COLLECTOR_URL?.trim() || DEFAULT_COLLECTOR_URL;
  return value.replace(/\/+$/, '');
}

async function readCollectorSettings(): Promise<{
  installationId: string;
  enabled: boolean;
} | null> {
  if (process.env.JADE_RUNTIME !== 'desktop' || !process.env.JADE_SETTINGS_PATH) return null;

  try {
    const raw = JSON.parse(
      await readFile(process.env.JADE_SETTINGS_PATH, 'utf8'),
    ) as DesktopCollectorSettings;
    return {
      installationId: typeof raw.installationId === 'string' ? raw.installationId : '',
      enabled: raw.resumeCollectionEnabled !== false,
    };
  } catch (error) {
    console.warn('[resume-collector] failed to read desktop settings:', error);
    return null;
  }
}

function normalizeThemeConfig(value: unknown): Record<string, unknown> {
  let normalized = value;
  if (typeof value === 'string') {
    try {
      normalized = JSON.parse(value) as unknown;
    } catch {
      // 保留无法解析的历史值，由服务端统一归档原始类型。
    }
  }
  if (typeof normalized === 'object' && normalized !== null && !Array.isArray(normalized)) {
    return normalized as Record<string, unknown>;
  }
  return {
    __collectorPreservedValue__: {
      kind: normalized === null ? 'null' : Array.isArray(normalized) ? 'array' : typeof normalized,
      value: normalized,
    },
  };
}

function sectionChanged(
  previous: ResumeSectionSnapshot | undefined,
  next: ResumeSectionSnapshot,
): boolean {
  if (!previous) return true;
  return (
    previous.type !== next.type ||
    previous.title !== next.title ||
    previous.sortOrder !== next.sortOrder ||
    previous.visible !== next.visible ||
    JSON.stringify(previous.content) !== JSON.stringify(next.content)
  );
}

async function sendRequest(path: string, payload: Record<string, unknown>): Promise<void> {
  const baseUrl = getCollectorBaseUrl();
  const settings = await readCollectorSettings();
  if (!settings?.enabled || !settings.installationId) return;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        installationId: settings.installationId,
        appVersion: process.env.JADE_APP_VERSION || 'unknown',
        platform: process.platform,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(
        `[resume-collector] request failed status=${response.status} ` +
          `fullSnapshot=${String(payload.fullSnapshot)} ` +
          `sections=${Array.isArray(payload.upsertSections) ? payload.upsertSections.length : 'invalid'}`,
      );
    }
  } catch (error) {
    // Collection is best-effort and must never turn a local save into a failure.
    console.warn('[resume-collector] request failed:', error);
  }
}

function send(path: string, payload: Record<string, unknown>): Promise<void> {
  // Serialize best-effort sends in this process so delete/update ordering is stable.
  // A rejection is swallowed by sendRequest, keeping the chain usable.
  sendChain = sendChain.then(() => sendRequest(path, payload));
  return sendChain;
}

export async function collectResumeChange(
  previous: ResumeSnapshot | null,
  current: ResumeSnapshot,
): Promise<void> {
  const previousSections = new Map((previous?.sections || []).map((section) => [section.id, section]));
  const currentIds = new Set(current.sections.map((section) => section.id));
  const upsertSections = current.sections.filter((section) =>
    sectionChanged(previousSections.get(section.id), section),
  );
  const deletedSectionIds = (previous?.sections || [])
    .filter((section) => !currentIds.has(section.id))
    .map((section) => section.id);

  await send('/api/desktop/resumes/collect', {
    schemaVersion: 1,
    resumeId: current.id,
    title: current.title,
    template: current.template,
    language: current.language,
    themeConfig: normalizeThemeConfig(current.themeConfig),
    clientUpdatedAt: nextClientUpdatedAt(),
    // 没有可信前序快照时，本次数据作为权威全量快照。
    fullSnapshot: previous === null,
    upsertSections,
    deletedSectionIds,
  });
}

export async function collectResumeDeletion(resumeId: string): Promise<void> {
  await send('/api/desktop/resumes/delete', {
    resumeId,
    clientUpdatedAt: nextClientUpdatedAt(),
  });
}
