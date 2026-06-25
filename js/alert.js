// alert.js
// Função para substituir o alert() com o estilo do app
export function alerta(message, title = "Aviso", type = "info") {
    
    // Remove qualquer modal existente
    const existingModal = document.querySelector('.custom-alert-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar o modal
    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal';
    
    // Criar o overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    
    // Criar o container do alert
    const alertContainer = document.createElement('div');
    alertContainer.className = `custom-alert-container custom-alert-${type}`;
    
    // Criar o ícone baseado no tipo
    let iconHTML = '';
    switch(type) {
        case 'success':
            iconHTML = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            break;
        case 'error':
            iconHTML = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-linecap="round"/>
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-linecap="round"/>
                </svg>
            `;
            break;
        case 'warning':
            iconHTML = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 9V13M12 17H12.01" stroke="currentColor" stroke-linecap="round"/>
                    <path d="M12 2L1 21H23L12 2Z" stroke="currentColor" stroke-linejoin="round"/>
                </svg>
            `;
            break;
        default:
            iconHTML = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-linecap="round"/>
                    <path d="M12 16H12.01" stroke="currentColor" stroke-linecap="round"/>
                </svg>
            `;
    }
    
    // Criar o conteúdo do alert
    alertContainer.innerHTML = `
        <div class="custom-alert-icon">${iconHTML}</div>
        <h3 class="custom-alert-title">${title}</h3>
        <p class="custom-alert-message">${message}</p>
        <button class="custom-alert-button">OK</button>
    `;
    
    modal.appendChild(overlay);
    modal.appendChild(alertContainer);
    document.body.appendChild(modal);
    
    // Adicionar estilos CSS
    const style = document.createElement('style');
    style.textContent = `
        .custom-alert-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        }
        
        .custom-alert-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
        }
        
        .custom-alert-container {
            position: relative;
            background: var(--bg-card);
            border-radius: 12px;
            padding: 32px 40px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: var(--shadow-lg);
            border: 1px solid var(--border-light);
            animation: slideUp 0.3s ease;
            z-index: 10000;
        }
        
        .custom-alert-icon {
            margin-bottom: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .custom-alert-success .custom-alert-icon {
            color: var(--green-soft);
        }
        
        .custom-alert-error .custom-alert-icon {
            color: var(--red-soft);
        }
        
        .custom-alert-warning .custom-alert-icon {
            color: var(--orange-primary);
        }
        
        .custom-alert-info .custom-alert-icon {
            color: var(--orange-primary);
        }
        
        .custom-alert-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 12px;
            font-family: inherit;
        }
        
        .custom-alert-message {
            color: var(--text-secondary);
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        
        .custom-alert-button {
            background: var(--orange-primary);
            color: white;
            border: none;
            padding: 10px 32px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(249, 115, 22, 0.2);
        }
        
        .custom-alert-button:hover {
            background: var(--orange-dark);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(249, 115, 22, 0.3);
        }
        
        .custom-alert-button:active {
            transform: translateY(0);
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    
    if (!document.querySelector('#custom-alert-styles')) {
        style.id = 'custom-alert-styles';
        document.head.appendChild(style);
    }
    
    // Adicionar evento para fechar o modal
    const button = alertContainer.querySelector('.custom-alert-button');
    const handleClose = () => {
        modal.remove();
    };
    
    button.addEventListener('click', handleClose);
    overlay.addEventListener('click', handleClose);
    
    // Fechar com ESC
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            handleClose();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
    
    // Retornar uma promise para aguardar o fechamento (opcional)
    return new Promise((resolve) => {
        button.addEventListener('click', () => resolve());
        overlay.addEventListener('click', () => resolve());
    });
}
// alert.js
export function confirmar(message, title = "Confirmação", type = "warning") {
    return new Promise((resolve) => {
        // Remove qualquer modal existente
        const existingModal = document.querySelector('.custom-alert-modal');
        if (existingModal) existingModal.remove();
        
        // Criar o modal
        const modal = document.createElement('div');
        modal.className = 'custom-alert-modal';
        
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';
        
        const alertContainer = document.createElement('div');
        alertContainer.className = `custom-alert-container custom-alert-${type}`;
        
        // Ícone baseado no tipo
        let iconHTML = '';
        switch(type) {
            case 'warning':
                iconHTML = `
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 9V13M12 17H12.01" stroke="currentColor" stroke-linecap="round"/>
                        <path d="M12 2L1 21H23L12 2Z" stroke="currentColor" stroke-linejoin="round"/>
                    </svg>
                `;
                break;
            default:
                iconHTML = `
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-linecap="round"/>
                        <path d="M12 16H12.01" stroke="currentColor" stroke-linecap="round"/>
                    </svg>
                `;
        }
        
        // Criar conteúdo com dois botões
        alertContainer.innerHTML = `
            <div class="custom-alert-icon">${iconHTML}</div>
            <h3 class="custom-alert-title">${title}</h3>
            <p class="custom-alert-message">${message.replace(/\n/g, '<br>')}</p>
            <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
                <button class="custom-alert-button-cancel">Cancelar</button>
                <button class="custom-alert-button-confirm">Confirmar</button>
            </div>
        `;
        
        modal.appendChild(overlay);
        modal.appendChild(alertContainer);
        document.body.appendChild(modal);
        
        // 🔥 ADICIONAR TODOS OS ESTILOS CSS COMPLETOS
        const style = document.createElement('style');
        style.textContent = `
            .custom-alert-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease;
            }
            
            .custom-alert-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
            }
            
            .custom-alert-container {
                position: relative;
                background: var(--bg-card, #ffffff);
                border-radius: 12px;
                padding: 32px 40px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                border: 1px solid var(--border-light, #eef2f6);
                animation: slideUp 0.3s ease;
                z-index: 10000;
            }
            
            .custom-alert-icon {
                margin-bottom: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .custom-alert-warning .custom-alert-icon {
                color: #f97316;
            }
            
            .custom-alert-title {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-primary, #1e293b);
                margin-bottom: 12px;
                font-family: inherit;
            }
            
            .custom-alert-message {
                color: var(--text-secondary, #475569);
                font-size: 14px;
                line-height: 1.5;
                margin-bottom: 24px;
                white-space: pre-wrap;
                text-align: left;
            }
            
            .custom-alert-button-confirm {
                background: #f97316;
                color: white;
                border: none;
                padding: 10px 24px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                flex: 1;
            }
            
            .custom-alert-button-confirm:hover {
                background: #ea580c;
                transform: translateY(-1px);
            }
            
            .custom-alert-button-cancel {
                background: #ffffff;
                color: #475569;
                border: 1px solid #e2e8f0;
                padding: 10px 24px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                flex: 1;
            }
            
            .custom-alert-button-cancel:hover {
                background: #f8fafc;
                border-color: #cbd5e1;
            }
            
            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        
        // Adicionar estilo apenas uma vez
        if (!document.querySelector('#custom-confirm-styles')) {
            style.id = 'custom-confirm-styles';
            document.head.appendChild(style);
        }
        
        const confirmBtn = alertContainer.querySelector('.custom-alert-button-confirm');
        const cancelBtn = alertContainer.querySelector('.custom-alert-button-cancel');
        
        const handleClose = (result) => {
            modal.remove();
            resolve(result);
        };
        
        confirmBtn.addEventListener('click', () => handleClose(true));
        cancelBtn.addEventListener('click', () => handleClose(false));
        overlay.addEventListener('click', () => handleClose(false));
        
        // Fechar com ESC (equivale a cancelar)
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                handleClose(false);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// Tornar global também
window.confirmar = confirmar;
window.alerta = alerta;