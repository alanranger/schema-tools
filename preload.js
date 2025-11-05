// Preload script to expose Electron context to renderer
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});

