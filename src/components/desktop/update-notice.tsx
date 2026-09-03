'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRuntimeConfig } from '@/components/providers/runtime-config-provider';

interface UpdateInfo {
  version: string;
}

/**
 * In-app notice that a newer desktop release exists.
 *
 * Deliberately not a native dialog. A modal would seize the window the instant
 * the app opens, before the user has done anything, which is far too much
 * weight for "there is a newer version" — this sits in the corner and can be
 * ignored, collapsed, or dismissed.
 *
 * Renders nothing outside the Electron shell: the same Next app also serves the
 * web deployment, where there is no installer to offer and no bridge to call.
 */
export function UpdateNotice() {
  const { desktop } = useRuntimeConfig();
  const t = useTranslations('desktopUpdate');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    const bridge = window.jade;
    if (!bridge) return;

    // Pull as well as subscribe: the check runs at launch and usually finishes
    // before this component mounts, so a push-only design would miss it every
    // time and only work on the rare slow-network launch.
    void bridge.getUpdateStatus().then((status) => {
      if (status.update) setInfo(status.update);
    });

    return bridge.onUpdateAvailable((status) => {
      if (status.update) setInfo(status.update);
    });
  }, [desktop]);

  const openUpdatePage = useCallback(async () => {
    await window.jade?.openUpdatePage();
  }, []);

  const skip = useCallback(async () => {
    await window.jade?.skipUpdate();
    setDismissed(true);
  }, []);

  if (!desktop || info === null || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{t('found', { version: info.version })}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={t(collapsed ? 'expand' : 'collapse')}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t('close')}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void openUpdatePage()}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t('download')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void skip()}>
            {t('skipVersion')}
          </Button>
        </div>
      )}
    </div>
  );
}
