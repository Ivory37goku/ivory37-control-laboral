const { contextBridge, ipcRenderer } = require('electron');

const DATA_KEY = '工V龱尺ㄚ㇌7_data_v1';

try {
  const params = new URL(location.href).searchParams;
  const forceRestore = params.get('nativeRestore') === '1';
  const shadow = ipcRenderer.sendSync('ivory37:read-storage-shadow');
  if (shadow) {
    const saved = JSON.parse(shadow);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)
      && (forceRestore || localStorage.getItem(DATA_KEY) === null)) {
      Object.keys(saved).forEach((key) => {
        if (typeof saved[key] === 'string' && key.length < 512
          && (forceRestore || localStorage.getItem(key) === null)) {
          localStorage.setItem(key, saved[key]);
        }
      });
    }
  }
} catch (_) {}

contextBridge.exposeInMainWorld('IVORY37DesktopBridge', {
  saveLocalStorage: (snapshot) => {
    if (typeof snapshot === 'string' && snapshot.length <= 12 * 1024 * 1024) {
      ipcRenderer.send('ivory37:write-storage-shadow', snapshot);
    }
  },
  saveFile: (fileName, mimeType, encoded) => ipcRenderer.invoke('ivory37:save-file', fileName, mimeType, encoded)
});
