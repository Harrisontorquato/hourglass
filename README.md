<div align="center">

```
██╗  ██╗ ██████╗ ██╗   ██╗██████╗  ██████╗ ██╗      █████╗ ███████╗███████╗
██║  ██║██╔═══██╗██║   ██║██╔══██╗██╔════╝ ██║     ██╔══██╗██╔════╝██╔════╝
███████║██║   ██║██║   ██║██████╔╝██║  ███╗██║     ███████║███████╗███████╗
██╔══██║██║   ██║██║   ██║██╔══██╗██║   ██║██║     ██╔══██║╚════██║╚════██║
██║  ██║╚██████╔╝╚██████╔╝██║  ██║╚██████╔╝███████╗██║  ██║███████║███████║
╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
```

**Automação de atendimento para WhatsApp**

[![Version](https://img.shields.io/badge/version-1.1.0-f97316?style=flat-square)](https://github.com/Harrisontorquato/hourglass/releases)
[![Electron](https://img.shields.io/badge/Electron-32.x-47848F?style=flat-square)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node-20.x-339933?style=flat-square)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-slate?style=flat-square)](LICENSE)

</div>

---

## O que é

Hourglass é uma aplicação desktop para automação de atendimento via WhatsApp. Crie bots com respostas baseadas em palavras-chave, controle quem já foi atendido, organize clientes em um kanban visual e deixe as tarefas repetitivas rodando sozinhas.

Desenvolvido com foco em simplicidade: você configura o bot em minutos, sem precisar de servidor ou infraestrutura externa.

---

## Funcionalidades

**Automação de mensagens**
Respostas automáticas disparadas por palavras-chave configuráveis. Suporte a múltiplos gatilhos no mesmo contexto (separados por vírgula), variáveis `{nome}` e `{bot}` nas mensagens, e detecção que ignora acentuação.

**Primeira mensagem inteligente**
Configure uma mensagem de boas-vindas que é enviada uma única vez por cliente — ou uma vez por dia, com persistência em disco entre reinicializações.

**Sistema de sinalizadores**
Classificação automática de clientes com tags. Um cliente que digita "preço" recebe o sinalizador "interessado". Quem recebeu a boas-vindas entra na coluna certa automaticamente. Tudo atualiza em tempo real sem recarregar a página.

**Kanban visual**
Visualize e gerencie clientes por sinalizador em tempo real. Cards se movem entre colunas conforme as interações chegam.

**Sessão persistente**
Após escanear o QR Code uma vez, a sessão é salva. O bot reconecta sozinho em caso de queda.

**Atualizações automáticas**
O app verifica atualizações via GitHub Releases e instala com um clique.

---

## Stack

| Tecnologia | Papel |
|---|---|
| Node.js 20 | Runtime principal, eventos, persistência |
| Electron | Interface desktop multiplataforma |
| Baileys | Comunicação com WhatsApp Web |
| Firebase Auth | Autenticação (Google + E-mail/Senha) |
| electron-updater | Atualizações automáticas |

---

## Como os dados são salvos

Tudo local, sem servidor externo:

```
bots-data/
├── bots-config.json      # bots, regras, clientes e sinalizadores
└── sessions/
    └── bot_[id]/         # sessão autenticada do WhatsApp por bot
```

---

## Fluxo de funcionamento

```
Usuário autentica → Firebase Auth
Cria o bot → configura regras e sinalizadores na interface
Escaneia QR → sessão do WhatsApp salva via Baileys
Mensagem chega → avalia palavras-chave em tempo real
Responde → mensagem enviada automaticamente
Sinaliza → cliente classificado com tag
Persiste → estado salvo em JSON, sobrevive ao reinício
```

---

## Tipos de sinalizador

| Tipo | Gatilho | Quando dispara |
|---|---|---|
| Palavra-chave | `palavra_chave` | Cliente envia mensagem com a palavra configurada |
| Primeira mensagem diária | `primeira_mensagem_do_dia` | Cliente recebe a boas-vindas (modo diário) |

---

## Contato

Harrison Torquato — [harrisontorquato.dev@gmail.com](mailto:harrisontorquato.dev@gmail.com)

[github.com/Harrisontorquato/hourglass](https://github.com/Harrisontorquato/hourglass)

---

## Reconhecimentos

[Baileys](https://github.com/WhiskeySockets/Baileys) · [Electron](https://www.electronjs.org/) · [Firebase](https://firebase.google.com/) · [Node.js](https://nodejs.org/)

---

<div align="center">
MIT License
</div>
