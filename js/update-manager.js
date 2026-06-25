// update-manager.js
const { BrowserWindow, ipcMain, app } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const log = require('electron-log');

class UpdateManager {
  constructor() {
    this.updateWindow = null;
    this.updateInfo = null;
    this.downloadedInstallerPath = null;
    this.mainWindow = null;
    this.checkInterval = null;
    
    // Configurar logging
    log.transports.file.level = 'debug';
    log.transports.console.level = 'debug';
  }

  // Inicializa o gerenciador de atualizações
  initialize(mainWindow, checkOnStart = true, intervalHours = 1) {
    this.mainWindow = mainWindow;
    
    // Registra os handlers IPC
    this.registerIpcHandlers();
    
    // Verifica atualizações ao iniciar
    if (checkOnStart) {
      setTimeout(() => {
        this.checkForUpdates();
      }, 5000);
    }
    
    // Configura verificação periódica
    if (intervalHours > 0) {
      this.checkInterval = setInterval(() => {
        this.checkForUpdates();
      }, intervalHours * 3600000);
    }
    
    log.info('✅ Update Manager inicializado');
  }

  // Registra todos os handlers IPC
  registerIpcHandlers() {
    ipcMain.on('check-for-updates', async () => {
      await this.checkForUpdates();
    });

    ipcMain.on('force-check-updates', async () => {
      await this.checkForUpdates(true);
    });

    ipcMain.on('download-update', async () => {
      await this.downloadUpdate();
    });

    ipcMain.on('install-update', async () => {
      await this.installUpdate();
    });

    ipcMain.on('close-update-window', () => {
      this.closeUpdateWindow();
    });
  }

  // Cria janela flutuante de atualização
  createUpdateWindow(updateData) {
    if (this.updateWindow && !this.updateWindow.isDestroyed()) {
      this.updateWindow.focus();
      return;
    }

    this.updateWindow = new BrowserWindow({
      width: 520,
      height: 580,
      minWidth: 480,
      minHeight: 500,
      resizable: true,
      maximizable: true,
      minimizable: true,
      closable: true,
      frame: false,
      parent: this.mainWindow,
      modal: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-update.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.updateWindow.loadFile('update-window.html');
    
    this.updateWindow.once('ready-to-show', () => {
      this.updateWindow.show();
      this.updateWindow.webContents.send('update-window-data', updateData);
    });

    this.updateWindow.on('closed', () => {
      this.updateWindow = null;
    });
  }

  // Fecha janela de atualização
  closeUpdateWindow() {
    if (this.updateWindow && !this.updateWindow.isDestroyed()) {
      this.updateWindow.close();
      this.updateWindow = null;
    }
  }

  // Busca a última versão do GitHub
  async getLatestRelease() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/Harrisontorquato/hourglass/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'Electron-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve(release);
            } else {
              reject(new Error(`API Error ${res.statusCode}: ${release.message || 'Unknown'}`));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  // Baixa o arquivo do instalador
  async downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      
      const makeRequest = (requestUrl, redirectCount = 0) => {
        const maxRedirects = 5;
        if (redirectCount > maxRedirects) {
          reject(new Error('Muitos redirecionamentos'));
          return;
        }

        const options = {
          headers: {
            'User-Agent': 'Electron-App',
            'Accept': '*/*'
          }
        };

        const request = https.get(requestUrl, options, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301 || 
              response.statusCode === 307 || response.statusCode === 308) {
            const redirectUrl = response.headers.location;
            log.info(`↪️ Redirecionando para: ${redirectUrl}`);
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            return;
          }
          
          const totalSize = parseInt(response.headers['content-length'], 10);
          let downloadedSize = 0;

          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (onProgress && totalSize) {
              const percent = (downloadedSize / totalSize) * 100;
              onProgress(percent);
            }
            file.write(chunk);
          });

          response.on('end', () => {
            file.end();
            resolve();
          });

          response.on('error', reject);
        });
        
        request.on('error', reject);
        request.end();
      };

      makeRequest(url);
    });
  }

  // Verifica por atualizações
  async checkForUpdates(force = false) {
    log.info('🔍 Verificando atualizações via GitHub API...');
    
    try {
      const release = await this.getLatestRelease();
      const currentVersion = app.getVersion();
      const latestVersion = release.tag_name.replace('v', '');
      
      log.info(`Versão atual: ${currentVersion}, Última versão: ${latestVersion}`);
      
      if (latestVersion !== currentVersion || force) {
        this.updateInfo = {
          version: latestVersion,
          releaseNotes: release.body || 'Sem notas de release',
          downloadUrl: null,
          publishedAt: release.published_at,
          assetName: null
        };
        
        // Procura o instalador Windows nos assets
        const windowsAsset = release.assets.find(asset => 
          asset.name.endsWith('.exe') && (asset.name.includes('Setup') || asset.name.includes('Installer'))
        );
        
        if (windowsAsset) {
          this.updateInfo.downloadUrl = windowsAsset.browser_download_url;
          this.updateInfo.assetName = windowsAsset.name;
          this.updateInfo.assetSize = windowsAsset.size;
          
          log.info(`✅ Nova versão disponível: ${latestVersion}!`);
          
          // Abre a janela flutuante
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.createUpdateWindow(this.updateInfo);
          }
        } else {
          log.warn('Nenhum instalador Windows (.exe) encontrado no release.');
        }
      } else {
        log.info('✅ Você já está na versão mais recente.');
      }
    } catch (error) {
      log.error('Erro ao buscar atualizações:', error);
    }
  }

  // Download da atualização
  async downloadUpdate() {
    if (!this.updateInfo || !this.updateInfo.downloadUrl) {
      log.error('❌ Nenhuma atualização disponível para download.');
      if (this.updateWindow && !this.updateWindow.isDestroyed()) {
        this.updateWindow.webContents.send('update-error', { message: 'Nenhuma atualização disponível' });
      }
      return;
    }
    
    const downloadPath = path.join(app.getPath('temp'), `${this.updateInfo.assetName || `setup-${this.updateInfo.version}.exe`}`);
    this.downloadedInstallerPath = downloadPath;
    
    log.info(`📥 Iniciando download: ${this.updateInfo.assetName || 'instalador'}`);
    
    try {
      await this.downloadFile(this.updateInfo.downloadUrl, downloadPath, (percent) => {
        log.info(`📊 Download: ${percent.toFixed(2)}%`);
        if (this.updateWindow && !this.updateWindow.isDestroyed()) {
          this.updateWindow.webContents.send('update-progress', { percent });
        }
      });
      
      log.info('✅ Download concluído!');
      if (this.updateWindow && !this.updateWindow.isDestroyed()) {
        this.updateWindow.webContents.send('update-completed');
      }
      setTimeout(() => {
        this.installUpdate();
      }, 1500);
    } catch (error) {
      log.error('Erro no download:', error);
      if (this.updateWindow && !this.updateWindow.isDestroyed()) {
        this.updateWindow.webContents.send('update-error', { message: error.message });
      }
    }
  }

// Instala a atualização (CORRIGIDO PARA WINDOWS)
async installUpdate() {
    if (!this.downloadedInstallerPath || !fs.existsSync(this.downloadedInstallerPath)) {
        log.error('❌ Instalador não encontrado.');
        if (this.updateWindow && !this.updateWindow.isDestroyed()) {
            this.updateWindow.webContents.send('update-error', { message: 'Instalador não encontrado' });
        }
        return;
    }

    log.info('🚀 Iniciando instalador...');
    log.info(`📁 Caminho: ${this.downloadedInstallerPath}`);

    try {
        // 🔥 SOLUÇÃO CORRETA PARA WINDOWS
        // Usa 'start' para criar um processo COMPLETAMENTE independente
        const command = `cmd.exe /c start "" "${this.downloadedInstallerPath}"`;
        
        log.info(`📟 Comando: ${command}`);
        
        const child = exec(command, {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
            shell: 'cmd.exe'
        });

        // Desvincula completamente o processo filho
        child.unref();
        
        // Aguarda um momento para o comando 'start' ser processado
        setTimeout(() => {
            log.info('✅ Instalador deveria estar rodando. Fechando app...');
            app.quit();
        }, 2000);
        
    } catch (error) {
        log.error(`❌ Erro ao iniciar instalador: ${error.message}`);
        if (this.updateWindow && !this.updateWindow.isDestroyed()) {
            this.updateWindow.webContents.send('update-error', { message: error.message });
        }
    }
}

  // Para o intervalo de verificações
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log.info('⏹️ Verificações periódicas paradas');
    }
  }

  // Limpa recursos ao fechar
  cleanup() {
    this.stopPeriodicCheck();
    this.closeUpdateWindow();
    log.info('🧹 Update Manager limpado');
  }
}

module.exports = UpdateManager;