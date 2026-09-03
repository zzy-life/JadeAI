import { BrowserWindow, ipcMain, shell } from 'electron';
import type { SettingsStore } from '../settings-store';
import type { AvailableUpdate } from '../update-check';

/**
 * Update UI backing, driven from the renderer's in-app notice.
 *
 * The renderer can request the update page, but cannot supply a URL. Keeping the
 * destination in the main process prevents page JavaScript from opening an
 * arbitrary external address through the Electron bridge.
 */

export interface UpdateStatus {
  update: { version: string } | null;
}

export const UPDATE_CHANNELS = {
  available: 'jade:update:available',
} as const;

export class UpdateCoordinator {
  private pending: AvailableUpdate | null = null;

  constructor(
    private readonly store: SettingsStore,
    private readonly updatePageUrl: string,
  ) {}

  /** Record an update and tell the renderer, if it is already listening. */
  announce(update: AvailableUpdate, window: BrowserWindow): void {
    this.pending = update;
    if (!window.isDestroyed()) {
      window.webContents.send(UPDATE_CHANNELS.available, this.status());
    }
  }

  status(): UpdateStatus {
    return {
      update: this.pending === null ? null : { version: this.pending.version },
    };
  }

  skip(): void {
    if (this.pending === null) return;
    this.store.patch({ skippedUpdateVersion: this.pending.version });
    this.pending = null;
  }

  async openUpdatePage(): Promise<void> {
    if (this.pending !== null) await shell.openExternal(this.updatePageUrl);
  }
}

export function registerUpdateIpc(coordinator: UpdateCoordinator): void {
  ipcMain.handle('jade:update:status', (): UpdateStatus => coordinator.status());
  ipcMain.handle('jade:update:open-page', () => coordinator.openUpdatePage());
  ipcMain.handle('jade:update:skip', (): void => coordinator.skip());
}
