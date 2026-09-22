const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');

// Prevenir cualquier cuadro de diálogo de error nativo de Windows en la versión de escritorio
dialog.showErrorBox = (title, content) => {
  console.error(`[Nuvexa Desktop - Cuadro Nativo Suprimido] ${title}: ${content}`);
};

// Evitar que excepciones no controladas generen ventanas emergentes de Windows
process.on('uncaughtException', (err) => {
  console.error('[Nuvexa Desktop uncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Nuvexa Desktop unhandledRejection]', reason);
});

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../build/icon.png');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    title: 'Nuvexa - Herramientas Digitales Privadas',
    icon: iconPath,
    backgroundColor: '#F8FAFC',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  // Quitar menú nativo básico para look limpio y moderno
  Menu.setApplicationMenu(null);

  // Abrir en pantalla completa (maximizada) inmediatamente cuando el contenido esté listo
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    if (isDev) {
      // mainWindow.webContents.openDevTools();
    }
  });

  // Permitir alternar pantalla completa total con F11
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  // Abrir enlaces externos (como Instagram) en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Permitir automáticamente el acceso al micrófono para grabación y dictado de voz
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(true);
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
