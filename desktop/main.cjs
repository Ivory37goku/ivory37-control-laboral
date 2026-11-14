const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const APP_ID = 'com.ivory37.controllaboral.desktop';
const APP_NAME = 'IVORY37 Control Laboral';

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

// Mantiene los datos de esta versión en una carpeta propia de Windows,
// separada de Chrome, GitHub Pages y la APK de Android.
app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));

const appRoot = app.getAppPath();
const indexPath = path.resolve(appRoot, 'index.html');
const iconPath = path.resolve(appRoot, 'desktop', 'assets', 'icon.ico');

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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, destination) => {
    try {
      const requested = new URL(destination);
      const requestedPath = requested.protocol === 'file:'
        ? path.resolve(fileURLToPath(requested))
        : '';
      if (requestedPath !== indexPath) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });

  window.loadURL(pathToFileURL(indexPath).href);
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
