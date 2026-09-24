const { contextBridge, ipcRenderer } = require('electron');

const api = {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron
};

try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', api);
  } else {
    window.electronAPI = api;
  }
} catch (e) {
  window.electronAPI = api;
}
