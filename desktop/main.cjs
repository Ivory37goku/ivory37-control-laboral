const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');

const APP_ID = 'com.ivory37.controllaboral.desktop';
const APP_NAME = '工V龱尺ㄚ㇌7';
const APP_DATA_DIR = 'IVORY37 Control Laboral';
const HOSTED_HOST = 'ivory37goku.github.io';
const HOSTED_PREFIX = '/ivory37-control-laboral/';
const HOSTED_URL = 'https://' + HOSTED_HOST + HOSTED_PREFIX;

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

// Mantiene la carpeta de datos de usuario estable entre las actualizaciones.
app.setPath('userData', path.join(app.getPath('appData'), APP_DATA_DIR));

const appRoot = app.getAppPath();
const indexPath = path.resolve(appRoot, 'index.html');
const iconPath = path.resolve(appRoot, 'desktop', 'assets', 'icon.ico');
const userDataPath = app.getPath('userData');
const storageShadowPath = path.join(userDataPath, 'web-storage-shadow.json');
const hostedBootstrapPath = path.join(userDataPath, 'hosted-app-enabled');

function isHostedApp(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === HOSTED_HOST && url.pathname.startsWith(HOSTED_PREFIX);
  } catch (_) { return false; }
}

function isLocalApp(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'file:' && path.resolve(fileURLToPath(url)) === indexPath;
  } catch (_) { return false; }
}

function isTrustedAppDocument(value) { return isHostedApp(value) || isLocalApp(value); }

function readStorageShadow() {
  try {
    const raw = fs.readFileSync(storageShadowPath, 'utf8');
    return raw.length <= 12 * 1024 * 1024 ? raw : '';
  } catch (_) { return ''; }
}

async function writeStorageShadow(raw) {
  if (typeof raw !== 'string' || raw.length > 12 * 1024 * 1024) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    await fsp.mkdir(userDataPath, { recursive: true });
    const tempPath = storageShadowPath + '.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(36).slice(2) + '.tmp';
    await fsp.writeFile(tempPath, raw, 'utf8');
    await fsp.rename(tempPath, storageShadowPath);
  } catch (_) {}
}

ipcMain.on('ivory37:read-storage-shadow', (event) => {
  event.returnValue = isTrustedAppDocument(event.senderFrame?.url || '') ? readStorageShadow() : '';
});

ipcMain.on('ivory37:write-storage-shadow', (event, raw) => {
  if (isTrustedAppDocument(event.senderFrame?.url || '')) void writeStorageShadow(raw);
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
    if (/^https:\/\//i.test(url) && !isHostedApp(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, destination) => {
    if (isLocalApp(destination) || isHostedApp(destination)) return;
    event.preventDefault();
    if (/^https:\/\//i.test(destination)) void shell.openExternal(destination);
  });

  let localStateCaptured = fs.existsSync(hostedBootstrapPath);
  let hostedFallbackStarted = false;
  let localCaptureStarted = false;

  window.webContents.on('did-finish-load', async () => {
    const currentUrl = window.webContents.getURL();
    if (localStateCaptured || localCaptureStarted || !isLocalApp(currentUrl)) return;
    localCaptureStarted = true;
    try {
      const raw = await window.webContents.executeJavaScript(
        "JSON.stringify((function(){var s={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k)s[k]=localStorage.getItem(k)}return s})())"
      );
      await writeStorageShadow(raw);
      await fsp.mkdir(userDataPath, { recursive: true });
      await fsp.writeFile(hostedBootstrapPath, 'enabled', 'utf8');
      localStateCaptured = true;
      await window.loadURL(HOSTED_URL);
    } catch (_) {
      // Si la primera migración no puede terminar, conserva abierta la copia local.
      localCaptureStarted = false;
    }
  });

  window.webContents.on('did-fail-load', (_event, _code, _description, failedUrl, isMainFrame) => {
    if (!isMainFrame || !isHostedApp(failedUrl) || hostedFallbackStarted) return;
    hostedFallbackStarted = true;
    void window.loadURL(localAppUrl(true));
  });

  if (localStateCaptured) window.loadURL(HOSTED_URL);
  else window.loadURL(localAppUrl(false));
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
