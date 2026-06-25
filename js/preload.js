// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// APIs expostas para o frontend (renderer process)
contextBridge.exposeInMainWorld('electronAPI', {
  startUpdateChecker: () => ipcRenderer.invoke('start-update-checker'),

  // Opcional: parar verificação
  stopUpdateChecker: () => ipcRenderer.invoke('stop-update-checker'),
  // Obtém a versão atual do app
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Navegação entre telas
  navigateToLogin: () => ipcRenderer.send('navigate-to-login'),
  navigateToHome: () => ipcRenderer.send('navigate-to-home'),
  home: () => ipcRenderer.send('home'),
  navigateToSinalizadores: () => { ipcRenderer.send('navigate-to-sinalizadores'); },

  // Verifica atualizações (manual)
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),

  // Força verificação
  forceCheckUpdates: () => ipcRenderer.send('force-check-updates'),

  // Bot Management
  botCreate: (botData) => ipcRenderer.invoke('bot:create', botData),
  botList: () => ipcRenderer.invoke('bot:list'),
  botStart: (botId) => ipcRenderer.invoke('bot:start', botId),
  botStop: (botId) => ipcRenderer.invoke('bot:stop', botId),
  botDelete: (botId) => ipcRenderer.invoke('bot:delete', botId),
  botGetQrCode: (botId) => ipcRenderer.invoke('bot:getQrCode', botId),
  botRemoverSinalizador: (botId, numero, sinalizador) => ipcRenderer.invoke('bot:remover-sinalizador', botId, numero, sinalizador),
  botUpdate: (botId, data) => ipcRenderer.invoke('bot:update', botId, data),
  botGetData: (botId) => ipcRenderer.invoke('bot:get-data', botId),
  botUpdateSinalizadoresOrdem: async (botId, ordem) => { return await ipcRenderer.invoke('bot:update-sinalizadores-ordem', botId, ordem); },

  // Event listeners para bots
  onBotStatusUpdate: (callback) => {
    ipcRenderer.on('bot:status-update', callback);
  },
  onBotQrCode: (callback) => {
    ipcRenderer.on('bot:qr-code', callback);
  },
  onClienteSinalizado: (callback) => {
    ipcRenderer.on('bot:cliente-sinalizado', callback);
  },

  // Remove todos os listeners (opcional)
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('update-status');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('no-update-available');
    ipcRenderer.removeAllListeners('update-error');
    ipcRenderer.removeAllListeners('bot:status-update');
    ipcRenderer.removeAllListeners('bot:qr-code');
  }
});


window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Preload carregado - APIs disponíveis');
});

process.on('uncaughtException', (error) => {
  console.error('❌ Erro não tratado no preload:', error);
});