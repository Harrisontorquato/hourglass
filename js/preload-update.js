// preload-update.js
const { contextBridge, ipcRenderer } = require('electron');

// APIs específicas para a janela de atualização
contextBridge.exposeInMainWorld('electronAPI', {
  // Recebe dados da atualização
  onUpdateWindowData: (callback) => {
    ipcRenderer.on('update-window-data', (event, data) => callback(data));
  },
  
  // Download
  downloadUpdate: () => ipcRenderer.send('download-update'),
  
  // Instalar
  installUpdate: () => ipcRenderer.send('install-update'),
  
  // Fechar janela
  closeUpdateWindow: () => ipcRenderer.send('close-update-window'),
  
  // Progresso do download
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  },
  
  // Download concluído
  onUpdateCompleted: (callback) => {
    ipcRenderer.on('update-completed', () => callback());
  },
  
  // Erro
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => callback(error));
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Preload da janela de atualização carregado');
});