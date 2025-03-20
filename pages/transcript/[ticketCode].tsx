"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Clock, Calendar, Building2, User } from 'lucide-react';

interface Author {
  id?: string;
  username?: string;
  displayName?: string;
  avatarURL?: string;
  roleColor?: string;
}

interface Embed {
  title?: string;
  description?: string;
  color?: number;
}

interface Attachment {
  url: string;
  name: string;
}

interface Message {
  content: string;
  author?: Author;
  attachments: Attachment[];
  embeds: Embed[];
  timestamp: string;
}

interface TranscriptData {
  ticketCode: string;
  messages: Message[];
  createdAt: string;
  closedAt: string;
  guildId: string;
  guildName: string;
}

// Usando o proxy da Vercel
const API_SERVER = '/api';

// Função para converter menções em texto legível
function formatMentions(content: string): string {
  return content
    .replace(/<@&(\d+)>/g, '@Role') // Menções de cargo
    .replace(/<@!?(\d+)>/g, '@User') // Menções de usuário
    .replace(/<#(\d+)>/g, '#Channel'); // Menções de canal
}

// Função para converter emojis personalizados em texto
function formatEmojis(content: string): string {
  return content.replace(/<:(.*?):(\d+)>/g, ':$1:');
}

// Função para obter informações do autor com fallbacks
function getAuthorInfo(author?: Author) {
  return {
    name: author?.displayName || author?.username || 'Usuário Desconhecido',
    avatar: author?.avatarURL || '/default-avatar.png',
    color: author?.roleColor || '#005012'
  };
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
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mt-2">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Criado: {new Date(transcript.createdAt).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Fechado: {new Date(transcript.closedAt).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              <span>Servidor: {transcript.guildName}</span>
            </div>
          </div>
          <div className="h-1 w-32 bg-[#005012]/20 rounded-full mt-4" />
        </div>

        <div className="space-y-4">
          {transcript.messages.map((message, index) => {
            const authorInfo = getAuthorInfo(message.author);

            return (
              <div
                key={index}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-800"
              >
                <div className="flex items-start gap-3">
                  {authorInfo.avatar ? (
                    <img
                      src={authorInfo.avatar}
                      alt={authorInfo.name}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = '/default-avatar.png';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="font-semibold"
                        style={{ color: authorInfo.color }}
                      >
                        {authorInfo.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    
                    {/* Conteúdo da mensagem */}
                    {message.content && (
                      <div className="text-gray-300 break-words whitespace-pre-wrap">
                        {formatEmojis(formatMentions(message.content))}
                      </div>
                    )}

                    {/* Embeds */}
                    {message.embeds?.map((embed, i) => (
                      <div 
                        key={i}
                        className="mt-2 border-l-4 bg-gray-900/50 p-3 rounded-r-md"
                        style={{ borderLeftColor: embed.color ? `#${embed.color.toString(16)}` : '#005012' }}
                      >
                        {embed.title && (
                          <div className="font-semibold mb-1">
                            {formatEmojis(embed.title)}
                          </div>
                        )}
                        {embed.description && (
                          <div className="text-sm text-gray-300 whitespace-pre-wrap">
                            {formatMentions(embed.description)}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Anexos */}
                    {message.attachments?.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment, i) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.url);
                          return isImage ? (
                            <div key={i} className="mt-2">
                              <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="max-w-full rounded-lg border border-gray-700"
                                style={{ maxHeight: '400px' }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <a
                              key={i}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 px-3 py-1 rounded-md transition-colors"
                            >
                              📎 {attachment.name}
                            </a>
                          );
                        })}
                      </div>
                    )}
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