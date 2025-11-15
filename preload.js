// Preload script to expose Electron context to renderer
// Note: Preload scripts must use CommonJS, not ES modules
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  buildDesktop: () => ipcRenderer.invoke('build-desktop'),
  openExe: (exePath) => ipcRenderer.invoke('open-exe', exePath),
  getExePath: () => ipcRenderer.invoke('get-exe-path'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  saveAndDeploySchema: (fileName, jsonContent) => ipcRenderer.invoke('save-and-deploy-schema', { fileName, jsonContent }),
  batchDeploySchemas: (files) => ipcRenderer.invoke('batch-deploy-schemas', { files }),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', { filePath, content }),
  onServerLog: (callback) => {
    ipcRenderer.on('server-log', (event, data) => callback(data));
  },
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

