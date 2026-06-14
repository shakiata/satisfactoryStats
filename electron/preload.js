const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ngrok tunnel
  tunnelStart: (host, port, authtoken) =>
    ipcRenderer.invoke("tunnel:start", host, port, authtoken),
  tunnelStop: () => ipcRenderer.invoke("tunnel:stop"),
  tunnelStatus: () => ipcRenderer.invoke("tunnel:status"),
  onTunnelError: (callback) =>
    ipcRenderer.on("tunnel:error", (_event, msg) => callback(msg)),
});
