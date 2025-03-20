"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  PlayCircle, 
  StopCircle, 
  RefreshCcw, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Power,
  XCircle,
  AlertTriangle,
  Settings,
  Terminal
} from "lucide-react";

interface Bot {
  name: string;
  pm_id: number;
  status: string;
  monit?: {
    memory: number;
    cpu: number;
    memory_limit: number;
  };
}

type ActionType = "start" | "stop" | "restart";

const getStatusInfo = (status: string) => {
  switch (status) {
    case 'online':
      return {
        text: 'Online',
        icon: Power,
        className: 'bg-[#005012]/10 text-[#005012] border border-[#005012]/20'
      };
    case 'stopped':
      return {
        text: 'Parado',
        icon: XCircle,
        className: 'bg-red-500/10 text-red-500 border border-red-500/20'
      };
    default:
      return {
        text: 'Erro',
        icon: AlertTriangle,
        className: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
      };
  }
};

// Função auxiliar para formatar bytes para MB
const formatMemory = (bytes: number) => {
  const mb = bytes / 1024 / 1024;
  return mb.toFixed(2);
};

// Função auxiliar para formatar o limite de memória (sem decimais)
const formatMemoryLimit = (bytes: number) => {
  const mb = bytes / 1024 / 1024;
  return Math.round(mb);
};

interface LogLine {
  timestamp: string;
  content: string;
}

interface BotLogs {
  [botName: string]: LogLine[];
}

// Constantes para o servidor
const API_SERVER = '/api';

export default function Home() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<{[key: string]: boolean}>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [logs, setLogs] = useState<BotLogs>({});
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isConsoleOpenRef = useRef(false);

  // Mantém a referência atualizada
  useEffect(() => {
    isConsoleOpenRef.current = isConsoleOpen;
  }, [isConsoleOpen]);

  const getActionKey = (botName: string, action: ActionType) => `${botName}-${action}`;

  const fetchBots = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await fetch(`${API_SERVER}/bots`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || 'Erro ao carregar bots');
      }
      const data = await res.json();
      setBots(data);
    } catch (err) {
      console.error('Erro:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar bots');
      toast.error('Erro ao carregar lista de bots');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBots();
    const interval = setInterval(fetchBots, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (botName: string, action: ActionType) => {
    const actionKey = getActionKey(botName, action);
    try {
      setActionInProgress(prev => ({ ...prev, [actionKey]: true }));
      
      const res = await fetch(`${API_SERVER}/bots/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botName }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || `Erro ao ${
          action === 'start' ? 'iniciar' :
          action === 'stop' ? 'parar' :
          'reiniciar'
        } o bot`);
      }

      toast.success(data.message, {
        icon: <CheckCircle2 className="w-4 h-4 text-green-500" />
      });
      
      await fetchBots();
    } catch (err) {
      console.error('Erro:', err);
      toast.error(err instanceof Error ? err.message : `Erro na operação`, {
        icon: <AlertCircle className="w-4 h-4 text-red-500" />
      });
    } finally {
      setActionInProgress(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // Função para conectar ao WebSocket
  const connectWebSocket = (botName: string) => {
    try {
      // Verifica se o console está realmente aberto antes de conectar
      if (!isConsoleOpenRef.current) {
        console.log('Console está fechado, não iniciará WebSocket');
        return;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('Fechando conexão WebSocket existente');
        wsRef.current.close();
      }

      console.log(`Iniciando nova conexão WebSocket para o bot ${botName}`);
      const ws = new WebSocket('ws://104.234.224.196:4001');
      wsRef.current = ws;

      ws.onopen = () => {
        // Verifica novamente se o console ainda está aberto
        if (!isConsoleOpenRef.current) {
          console.log('Console foi fechado durante a conexão, fechando WebSocket');
          ws.close();
          return;
        }

        console.log('WebSocket conectado com sucesso');
        const subscribeMessage = { type: 'subscribe', botName };
        console.log('Enviando mensagem de subscrição:', subscribeMessage);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        // Verifica se o console ainda está aberto antes de processar mensagens
        if (!isConsoleOpenRef.current) {
          console.log('Console está fechado, ignorando mensagem');
          ws.close();
          return;
        }

        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log') {
            setLogs(prev => {
              const botLogs = prev[botName] || [];
              const newLogs = [...botLogs, { timestamp: new Date().toISOString(), content: data.content }];
              const trimmedLogs = newLogs.length > 1000 ? newLogs.slice(-1000) : newLogs;
              return {
                ...prev,
                [botName]: trimmedLogs
              };
            });
            
            if (logsRef.current) {
              logsRef.current.scrollTop = logsRef.current.scrollHeight;
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem do WebSocket:', error);
        }
      };

      ws.onerror = (error) => {
        if (!isConsoleOpenRef.current) {
          console.log('Console está fechado, ignorando erro do WebSocket');
          return;
        }
        console.error('Erro no WebSocket:', error);
        toast.error('Erro na conexão com o console. Tentando reconectar...');
      };

      ws.onclose = (event) => {
        console.log('WebSocket desconectado:', event.code, event.reason);
        
        // Verifica se o console ainda está aberto antes de tentar reconectar
        if (isConsoleOpenRef.current && selectedBot === botName) {
          console.log('Console ainda está aberto, tentando reconectar...');
          setTimeout(() => {
            // Verifica novamente antes de reconectar
            if (isConsoleOpenRef.current && selectedBot === botName) {
              console.log('Tentando reconectar WebSocket...');
              connectWebSocket(botName);
            } else {
              console.log('Console foi fechado ou bot mudou, cancelando reconexão');
            }
          }, 5000);
        } else {
          console.log('Console está fechado ou bot mudou, não tentará reconectar');
        }
      };
    } catch (error) {
      console.error('Erro ao criar conexão WebSocket:', error);
      toast.error('Erro ao criar conexão com o console');
    }
  };

  // Função para buscar logs iniciais
  const fetchInitialLogs = async (botName: string) => {
    try {
      setIsLoadingLogs(true);
      const res = await fetch(`${API_SERVER}/bots/logs/${botName}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || 'Erro ao carregar logs');
      }
      const data = await res.json();
      
      setLogs(prev => ({
        ...prev,
        [botName]: data.logs
      }));
      
      // Rola para o final dos logs
      setTimeout(() => {
        if (logsRef.current) {
          logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error('Erro:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Gerencia a conexão WebSocket quando o bot selecionado muda
  useEffect(() => {
    // Só inicia o WebSocket se houver um bot selecionado E o console estiver explicitamente aberto
    if (selectedBot && isConsoleOpen) {
      // Se não temos logs para este bot, busca os logs iniciais
      if (!logs[selectedBot]) {
        fetchInitialLogs(selectedBot);
      }
      connectWebSocket(selectedBot);
    }

    // Sempre limpa a conexão quando o componente é desmontado ou quando o console é fechado
    return () => {
      if (wsRef.current) {
        console.log('Fechando conexão WebSocket existente');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedBot, isConsoleOpen]); // Agora depende também do estado do console

  // Função para limpar logs de um bot específico
  const clearBotLogs = (botName: string) => {
    setLogs(prev => {
      const newLogs = { ...prev };
      delete newLogs[botName];
      return newLogs;
    });
    fetchInitialLogs(botName);
  };

  // Função para alternar o console
  const toggleConsole = (botName: string) => {
    if (selectedBot === botName) {
      // Fechando o console
      setIsConsoleOpen(false);
      if (wsRef.current) {
        console.log('Fechando conexão WebSocket ao fechar console');
        wsRef.current.close();
        wsRef.current = null;
      }
      setSelectedBot(null);
    } else {
      // Abrindo o console
      setSelectedBot(botName);
      setIsConsoleOpen(true);
    }
  };

  // Função para fechar o console
  const closeConsole = () => {
    setIsConsoleOpen(false);
    if (wsRef.current) {
      console.log('Fechando conexão WebSocket ao fechar console');
      wsRef.current.close();
      wsRef.current = null;
    }
    setSelectedBot(null);
  };

  if (loading && bots.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-700" />
          <p>Carregando bots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <strong className="font-bold">Erro! </strong>
            <span className="block sm:inline">{error}</span>
          </div>
          <Button onClick={fetchBots} className="mt-4">Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 relative">
      {/* Background Image */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'url(https://i.imgur.com/2OrQhPG.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'grayscale(100%)',
          mixBlendMode: 'overlay'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <img 
              src="https://i.imgur.com/2OrQhPG.png" 
              alt="TecnoHope Logo" 
              className="w-10 h-10 md:w-12 md:h-12 object-contain"
            />
            <h1 className="text-xl md:text-2xl font-bold text-[#005012]">
              Tecno Hope - Gerenciamento de Bots
            </h1>
          </div>
          <Button 
            onClick={fetchBots} 
            variant="outline"
            className="border-[#005012] text-[#005012] hover:bg-[#005012]/10 flex items-center gap-2 transition-all duration-200 w-full md:w-auto"
            disabled={isRefreshing}
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        {bots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Nenhum bot encontrado no servidor.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-800 shadow-xl bg-gray-900/80 backdrop-blur-sm">
              <table className="w-full border-collapse">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs md:text-sm font-semibold text-gray-300">Nome</th>
                    <th className="px-3 py-3 text-left text-xs md:text-sm font-semibold text-gray-300">Status</th>
                    <th className="hidden md:table-cell px-3 py-3 text-left text-xs md:text-sm font-semibold text-gray-300">RAM</th>
                    <th className="hidden md:table-cell px-3 py-3 text-left text-xs md:text-sm font-semibold text-gray-300">CPU</th>
                    <th className="px-3 py-3 text-right text-xs md:text-sm font-semibold text-gray-300">Ações</th>
          </tr>
        </thead>
                <tbody className="divide-y divide-gray-800">
          {bots.map((bot) => (
                    <tr key={bot.pm_id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-3 text-xs md:text-sm text-gray-100">{bot.name}</td>
                      <td className="px-3 py-3">
                        {(() => {
                          const statusInfo = getStatusInfo(bot.status);
                          const StatusIcon = statusInfo.icon;
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.text}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="hidden md:table-cell px-3 py-3 text-xs md:text-sm text-gray-300">
                        {bot.monit ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full transition-all duration-300"
                                style={{ 
                                  width: `${Math.min(100, (bot.monit.memory / bot.monit.memory_limit) * 100)}%`,
                                  backgroundColor: bot.monit.memory / bot.monit.memory_limit > 0.8 ? '#ef4444' : '#005012'
                                }}
                              />
                            </div>
                            <span className="text-xs whitespace-nowrap font-mono">
                              {formatMemory(bot.monit.memory)}MB / {formatMemoryLimit(bot.monit.memory_limit)}MB
                            </span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="hidden md:table-cell px-3 py-3 text-xs md:text-sm text-gray-300">
                        {bot.monit ? `${bot.monit.cpu.toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col md:flex-row gap-2 justify-end">
                          <Button 
                            onClick={() => handleAction(bot.name, "start")}
                            size="sm"
                            variant="ghost"
                            className={`inline-flex items-center gap-1 transition-all duration-200 px-2 py-1 ${
                              bot.status === 'online' || actionInProgress[getActionKey(bot.name, "start")]
                                ? 'opacity-30 cursor-not-allowed'
                                : 'text-[#005012] hover:bg-[#005012]/10 hover:text-[#005012]'
                            }`}
                            disabled={bot.status === 'online' || actionInProgress[getActionKey(bot.name, "start")]}
                          >
                            {actionInProgress[getActionKey(bot.name, "start")] ? (
                              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                            ) : (
                              <PlayCircle className="w-3 h-3 md:w-4 md:h-4" />
                            )}
                            <span className="hidden md:inline">Iniciar</span>
                          </Button>
                          <Button 
                            onClick={() => handleAction(bot.name, "restart")}
                            size="sm"
                            variant="ghost"
                            className={`inline-flex items-center gap-1 transition-all duration-200 px-2 py-1 ${
                              bot.status === 'stopped' || actionInProgress[getActionKey(bot.name, "restart")]
                                ? 'opacity-30 cursor-not-allowed'
                                : 'text-blue-400 hover:bg-blue-400/10 hover:text-blue-300'
                            }`}
                            disabled={bot.status === 'stopped' || actionInProgress[getActionKey(bot.name, "restart")]}
                          >
                            {actionInProgress[getActionKey(bot.name, "restart")] ? (
                              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="w-3 h-3 md:w-4 md:h-4" />
                            )}
                            <span className="hidden md:inline">Reiniciar</span>
                          </Button>
                          <Button 
                            onClick={() => handleAction(bot.name, "stop")}
                            size="sm"
                            variant={bot.status === 'online' ? 'default' : 'ghost'}
                            className={`inline-flex items-center gap-1 transition-all duration-200 px-2 py-1 ${
                              bot.status === 'stopped' || actionInProgress[getActionKey(bot.name, "stop")]
                                ? 'opacity-30 cursor-not-allowed'
                                : bot.status === 'online'
                                  ? 'bg-red-500 hover:bg-red-600 text-white'
                                  : 'text-red-400 hover:bg-red-400/10 hover:text-red-300'
                            }`}
                            disabled={bot.status === 'stopped' || actionInProgress[getActionKey(bot.name, "stop")]}
                          >
                            {actionInProgress[getActionKey(bot.name, "stop")] ? (
                              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
                            ) : (
                              <StopCircle className="w-3 h-3 md:w-4 md:h-4" />
                            )}
                            <span className="hidden md:inline">Parar</span>
                          </Button>
                          <Button
                            onClick={() => toggleConsole(bot.name)}
                            size="sm"
                            variant="ghost"
                            className={`inline-flex items-center gap-1 transition-all duration-200 px-2 py-1 ${
                              selectedBot === bot.name
                                ? 'bg-gray-700 text-gray-100'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`}
                          >
                            <Terminal className="w-3 h-3 md:w-4 md:h-4" />
                            <span className="hidden md:inline">Console</span>
                          </Button>
                        </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
            </div>

            {/* Console do Bot */}
            {selectedBot && (
              <div className="mt-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-[#005012]">
                    <Terminal className="w-5 h-5" />
                    Console: {selectedBot}
                  </h2>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Button
                      onClick={() => clearBotLogs(selectedBot)}
                      variant="outline"
                      size="sm"
                      className="border-gray-700 text-gray-300 hover:bg-gray-800 flex-1 md:flex-none"
                      disabled={isLoadingLogs}
                    >
                      <RefreshCcw className={`w-4 h-4 mr-2 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                      Limpar e Recarregar
                    </Button>
                    <Button
                      onClick={closeConsole}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:bg-gray-800 hover:text-gray-200 flex-1 md:flex-none"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Fechar Console
                    </Button>
                  </div>
                </div>
                <div
                  ref={logsRef}
                  className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs md:text-sm h-[300px] md:h-[400px] overflow-y-auto border border-gray-800 shadow-xl"
                >
                  {isLoadingLogs && !logs[selectedBot]?.length ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-[#005012]" />
                    </div>
                  ) : (
                    logs[selectedBot]?.map((log, index) => (
                      <div key={index} className="whitespace-pre-wrap mb-1 text-gray-300">
                        {log.content}
                      </div>
                    )) || []
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
