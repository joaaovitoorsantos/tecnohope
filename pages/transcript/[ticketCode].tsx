"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

interface Message {
  author: {
    username: string;
    avatarURL: string;
    id: string;
  };
  content: string;
  timestamp: number;
  attachments: {
    url: string;
    name: string;
  }[];
  embeds: any[];
}

const API_SERVER = 'http://104.234.224.196:4000';

export default function TranscriptViewer() {
  const router = useRouter();
  const { ticketCode } = router.query;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTranscript() {
      if (!ticketCode) return;

      try {
        setLoading(true);
        setError(null);
        console.log('Buscando transcript:', `${API_SERVER}/bots/transcript/${ticketCode}`);
        
        const res = await fetch(`${API_SERVER}/bots/transcript/${ticketCode}`);
        console.log('Status da resposta:', res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error('Erro da API:', errorData);
          throw new Error(errorData.details || 'Erro ao carregar transcript');
        }

        const data = await res.json();
        console.log('Dados recebidos:', data);
        
        if (!data.transcript) {
          throw new Error('Transcript não encontrado nos dados');
        }

        // Garantir que o transcript é um array
        const transcriptData = Array.isArray(data.transcript) ? data.transcript : 
          (typeof data.transcript === 'string' ? JSON.parse(data.transcript) : []);

        console.log('Transcript processado:', {
          isArray: Array.isArray(transcriptData),
          length: transcriptData.length,
          firstMessage: transcriptData[0]
        });

        setMessages(transcriptData);
      } catch (err) {
        console.error('Erro ao buscar transcript:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar transcript');
      } finally {
        setLoading(false);
      }
    }

    if (ticketCode) {
      console.log('Iniciando busca do transcript para:', ticketCode);
      fetchTranscript();
    }
  }, [ticketCode]);

  if (!ticketCode) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p>Código do ticket não fornecido</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#005012]" />
          <p>Carregando transcript...</p>
          <p className="text-sm text-gray-400 mt-2">Ticket #{ticketCode}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500">
            <h2 className="text-lg font-semibold mb-2">Erro ao carregar transcript</h2>
            <p>{error}</p>
            <button 
              onClick={() => router.reload()}
              className="mt-4 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#005012] mb-2">
            Transcript do Ticket #{ticketCode}
          </h1>
          <div className="h-1 w-32 bg-[#005012]/20 rounded-full" />
        </div>

        {messages.length === 0 ? (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-yellow-500">
            <p>Nenhuma mensagem encontrada neste transcript.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-800"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={message.author.avatarURL}
                    alt={message.author.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#005012]">
                        {message.author.username}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-gray-300 break-words">
                      {message.content}
                    </div>
                    {message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((att, i) => (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 px-3 py-1 rounded-md transition-colors"
                          >
                            📎 {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                    {message.embeds.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.embeds.map((embed, i) => (
                          <div
                            key={i}
                            className="border-l-4 border-[#005012] bg-gray-900 p-3 rounded-r-md"
                          >
                            {embed.title && (
                              <div className="font-semibold text-[#005012] mb-1">
                                {embed.title}
                              </div>
                            )}
                            {embed.description && (
                              <div className="text-sm text-gray-300">
                                {embed.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 