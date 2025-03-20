"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Clock, Calendar } from 'lucide-react';

interface Message {
  content: string;
  timestamp: string;
}

interface TranscriptData {
  ticketCode: string;
  messages: Message[];
  createdAt: string;
  closedAt: string;
}

// Usando o proxy da Vercel
const API_SERVER = '/api';

// Função para extrair nome do usuário e conteúdo da mensagem
function parseMessage(content: string): { author: string; content: string; timestamp?: string } {
  // Verifica se é uma mensagem com timestamp
  const timestampMatch = content.match(/^\[([\d/,: ]+)\] ([^:]+): (.+)$/);
  if (timestampMatch) {
    return {
      timestamp: timestampMatch[1],
      author: timestampMatch[2],
      content: timestampMatch[3]
    };
  }

  return {
    author: 'Sistema',
    content: content
  };
}

// Função para verificar se é uma URL de imagem
function isImageUrl(text: string): boolean {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
  const urlMatch = text.match(/\bhttps?:\/\/\S+/);
  return urlMatch ? imageExtensions.test(urlMatch[0]) : false;
}

// Função para extrair URL de uma string
function extractUrl(text: string): string | null {
  const urlMatch = text.match(/\bhttps?:\/\/\S+/);
  return urlMatch ? urlMatch[0] : null;
}

export default function TranscriptViewer() {
  const router = useRouter();
  const { ticketCode } = router.query;
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
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

        // Parse do transcript
        const transcriptData = typeof data.transcript === 'string' ? 
          JSON.parse(data.transcript) : data.transcript;

        setTranscript(transcriptData);
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

  if (!transcript) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-yellow-500">
            <p>Nenhum dado encontrado para este transcript.</p>
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
            Transcript do Ticket #{transcript.ticketCode}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Criado: {new Date(transcript.createdAt).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Fechado: {new Date(transcript.closedAt).toLocaleString('pt-BR')}</span>
            </div>
          </div>
          <div className="h-1 w-32 bg-[#005012]/20 rounded-full mt-4" />
        </div>

        <div className="space-y-4">
          {transcript.messages.map((message, index) => {
            const parsedMessage = parseMessage(message.content);
            const imageUrl = extractUrl(parsedMessage.content);
            const isImage = imageUrl && isImageUrl(imageUrl);

            return (
              <div
                key={index}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-800"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#005012]">
                        {parsedMessage.author}
                      </span>
                      <span className="text-xs text-gray-500">
                        {parsedMessage.timestamp || new Date(message.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-gray-300 break-words">
                      {isImage ? (
                        <div className="mt-2">
                          <img 
                            src={imageUrl} 
                            alt="Anexo" 
                            className="max-w-full rounded-lg border border-gray-700"
                            style={{ maxHeight: '400px' }}
                          />
                        </div>
                      ) : (
                        parsedMessage.content
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 