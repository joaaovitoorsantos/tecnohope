const express = require("express");
const pm2 = require("pm2");
const cors = require("cors");
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const app = express();
const PORT = 4000;
const WS_PORT = 4001;

// Configuração do CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configuração do WebSocket Server
const wss = new WebSocket.Server({ 
  port: WS_PORT,
  perMessageDeflate: false,
  clientTracking: true
}, () => {
  console.log(`Servidor WebSocket iniciado na porta ${WS_PORT}`);
});

wss.on('listening', () => {
  console.log(`WebSocket Server está ouvindo na porta ${WS_PORT}`);
});

wss.on('error', (error) => {
  console.error('Erro no servidor WebSocket:', error);
});

// Armazena as conexões WebSocket por bot
const botConnections = new Map();

// Função para enviar logs para todos os clientes conectados a um bot específico
function broadcastBotLogs(botName, log) {
  const connections = botConnections.get(botName) || [];
  console.log(`Enviando log para ${connections.size} clientes do bot ${botName}`);
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'log', content: log }));
    }
  });
}

// Gerenciamento de conexões WebSocket
wss.on('connection', (ws, req) => {
  console.log('Nova conexão WebSocket recebida');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Mensagem WebSocket recebida:', data);
      
      if (data.type === 'subscribe' && data.botName) {
        const { botName } = data;
        console.log(`Cliente subscreveu aos logs do bot: ${botName}`);
        
        // Adiciona a conexão à lista do bot
        if (!botConnections.has(botName)) {
          botConnections.set(botName, new Set());
        }
        botConnections.get(botName).add(ws);
        console.log(`Agora temos ${botConnections.get(botName).size} clientes conectados ao bot ${botName}`);

        // Inicia o monitoramento dos logs do bot
        startLogMonitoring(botName, ws);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem WebSocket:', error);
    }
  });

  ws.on('close', () => {
    console.log('Conexão WebSocket fechada');
    // Remove a conexão de todos os bots
    for (const [botName, connections] of botConnections.entries()) {
      connections.delete(ws);
      console.log(`Cliente removido do bot ${botName}. Restam ${connections.size} clientes`);
      if (connections.size === 0) {
        botConnections.delete(botName);
        console.log(`Nenhum cliente restante para o bot ${botName}, removendo da lista`);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('Erro na conexão WebSocket:', error);
  });
});

// Função para monitorar logs em tempo real
function startLogMonitoring(botName, ws) {
  pm2.list((err, list) => {
    if (err) {
      console.error(`Erro ao buscar bot ${botName}:`, err);
      return;
    }

    const bot = list.find(p => p.name === botName);
    if (!bot) {
      console.error(`Bot não encontrado: ${botName}`);
      return;
    }

    const logFile = path.join(bot.pm2_env.pm_cwd || '', 'logs/out.log');
    console.log(`Monitorando logs de: ${logFile}`);

    // Usa PowerShell para ler os logs iniciais e continuar monitorando
    const powershell = spawn('powershell.exe', [
      '-Command',
      `Get-Content "${logFile}" -Tail 100 -Wait`
    ]);

    powershell.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          broadcastBotLogs(botName, line.trim());
        }
      });
    });

    powershell.stderr.on('data', (data) => {
      console.error(`Erro no PowerShell: ${data}`);
    });

    ws.on('close', () => {
      powershell.kill();
    });
  });
}

// Função auxiliar para conectar ao PM2
function connectPM2() {
  return new Promise((resolve, reject) => {
  pm2.connect((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Função para formatar o status do bot
function formatBotStatus(process) {
  const status = process.pm2_env?.status || 'unknown';
  const uptime = process.pm2_env?.pm_uptime ? new Date(process.pm2_env.pm_uptime) : null;
  const restarts = process.pm2_env?.restart_time || 0;
  
  // Obtém o limite de memória do processo (em bytes)
  const memoryLimit = process.pm2_env?.max_memory_restart || 512 * 1024 * 1024; // Padrão: 512MB
  
  return {
    name: process.name,
    pm_id: process.pm_id,
    status: status,
    monit: {
      ...process.monit,
      memory_limit: memoryLimit
    },
    uptime: uptime,
    restarts: restarts,
    // Informações adicionais que podem ser úteis
    version: process.pm2_env?.version || 'N/A',
    node_version: process.pm2_env?.node_version || 'N/A',
    instances: process.pm2_env?.instances || 1,
    exec_mode: process.pm2_env?.exec_mode || 'N/A'
  };
}

// Lista todos os bots
app.get("/bots", async (req, res) => {
  try {
    await connectPM2();

    pm2.list((err, list) => {
      pm2.disconnect();
      if (err) {
        console.error("Erro ao listar bots:", err);
        return res.status(500).json({ error: "Erro ao listar os bots", details: err.message });
      }
      
      // Formata a lista de bots com informações detalhadas
      const formattedList = list.map(process => formatBotStatus(process));
      res.json(formattedList);
    });
  } catch (error) {
    console.error("Erro na conexão PM2:", error);
    res.status(500).json({ error: "Erro ao conectar ao PM2", details: error.message });
  }
});

// Inicia um bot
app.post("/bots/start", async (req, res) => {
  try {
    const { botName } = req.body;
    
    if (!botName) {
      return res.status(400).json({ error: "Nome do bot é obrigatório" });
    }

    await connectPM2();
    
    pm2.start(botName, (err) => {
      pm2.disconnect();
      if (err) {
        console.error(`Erro ao iniciar bot ${botName}:`, err);
        return res.status(500).json({ error: "Erro ao iniciar o bot", details: err.message });
      }
      res.json({ success: true, message: `Bot ${botName} iniciado com sucesso` });
    });
  } catch (error) {
    console.error("Erro na conexão PM2:", error);
    res.status(500).json({ error: "Erro ao conectar ao PM2", details: error.message });
  }
});

// Para um bot
app.post("/bots/stop", async (req, res) => {
  try {
    const { botName } = req.body;
    
    if (!botName) {
      return res.status(400).json({ error: "Nome do bot é obrigatório" });
    }

    await connectPM2();
    
    pm2.stop(botName, (err) => {
      pm2.disconnect();
      if (err) {
        console.error(`Erro ao parar bot ${botName}:`, err);
        return res.status(500).json({ error: "Erro ao parar o bot", details: err.message });
      }
      res.json({ success: true, message: `Bot ${botName} parado com sucesso` });
    });
  } catch (error) {
    console.error("Erro na conexão PM2:", error);
    res.status(500).json({ error: "Erro ao conectar ao PM2", details: error.message });
  }
});

// Reinicia um bot
app.post("/bots/restart", async (req, res) => {
  try {
    const { botName } = req.body;
    
    if (!botName) {
      return res.status(400).json({ error: "Nome do bot é obrigatório" });
    }

    await connectPM2();
    
    pm2.restart(botName, (err) => {
      pm2.disconnect();
      if (err) {
        console.error(`Erro ao reiniciar bot ${botName}:`, err);
        return res.status(500).json({ error: "Erro ao reiniciar o bot", details: err.message });
      }
      res.json({ success: true, message: `Bot ${botName} reiniciado com sucesso` });
    });
  } catch (error) {
    console.error("Erro na conexão PM2:", error);
    res.status(500).json({ error: "Erro ao conectar ao PM2", details: error.message });
  }
});

// Atualiza o limite de memória de um bot
app.post("/bots/memory-limit", async (req, res) => {
  try {
    const { botName, memoryLimit } = req.body;
    console.log(`[Memory Update] Recebido pedido para ${botName}: ${memoryLimit}MB`);
    
    if (!botName || !memoryLimit) {
      return res.status(400).json({ 
        error: "Nome do bot e limite de memória são obrigatórios",
        details: "Forneça o nome do bot e o limite de memória em MB" 
      });
    }

    await connectPM2();
    
    // Primeiro, encontra o processo pelo nome
    pm2.list((err, list) => {
      if (err) {
        pm2.disconnect();
        console.error(`Erro ao buscar bot ${botName}:`, err);
        return res.status(500).json({ error: "Erro ao buscar bot", details: err.message });
      }

      const bot = list.find(p => p.name === botName);
      if (!bot) {
        pm2.disconnect();
        return res.status(404).json({ error: "Bot não encontrado", details: `Bot ${botName} não encontrado` });
      }

      console.log(`[Memory Update] Bot encontrado:`, {
        name: bot.name,
        pm_id: bot.pm_id,
        currentMemLimit: bot.pm2_env?.max_memory_restart || 'não definido'
      });

      // Usa o comando direto do PM2 para atualizar a variável de ambiente e reiniciar
      const { exec } = require('child_process');
      const commands = [
        // Define a variável de ambiente MAX_MEMORY
        `pm2 set ${botName}:MAX_MEMORY ${memoryLimit}M`,
        // Reinicia o processo para aplicar a nova configuração
        `pm2 restart ${botName} --update-env`,
        // Salva a configuração
        'pm2 save'
      ].join(' && ');
      
      console.log(`[Memory Update] Executando comandos:`, commands);
      
      exec(commands, (execErr, stdout, stderr) => {
        if (execErr) {
          console.error(`Erro ao executar comandos:`, execErr);
          console.error(`Stderr:`, stderr);
          pm2.disconnect();
          return res.status(500).json({ 
            error: "Erro ao atualizar configuração", 
            details: execErr.message 
          });
        }

        console.log(`[Memory Update] Saída dos comandos:`, stdout);

        // Verifica se a atualização foi aplicada
        pm2.describe(botName, (descErr, processDescription) => {
          pm2.disconnect();
          
          if (descErr) {
            console.error(`Erro ao verificar atualização do bot ${botName}:`, descErr);
            return res.status(500).json({ 
              error: "Erro ao verificar atualização", 
              details: descErr.message 
            });
          }

          const newMemLimit = processDescription[0]?.pm2_env?.max_memory_restart;
          console.log(`[Memory Update] Configuração após atualização:`, {
            name: botName,
            newMemoryLimit: newMemLimit,
            requestedLimit: `${memoryLimit}M`,
            success: true,
            isPersistent: true
          });

          res.json({ 
            success: true, 
            message: `Limite de memória do bot ${botName} atualizado para ${memoryLimit}MB (configuração salva)`,
            newLimit: memoryLimit * 1024 * 1024
          });
        });
      });
    });
  } catch (error) {
    console.error("Erro na conexão PM2:", error);
    res.status(500).json({ error: "Erro ao conectar ao PM2", details: error.message });
  }
});

// Atualiza a rota de logs para usar PowerShell
app.get("/bots/logs/:botName", async (req, res) => {
  try {
    const { botName } = req.params;
    const { lines = 100 } = req.query;
    
    console.log(`[Logs] Buscando logs para ${botName}, últimas ${lines} linhas`);

    await connectPM2();
    
    pm2.list((err, list) => {
      if (err) {
        pm2.disconnect();
        console.error(`Erro ao buscar bot ${botName}:`, err);
        return res.status(500).json({ error: "Erro ao buscar bot", details: err.message });
      }

      const bot = list.find(p => p.name === botName);
      if (!bot) {
        pm2.disconnect();
        return res.status(404).json({ error: "Bot não encontrado", details: `Bot ${botName} não encontrado` });
      }

      const logFile = path.join(bot.pm2_env.pm_cwd || '', 'logs/out.log');
      console.log(`[Logs] Lendo arquivo: ${logFile}`);
      
      // Usa PowerShell para ler as últimas linhas
      const powershell = spawn('powershell.exe', [
        '-Command',
        `Get-Content "${logFile}" -Tail ${lines}`
      ]);

      let output = '';
      let error = '';

      powershell.stdout.on('data', (data) => {
        output += data.toString();
      });

      powershell.stderr.on('data', (data) => {
        error += data.toString();
      });

      powershell.on('close', (code) => {
        pm2.disconnect();
        
        if (code !== 0) {
          console.error(`Erro ao ler logs: ${error}`);
          return res.status(500).json({ 
            error: "Erro ao ler logs", 
            details: error 
          });
        }

        const logLines = output.split('\n')
          .filter(line => line.trim())
          .map(line => ({
            timestamp: new Date().toISOString(),
            content: line.trim()
          }));

        res.json({ 
          success: true,
          botName,
          logs: logLines
        });
      });
    });
  } catch (error) {
    console.error("Erro na conexão PM2:", error);
    res.status(500).json({ error: "Erro ao conectar ao PM2", details: error.message });
  }
});

// Rota de status do servidor
app.get("/status", (req, res) => {
  res.json({ 
    status: "online", 
    timestamp: new Date().toISOString(),
    version: process.version,
    platform: process.platform
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Endpoints disponíveis:`);
  console.log(`- GET  /bots           : Lista todos os bots`);
  console.log(`- POST /bots/start     : Inicia um bot`);
  console.log(`- POST /bots/stop      : Para um bot`);
  console.log(`- POST /bots/restart   : Reinicia um bot`);
  console.log(`- POST /bots/memory-limit : Atualiza limite de memória`);
  console.log(`- GET  /bots/logs/:botName : Obter logs do bot`);
  console.log(`- GET  /status         : Status do servidor`);
});
