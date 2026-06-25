import { auth, signOut, onAuthStateChanged } from "./firebase.js";
import { alerta, confirmar } from './alert.js';
console.log('Inicializando Firebase na Home...');

let currentUser = null;
let editingBotId = null; // Variável para controle de edição

// Elementos DOM
const userInfoDiv           = document.getElementById('userInfo');
const versionSpan           = document.getElementById('versionNumber');
const createBotBtn          = document.getElementById('createBotBtn');
const botNameInput          = document.getElementById('botName');
const firstMessageInput     = document.getElementById('firstMessage');
const firstMsgSinalizador   = document.getElementById('firstMessageSinalizador');
const rulesListDiv          = document.getElementById('rulesList');
const addRuleBtn            = document.getElementById('addRuleBtn');
const cancelEditBtn         = document.getElementById('cancelEditBtn');

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Função para mostrar notificação no topo
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.background = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '9999';
    notification.style.animation = 'slideIn 0.3s ease';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Função para limpar o formulário
function clearForm() {
    botNameInput.value = '';
    firstMessageInput.value = '';
    firstMsgSinalizador.value = '';
    const toggle = document.getElementById('firstMessageDiarioToggle');
    if (toggle) toggle.checked = false;
    rulesListDiv.innerHTML = '';
    addRuleItem();
    editingBotId = null;
    createBotBtn.textContent = 'Criar Bot';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
}

// Adicionar CSS para notificações
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyle);

// ─────────────────────────────────────────────
// REGRAS: PALAVRA + RESPOSTA + SINALIZADOR
// ─────────────────────────────────────────────

function addRuleItem(palavra = '', resposta = '', sinalizador = '') {
    const div = document.createElement('div');
    div.className = 'rule-item';
    div.innerHTML = `
        <input type="text" class="rule-word"
            placeholder="Palavra (ex: horário, preço)"
            value="${escapeHtml(palavra)}">
        <textarea class="rule-response"
            placeholder="Resposta"
            rows="2">${escapeHtml(resposta)}</textarea>
        <input type="text" class="rule-sinalizador"
            placeholder="Sinalizador (opcional)"
            value="${escapeHtml(sinalizador)}">
        <button class="remove-rule" onclick="this.parentElement.remove()">✕</button>
    `;
    rulesListDiv.appendChild(div);
}

function collectRules() {
    const collected = [];
    document.querySelectorAll('#rulesList .rule-item').forEach(item => {
        const palavra      = item.querySelector('.rule-word').value.trim();
        const resposta     = item.querySelector('.rule-response').value.trim();
        const sinalizador  = item.querySelector('.rule-sinalizador').value.trim();
        if (palavra && resposta) collected.push({ palavra, resposta, sinalizador });
    });
    return collected;
}

addRuleBtn.onclick = () => addRuleItem();

// Cancelar edição
if (cancelEditBtn) {
    cancelEditBtn.onclick = () => {
        clearForm();
        showNotification('Edição cancelada', 'info');
    };
}

// ─────────────────────────────────────────────
// AUTENTICAÇÃO
// ─────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.electronAPI.navigateToLogin();
        return;
    }

    currentUser = user;
    const displayName = user.displayName || user.email.split('@')[0];
    userInfoDiv.innerHTML = `Bem-vindo, ${displayName} ao Hourglass!
        <button id="sinalizadoresBtn" class="btn">Sinalizadores</button>
        <button class="btn" id="logoutBtn">Sair</button>`;

    // Evento do botão Sinalizadores
    const sinalizadoresBtn = document.getElementById('sinalizadoresBtn');
    if (sinalizadoresBtn) {
        sinalizadoresBtn.onclick = () => {
            window.electronAPI.navigateToSinalizadores();
        };
    }

    // Evento do botão Sair
    document.getElementById('logoutBtn').onclick = async () => {
        try {
            await signOut(auth);
            window.electronAPI.navigateToLogin();
        } catch (e) {
            console.error('Erro ao sair:', e);
        }
    };

    loadBots();
});

// ─────────────────────────────────────────────
// VERSÃO
// ─────────────────────────────────────────────

window.electronAPI.getAppVersion()
    .then(v  => { versionSpan.textContent = v; })
    .catch(() => { versionSpan.textContent = 'erro'; });

// ─────────────────────────────────────────────
// CARREGAR / RENDERIZAR BOTS
// ─────────────────────────────────────────────

async function loadBots() {
    try {
        const result = await window.electronAPI.botList();
        if (result.success && result.bots) {
            updateBotsList(result.bots);
        } else {
            document.getElementById('botsList').innerHTML =
                `<div class="loading">Erro ao carregar bots: ${result.error || 'desconhecido'}</div>`;
        }
    } catch (e) {
        document.getElementById('botsList').innerHTML =
            '<div class="loading">Erro ao carregar bots</div>';
    }
}

// Atualiza apenas o necessário sem recriar cards existentes
function updateBotsList(bots) {
    const container = document.getElementById('botsList');
    const existingCards = new Map();
    
    // Mapear cards existentes
    document.querySelectorAll('.bot-card').forEach(card => {
        const botId = card.getAttribute('data-bot-id');
        existingCards.set(botId, card);
    });
    
    // Processar cada bot
    bots.forEach(bot => {
        const existingCard = existingCards.get(bot.id);
        
        if (existingCard) {
            // Card já existe - apenas atualiza status e informações
            updateExistingCard(existingCard, bot);
            existingCards.delete(bot.id);
        } else {
            // Bot novo - cria card
            container.appendChild(createBotCard(bot));
        }
    });
    
    // Remover cards de bots que foram deletados
    existingCards.forEach((card) => {
        card.remove();
    });
}

// Atualiza card existente sem recriar (preserva QR Code)
function updateExistingCard(card, bot) {
    // Se o bot está conectando, preservar QR Code e não atualizar muito
    if (bot.status === 'connecting') {
        const statusSpan = card.querySelector('.bot-status');
        statusSpan.className = 'bot-status connecting';
        statusSpan.textContent = '🟡 Conectando';
        return;
    }
    
    // Atualizar status
    const statusSpan = card.querySelector('.bot-status');
    const statusClass = bot.status === 'connected'  ? 'online' :
                        bot.status === 'connecting' ? 'connecting' :
                        bot.status === 'error'      ? 'error' : 'offline';
    
    const statusText = bot.status === 'connected'  ? '🟢 Online' :
                       bot.status === 'connecting' ? '🟡 Conectando' :
                       bot.status === 'error'      ? '🔴 Erro' : '⚫ Offline';
    
    statusSpan.className = `bot-status ${statusClass}`;
    statusSpan.textContent = statusText;
    
    // Atualizar informações (regras e clientes)
    const rulesCount = bot.rules?.keywords ? Object.keys(bot.rules.keywords).length : 0;
    const clientCount = bot.clientes ? Object.keys(bot.clientes).length : 0;
    
    const infoDiv = card.querySelector('.bot-info');
    if (infoDiv) {
        const rulesElement = infoDiv.children[1];
        const clientElement = infoDiv.children[2];
        
        if (rulesElement) rulesElement.innerHTML = `${rulesCount} regras configuradas`;
        if (clientElement) clientElement.innerHTML = `${clientCount} clientes rastreados`;
    }
    
    // Atualizar botões
    const startBtn = card.querySelector('.start-bot');
    const stopBtn = card.querySelector('.stop-bot');
    const editBtn = card.querySelector('.edit-bot');
    const deleteBtn = card.querySelector('.delete-bot');
    
    if (startBtn) startBtn.disabled = bot.status === 'connected';
    if (stopBtn) stopBtn.disabled = bot.status !== 'connected';
    if (editBtn) editBtn.disabled = bot.status === 'connected';
    if (deleteBtn) deleteBtn.disabled = bot.status === 'connected';
}

// Cria card para novo bot
function createBotCard(bot) {
    const card = document.createElement('div');
    card.className = 'bot-card';
    card.setAttribute('data-bot-id', bot.id);
    
    const statusClass = bot.status === 'connected'  ? 'online'     :
                        bot.status === 'connecting' ? 'connecting' :
                        bot.status === 'error'      ? 'error'      : 'offline';
    
    const statusText  = bot.status === 'connected'  ? '🟢 Online'     :
                        bot.status === 'connecting' ? '🟡 Conectando' :
                        bot.status === 'error'      ? '🔴 Erro'       : '⚫ Offline';
    
    const rulesCount    = bot.rules?.keywords     ? Object.keys(bot.rules.keywords).length : 0;
    const clientCount   = bot.clientes            ? Object.keys(bot.clientes).length       : 0;
    
    card.innerHTML = `
        <div class="bot-header">
            <h3>${escapeHtml(bot.name)}</h3>
            <span class="bot-status ${statusClass}">${statusText}</span>
        </div>
        <div class="bot-info">
            <div>Primeira mensagem: ${bot.rules?.firstMessage ? '✅' : '❌'}</div>
            <div>${rulesCount} regras configuradas</div>
            <div>${clientCount} clientes rastreados</div>
            <div>ID: ${bot.id.substring(0, 8)}...</div>
        </div>
        <div class="bot-actions">
            <button class="start-bot"  ${bot.status === 'connected' ? 'disabled' : ''}>▶ Iniciar</button>
            <button class="stop-bot"   ${bot.status !== 'connected' ? 'disabled' : ''}>⏹ Parar</button>
            <button class="edit-bot"   ${bot.status === 'connected' ? 'disabled' : ''}>✏️ Editar</button>
            <button class="delete-bot" ${bot.status === 'connected' ? 'disabled' : ''}>🗑 Deletar</button>
        </div>
        <div class="bot-message" style="display:none;"></div>
        <div class="qr-container" style="display:none;"></div>
    `;
    
    card.querySelector('.start-bot') .addEventListener('click', () => startBot(bot.id));
    card.querySelector('.stop-bot')  .addEventListener('click', () => stopBot(bot.id));
    card.querySelector('.edit-bot')  .addEventListener('click', () => editBot(bot.id));
    card.querySelector('.delete-bot').addEventListener('click', () => deleteBot(bot.id));
    
    return card;
}

// ─────────────────────────────────────────────
// FUNÇÃO DE EDIÇÃO
// ─────────────────────────────────────────────

async function editBot(botId) {
    try {
        const bot = await window.electronAPI.botGetData(botId);
        if (bot && bot.id) {
            // Limpar formulário atual
            clearForm();
            
            // Setar modo edição
            editingBotId = bot.id;
            createBotBtn.textContent = 'Salvar Edição';
            if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
            
            // Preencher campos básicos
            botNameInput.value = bot.name;
            firstMessageInput.value = bot.rules?.firstMessage || '';
            
            // Preencher toggle (firstMessageDiario)
            const toggle = document.getElementById('firstMessageDiarioToggle');
            if (toggle) {
                toggle.checked = bot.rules?.firstMessageDiario === true;
            }
            
            // Preencher sinalizador da primeira mensagem
            const sinalizadores = bot.rules?.sinalizadores || [];
            const firstMsgSinalizadorObj = sinalizadores.find(s => s.gatilho === 'primeira_mensagem_do_dia');
            if (firstMsgSinalizadorObj) {
                firstMsgSinalizador.value = firstMsgSinalizadorObj.label;
            }
            
            // Limpar e preencher regras de palavras-chave
            rulesListDiv.innerHTML = '';
            
            const keywords = bot.rules?.keywords || {};
            const palavrasRegras = [];
            
            // Coletar regras existentes
            for (const [palavra, resposta] of Object.entries(keywords)) {
                const sinalizadorRegra = sinalizadores.find(s => s.gatilho === 'palavra_chave' && s.valor === palavra);
                const sinalizadorLabel = sinalizadorRegra ? sinalizadorRegra.label : '';
                palavrasRegras.push({ palavra, resposta, sinalizador: sinalizadorLabel });
            }
            
            // Adicionar as regras ao formulário
            if (palavrasRegras.length === 0) {
                addRuleItem();
            } else {
                palavrasRegras.forEach(regra => {
                    addRuleItem(regra.palavra, regra.resposta, regra.sinalizador);
                });
            }
            
            // Rolar a página para o formulário
            document.querySelector('.create-bot').scrollIntoView({ behavior: 'smooth' });
            
            showNotification('✏️ Editando bot: ' + bot.name, 'info');
        } else {
            alert('Erro ao carregar dados do bot');
        }
    } catch (error) {
        console.error('Erro ao editar bot:', error);
        alert('Erro ao carregar bot para edição');
    }
}

// ─────────────────────────────────────────────
// CRIAR/EDITAR BOT
// ─────────────────────────────────────────────

createBotBtn.onclick = async () => {
    const name         = botNameInput.value.trim();
    const firstMessage = firstMessageInput.value.trim();
    const firstMsgTag  = firstMsgSinalizador.value.trim();
    const firstMessageDiario = document.getElementById('firstMessageDiarioToggle')?.checked || false;

    if (!name) {
        alerta('Para poder salvar as configurações de um Bot, você precisa primeiro dar um nome para o ele','Opaa!!!','info');
        return;
    }

    // Montar keywords + sinalizadores a partir das regras
    const keywords      = {};
    const sinalizadores = [];

    // Sinalizador da primeira mensagem
    if (firstMsgTag) {
        sinalizadores.push({ gatilho: 'primeira_mensagem_do_dia', label: firstMsgTag });
    }

    // Regras de palavras-chave
    collectRules().forEach(r => {
        keywords[r.palavra] = r.resposta;
        if (r.sinalizador) {
            sinalizadores.push({ gatilho: 'palavra_chave', valor: r.palavra, label: r.sinalizador });
        }
    });

    const rulesConfig = { 
        firstMessage, 
        keywords, 
        sinalizadores,
        firstMessageDiario: firstMessageDiario
    };

    createBotBtn.disabled    = true;
    createBotBtn.textContent = editingBotId ? 'Salvando...' : 'Criando...';

    try {
        let result;
        
        if (editingBotId) {
            // MODO EDIÇÃO: Atualizar bot existente
            result = await window.electronAPI.botUpdate(editingBotId, {
                name,
                rules: rulesConfig
            });
            
            if (result.success) {
                showNotification('✅ Bot atualizado com sucesso!', 'success');
                clearForm();
                loadBots();
            } else {
                alert('Erro ao atualizar bot: ' + result.error);
            }
        } else {
            // MODO CRIAÇÃO: Criar novo bot
            result = await window.electronAPI.botCreate({
                name,
                phoneNumber: 'aguardando_conexao',
                rules: rulesConfig,
                clientes: {},
                createdBy: currentUser?.email || 'unknown'
            });
            
            if (result.success) {
                showNotification('✅ Bot criado com sucesso!', 'success');
                clearForm();
                loadBots();
            } else {
                alert('Erro ao criar bot: ' + result.error);
            }
        }
    } catch (e) {
        console.error('Erro:', e);
        alert(editingBotId ? 'Erro ao atualizar bot' : 'Erro ao criar bot');
    } finally {
        createBotBtn.disabled    = false;
        createBotBtn.textContent = editingBotId ? 'Salvar Edição' : 'Criar Bot';
    }
};

// ─────────────────────────────────────────────
// AÇÕES DOS BOTS
// ─────────────────────────────────────────────

async function startBot(botId) {
    try {
        const result = await window.electronAPI.botStart(botId);
        if (result.success) {
            showBotMessage(botId, '✅ Bot iniciado! Escaneie o QR Code para conectar.', 'success');
        } else {
            showBotMessage(botId, '❌ Erro ao iniciar: ' + result.error, 'error');
            setTimeout(() => loadBots(), 2000);
        }
    } catch (e) {
        showBotMessage(botId, '❌ Erro ao iniciar bot', 'error');
    }
}

async function stopBot(botId) {
    try {
        const result = await window.electronAPI.botStop(botId);
        if (result.success) {
            showBotMessage(botId, '⏹ Bot parado com sucesso', 'success');
            setTimeout(() => loadBots(), 1000);
        } else {
            showBotMessage(botId, '❌ Erro ao parar: ' + result.error, 'error');
        }
    } catch (e) {
        showBotMessage(botId, '❌ Erro ao parar bot', 'error');
    }
}

async function deleteBot(botId) {
    if (await confirmar('Tem certeza que deseja deletar este bot?')) {
        try {
            const result = await window.electronAPI.botDelete(botId);
            if (result.success) {
                showNotification('🗑 Bot deletado com sucesso', 'success');
                loadBots();
            } else {
                alert('Erro ao deletar bot: ' + result.error);
            }
        } catch (e) {
            alert('Erro ao deletar bot');
        }
    }
}

// ─────────────────────────────────────────────
// FEEDBACK VISUAL
// ─────────────────────────────────────────────

function showBotMessage(botId, message, type) {
    const card = document.querySelector(`.bot-card[data-bot-id="${botId}"]`);
    if (!card) return;
    const msgDiv = card.querySelector('.bot-message');
    msgDiv.textContent           = message;
    msgDiv.style.display         = 'block';
    msgDiv.style.background      = type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
    msgDiv.style.borderLeftColor = type === 'success' ? '#10b981' : '#ef4444';
    setTimeout(() => { msgDiv.style.display = 'none'; }, 5000);
}

function showQrCode(botId, qrCode) {
    const card = document.querySelector(`.bot-card[data-bot-id="${botId}"]`);
    if (!card) return;
    const qrContainer = card.querySelector('.qr-container');
    qrContainer.innerHTML = `
        <div style="text-align:center;">
            <p style="color:#333;margin-bottom:10px;">📱 Escaneie o QR Code com o WhatsApp</p>
            <img src="${qrCode}" alt="QR Code" style="max-width:200px;">
            <p style="color:#666;margin-top:10px;font-size:12px;">Aguardando conexão...</p>
        </div>
    `;
    qrContainer.style.display = 'block';
    setTimeout(() => { qrContainer.style.display = 'none'; }, 120000);
}
(async () => {
  try {
    await window.electronAPI.startUpdateChecker();
    console.log('✅ Sistema de atualizações iniciado');
  } catch (error) {
    console.error('❌ Erro ao iniciar verificação de atualizações:', error);
  }
})();
// ─────────────────────────────────────────────
// EVENTOS DO ELECTRON
// ─────────────────────────────────────────────

let statusUpdateTimeout = null;

window.electronAPI.onBotStatusUpdate(() => {
    if (statusUpdateTimeout) clearTimeout(statusUpdateTimeout);
    statusUpdateTimeout = setTimeout(() => {
        loadBots();
    }, 500);
});

window.electronAPI.onBotQrCode((event, data) => showQrCode(data.botId, data.qrCode));

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

addRuleItem();
console.log('✅ Home carregada — Sistema de bots + sinalizadores + edição pronto');