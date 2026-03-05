/* ──────────────────────────────────────────────────────────────────────
   GeoFilter Widget — Electron Main Process
   Netgear Nighthawk / DumaOS 실행형 위젯
   ────────────────────────────────────────────────────────────────────── */

'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    frame: false,               // 커스텀 타이틀바 사용
    backgroundColor: '#0d0f14', // 로드 전 배경색
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    title: 'GeoFilter Widget — DumaOS',
    show: false,                // ready-to-show 후 표시
  });

  win.loadFile('index.html');

  // 렌더링 완료 후 표시 (흰 화면 방지)
  win.once('ready-to-show', () => {
    win.show();
  });

  // ─── IPC 핸들러: 윈도우 컨트롤 ─────────────────────────────────────
  ipcMain.on('win:minimize', () => win.minimize());

  ipcMain.on('win:maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.on('win:close', () => win.close());

  ipcMain.on('win:pin', (_, pinned) => {
    win.setAlwaysOnTop(pinned, 'screen-saver');
  });

  ipcMain.handle('win:isMaximized', () => win.isMaximized());
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
