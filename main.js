const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f6f7f9',
    frame: false,               // custom titlebar
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Keep renderer simple: open devtools only if env var set
  if (process.env.UBM_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Chrome-like devtools toggles
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;
    const key = String(input.key || '').toLowerCase();
    const ctrlOrCmd = !!(input.control || input.meta);

    // F12 => toggle devtools
    if (key === 'f12') {
      if (mainWindow.webContents.isDevToolsOpened()) mainWindow.webContents.closeDevTools();
      else mainWindow.webContents.openDevTools({ mode: 'detach' });
      return;
    }

    // Ctrl/Cmd + Shift + I => open devtools
    if (ctrlOrCmd && input.shift && key === 'i') {
      if (!mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// ---- Window controls ----
ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:close', () => mainWindow?.close());
ipcMain.handle('win:toggleMaximize', () => {
  if (!mainWindow) return { maximized: false };
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return { maximized: mainWindow.isMaximized() };
});
ipcMain.handle('win:isMaximized', () => ({ maximized: !!mainWindow?.isMaximized() }));

// ---- Assets / data loading ----
ipcMain.handle('asset:readText', async (_evt, relPath) => {
  const safeRel = String(relPath || '').replace(/\\/g, '/');
  if (!safeRel || safeRel.includes('..')) throw new Error('Invalid path');
  const abs = path.join(__dirname, safeRel);
  if (!abs.startsWith(__dirname)) throw new Error('Invalid path');
  return fs.readFileSync(abs, 'utf-8');
});

// ---- PDF / Print helpers (from HTML) ----
async function renderHtmlToPdfBuffer(html, { landscape = false } = {}) {
  const win = new BrowserWindow({
    show: false,
    width: landscape ? 1400 : 1000,
    height: 900,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(String(html || ''));
  await win.loadURL(dataUrl);
  await new Promise(r => setTimeout(r, 200));

  const buf = await win.webContents.printToPDF({
    pageSize: 'A4',
    landscape: !!landscape,
    printBackground: true,
    marginsType: 1,
  });

  win.destroy();
  return buf;
}

ipcMain.handle('pdf:saveFromHtml', async (_evt, payload) => {
  const html = String(payload?.html || '');
  const landscape = !!payload?.landscape;
  const defaultPath = String(payload?.defaultPath || 'invoice.pdf');

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Invoice PDF',
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  const buf = await renderHtmlToPdfBuffer(html, { landscape });
  fs.writeFileSync(filePath, buf);
  return { canceled: false, filePath };
});

ipcMain.handle('print:fromHtml', async (_evt, payload) => {
  const html = String(payload?.html || '');
  const landscape = !!payload?.landscape;

  const win = new BrowserWindow({
    show: true,
    width: landscape ? 1400 : 1000,
    height: 900,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(String(html || ''));
  await win.loadURL(dataUrl);
  await new Promise(r => setTimeout(r, 200));

  win.webContents.print({
    silent: false,
    printBackground: true,
    landscape: !!landscape,
  }, () => {
    setTimeout(() => {
      try { win.close(); } catch {}
    }, 500);
  });

  return { ok: true };
});
