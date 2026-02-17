const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ubm', {
  build: {
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    platform: process.platform,
    arch: process.arch,
  },
  window: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    close: () => ipcRenderer.invoke('win:close'),
    toggleMaximize: () => ipcRenderer.invoke('win:toggleMaximize'),
    isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  },
  assets: {
    readText: (relPath) => ipcRenderer.invoke('asset:readText', relPath),
  }
  ,
  pdf: {
    saveFromHtml: (html, opts = {}) => ipcRenderer.invoke('pdf:saveFromHtml', { html, ...opts }),
  },
  print: {
    fromHtml: (html, opts = {}) => ipcRenderer.invoke('print:fromHtml', { html, ...opts }),
  }
});
