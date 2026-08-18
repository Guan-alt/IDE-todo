const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  confirmNotes: (notes) => ipcRenderer.invoke("quick-add:confirm", notes),
  skipNotes: () => ipcRenderer.invoke("quick-add:skip"),
});
