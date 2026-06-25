// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const UpdateManager = require('./update-manager');
const BotManager = require('./bot-manager');

let mainWindow;
let updateManager;
let botManager;

// 🔧 FIX: Configurar crypto para o Electron
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Forçar o uso do crypto do Node
global.crypto = require('crypto');

// 🔥 FIX EBADF: capturar erros não tratados no processo principal
//    O Baileys/pino pode emitir EBADF ao fechar o socket — não é fatal,
//    então apenas logamos e deixamos o processo continuar normalmente.
process.on('uncaughtException', (error) => {
  if (error.code === 'EBADF' || (error.message && error.message.includes('EBADF'))) {
    console.warn('⚠️ [main] EBADF ignorado (stream do pino já fechado):', error.message);
    return; // não propagar — evita o popup de erro do Electron
  }
  // Outros erros não tratados: logar e deixar o Electron mostrar o diálogo normalmente
  console.error('❌ [main] Uncaught Exception:', error);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    maximizable: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove o menu da janela (File, Edit, View, etc.)
  mainWindow.setMenuBarVisibility(false);

  // Inicia com a tela de login
  mainWindow.loadFile('carregamento.html');

  // Abrir DevTools em desenvolvimento (opcional)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 🔥 FIX: usar 'close' (não 'closed') para aguardar cleanup assíncrono antes de fechar.
  //    e.preventDefault() impede o fechamento imediato.
  //    Só depois do await é que mainWindow.destroy() é chamado.
  //    O evento 'closed' foi REMOVIDO — ele causava cleanup duplo após o destroy.
  mainWindow.on('close', async (e) => {
    e.preventDefault();
    console.log('🔒 Janela fechando — aguardando cleanup dos bots...');
    try {
      if (updateManager) {
        updateManager.cleanup();
      }
      if (botManager) {
        await botManager.cleanup();
      }
    } catch (err) {
      console.error('❌ Erro durante cleanup:', err);
    } finally {
      console.log('✅ Cleanup concluído — fechando janela');
      mainWindow.destroy();
    }
  });
}

// Navegação entre telas
function navigateToLogin() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('Navegando para login');
    mainWindow.loadFile('index.html');
  }
}

// Adicione esta função junto com as outras navegações
function navigateToSinalizadores() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('Navegando para sinalizadores');
    mainWindow.loadFile('sinalizadores.html');
  }
}

function navigateToHome() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('Navegando para home');
    mainWindow.loadFile('carregamento.html');
  }
}
function home() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile('home.html');
  }
}

// Inicializa o BotManager com o caminho correto
function initializeBotManager() {
  try {
    let basePath;

    if (app.isPackaged) {
      // Em produção: C:\Users\"usuario"\AppData\Local\Programs\hourglass\bots
      const executionPath = path.dirname(app.getPath('exe'));
      basePath = path.join(executionPath, 'bots');
    } else {
      // Em desenvolvimento: pasta local
      basePath = path.join(__dirname, 'bots_data');
    }

    // Cria a pasta se não existir
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
      console.log('📁 Pasta de bots criada em:', basePath);
    }

    console.log('🤖 Inicializando BotManager em:', basePath);
    botManager = new BotManager(basePath, mainWindow);
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar BotManager:', error);
    return false;
  }
}
app.whenReady().then(() => {
  createWindow();
  initializeBotManager(); // só isso

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 🔥 FIX: cleanup já foi feito no evento 'close' — apenas chama app.quit() aqui.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handlers IPC existentes
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('navigate-to-sinalizadores', () => {
  navigateToSinalizadores();
});

ipcMain.on('navigate-to-login', () => {
  navigateToLogin();
});

ipcMain.on('navigate-to-home', () => {
  navigateToHome();
});

ipcMain.on('home', () => {
  home();
});

// Handlers IPC para bots
ipcMain.handle('bot:create', async (event, botData) => {
  try {
    return await botManager.createBot(botData);
  } catch (error) {
    console.error('Erro ao criar bot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bot:getData', async (event, botId) => {
  try {
    if (!botManager) {
      return { success: false, error: 'BotManager não inicializado' };
    }
    const botData = await botManager.getBotData(botId);
    return { success: true, bot: botData };
  } catch (error) {
    console.error('Erro ao obter dados do bot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bot:start', async (event, botId) => {
  try {
    return await botManager.startBot(botId);
  } catch (error) {
    console.error('Erro ao iniciar bot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bot:remover-sinalizador', async (event, botId, numero, sinalizador) => {
    return await botManager.removerSinalizadorCliente(botId, numero, sinalizador);
});

ipcMain.handle('bot:stop', async (event, botId) => {
  try {
    return await botManager.stopBot(botId);
  } catch (error) {
    console.error('Erro ao parar bot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bot:delete', async (event, botId) => {
  try {
    return await botManager.deleteBot(botId);
  } catch (error) {
    console.error('Erro ao deletar bot:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bot:getQrCode', async (event, botId) => {
  try {
    return await botManager.getQrCode(botId);
  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('bot:list', async () => {
  try {
    return await botManager.listBots();
  } catch (error) {
    console.error('Erro ao listar bots:', error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('bot:update', async (event, botId, data) => {
    return await botManager.updateBot(botId, data);
});

ipcMain.handle('bot:get-data', async (event, botId) => {
    return await botManager.getBotData(botId);
});
ipcMain.handle('bot:update-sinalizadores-ordem', async (event, botId, ordem) => {
    return await botManager.updateSinalizadoresOrdem(botId, ordem);
});
ipcMain.handle('start-update-checker', async () => {
  if (!updateManager) {
    updateManager = new UpdateManager();
    updateManager.initialize(mainWindow, true, 1);
    console.log('✅ Update Manager iniciado a partir do home');
    return { success: true };
  }
  return { success: false, message: 'Update Manager já está rodando' };
});

// Handler para parar verificações (opcional)
ipcMain.handle('stop-update-checker', () => {
  if (updateManager) {
    updateManager.stopPeriodicCheck();
    console.log('⏹️ Update Manager parado');
  }
});