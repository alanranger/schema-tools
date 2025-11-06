// Preload script to expose Electron context to renderer
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  buildDesktop: () => ipcRenderer.invoke('build-desktop'),
  openExe: (exePath) => ipcRenderer.invoke('open-exe', exePath),
  getExePath: () => ipcRenderer.invoke('get-exe-path'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  onBuildProgress: (callback) => {
    ipcRenderer.on('build-progress', (event, data) => callback(data));
  },
  onBuildComplete: (callback) => {
    ipcRenderer.on('build-complete', (event, data) => callback(data));
  },
  onBuildError: (callback) => {
    ipcRenderer.on('build-error', (event, data) => callback(data));
  },
});

