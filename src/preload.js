const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onForceUpdate: (cb) => ipcRenderer.on("force-update-required", (_e, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on("update-progress", (_e, p) => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", (_e, info) => cb(info)),
  onUpdateMessage: (cb) => ipcRenderer.on("update-message", (_e, msg) => cb(msg)),
});
