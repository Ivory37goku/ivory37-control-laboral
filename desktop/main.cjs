const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');

const APP_ID = 'com.ivory37.controllaboral.desktop';
const APP_NAME = 'Control Laboral';
const APP_DATA_DIR = 'IVORY37 Control Laboral';

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

// Mantiene la carpeta de datos de usuario estable entre las actualizaciones.
const profilePath = app.commandLine.getSwitchValue('user-data-dir');
app.setPath('userData', profilePath ? path.resolve(profilePath) : path.join(app.getPath('appData'), APP_DATA_DIR));

const appRoot = app.getAppPath();
const indexPath = path.resolve(appRoot, 'index.html');
const iconPath = path.resolve(appRoot, 'desktop', 'assets', 'icon.ico');
const userDataPath = app.getPath('userData');
const storageShadowPath = path.join(userDataPath, 'web-storage-shadow.json');
const hostedBootstrapPath = path.join(userDataPath, 'hosted-app-enabled');
const bundledStorageMarker = path.join(userDataPath, 'bundled-storage-restored');

function isLocalApp(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'file:' && path.resolve(fileURLToPath(url)) === indexPath;
  } catch (_) { return false; }
}

function isTrustedAppDocument(value) { return isLocalApp(value); }

function readStorageShadow() {
  try {
    const raw = fs.readFileSync(storageShadowPath, 'utf8');
    return raw.length <= 12 * 1024 * 1024 ? raw : '';
  } catch (_) { return ''; }
}

function writeStorageShadow(raw) {
  if (typeof raw !== 'string' || raw.length > 12 * 1024 * 1024) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    fs.mkdirSync(userDataPath, { recursive: true });
    const tempPath = storageShadowPath + '.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(36).slice(2) + '.tmp';
    fs.writeFileSync(tempPath, raw, 'utf8');
    fs.renameSync(tempPath, storageShadowPath);
  } catch (_) {}
}

ipcMain.on('ivory37:read-storage-shadow', (event) => {
  event.returnValue = isTrustedAppDocument(event.senderFrame?.url || '') ? readStorageShadow() : '';
});

ipcMain.on('ivory37:write-storage-shadow', (event, raw) => {
  if (isTrustedAppDocument(event.senderFrame?.url || '')) writeStorageShadow(raw);
});

ipcMain.on('ivory37:finish-storage-migration', (event) => {
  event.returnValue = false;
  if (!isTrustedAppDocument(event.senderFrame?.url || '')) return;
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(bundledStorageMarker, 'enabled', 'utf8');
    event.returnValue = true;
  } catch (_) {}
});

ipcMain.handle('ivory37:save-file', async (event, fileName, mimeType, encoded) => {
  if (!isTrustedAppDocument(event.senderFrame?.url || '') || typeof encoded !== 'string'
    || encoded.length > (12 * 1024 * 1024 * 4 / 3) + 16 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return false;
  const mime = String(mimeType || '').split(';', 1)[0].trim().toLowerCase();
  if (mime !== 'application/json' && mime !== 'text/csv') return false;
  const safeName = String(fileName || 'backup.json').replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_').trim().slice(0, 120) || 'backup.json';
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 12 * 1024 * 1024) return false;
  const extension = mime === 'application/json' ? 'json' : 'csv';
  const defaultName = safeName.toLowerCase().endsWith('.' + extension) ? safeName : safeName + '.' + extension;
  const options = {
    title: 'Guardar archivo de Control Laboral',
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  };
  try {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    await fsp.writeFile(result.filePath, bytes);
    return true;
  } catch (_) { return false; }
});

function localAppUrl(forceRestore) {
  return pathToFileURL(indexPath).href + (forceRestore ? '?nativeRestore=1' : '');
}

function createWindow() {
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 960,
    minWidth: 760,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#070d18',
    icon: iconPath,
    webPreferences: {
      preload: path.join(appRoot, 'desktop', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, destination) => {
    if (isLocalApp(destination)) return;
    event.preventDefault();
    if (/^https:\/\//i.test(destination)) void shell.openExternal(destination);
  });

  const needsStorageMigration = fs.existsSync(hostedBootstrapPath) && !fs.existsSync(bundledStorageMarker);
  void window.loadURL(localAppUrl(needsStorageMigration));
  return window;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
