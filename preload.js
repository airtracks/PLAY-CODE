/* ──────────────────────────────────────────────────────────────────────
   GeoFilter Widget — Preload / Context Bridge
   ────────────────────────────────────────────────────────────────────── */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron:  true,
  minimize:    () => ipcRenderer.send('win:minimize'),
  maximize:    () => ipcRenderer.send('win:maximize'),
  close:       () => ipcRenderer.send('win:close'),
  pin:         (v) => ipcRenderer.send('win:pin', v),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
});
