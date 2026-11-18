const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('IVORY37DesktopBridge', {
  getLocalStorageSnapshot: () => ipcRenderer.sendSync('ivory37:read-storage-shadow') || '{}',
  completeLocalStorageMigration: () => ipcRenderer.sendSync('ivory37:finish-storage-migration'),
  saveLocalStorage: (snapshot) => {
    if (typeof snapshot === 'string' && snapshot.length <= 12 * 1024 * 1024) {
      ipcRenderer.send('ivory37:write-storage-shadow', snapshot);
    }
  },
  saveFile: (fileName, mimeType, encoded) => ipcRenderer.invoke('ivory37:save-file', fileName, mimeType, encoded)
});
