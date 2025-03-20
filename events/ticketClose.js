const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTranscript } = require('discord-html-transcripts');
const config = require('../config.json');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

// Configuração do servidor
const API_SERVER = 'http://104.234.224.196:4000';

// Função para salvar o transcript no servidor
async function saveTranscriptToServer(ticketCode, content) {
    try {
        const transcriptPath = path.join(process.cwd(), 'transcript.txt');
        await fs.writeFile(transcriptPath, content, 'utf8');
        
        // Notificar o servidor sobre o novo transcript
        await fetch(`${API_SERVER}/bots/transcript/${ticketCode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content
            })
        });
    } catch (error) {
        console.error('Erro ao salvar transcript no servidor:', error);
        throw error;
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            if (!interaction.isButton()) return;
            
            // Verificar se é um tópico de ticket
            if (!interaction.channel.isThread()) return;
            const ticketCode = interaction.channel.name.split(' - ')[1];
            if (!ticketCode) return;

            // Verificar se o usuário tem o cargo roleTeam
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasTeamRole = member.roles.cache.has(config.roleTeam);

            // Lidar com o botão de fechar ticket
            if (interaction.customId === 'close_ticket') {
                // Se não tiver o cargo roleTeam, negar acesso
                if (!hasTeamRole) {
                    return interaction.reply({
                        content: '❌ Você precisa ser da equipe para fechar tickets!',
                        ephemeral: true
                    });
                }

                const confirmEmbed = new EmbedBuilder()
                    .setColor(config.cor)
                    .setTitle('<:cadeado:1352167596429934642> Fechar Ticket')
                    .setDescription(`Você tem certeza que deseja fechar este ticket?\n**Ticket:** #${ticketCode}`);

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm_close')
                            .setLabel('Sim')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:check:1352159973144133723>'),
                        new ButtonBuilder()
                            .setCustomId('cancel_close')
                            .setLabel('Não')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:negative:1352159928881512458>')
                    );

                await interaction.reply({
                    embeds: [confirmEmbed],
                    components: [buttons],
                    ephemeral: true
                });
            }

            // Lidar com a confirmação de fechar
            else if (interaction.customId === 'confirm_close') {
                // Verificar novamente o cargo ao confirmar
                if (!hasTeamRole) {
                    return interaction.reply({
                        content: '❌ Você precisa ser da equipe para fechar tickets!',
                        ephemeral: true
                    });
                }

                // Primeiro enviar mensagem ephemeral para quem clicou
                await interaction.reply({
                    content: '✅ Gerando transcript e fechando o ticket...',
                    ephemeral: true
                });

                try {
                    // Buscar todas as mensagens do canal
                    const messages = await interaction.channel.messages.fetch();
                    const messageArray = Array.from(messages.values()).reverse();

                    // Preparar o conteúdo do transcript
                    const transcriptContent = messageArray.map(msg => {
                        const attachments = Array.from(msg.attachments.values())
                            .map(att => `[Anexo: ${att.name}](${att.url})`)
                            .join('\n');

                        const embedsContent = msg.embeds
                            .map(embed => {
                                let content = '';
                                if (embed.title) content += `**${embed.title}**\n`;
                                if (embed.description) content += `${embed.description}\n`;
                                return content;
                            })
                            .join('\n');

                        return `[${new Date(msg.createdTimestamp).toLocaleString()}] ${msg.author.tag}: ${msg.content}${
                            attachments ? `\n${attachments}` : ''
                        }${embedsContent ? `\n${embedsContent}` : ''}`;
                    }).join('\n');

                    // Salvar o transcript no servidor
                    await saveTranscriptToServer(ticketCode, transcriptContent);

                    // Buscar a primeira mensagem para identificar o criador do ticket
                    const firstMessage = messageArray[0];
                    const creator = firstMessage?.mentions.users.first();

                    // Canal para enviar os logs
                    const logsChannelId = '1351389808848670770';
                    const logsChannel = interaction.guild.channels.cache.get(logsChannelId);

                    if (logsChannel) {
                        // Gerar o transcript HTML
                        const transcript = await createTranscript(interaction.channel, {
                            limit: -1,
                            fileName: `transcript-${ticketCode}.html`,
                            poweredBy: false,
                            saveImages: true,
                            minify: true,
                            returnBuffer: false
                        });

                        // Enviar o transcript e pegar a URL do arquivo
                        const transcriptMessage = await logsChannel.send({
                            files: [transcript]
                        });

                        const transcriptUrl = transcriptMessage.attachments.first()?.url;
                        const wsViewerUrl = `http://104.234.224.196:3000/transcript/${ticketCode}`;

                        // Criar embed do transcript com os botões
                        const transcriptEmbed = new EmbedBuilder()
                            .setColor(config.cor)
                            .setTitle(`📑 Transcript do Ticket #${ticketCode}`)
                            .addFields(
                                { name: '📌 Ticket', value: `#${ticketCode}`, inline: true },
                                { name: '👤 Criador', value: creator ? `${creator}` : 'Não encontrado', inline: true },
                                { name: '🔒 Fechado por', value: `${interaction.user}`, inline: true }
                            )
                            .setFooter({ text: config.nome })
                            .setTimestamp();

                        // Criar botões para o transcript
                        const transcriptButtons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel('Download Transcript')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(transcriptUrl)
                                    .setEmoji('📥'),
                                new ButtonBuilder()
                                    .setLabel('Visualizar Online')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(wsViewerUrl)
                                    .setEmoji('👀')
                            );

                        // Enviar embed com os botões
                        await logsChannel.send({
                            embeds: [transcriptEmbed],
                            components: [transcriptButtons]
                        });
                    }

                    // Enviar mensagem final no ticket
                    const closeEmbed = new EmbedBuilder()
                        .setColor(config.cor)
                        .setTitle('🔒 Ticket Fechado')
                        .setDescription(`**Ticket:** #${ticketCode}\n**Fechado por:** ${interaction.user}\n\nO transcript foi gerado e salvo.`)
                        .setFooter({ text: config.nome })
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [closeEmbed] });

                    // Esperar 5 segundos e arquivar o tópico
                    setTimeout(async () => {
                        try {
                            await interaction.channel.setLocked(true);
                            await interaction.channel.setArchived(true);
                        } catch (error) {
                            console.error('Erro ao arquivar tópico:', error);
                        }
                    }, 5000);

                } catch (error) {
                    console.error('Erro ao gerar transcript:', error);
                    await interaction.followUp({
                        content: '❌ Ocorreu um erro ao gerar o transcript.',
                        ephemeral: true
                    });
                }
            }

            // Lidar com o cancelamento
            else if (interaction.customId === 'cancel_close') {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(config.cor)
                    .setDescription('✅ Fechamento do ticket cancelado!')
                    .setFooter({ text: config.nome })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [cancelEmbed],
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Erro ao fechar ticket:', error);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao fechar o ticket.',
                ephemeral: true
            }).catch(() => {});
        }
    },
}; 