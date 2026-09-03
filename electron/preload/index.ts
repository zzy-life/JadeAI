import { contextBridge, ipcRenderer } from 'electron';

/**
 * The entire renderer → main surface. Keep it small and explicit: everything
 * here is reachable from page JavaScript.
 */
export interface UpdateStatus {
  update: { version: string } | null;
}

/**
 * Update actions take no URL arguments. The main process owns the fixed external
 * destination; the renderer can only request that it be opened.
 */
const jade = {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('jade:settings:get'),
  patchSettings: (patch: unknown) => ipcRenderer.invoke('jade:settings:patch', patch),
  openDataDir: () => ipcRenderer.invoke('jade:shell:open-data-dir'),
  retryStartup: () => ipcRenderer.send('jade:startup:retry'),

  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('jade:update:status'),
  openUpdatePage: (): Promise<void> => ipcRenderer.invoke('jade:update:open-page'),
  skipUpdate: (): Promise<void> => ipcRenderer.invoke('jade:update:skip'),

  /**
   * Both subscriptions return an unsubscribe function. React effects re-run,
   * and an ipcRenderer listener that is never removed accumulates one copy per
   * run — each firing a setState on a component that may be unmounted.
   */
  onUpdateAvailable: (callback: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: UpdateStatus) => callback(status);
    ipcRenderer.on('jade:update:available', listener);
    return () => ipcRenderer.removeListener('jade:update:available', listener);
  },
};

export type JadeBridge = typeof jade;

contextBridge.exposeInMainWorld('jade', jade);
