// Preload script to expose Electron context to renderer
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});

