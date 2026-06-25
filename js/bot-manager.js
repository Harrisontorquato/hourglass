// bot-manager.js (VERSÃO COMPLETA CORRIGIDA)
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const QRCode = require('qrcode');

console.log('🔵 [MANAGER] Arquivo bot-manager.js carregado');

// 🔧 Garantir que o crypto está disponível
if (!global.crypto) {
  global.crypto = require('crypto');
  console.log('✅ Crypto inicializado');
}

// Importação do baileys
let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion;

try {
  console.log('🔵 [MANAGER] Tentando importar baileys...');
  const baileys = require('baileys');
  console.log('✅ Baileys carregado');

  makeWASocket = baileys.default;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  Browsers = baileys.Browsers;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;

  console.log('✅ Funções carregadas');
} catch (error) {
  console.error('🔴 ERRO AO IMPORTAR BAILEYS:', error);
}

// ==================== CLASSE BOT INSTANCE ====================
class BotInstance extends EventEmitter {
  constructor(config, sessionsBasePath, manager) {
    super();
    console.log(`🔵 [INSTANCE] Construtor: ${config.name}`);
    this.config = config;
    this.sessionPath = path.join(sessionsBasePath, config.id);
    this.manager = manager;
    this.sock = null;
    this.status = 'stopped';
    this.currentQr = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.stopped = false;

    // Cache para sinalizador 'primeira_mensagem_do_dia'
    this.ultimasMensagens = new Map();

    // Cache para sinalizador 'primeira_mensagem_do_dia' (modo padrão - 2 horas)
    this.clientesRespondidos = new Map();

    // Maps EXCLUSIVOS do applyRules para controle de envio da firstMessage
    // Separados dos Maps acima para evitar conflito com identificarSinalizadorPelaMensagem
    this.ultimasMensagensEnviadas = new Map();
    this.clientesRespondidosEnvio = new Map();

    // Carregar dados persistidos
    this.carregarDadosPersistidos();
  }

  // Método para carregar dados do JSON
carregarDadosPersistidos() {
    const clientes = this.config.clientes || {};
    for (const [numero, dados] of Object.entries(clientes)) {
        // Carregar última mensagem para modo diário (RAM)
        if (dados.ultimaFirstMessageDiario) {
            this.ultimasMensagens.set(numero, new Date(dados.ultimaFirstMessageDiario));
        }
        
        // 🔥 FIX: Carregar para AMBOS os Maps
        // Para identificarSinalizadorPelaMensagem
        if (dados.ultimaInteracaoFirstMsg) {
            this.clientesRespondidos.set(numero, new Date(dados.ultimaInteracaoFirstMsg));
        }
        
        // 🔥 NOVO: Para applyRules - garantir que o modo padrão persista
        if (dados.ultimaInteracaoFirstMsg) {
            this.clientesRespondidosEnvio.set(numero, new Date(dados.ultimaInteracaoFirstMsg));
        }
    }
    console.log(`📋 [INSTANCE] Carregados: ${this.ultimasMensagens.size} clientes (modo diário), ${this.clientesRespondidos.size} clientes (modo padrão 2h - sinalizador), ${this.clientesRespondidosEnvio.size} clientes (modo padrão 2h - envio)`);
}

  async start() {
    console.log(`🚀 [INSTANCE] Iniciando: ${this.config.name}`);

    if (this.stopped) {
      console.log('⏹ [INSTANCE] Bot foi parado manualmente, ignorando start.');
      return;
    }

    if (this.isConnecting) {
      console.log('⚠️ [INSTANCE] Já está conectando, ignorando...');
      return;
    }

    if (!makeWASocket || !useMultiFileAuthState) {
      console.error('❌ [INSTANCE] Baileys não disponível');
      this.status = 'error';
      this.emit('status', 'error', 'Baileys não disponível');
      return;
    }

    try {
      this.isConnecting = true;
      this.status = 'connecting';
      this.emit('status', 'connecting');

      console.log(`📁 [INSTANCE] Sessão: ${this.sessionPath}`);

      // Garantir que a pasta da sessão existe
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

      // Buscar versão atual do WhatsApp automaticamente
      let waVersion;
      try {
        const { version } = await fetchLatestBaileysVersion();
        waVersion = version;
        console.log(`✅ [INSTANCE] Versão WA obtida: ${version.join('.')}`);
      } catch (vErr) {
        console.warn('⚠️ [INSTANCE] Não foi possível buscar versão WA, usando fallback:', vErr.message);
        waVersion = [2, 3000, 1015901307];
      }

      // Logger silencioso para evitar EBADF
      const noop = () => { };
      const silentLogger = {
        level: 'silent',
        trace: noop, debug: noop, info: noop,
        warn: noop, error: noop, fatal: noop,
        child: () => silentLogger,
      };

      this.sock = makeWASocket({
        auth: state,
        version: waVersion,
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        patchMessageBeforeSending: (message) => message,
        defaultQueryTimeoutMs: undefined,
        retryRequestDelayMs: 3000,
        logger: silentLogger,
        shouldReconnect: () => false,
      });

      // EVENTO DE CONEXÃO
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log(`🔄 [INSTANCE] Update - Connection: ${connection}, QR: ${!!qr}`);

        // CAPTURAR QR
        if (qr) {
          console.log(`📱 [INSTANCE] QR Code recebido! Tamanho: ${qr.length}`);
          try {
            const qrDataURL = await QRCode.toDataURL(qr);
            this.currentQr = qrDataURL;
            this.emit('qr', qrDataURL);
            console.log(`✅ [INSTANCE] QR Code enviado ao frontend`);
            this.reconnectAttempts = 0;
          } catch (qrError) {
            console.error('[INSTANCE] Erro ao gerar QR:', qrError);
            this.emit('qr', qr);
          }
        }

        // CONEXÃO FECHADA
        if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          console.log(`⚠️ [INSTANCE] Conexão fechada. Logout: ${loggedOut}, StatusCode: ${statusCode}`);

          if (this.stopped) {
            console.log('⏹ [INSTANCE] Parado manualmente, sem reconexão.');
            return;
          }

          if (loggedOut) {
            console.log(`🚪 [INSTANCE] Deslogado permanentemente - limpando sessão`);
            this.status = 'stopped';
            this.currentQr = null;
            this.emit('status', 'stopped', 'Desconectado permanentemente');
            this._clearSession();
            return;
          }

          if (statusCode === 405) {
            this.reconnectAttempts++;
            if (this.reconnectAttempts > 3) {
              this.status = 'error';
              this.emit('status', 'error', 'Tente novamente em alguns minutos.');
              return;
            }
            const delay = 15000 * this.reconnectAttempts;
            setTimeout(() => {
              if (!this.stopped) this.start().catch(console.error);
            }, delay);
            return;
          }

          // Outros erros — reconexão com backoff exponencial
          this.reconnectAttempts++;
          const maxAttempts = 10;

          if (this.reconnectAttempts > maxAttempts) {
            console.log(`❌ [INSTANCE] Máximo de tentativas (${maxAttempts}) atingido. Parando.`);
            this.status = 'error';
            this.emit('status', 'error', 'Não foi possível conectar após várias tentativas.');
            return;
          }

          const delay = Math.min(5000 * Math.pow(1.5, this.reconnectAttempts), 60000);
          console.log(`🔄 [INSTANCE] Reconexão em ${(delay / 1000).toFixed(0)}s (tentativa ${this.reconnectAttempts}/${maxAttempts})`);
          setTimeout(() => {
            if (!this.stopped) this.start().catch(console.error);
          }, delay);
        }

        // CONEXÃO ESTABELECIDA
        if (connection === 'open') {
          this.isConnecting = false;
          this.status = 'connected';
          this.currentQr = null;
          this.reconnectAttempts = 0;
          this.emit('status', 'connected', 'Conectado com sucesso!');
          console.log(`✅✅✅ [INSTANCE] ${this.config.name} CONECTADO! ✅✅✅`);
        }

        if (connection === 'connecting') {
          console.log(`🟡 [INSTANCE] Conectando ao WhatsApp...`);
        }
      });

      // Salvar credenciais quando atualizadas
      this.sock.ev.on('creds.update', () => {
        if (!this.stopped) {
          console.log(`💾 [INSTANCE] Credenciais atualizadas e salvas`);
          saveCreds();
        }
      });

      // Processar mensagens recebidas
      this.sock.ev.on('messages.upsert', async (messageUpdate) => {
        await this.handleMessage(messageUpdate);
      });

      // Tratar erros da conexão
      this.sock.ev.on('error', (error) => {
        console.error(`⚠️ [INSTANCE] Erro na conexão:`, error.message);
      });

    } catch (error) {
      console.error(`❌ [INSTANCE] ERRO FATAL:`, error);
      this.isConnecting = false;
      this.status = 'error';
      this.emit('status', 'error', error.message);
    }
  }

  // Limpa a pasta de sessão corrompida
  _clearSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
        fs.mkdirSync(this.sessionPath, { recursive: true });
        console.log(`🗑 [INSTANCE] Sessão limpa: ${this.sessionPath}`);
      }
    } catch (err) {
      console.error('Erro ao limpar sessão:', err);
    }
  }

  // Processar mensagens recebidas
  async handleMessage(messageUpdate) {
    try {
      const messages = messageUpdate.messages;
      if (!messages || messages.length === 0) return;

      const message = messages[0];
      if (message.key.fromMe) return;

      // 🔥 IGNORAR QUALQUER COISA QUE TENHA "status" no remoteJid
      if (message.key.remoteJid?.includes('status')) {
        console.log(`⏭️ [INSTANCE] Ignorando mensagem de status: ${message.key.remoteJid}`);
        return;
      }

      let text = '';
      if (message.message?.conversation) {
        text = message.message.conversation;
      } else if (message.message?.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      } else if (message.message?.imageMessage?.caption) {
        text = message.message.imageMessage.caption;
      } else if (message.message?.audioMessage) {
        text = '';
      } else {
        return;
      }

      const sender = message.key.remoteJid;
      let senderName = message.pushName || 'Usuário';

      // Tentar buscar o nome do contato via API do WhatsApp
      if (this.sock && this.sock.getContactById) {
        try {
          const contact = await this.sock.getContactById(sender);
          if (contact && contact.name) {
            senderName = contact.name;
            console.log(`📇 Nome do contato encontrado: ${senderName}`);
          }
        } catch (err) {
          console.warn('Não foi possível buscar nome do contato:', err.message);
        }
      }

      console.log(`📨 [${this.config.name}] ${senderName}: ${text.substring(0, 100)}`);

      // IDENTIFICAR SINALIZADOR ANTES de applyRules — evita que o Map de controle
      // (ultimasMensagens / clientesRespondidos) já esteja marcado quando checarmos
      // o gatilho 'primeira_mensagem_do_dia', o que impedia o sinalizador de ser aplicado.
      const sinalizadorAplicado = this.identificarSinalizadorPelaMensagem(text, sender);

      // Aplicar regras e obter resposta
      const response = this.applyRules(text, senderName, sender);

      if (response && this.sock) {
        await this.sock.sendMessage(sender, { text: response });
        console.log(`🤖 [${this.config.name}] Respondeu: ${response.substring(0, 100)}`);
      }

      if (sinalizadorAplicado) {
        // Atualizar o cliente com o novo sinalizador
        await this.atualizarSinalizadorCliente(sender, senderName, sinalizadorAplicado, text);
      }

      // Emitir evento de mensagem recebida
      this.emit('message-received', {
        from: sender,
        fromName: senderName,
        message: text,
        response: response,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`❌ [INSTANCE] Erro mensagem:`, error);
    }
  }

  identificarSinalizadorPelaMensagem(texto, sender) {
    const sinalizadoresConfig = this.config.rules?.sinalizadores || [];

    // Ordenar por prioridade: palavras-chave primeiro, depois primeira msg do dia
    const ordenados = [...sinalizadoresConfig].sort((a, b) => {
      if (a.gatilho === 'palavra_chave' && b.gatilho === 'primeira_mensagem_do_dia') return -1;
      if (a.gatilho === 'primeira_mensagem_do_dia' && b.gatilho === 'palavra_chave') return 1;
      return 0;
    });

    const textoSemAcento = this.removerAcentos(texto.toLowerCase());
    const firstMessageDiario = this.config.rules?.firstMessageDiario === true;

    for (const sinalizador of ordenados) {
      if (sinalizador.gatilho === 'primeira_mensagem_do_dia') {
        if (firstMessageDiario) {
          // 🔥 MODO DIÁRIO: RAM apenas - uma vez por conexão
          const ultimaMsgData = this.ultimasMensagens.get(sender);
          if (!ultimaMsgData) {
            this.ultimasMensagens.set(sender, new Date());
            return sinalizador.label;
          }
        } else {
          // 🔥 MODO PADRÃO: Persistente - uma vez a cada 2 horas
          const ultimaInteracao = this.clientesRespondidos.get(sender);
          const agora = new Date();

          if (!ultimaInteracao || this.passouTempoMinimo(ultimaInteracao, agora, 2)) {
            this.clientesRespondidos.set(sender, agora);
            // Persistir no JSON
            if (this.manager && this.manager.marcarUltimaInteracaoFirstMsg) {
              this.manager.marcarUltimaInteracaoFirstMsg(this.config.id, sender, agora).catch(console.error);
            }
            return sinalizador.label;
          }
        }
      }

      if (sinalizador.gatilho === 'palavra_chave') {
        const palavrasLista = sinalizador.valor.split(',').map(p => this.removerAcentos(p.trim().toLowerCase()));
        const encontrou = palavrasLista.some(palavra => textoSemAcento.includes(palavra));

        if (encontrou) {
          return sinalizador.label;
        }
      }
    }

    return null;
  }

  // Verifica se passou o tempo mínimo (em horas)
  passouTempoMinimo(dataAnterior, dataAtual, horasMinimo = 2) {
    if (!dataAnterior) return true;
    const diffMs = dataAtual - dataAnterior;
    const diffHoras = diffMs / (1000 * 60 * 60);
    return diffHoras >= horasMinimo;
  }

  // Atualizar sinalizador do cliente
  async atualizarSinalizadorCliente(numero, nome, sinalizador, mensagem) {
    try {
      if (this.manager && this.manager.atualizarCliente) {
        await this.manager.atualizarCliente(this.config.id, numero, nome, sinalizador, mensagem);
      } else {
        // Fallback: manipular arquivo diretamente
        const botPath = this.manager ? this.manager.botsConfigPath : path.join(this.sessionPath, '..', '..', 'bots-config.json');

        if (fs.existsSync(botPath)) {
          const config = JSON.parse(fs.readFileSync(botPath, 'utf8'));
          const botConfig = config.bots.find(b => b.id === this.config.id);

          if (botConfig) {
            if (!botConfig.clientes) botConfig.clientes = {};
            if (!botConfig.clientes[numero]) {
              botConfig.clientes[numero] = {
                nome: nome,
                sinalizadores: [],
                historico: [],
                ultimaMensagem: mensagem,
                ultimaInteracao: new Date().toISOString()
              };
            }

            if (!botConfig.clientes[numero].sinalizadores.includes(sinalizador)) {
              botConfig.clientes[numero].sinalizadores.push(sinalizador);
              botConfig.clientes[numero].ultimaMensagem = mensagem;
              botConfig.clientes[numero].ultimaInteracao = new Date().toISOString();

              fs.writeFileSync(botPath, JSON.stringify(config, null, 2));
              console.log(`🏷️ Cliente ${numero} recebeu sinalizador: ${sinalizador}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Erro ao atualizar sinalizador:`, error);
    }
  }

  // Função auxiliar para remover acentos
  removerAcentos(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  applyRules(text, senderName, sender) {
    const rules = this.config.rules;
    if (!rules) return null;

    const lowerText = this.removerAcentos(text.toLowerCase().trim());

    // 1. Palavras-chave (prioridade máxima)
    if (rules.keywords && Object.keys(rules.keywords).length > 0) {
      for (const [keyword, reply] of Object.entries(rules.keywords)) {
        const palavrasLista = keyword.split(',').map(p => this.removerAcentos(p.trim().toLowerCase()));
        const encontrou = palavrasLista.some(palavra => lowerText.includes(palavra));

        if (encontrou) {
          let finalReply = reply;
          finalReply = finalReply.replace(/{nome}/g, senderName);
          finalReply = finalReply.replace(/{bot}/g, this.config.name);
          return finalReply;
        }
      }
    }

    // 2. Verificar configuração do firstMessage
    // applyRules usa Maps PRÓPRIOS (ultimasMensagensEnviadas / clientesRespondidosEnvio)
    // separados dos Maps do identificarSinalizadorPelaMensagem, evitando conflito.
    const firstMessageDiario = this.config.rules?.firstMessageDiario === true;

    let podeEnviar = false;

    if (firstMessageDiario) {
      // 🔥 MODO DIÁRIO: RAM apenas - uma vez por conexão
      if (!this.ultimasMensagensEnviadas) this.ultimasMensagensEnviadas = new Map();
      const ultimoEnvio = this.ultimasMensagensEnviadas.get(sender);
      if (!ultimoEnvio) {
        podeEnviar = true;
        this.ultimasMensagensEnviadas.set(sender, new Date());
      }
    } else {
      // 🔥 MODO PADRÃO: Persistente - uma vez a cada 2 horas
      if (!this.clientesRespondidosEnvio) this.clientesRespondidosEnvio = new Map();
      const ultimaInteracao = this.clientesRespondidosEnvio.get(sender);
      const agora = new Date();

      if (!ultimaInteracao || this.passouTempoMinimo(ultimaInteracao, agora, 2)) {
        podeEnviar = true;
        this.clientesRespondidosEnvio.set(sender, agora);
        if (this.manager && this.manager.marcarUltimaInteracaoFirstMsg) {
          this.manager.marcarUltimaInteracaoFirstMsg(this.config.id, sender, agora).catch(console.error);
        }
      }
    }

    // 3. Enviar firstMessage se puder
    if (podeEnviar && rules.firstMessage && rules.firstMessage.trim() !== '') {
      let finalReply = rules.firstMessage;
      finalReply = finalReply.replace(/{nome}/g, senderName);
      finalReply = finalReply.replace(/{bot}/g, this.config.name);
      return finalReply;
    }

    return null;
  }

  // Parar o bot
  async stop() {
    try {
      this.stopped = true;
      this.isConnecting = false;

      if (this.sock) {
        console.log(`🛑 Parando ${this.config.name}...`);
        this.sock.ev.removeAllListeners();

        try {
          if (this.sock.logger) {
            this.sock.logger.level = 'silent';
          }
        } catch (_) { }

        try {
          this.sock.end(undefined);
        } catch (_) { }

        this.sock = null;
      }

      this.status = 'stopped';
      this.currentQr = null;
      console.log(`⏹ Bot ${this.config.name} parado`);
    } catch (error) {
      console.error(`❌ Erro ao parar:`, error);
      this.status = 'stopped';
    }
  }

  getStatus() { return this.status; }
  getCurrentQr() { return this.currentQr; }
}

// ==================== CLASSE BOT MANAGER ====================
class BotManager extends EventEmitter {
  constructor(basePath, mainWindow) {
    super();
    console.log('🔵 [MANAGER] Construtor');

    this.basePath = basePath;
    this.mainWindow = mainWindow;
    this.botsConfigPath = path.join(basePath, 'bots-config.json');
    this.sessionsPath = path.join(basePath, 'sessions');
    this.bots = new Map();
    this.botsConfig = { bots: [] };

    this.init();
  }

  init() {
    console.log('🔵 [MANAGER] init()');
    try {
      if (!fs.existsSync(this.sessionsPath)) {
        fs.mkdirSync(this.sessionsPath, { recursive: true });
      }

      if (fs.existsSync(this.botsConfigPath)) {
        const data = fs.readFileSync(this.botsConfigPath, 'utf8');
        this.botsConfig = JSON.parse(data);
        console.log(`✅ [MANAGER] ${this.botsConfig.bots.length} bots carregados`);
      } else {
        this.saveConfig();
      }
    } catch (error) {
      console.error('❌ [MANAGER] Erro init:', error);
    }
  }

  async listBots() {
    console.log('🔵 [MANAGER] listBots');
    try {
      for (const bot of this.botsConfig.bots) {
        const instance = this.bots.get(bot.id);
        if (instance) {
          bot.status = instance.getStatus();
        }
      }
      return { success: true, bots: this.botsConfig.bots };
    } catch (error) {
      console.error('❌ [MANAGER] Erro list:', error);
      return { success: false, error: error.message };
    }
  }

  async updateBot(botId, updateData) {
    console.log(`🔵 [MANAGER] updateBot: ${botId}`);

    const botIndex = this.botsConfig.bots.findIndex(b => b.id === botId);
    if (botIndex === -1) {
      return { success: false, error: 'Bot não encontrado' };
    }

    // Verificar se o bot está rodando
    const botInstance = this.bots.get(botId);
    if (botInstance && botInstance.getStatus() === 'connected') {
      return { success: false, error: 'Não é possível editar um bot conectado. Pare o bot primeiro.' };
    }

    // Atualizar dados
    if (updateData.name) {
      this.botsConfig.bots[botIndex].name = updateData.name;
    }

    if (updateData.rules) {
      this.botsConfig.bots[botIndex].rules = updateData.rules;
    }

    this.saveConfig();

    console.log(`✅ [MANAGER] Bot ${botId} atualizado`);
    return { success: true, bot: this.botsConfig.bots[botIndex] };
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.botsConfigPath, JSON.stringify(this.botsConfig, null, 2));
      console.log('💾 [MANAGER] Configuração salva');
    } catch (error) {
      console.error('❌ [MANAGER] Erro save:', error);
    }
  }

  async createBot(botData) {
    console.log('🔵 [MANAGER] createBot:', botData.name);
    try {
      const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const sessionPath = path.join(this.sessionsPath, botId);

      const newBot = {
        id: botId,
        name: botData.name,
        phoneNumber: botData.phoneNumber || 'pending',
        rules: botData.rules || { firstMessage: '', keywords: {}, sinalizadores: [] },
        clientes: botData.clientes || {},
        status: 'stopped',
        sessionPath: sessionPath,
        createdAt: new Date().toISOString(),
        createdBy: botData.createdBy || 'unknown'
      };

      this.botsConfig.bots.push(newBot);
      this.saveConfig();

      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }

      console.log('✅ [MANAGER] Bot criado:', botId);
      this.emit('bot-created', newBot);

      return { success: true, bot: newBot };
    } catch (error) {
      console.error('❌ [MANAGER] Erro create:', error);
      return { success: false, error: error.message };
    }
  }

  async stopBot(botId) {
    console.log(`🔵 [MANAGER] stopBot: ${botId}`);
    try {
      const botInstance = this.bots.get(botId);
      if (!botInstance) {
        return { success: false, error: 'Bot não está rodando' };
      }

      await botInstance.stop();
      this.bots.delete(botId);

      const botConfig = this.botsConfig.bots.find(b => b.id === botId);
      if (botConfig) {
        botConfig.status = 'stopped';
        this.saveConfig();
      }

      this.emitStatus(botId, 'stopped');
      return { success: true };
    } catch (error) {
      console.error(`❌ [MANAGER] Erro stop:`, error);
      return { success: false, error: error.message };
    }
  }

  async deleteBot(botId) {
    console.log(`🔵 [MANAGER] deleteBot: ${botId}`);
    try {
      await this.stopBot(botId);

      const index = this.botsConfig.bots.findIndex(b => b.id === botId);
      if (index !== -1) {
        this.botsConfig.bots.splice(index, 1);
        this.saveConfig();
      }

      const sessionPath = path.join(this.sessionsPath, botId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ [MANAGER] Erro delete:`, error);
      return { success: false, error: error.message };
    }
  }

  getQrCode(botId) {
    const botInstance = this.bots.get(botId);
    return botInstance ? botInstance.getCurrentQr() : null;
  }

  emitStatus(botId, status, message = '') {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('bot:status-update', {
        botId,
        status,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  emitQR(botId, qrCode) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('bot:qr-code', {
        botId,
        qrCode,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Marcar última interação do firstMessage (modo padrão - 2 horas)
  async marcarUltimaInteracaoFirstMsg(botId, sender, data) {
    const botConfig = this.botsConfig.bots.find(b => b.id === botId);
    if (!botConfig) return;

    if (!botConfig.clientes) botConfig.clientes = {};
    if (!botConfig.clientes[sender]) {
      botConfig.clientes[sender] = {};
    }

    botConfig.clientes[sender].ultimaInteracaoFirstMsg = data.toISOString();
    this.saveConfig();
  }

  // Atualizar cliente e emitir evento em tempo real
  async atualizarCliente(botId, numero, nome, sinalizador, mensagem, substituir = true) {
    try {
      const botConfig = this.botsConfig.bots.find(b => b.id === botId);
      if (!botConfig) return false;

      if (!botConfig.clientes) botConfig.clientes = {};
      if (!botConfig.clientes[numero]) {
        botConfig.clientes[numero] = {
          nome: nome,
          sinalizadores: [],
          historico: [],
          ultimaMensagem: mensagem,
          ultimaInteracao: new Date().toISOString()
        };
      }

      // Substituir ou adicionar sinalizador
      if (substituir) {
        botConfig.clientes[numero].sinalizadores = [sinalizador];
      } else {
        if (!botConfig.clientes[numero].sinalizadores.includes(sinalizador)) {
          botConfig.clientes[numero].sinalizadores.push(sinalizador);
        }
      }

      botConfig.clientes[numero].ultimaMensagem = mensagem;
      botConfig.clientes[numero].ultimaInteracao = new Date().toISOString();

      this.saveConfig();
      console.log(`✅ Cliente ${nome} atualizado com sinalizador: ${sinalizador}`);

      // EMITIR EVENTO PARA O FRONTEND EM TEMPO REAL
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('bot:cliente-sinalizado', {
          botId: botId,
          cliente: {
            numero: numero,
            nome: nome,
            novoSinalizador: sinalizador,
            mensagem: mensagem
          }
        });
        console.log(`📡 Evento 'bot:cliente-sinalizado' emitido para o frontend`);
      }

      return true;
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      return false;
    }
  }

  async cleanup() {
    console.log('🧹 [MANAGER] Cleanup');
    const stopPromises = [];
    for (const [botId, botInstance] of this.bots) {
      console.log(`🛑 [MANAGER] Parando bot ${botId}...`);
      stopPromises.push(botInstance.stop().catch(console.error));
    }
    await Promise.all(stopPromises);
    this.bots.clear();

    for (const bot of this.botsConfig.bots) {
      bot.status = 'stopped';
    }
    this.saveConfig();

    console.log('✅ [MANAGER] Todos os bots foram parados');
  }

  async startBot(botId) {
    console.log(`🔵 [MANAGER] startBot: ${botId}`);

    if (!makeWASocket || !useMultiFileAuthState) {
      this.emitStatus(botId, 'error', 'Baileys não disponível');
      return { success: false, error: 'Baileys não disponível' };
    }

    try {
      if (this.bots.has(botId)) {
        const existing = this.bots.get(botId);
        if (existing.getStatus() === 'connected') {
          return { success: false, error: 'Bot já está rodando' };
        }
        if (existing.getStatus() === 'connecting') {
          return { success: false, error: 'Bot já está conectando' };
        }
      }

      const botConfig = this.botsConfig.bots.find(b => b.id === botId);
      if (!botConfig) {
        return { success: false, error: 'Bot não encontrado' };
      }

      botConfig.status = 'connecting';
      this.saveConfig();
      this.emitStatus(botId, 'connecting');

      // PASSAR O MANAGER PARA O BOTINSTANCE
      const botInstance = new BotInstance(botConfig, this.sessionsPath, this);

      botInstance.on('status', (status, message) => {
        const bot = this.botsConfig.bots.find(b => b.id === botId);
        if (bot) {
          bot.status = status;
          this.saveConfig();
        }
        this.emitStatus(botId, status, message);
      });

      botInstance.on('qr', (qrCode) => {
        console.log(`📱 [MANAGER] QR Code recebido para ${botId}`);
        this.emitQR(botId, qrCode);
      });

      botInstance.on('error', (error) => {
        const bot = this.botsConfig.bots.find(b => b.id === botId);
        if (bot) {
          bot.status = 'error';
          this.saveConfig();
        }
        this.emitStatus(botId, 'error', error.message);
      });

      botInstance.on('message-received', (message) => {
        this.emit('bot-message', { botId, message });
      });

      this.bots.set(botId, botInstance);
      await botInstance.start();

      console.log(`🚀 [MANAGER] Bot ${botId} iniciado`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [MANAGER] Erro start:`, error);
      this.emitStatus(botId, 'error', error.message);
      return { success: false, error: error.message };
    }
  }

  async getBotData(botId) {
    console.log(`🔵 [MANAGER] getBotData: ${botId}`);

    const botConfig = this.botsConfig.bots.find(b => b.id === botId);
    if (!botConfig) {
      throw new Error('Bot não encontrado');
    }

    const instance = this.bots.get(botId);
    if (instance) {
      botConfig.status = instance.getStatus();
    }

    return botConfig;
  }

  async removerSinalizadorCliente(botId, numero, sinalizador) {
    const botConfig = this.botsConfig.bots.find(b => b.id === botId);
    if (!botConfig) return { success: false };

    const cliente = botConfig.clientes?.[numero];
    if (!cliente) return { success: false };

    // Remover o sinalizador específico
    cliente.sinalizadores = cliente.sinalizadores.filter(s => s !== sinalizador);

    this.saveConfig();

    // Opcional: emitir evento de atualização
    this.mainWindow?.webContents.send('bot:cliente-atualizado', { botId, numero });

    return { success: true };
  }
  // Adicione no BotManager class
async updateSinalizadoresOrdem(botId, ordem) {
    const botConfig = this.botsConfig.bots.find(b => b.id === botId);
    if (!botConfig) return { success: false, error: 'Bot não encontrado' };
    
    botConfig.ordemSinalizadores = ordem;
    this.saveConfig();
    
    console.log(`✅ Ordem dos sinalizadores salva para ${botConfig.name}:`, ordem);
    return { success: true };
}
}

module.exports = BotManager;