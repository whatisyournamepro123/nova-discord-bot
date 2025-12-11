require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { 
    Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType
} = require('discord.js');

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                              GROQ AI ENGINE                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

class NovaAI {
    constructor() {
        this.groqKey = process.env.GROQ_API_KEY;
        console.log(this.groqKey ? '🧠 Groq AI Ready!' : '⚠️ No Groq API key');
    }

    async ask(prompt, system, maxTokens = 300, temp = 0.7) {
        if (!this.groqKey) return null;
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.groqKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
                    max_tokens: maxTokens,
                    temperature: temp
                })
            });
            const data = await res.json();
            return data.choices?.[0]?.message?.content || null;
        } catch (e) { return null; }
    }

    async analyzeUser(user) {
        const now = Date.now();
        const daysOld = Math.floor((now - user.createdTimestamp) / (1000 * 60 * 60 * 24));
        const hoursOld = Math.floor((now - user.createdTimestamp) / (1000 * 60 * 60));

        let score = 0;
        const flags = [];

        if (hoursOld < 1) { score += 50; flags.push('🚨 Account < 1 hour'); }
        else if (hoursOld < 24) { score += 40; flags.push('⚠️ Account < 24 hours'); }
        else if (daysOld < 7) { score += 25; flags.push('📝 Account < 7 days'); }
        else if (daysOld < 30) { score += 10; }

        if (!user.avatar) { score += 15; flags.push('👤 No avatar'); }

        const username = user.username.toLowerCase();
        if (/^[a-z]{2,4}\d{4,}$/.test(username)) { score += 20; flags.push('🤖 Auto-generated name'); }
        if (/(free|nitro|gift|hack|bot|spam)/i.test(username)) { score += 30; flags.push('🚫 Suspicious keywords'); }

        score = Math.min(100, Math.max(0, score));

        let riskLevel, challengeCount;
        if (score >= 60) { riskLevel = 'critical'; challengeCount = 3; }
        else if (score >= 40) { riskLevel = 'high'; challengeCount = 2; }
        else if (score >= 20) { riskLevel = 'medium'; challengeCount = 1; }
        else { riskLevel = 'low'; challengeCount = 1; }

        return { oderId: user.id, username: user.tag, avatar: user.displayAvatarURL(), daysOld, score, riskLevel, challengeCount, flags };
    }

    async generateChallenge(difficulty) {
        const response = await this.ask(
            `Create a ${difficulty} verification challenge. Types: math, pattern, knowledge, emoji.
JSON only: {"question":"text","answer":"correct","options":["a","b","c","d"],"hint":"hint","type":"type"}`,
            'Create fun challenges. JSON only.', 200, 0.9
        );

        if (response) {
            try {
                let cleaned = response.replace(/```json?|```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                if (parsed.question && parsed.answer && parsed.options?.length >= 2) {
                    if (!parsed.options.includes(parsed.answer)) parsed.options[0] = parsed.answer;
                    parsed.options = parsed.options.sort(() => Math.random() - 0.5);
                    return parsed;
                }
            } catch (e) {}
        }

        const fallbacks = [
            { question: "What is 8 + 5?", answer: "13", options: ["11", "12", "13", "14"], hint: "Basic math!", type: "math" },
            { question: "🔵🔴🔵🔴🔵❓ What's next?", answer: "🔴", options: ["🔵", "🔴", "🟢", "🟡"], hint: "Pattern!", type: "pattern" },
            { question: "What color is the sky?", answer: "Blue", options: ["Blue", "Green", "Red", "Yellow"], hint: "Look up!", type: "knowledge" },
            { question: "How many legs does a dog have?", answer: "4", options: ["2", "4", "6", "8"], hint: "🐕", type: "knowledge" },
            { question: "2 × 6 = ?", answer: "12", options: ["10", "12", "14", "8"], hint: "Multiply!", type: "math" }
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    async verifyAnswer(challenge, userAnswer) {
        const correct = String(challenge.answer).toLowerCase().trim();
        const user = String(userAnswer).toLowerCase().trim();
        if (user === correct) return { correct: true };
        if (!isNaN(correct) && !isNaN(user) && parseFloat(user) === parseFloat(correct)) return { correct: true };
        return { correct: false };
    }

    async categorize(content) {
        const r = await this.ask('Categorize: ' + content, 'Reply ONLY: general, technical, billing, report, or other');
        const valid = ['general', 'technical', 'billing', 'report', 'other'];
        return valid.includes((r || '').toLowerCase().trim()) ? r.toLowerCase().trim() : 'general';
    }

    async suggestResponse(messages, category) {
        const convo = messages.slice(-5).map(m => `${m.author}: ${m.content}`).join('\n');
        return await this.ask(`Suggest helpful reply for ${category} ticket:\n${convo}`, 'Be professional and helpful. Under 200 chars.');
    }

    async analyzeTicket(messages) {
        const convo = messages.slice(-10).map(m => `${m.author}: ${m.content}`).join('\n');
        const response = await this.ask(
            `Analyze this support ticket conversation:\n${convo}\n\nProvide: sentiment (positive/neutral/negative), urgency (low/medium/high), summary (1 sentence)`,
            'Analyze tickets. JSON: {"sentiment":"","urgency":"","summary":""}', 150, 0.3
        );
        try {
            return JSON.parse(response.replace(/```json?|```/g, '').trim());
        } catch (e) {
            return { sentiment: 'neutral', urgency: 'medium', summary: 'Support request' };
        }
    }

    async chat(message, username) {
        return await this.ask(`${username}: ${message}`, 'You are Nova bot. Friendly, helpful, use emojis. Under 250 chars.') || 'Hey! 👋';
    }
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                              DISCORD BOT                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

class NovaBot {
    constructor(io) {
        this.io = io;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.ai = new NovaAI();
        this.sessions = new Map();
        this.settings = new Map();
        this.tickets = new Map();
        this.ticketChannels = new Map();
        this.ticketCounter = 1;
        this.stats = { verified: 0, failed: 0, kicked: 0, ticketsCreated: 0, ticketsClosed: 0, messagesHandled: 0 };
        this.logs = [];
        this.serverEvents = [];

        this.setupEvents();
    }

    getSettings(guildId) {
        if (!this.settings.has(guildId)) {
            this.settings.set(guildId, {
                enabled: true,
                channelId: null,
                verifiedRoleId: null,
                unverifiedRoleId: null,
                logChannelId: null,
                kickOnFail: true,
                maxAttempts: 3,
                timeout: 300
            });
        }
        return this.settings.get(guildId);
    }

    setupEvents() {
        this.client.once('ready', () => {
            console.log(`🤖 ${this.client.user.tag} is online!`);
            this.log('Bot started successfully!', 'success');
            this.addServerEvent('Bot Online', `${this.client.user.tag} connected`, 'success');
        });

        // ═══════════════════════════════════════════════════════════════
        // SERVER EVENTS TRACKING
        // ═══════════════════════════════════════════════════════════════

        this.client.on('guildMemberAdd', async (member) => {
            this.addServerEvent('Member Joined', `${member.user.tag} joined ${member.guild.name}`, 'join');
            
            const settings = this.getSettings(member.guild.id);
            if (!settings.enabled || !settings.channelId) return;

            const channel = member.guild.channels.cache.get(settings.channelId);
            if (!channel) return;

            if (settings.unverifiedRoleId) {
                try { await member.roles.add(settings.unverifiedRoleId); } catch (e) {}
            }

            const analysis = await this.ai.analyzeUser(member.user);
            this.log(`${member.user.tag} joined - Risk: ${analysis.riskLevel}`, analysis.riskLevel === 'critical' ? 'warning' : 'info');

            const challenges = [];
            for (let i = 0; i < analysis.challengeCount; i++) {
                challenges.push(await this.ai.generateChallenge(i === 0 ? 'easy' : 'medium'));
            }

            const sessionId = `${member.id}-${member.guild.id}`;
            this.sessions.set(sessionId, {
                memberId: member.id,
                guildId: member.guild.id,
                channelId: channel.id,
                username: member.user.tag,
                avatar: member.user.displayAvatarURL(),
                analysis,
                challenges,
                currentIndex: 0,
                attempts: 0,
                maxAttempts: settings.maxAttempts,
                status: 'pending',
                startedAt: Date.now(),
                messageId: null
            });

            await this.sendVerificationUI(member, channel, this.sessions.get(sessionId));
            this.emitUpdate();

            setTimeout(async () => {
                const s = this.sessions.get(sessionId);
                if (s && s.status === 'pending') {
                    s.status = 'timeout';
                    this.stats.failed++;
                    this.addServerEvent('Verification Timeout', `${member.user.tag} timed out`, 'warning');
                    if (settings.kickOnFail) {
                        try { await member.kick('Verification timeout'); this.stats.kicked++; } catch (e) {}
                    }
                    this.emitUpdate();
                }
            }, settings.timeout * 1000);
        });

        this.client.on('guildMemberRemove', (member) => {
            this.addServerEvent('Member Left', `${member.user.tag} left ${member.guild.name}`, 'leave');
        });

        this.client.on('messageDelete', (msg) => {
            if (!msg.author?.bot) {
                this.addServerEvent('Message Deleted', `Message by ${msg.author?.tag || 'Unknown'} deleted`, 'moderation');
            }
        });

        this.client.on('messageUpdate', (oldMsg, newMsg) => {
            if (!oldMsg.author?.bot && oldMsg.content !== newMsg.content) {
                this.addServerEvent('Message Edited', `${oldMsg.author?.tag} edited a message`, 'info');
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIONS
        // ═══════════════════════════════════════════════════════════════

        this.client.on('interactionCreate', async (interaction) => {
            try {
                if (interaction.isButton()) {
                    const customId = interaction.customId;
                    if (customId.startsWith('vf_')) await this.handleVerificationButton(interaction);
                    else if (customId.startsWith('claim_')) await this.claimTicket(interaction, customId.replace('claim_', ''));
                    else if (customId.startsWith('close_')) await this.closeTicketButton(interaction, customId.replace('close_', ''));
                }
            } catch (e) {
                console.error('Interaction error:', e);
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // MESSAGES
        // ═══════════════════════════════════════════════════════════════

        this.client.on('messageCreate', async (msg) => {
            if (msg.author.bot || !msg.guild) return;
            this.stats.messagesHandled++;

            // Ticket channel messages - sync to dashboard
            if (this.ticketChannels.has(msg.channel.id)) {
                const ticketId = this.ticketChannels.get(msg.channel.id);
                const ticket = this.tickets.get(ticketId);
                if (ticket) {
                    ticket.messages.push({
                        id: msg.id,
                        author: msg.author.tag,
                        authorId: msg.author.id,
                        authorAvatar: msg.author.displayAvatarURL(),
                        content: msg.content,
                        timestamp: new Date().toISOString(),
                        isStaff: msg.member?.permissions.has(PermissionFlagsBits.ManageMessages) || false
                    });
                    
                    // Emit real-time update to dashboard
                    if (this.io) {
                        this.io.emit('ticketMessage', { ticketId, message: ticket.messages[ticket.messages.length - 1] });
                        this.io.emit('tickets', this.getAllTickets());
                    }
                }
                return;
            }

            const content = msg.content.toLowerCase();
            const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);

            if (content === '!help') await this.sendHelpEmbed(msg);
            else if (content.startsWith('!ticket')) await this.createTicket(msg, msg.content.slice(7).trim() || 'No reason provided');
            else if (content === '!setup' && isAdmin) await this.sendSetupEmbed(msg);
            else if (content.startsWith('!setverify') && isAdmin) {
                const channel = msg.mentions.channels.first();
                if (channel) {
                    this.getSettings(msg.guild.id).channelId = channel.id;
                    msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Verification channel: ${channel}`)] });
                }
            }
            else if (content.startsWith('!setrole') && isAdmin) {
                const role = msg.mentions.roles.first();
                if (role) {
                    this.getSettings(msg.guild.id).verifiedRoleId = role.id;
                    msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Verified role: ${role}`)] });
                }
            }
            else if (content.startsWith('!setunverified') && isAdmin) {
                const role = msg.mentions.roles.first();
                if (role) {
                    this.getSettings(msg.guild.id).unverifiedRoleId = role.id;
                    msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Unverified role: ${role}`)] });
                }
            }
            else if (content === '!testvf' && isAdmin) await this.testVerification(msg);
            else if (msg.mentions.has(this.client.user)) {
                const response = await this.ai.chat(msg.content.replace(/<@!?\d+>/g, '').trim(), msg.author.username);
                msg.reply(response);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICATION UI
    // ═══════════════════════════════════════════════════════════════════════

    async sendVerificationUI(member, channel, session) {
        const challenge = session.challenges[session.currentIndex];
        const embed = this.createVerificationEmbed(member, session, challenge, 'start');
        const components = this.createVerificationButtons(session, challenge);

        const message = await channel.send({ content: `${member}`, embeds: [embed], components });
        session.messageId = message.id;
    }

    createVerificationEmbed(member, session, challenge, state) {
        const colors = { start: '#ffffff', correct: '#00ff00', wrong: '#ffaa00', success: '#00ff00', failed: '#ff0000' };
        const analysis = session.analysis;

        const embed = new EmbedBuilder()
            .setColor(colors[state] || '#ffffff')
            .setAuthor({ name: '🛡️ Nova Verification', iconURL: this.client.user.displayAvatarURL() })
            .setThumbnail(session.avatar)
            .setTimestamp();

        if (state === 'start' || state === 'wrong') {
            embed.setTitle(state === 'wrong' ? '❌ Incorrect! Try Again' : '👋 Verification Required')
                .setDescription(`Welcome ${member}!\n\nComplete the challenge below to access the server.\n\n━━━━━━━━━━━━━━━━━━━━━━━━`)
                .addFields(
                    { name: `📝 Challenge ${session.currentIndex + 1}/${session.challenges.length}`, value: `\`\`\`${challenge.question}\`\`\``, inline: false },
                    { name: '💡 Hint', value: challenge.hint || 'Think carefully!', inline: true },
                    { name: '🔄 Attempts', value: `${session.attempts}/${session.maxAttempts}`, inline: true },
                    { name: '🎯 Risk', value: analysis.riskLevel.toUpperCase(), inline: true }
                )
                .setFooter({ text: '⏱️ 5 minutes to complete • AI-Powered' });
        } else if (state === 'success') {
            embed.setTitle('🎉 Verification Complete!')
                .setDescription(`Welcome to the server!\n\n✅ You now have full access.`)
                .addFields(
                    { name: '⏱️ Time', value: `${Math.floor((Date.now() - session.startedAt) / 1000)}s`, inline: true },
                    { name: '✅ Challenges', value: `${session.challenges.length}`, inline: true }
                );
        } else if (state === 'failed') {
            embed.setTitle('❌ Verification Failed')
                .setDescription('Maximum attempts exceeded.\n\nRejoin the server to try again.');
        }

        return embed;
    }

    createVerificationButtons(session, challenge) {
        const row = new ActionRowBuilder();
        const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

        challenge.options.slice(0, 4).forEach((opt, i) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`vf_${session.memberId}_${session.guildId}_${i}`)
                    .setLabel(String(opt).substring(0, 40))
                    .setStyle(styles[i])
                    .setEmoji(emojis[i])
            );
        });

        return [row];
    }

    async handleVerificationButton(interaction) {
        const parts = interaction.customId.split('_');
        const memberId = parts[1];
        const guildId = parts[2];
        const answerIndex = parseInt(parts[3]);

        if (interaction.user.id !== memberId) {
            return interaction.reply({ content: '❌ Not for you!', ephemeral: true });
        }

        const session = this.sessions.get(`${memberId}-${guildId}`);
        if (!session || session.status !== 'pending') {
            return interaction.reply({ content: '❌ Session expired. Rejoin the server.', ephemeral: true });
        }

        await interaction.deferUpdate();

        const challenge = session.challenges[session.currentIndex];
        const userAnswer = challenge.options[answerIndex];
        const result = await this.ai.verifyAnswer(challenge, userAnswer);

        const member = await interaction.guild.members.fetch(memberId).catch(() => null);
        if (!member) return;

        if (result.correct) {
            session.currentIndex++;

            if (session.currentIndex >= session.challenges.length) {
                session.status = 'verified';
                this.stats.verified++;

                const settings = this.getSettings(guildId);
                if (settings.verifiedRoleId) try { await member.roles.add(settings.verifiedRoleId); } catch (e) {}
                if (settings.unverifiedRoleId) try { await member.roles.remove(settings.unverifiedRoleId); } catch (e) {}

                const embed = this.createVerificationEmbed(member, session, challenge, 'success');
                await interaction.message.edit({ embeds: [embed], components: [] });

                this.log(`✅ ${session.username} verified!`, 'success');
                this.addServerEvent('Verification Success', `${session.username} verified`, 'success');
            } else {
                const next = session.challenges[session.currentIndex];
                const embed = this.createVerificationEmbed(member, session, next, 'start');
                const components = this.createVerificationButtons(session, next);
                await interaction.message.edit({ embeds: [embed], components });
            }
        } else {
            session.attempts++;

            if (session.attempts >= session.maxAttempts) {
                session.status = 'failed';
                this.stats.failed++;

                const embed = this.createVerificationEmbed(member, session, challenge, 'failed');
                await interaction.message.edit({ embeds: [embed], components: [] });

                const settings = this.getSettings(guildId);
                if (settings.kickOnFail) {
                    try { await member.kick('Failed verification'); this.stats.kicked++; } catch (e) {}
                }

                this.addServerEvent('Verification Failed', `${session.username} failed`, 'warning');
            } else {
                session.challenges[session.currentIndex] = await this.ai.generateChallenge('medium');
                const newChallenge = session.challenges[session.currentIndex];
                const embed = this.createVerificationEmbed(member, session, newChallenge, 'wrong');
                const components = this.createVerificationButtons(session, newChallenge);
                await interaction.message.edit({ embeds: [embed], components });
            }
        }

        this.emitUpdate();
    }

    async testVerification(msg) {
        const settings = this.getSettings(msg.guild.id);
        if (!settings.channelId) {
            return msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('❌ Set channel first: `!setverify #channel`')] });
        }

        const channel = msg.guild.channels.cache.get(settings.channelId);
        if (!channel) return msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('❌ Channel not found!')] });

        const analysis = await this.ai.analyzeUser(msg.author);
        const challenges = [await this.ai.generateChallenge('easy')];

        const sessionId = `${msg.author.id}-${msg.guild.id}`;
        this.sessions.set(sessionId, {
            memberId: msg.author.id,
            guildId: msg.guild.id,
            channelId: channel.id,
            username: msg.author.tag,
            avatar: msg.author.displayAvatarURL(),
            analysis,
            challenges,
            currentIndex: 0,
            attempts: 0,
            maxAttempts: 3,
            status: 'pending',
            startedAt: Date.now()
        });

        await this.sendVerificationUI(msg.member, channel, this.sessions.get(sessionId));
        msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Test sent to ${channel}`)] });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TICKET SYSTEM
    // ═══════════════════════════════════════════════════════════════════════

    async createTicket(msg, reason) {
        const user = msg.author;
        const guild = msg.guild;

        for (const [, t] of this.tickets) {
            if (t.userId === user.id && t.status === 'open') {
                const ch = guild.channels.cache.get(t.channelId);
                if (ch) return msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`❌ You have an open ticket: ${ch}`)] });
            }
        }

        const ticketId = `ticket-${this.ticketCounter++}`;
        const category = await this.ai.categorize(reason);

        try {
            const channel = await guild.channels.create({
                name: `🎫-${ticketId}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ]
            });

            const ticket = {
                id: ticketId,
                oderId: user.id,
                oderId: user.tag,
                oderId: user.displayAvatarURL(),
                channelId: channel.id,
                guildId: guild.id,
                guildName: guild.name,
                reason,
                category,
                status: 'open',
                priority: 'normal',
                claimedBy: null,
                createdAt: new Date().toISOString(),
                messages: [{
                    id: '1',
                    author: user.tag,
                    authorId: user.id,
                    authorAvatar: user.displayAvatarURL(),
                    content: reason,
                    timestamp: new Date().toISOString(),
                    isStaff: false
                }]
            };

            // Fix property names
            ticket.userId = user.id;
            ticket.userName = user.tag;
            ticket.userAvatar = user.displayAvatarURL();

            this.tickets.set(ticketId, ticket);
            this.ticketChannels.set(channel.id, ticketId);

            const embed = new EmbedBuilder()
                .setColor('#ffffff')
                .setTitle(`🎫 ${ticketId}`)
                .setDescription(`Hello ${user}!\n\nA staff member will assist you shortly.\n\n━━━━━━━━━━━━━━━━━━━━━━━━`)
                .addFields(
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '🏷️ Category', value: category, inline: true },
                    { name: '👤 User', value: user.tag, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${ticketId}`).setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('✋'),
                new ButtonBuilder().setCustomId(`close_${ticketId}`).setLabel('Close').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
            );

            await channel.send({ embeds: [embed], components: [row] });
            await msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Ticket created: ${channel}`)] });

            this.stats.ticketsCreated++;
            this.log(`Ticket ${ticketId} created`, 'success');
            this.addServerEvent('Ticket Created', `${user.tag} opened ${ticketId}`, 'ticket');
            this.emitUpdate();
        } catch (e) {
            msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('❌ Failed to create ticket')] });
        }
    }

    async claimTicket(interaction, ticketId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Not found', ephemeral: true });

        ticket.claimedBy = interaction.user.tag;
        await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Claimed by ${interaction.user}`)] });
        this.addServerEvent('Ticket Claimed', `${interaction.user.tag} claimed ${ticketId}`, 'ticket');
        this.emitUpdate();
    }

    async closeTicketButton(interaction, ticketId) {
        const ticket = this.tickets.get(ticketId);
        if (ticket) {
            ticket.status = 'closed';
            this.stats.ticketsClosed++;
            this.addServerEvent('Ticket Closed', `${ticketId} closed by ${interaction.user.tag}`, 'ticket');
        }

        await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription('🔒 Closing in 3 seconds...')] });
        
        setTimeout(async () => {
            this.ticketChannels.delete(ticket?.channelId);
            this.tickets.delete(ticketId);
            try { await interaction.channel.delete(); } catch (e) {}
            this.emitUpdate();
        }, 3000);
    }

    // Dashboard sends message to ticket
    async sendTicketMessage(ticketId, content, staffName, staffAvatar) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return { success: false, error: 'Ticket not found' };

        try {
            const guild = await this.client.guilds.fetch(ticket.guildId);
            const channel = await guild.channels.fetch(ticket.channelId);

            const embed = new EmbedBuilder()
                .setColor('#ffffff')
                .setAuthor({ name: `📩 ${staffName}`, iconURL: staffAvatar || this.client.user.displayAvatarURL() })
                .setDescription(content)
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            const message = {
                id: Date.now().toString(),
                author: `${staffName} (Staff)`,
                authorId: 'dashboard',
                authorAvatar: staffAvatar || this.client.user.displayAvatarURL(),
                content,
                timestamp: new Date().toISOString(),
                isStaff: true
            };

            ticket.messages.push(message);
            
            // Emit to all dashboard clients
            if (this.io) {
                this.io.emit('ticketMessage', { ticketId, message });
                this.io.emit('tickets', this.getAllTickets());
            }

            this.log(`Staff replied to ${ticketId}`, 'response');
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async getAISuggestion(ticketId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;
        return await this.ai.suggestResponse(ticket.messages, ticket.category);
    }

    async getTicketAnalysis(ticketId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;
        return await this.ai.analyzeTicket(ticket.messages);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HELP EMBEDS
    // ═══════════════════════════════════════════════════════════════════════

    async sendHelpEmbed(msg) {
        const embed = new EmbedBuilder()
            .setColor('#ffffff')
            .setAuthor({ name: '🤖 Nova Bot', iconURL: this.client.user.displayAvatarURL() })
            .setTitle('Commands')
            .addFields(
                { name: '🎫 Tickets', value: '`!ticket [reason]`', inline: true },
                { name: '⚙️ Setup', value: '`!setup`', inline: true },
                { name: '🧪 Test', value: '`!testvf`', inline: true }
            )
            .setFooter({ text: 'Mention me to chat!' });
        await msg.reply({ embeds: [embed] });
    }

    async sendSetupEmbed(msg) {
        const settings = this.getSettings(msg.guild.id);
        const embed = new EmbedBuilder()
            .setColor('#ffffff')
            .setTitle('⚙️ Setup')
            .addFields(
                { name: 'Commands', value: '`!setverify #channel`\n`!setrole @role`\n`!setunverified @role`', inline: false },
                { name: 'Verify Channel', value: settings.channelId ? `<#${settings.channelId}>` : '❌ Not set', inline: true },
                { name: 'Verified Role', value: settings.verifiedRoleId ? `<@&${settings.verifiedRoleId}>` : '❌ Not set', inline: true },
                { name: 'Unverified Role', value: settings.unverifiedRoleId ? `<@&${settings.unverifiedRoleId}>` : '❌ Not set', inline: true }
            );
        await msg.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════════════════

    log(msg, type = 'info') {
        const entry = { message: msg, type, timestamp: new Date().toISOString() };
        this.logs.push(entry);
        if (this.logs.length > 100) this.logs.shift();
        console.log(`[${type.toUpperCase()}] ${msg}`);
        if (this.io) this.io.emit('newLog', entry);
    }

    addServerEvent(title, description, type) {
        const event = { title, description, type, timestamp: new Date().toISOString() };
        this.serverEvents.unshift(event);
        if (this.serverEvents.length > 50) this.serverEvents.pop();
        if (this.io) this.io.emit('serverEvent', event);
    }

    emitUpdate() {
        if (this.io) {
            this.io.emit('stats', this.getStats());
            this.io.emit('tickets', this.getAllTickets());
            this.io.emit('sessions', this.getPendingSessions());
            this.io.emit('events', this.serverEvents);
        }
    }

    getAllTickets() {
        return Array.from(this.tickets.values()).filter(t => t.status === 'open').map(t => ({
            ...t,
            messageCount: t.messages.length,
            lastMessage: t.messages[t.messages.length - 1]
        }));
    }

    getTicket(ticketId) {
        return this.tickets.get(ticketId);
    }

    getPendingSessions() {
        return Array.from(this.sessions.values())
            .filter(s => s.status === 'pending')
            .map(s => ({
                oderId: s.memberId,
                username: s.username,
                avatar: s.avatar,
                riskLevel: s.analysis.riskLevel,
                score: s.analysis.score,
                progress: `${s.currentIndex}/${s.challenges.length}`,
                attempts: s.attempts,
                startedAt: s.startedAt
            }));
    }

    getStats() {
        return {
            guilds: this.client.guilds?.cache.size || 0,
            users: this.client.guilds?.cache.reduce((a, g) => a + g.memberCount, 0) || 0,
            ping: this.client.ws?.ping || 0,
            uptime: this.client.uptime || 0,
            ...this.stats,
            openTickets: Array.from(this.tickets.values()).filter(t => t.status === 'open').length,
            pendingSessions: Array.from(this.sessions.values()).filter(s => s.status === 'pending').length
        };
    }

    async start(token) {
        await this.client.login(token);
    }
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                           EXPRESS + DASHBOARD                             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const bot = new NovaBot(io);

app.use(express.json());

// Modern Dashboard HTML
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nova AI Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #000000;
            --bg-secondary: #0a0a0a;
            --bg-tertiary: #111111;
            --bg-card: #141414;
            --bg-hover: #1a1a1a;
            --border: #222222;
            --border-light: #333333;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --text-muted: #666666;
            --accent: #ffffff;
            --success: #22c55e;
            --warning: #eab308;
            --error: #ef4444;
            --info: #3b82f6;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-secondary); }
        ::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

        /* Layout */
        .app {
            display: flex;
            height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        .logo {
            padding: 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-icon {
            width: 40px;
            height: 40px;
            background: var(--text-primary);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .logo-text {
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .logo-text span {
            color: var(--text-muted);
            font-weight: 400;
            font-size: 0.75rem;
            display: block;
        }

        .nav {
            padding: 16px;
            flex: 1;
        }

        .nav-section {
            margin-bottom: 24px;
        }

        .nav-label {
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 0 12px;
            margin-bottom: 8px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--text-secondary);
            font-size: 0.9rem;
            font-weight: 500;
        }

        .nav-item:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
        }

        .nav-item.active {
            background: var(--text-primary);
            color: var(--bg-primary);
        }

        .nav-item .icon {
            font-size: 1.1rem;
            width: 24px;
            text-align: center;
        }

        .nav-item .badge {
            margin-left: auto;
            background: var(--bg-hover);
            color: var(--text-secondary);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .nav-item.active .badge {
            background: rgba(0,0,0,0.2);
            color: var(--bg-primary);
        }

        .status-bar {
            padding: 16px;
            border-top: 1px solid var(--border);
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.9); }
        }

        /* Main Content */
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .header {
            padding: 20px 32px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg-secondary);
        }

        .header h1 {
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .header-stats {
            display: flex;
            gap: 24px;
        }

        .header-stat {
            text-align: right;
        }

        .header-stat .value {
            font-size: 1.5rem;
            font-weight: 700;
        }

        .header-stat .label {
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .content {
            flex: 1;
            overflow: hidden;
            display: flex;
        }

        /* Tab Content */
        .tab-content {
            display: none;
            flex: 1;
            overflow: hidden;
        }

        .tab-content.active {
            display: flex;
        }

        /* Dashboard Tab */
        .dashboard {
            flex: 1;
            padding: 32px;
            overflow-y: auto;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            transition: all 0.3s;
        }

        .stat-card:hover {
            border-color: var(--border-light);
            transform: translateY(-2px);
        }

        .stat-card .icon {
            width: 48px;
            height: 48px;
            background: var(--bg-hover);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            margin-bottom: 16px;
        }

        .stat-card .value {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -1px;
            margin-bottom: 4px;
        }

        .stat-card .label {
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        .stat-card.success .value { color: var(--success); }
        .stat-card.warning .value { color: var(--warning); }
        .stat-card.error .value { color: var(--error); }
        .stat-card.info .value { color: var(--info); }

        .section-title {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            overflow: hidden;
        }

        .card-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .card-body {
            padding: 16px;
            max-height: 400px;
            overflow-y: auto;
        }

        /* Events & Logs */
        .event-item, .log-item {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 8px;
            background: var(--bg-hover);
            border-left: 3px solid var(--border-light);
            transition: all 0.2s;
        }

        .event-item:hover, .log-item:hover {
            background: var(--bg-tertiary);
        }

        .event-item.success, .log-item.success { border-color: var(--success); }
        .event-item.warning, .log-item.warning { border-color: var(--warning); }
        .event-item.error, .log-item.error, .event-item.moderation, .log-item.moderation { border-color: var(--error); }
        .event-item.info, .log-item.info { border-color: var(--info); }
        .event-item.ticket, .log-item.ticket { border-color: var(--text-primary); }
        .event-item.join { border-color: var(--success); }
        .event-item.leave { border-color: var(--warning); }

        .event-title {
            font-weight: 600;
            font-size: 0.9rem;
            margin-bottom: 4px;
        }

        .event-desc {
            font-size: 0.8rem;
            color: var(--text-secondary);
        }

        .event-time {
            font-size: 0.7rem;
            color: var(--text-muted);
            margin-top: 4px;
        }

        /* Tickets Tab */
        .tickets-container {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .tickets-list {
            width: 340px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }

        .tickets-header {
            padding: 20px;
            border-bottom: 1px solid var(--border);
        }

        .tickets-header h2 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 12px;
        }

        .search-box {
            position: relative;
        }

        .search-box input {
            width: 100%;
            padding: 12px 16px 12px 40px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 10px;
            color: var(--text-primary);
            font-size: 0.9rem;
            font-family: inherit;
            transition: all 0.2s;
        }

        .search-box input:focus {
            outline: none;
            border-color: var(--text-primary);
        }

        .search-box::before {
            content: '🔍';
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.9rem;
        }

        .tickets-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .ticket-card {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .ticket-card:hover {
            border-color: var(--border-light);
            transform: translateX(4px);
        }

        .ticket-card.active {
            border-color: var(--text-primary);
            background: var(--bg-hover);
        }

        .ticket-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }

        .ticket-id {
            font-weight: 700;
            font-size: 0.9rem;
        }

        .ticket-badge {
            font-size: 0.7rem;
            padding: 4px 8px;
            border-radius: 6px;
            background: var(--bg-hover);
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 600;
        }

        .ticket-user {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .ticket-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--bg-hover);
        }

        .ticket-username {
            font-size: 0.85rem;
            color: var(--text-secondary);
        }

        .ticket-preview {
            font-size: 0.8rem;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ticket-meta {
            display: flex;
            justify-content: space-between;
            margin-top: 8px;
            font-size: 0.7rem;
            color: var(--text-muted);
        }

        /* Chat Area */
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-primary);
        }

        .chat-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-secondary);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .chat-header-info {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .chat-header-avatar {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: var(--bg-hover);
        }

        .chat-header-text h3 {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .chat-header-text span {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .chat-actions {
            display: flex;
            gap: 8px;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .btn:hover {
            transform: translateY(-1px);
        }

        .btn-primary {
            background: var(--text-primary);
            color: var(--bg-primary);
        }

        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .btn-danger {
            background: var(--error);
            color: white;
        }

        .btn-success {
            background: var(--success);
            color: white;
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .message {
            display: flex;
            gap: 12px;
            max-width: 70%;
            animation: messageIn 0.3s ease;
        }

        @keyframes messageIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.staff {
            margin-left: auto;
            flex-direction: row-reverse;
        }

        .message-avatar {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: var(--bg-tertiary);
            flex-shrink: 0;
        }

        .message-content {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px;
        }

        .message.staff .message-content {
            background: var(--bg-tertiary);
            border-color: var(--border-light);
        }

        .message-author {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 6px;
        }

        .message-text {
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .message-time {
            font-size: 0.7rem;
            color: var(--text-muted);
            margin-top: 8px;
        }

        .chat-input-area {
            padding: 20px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-secondary);
        }

        .ai-suggestion {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px 16px;
            margin-bottom: 12px;
            display: none;
        }

        .ai-suggestion.show {
            display: block;
        }

        .ai-suggestion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .ai-suggestion-label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .ai-suggestion-text {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .chat-input-row {
            display: flex;
            gap: 12px;
        }

        .chat-input {
            flex: 1;
            padding: 14px 18px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 12px;
            color: var(--text-primary);
            font-size: 0.9rem;
            font-family: inherit;
            resize: none;
            min-height: 50px;
            max-height: 120px;
            transition: all 0.2s;
        }

        .chat-input:focus {
            outline: none;
            border-color: var(--text-primary);
        }

        .chat-input::placeholder {
            color: var(--text-muted);
        }

        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
        }

        .empty-state-icon {
            font-size: 4rem;
            margin-bottom: 16px;
            opacity: 0.3;
        }

        .empty-state h3 {
            font-size: 1.2rem;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        /* Verification Tab */
        .verification-container {
            flex: 1;
            padding: 32px;
            overflow-y: auto;
        }

        .session-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        }

        .session-card:hover {
            border-color: var(--border-light);
        }

        .session-user {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .session-avatar {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: var(--bg-hover);
        }

        .session-info h4 {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .session-info span {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .session-meta {
            display: flex;
            gap: 24px;
            align-items: center;
        }

        .risk-badge {
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
        }

        .risk-low { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .risk-medium { background: rgba(234, 179, 8, 0.2); color: var(--warning); }
        .risk-high { background: rgba(239, 68, 68, 0.2); color: var(--error); }
        .risk-critical { background: rgba(239, 68, 68, 0.4); color: var(--error); }

        /* Responsive */
        @media (max-width: 1200px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .grid-2 { grid-template-columns: 1fr; }
        }

        @media (max-width: 900px) {
            .sidebar { width: 70px; }
            .logo-text, .nav-label, .nav-item span:not(.icon), .status-indicator span { display: none; }
            .nav-item { justify-content: center; padding: 16px; }
            .nav-item .badge { display: none; }
        }
    </style>
</head>
<body>
    <div class="app">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="logo">
                <div class="logo-icon">🛡️</div>
                <div class="logo-text">
                    Nova AI
                    <span>Dashboard v2.0</span>
                </div>
            </div>
            
            <nav class="nav">
                <div class="nav-section">
                    <div class="nav-label">Main</div>
                    <div class="nav-item active" onclick="showTab('dashboard')">
                        <span class="icon">📊</span>
                        <span>Dashboard</span>
                    </div>
                    <div class="nav-item" onclick="showTab('tickets')">
                        <span class="icon">🎫</span>
                        <span>Tickets</span>
                        <span class="badge" id="ticketBadge">0</span>
                    </div>
                    <div class="nav-item" onclick="showTab('verification')">
                        <span class="icon">🛡️</span>
                        <span>Verification</span>
                        <span class="badge" id="verifyBadge">0</span>
                    </div>
                </div>
                
                <div class="nav-section">
                    <div class="nav-label">Server</div>
                    <div class="nav-item" onclick="showTab('events')">
                        <span class="icon">📡</span>
                        <span>Events</span>
                    </div>
                    <div class="nav-item" onclick="showTab('logs')">
                        <span class="icon">📝</span>
                        <span>Logs</span>
                    </div>
                </div>
            </nav>

            <div class="status-bar">
                <div class="status-indicator">
                    <div class="status-dot"></div>
                    <span>Connected</span>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main">
            <header class="header">
                <h1 id="pageTitle">Dashboard</h1>
                <div class="header-stats">
                    <div class="header-stat">
                        <div class="value" id="headerPing">0ms</div>
                        <div class="label">Ping</div>
                    </div>
                    <div class="header-stat">
                        <div class="value" id="headerUptime">0h</div>
                        <div class="label">Uptime</div>
                    </div>
                </div>
            </header>

            <div class="content">
                <!-- Dashboard Tab -->
                <div class="tab-content active" id="tab-dashboard">
                    <div class="dashboard">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="icon">🌐</div>
                                <div class="value" id="statServers">0</div>
                                <div class="label">Servers</div>
                            </div>
                            <div class="stat-card">
                                <div class="icon">👥</div>
                                <div class="value" id="statUsers">0</div>
                                <div class="label">Users</div>
                            </div>
                            <div class="stat-card success">
                                <div class="icon">✅</div>
                                <div class="value" id="statVerified">0</div>
                                <div class="label">Verified</div>
                            </div>
                            <div class="stat-card error">
                                <div class="icon">❌</div>
                                <div class="value" id="statFailed">0</div>
                                <div class="label">Failed</div>
                            </div>
                        </div>

                        <div class="grid-2">
                            <div class="card">
                                <div class="card-header">
                                    📡 Recent Events
                                </div>
                                <div class="card-body" id="eventsContainer"></div>
                            </div>
                            <div class="card">
                                <div class="card-header">
                                    🎫 Active Tickets
                                </div>
                                <div class="card-body" id="ticketsPreview"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tickets Tab -->
                <div class="tab-content" id="tab-tickets">
                    <div class="tickets-container">
                        <div class="tickets-list">
                            <div class="tickets-header">
                                <h2>🎫 Tickets</h2>
                                <div class="search-box">
                                    <input type="text" placeholder="Search tickets..." id="ticketSearch" oninput="filterTickets()">
                                </div>
                            </div>
                            <div class="tickets-scroll" id="ticketsList"></div>
                        </div>

                        <div class="chat-area" id="chatArea">
                            <div class="empty-state" id="chatEmpty">
                                <div class="empty-state-icon">💬</div>
                                <h3>Select a Ticket</h3>
                                <p>Choose a ticket to view the conversation</p>
                            </div>
                            
                            <div id="chatView" style="display:none;flex:1;flex-direction:column;">
                                <div class="chat-header">
                                    <div class="chat-header-info">
                                        <img class="chat-header-avatar" id="chatAvatar" src="">
                                        <div class="chat-header-text">
                                            <h3 id="chatTitle">Ticket</h3>
                                            <span id="chatSubtitle">Loading...</span>
                                        </div>
                                    </div>
                                    <div class="chat-actions">
                                        <button class="btn btn-secondary" onclick="getAISuggestion()">🧠 AI Suggest</button>
                                        <button class="btn btn-danger" onclick="closeCurrentTicket()">🔒 Close</button>
                                    </div>
                                </div>
                                
                                <div class="chat-messages" id="chatMessages"></div>
                                
                                <div class="chat-input-area">
                                    <div class="ai-suggestion" id="aiSuggestion">
                                        <div class="ai-suggestion-header">
                                            <span class="ai-suggestion-label">🧠 AI Suggestion</span>
                                            <button class="btn btn-secondary" style="padding:6px 12px;font-size:0.75rem" onclick="useSuggestion()">Use</button>
                                        </div>
                                        <div class="ai-suggestion-text" id="aiSuggestionText"></div>
                                    </div>
                                    <div class="chat-input-row">
                                        <textarea class="chat-input" id="chatInput" placeholder="Type your message..." rows="1"></textarea>
                                        <button class="btn btn-primary" onclick="sendMessage()">Send →</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Verification Tab -->
                <div class="tab-content" id="tab-verification">
                    <div class="verification-container">
                        <h2 class="section-title">🛡️ Pending Verifications</h2>
                        <div id="sessionsList"></div>
                    </div>
                </div>

                <!-- Events Tab -->
                <div class="tab-content" id="tab-events">
                    <div class="dashboard">
                        <h2 class="section-title">📡 Server Events</h2>
                        <div class="card">
                            <div class="card-body" id="allEvents" style="max-height:600px"></div>
                        </div>
                    </div>
                </div>

                <!-- Logs Tab -->
                <div class="tab-content" id="tab-logs">
                    <div class="dashboard">
                        <h2 class="section-title">📝 Activity Logs</h2>
                        <div class="card">
                            <div class="card-body" id="allLogs" style="max-height:600px"></div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let tickets = [];
        let currentTicket = null;
        let sessions = [];
        let events = [];
        let logs = [];

        // Tab switching
        function showTab(name) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById('tab-' + name).classList.add('active');
            event.target.closest('.nav-item').classList.add('active');
            
            const titles = { dashboard: 'Dashboard', tickets: 'Tickets', verification: 'Verification', events: 'Server Events', logs: 'Activity Logs' };
            document.getElementById('pageTitle').textContent = titles[name] || name;
        }

        // Socket events
        socket.on('stats', (s) => {
            document.getElementById('statServers').textContent = s.guilds || 0;
            document.getElementById('statUsers').textContent = (s.users || 0).toLocaleString();
            document.getElementById('statVerified').textContent = s.verified || 0;
            document.getElementById('statFailed').textContent = s.failed || 0;
            document.getElementById('headerPing').textContent = (s.ping || 0) + 'ms';
            document.getElementById('headerUptime').textContent = Math.floor((s.uptime || 0) / 3600000) + 'h';
            document.getElementById('ticketBadge').textContent = s.openTickets || 0;
            document.getElementById('verifyBadge').textContent = s.pendingSessions || 0;
        });

        socket.on('tickets', (data) => {
            tickets = data || [];
            renderTickets();
            renderTicketsPreview();
        });

        socket.on('ticketMessage', (data) => {
            if (currentTicket && currentTicket.id === data.ticketId) {
                addMessageToChat(data.message);
            }
        });

        socket.on('sessions', (data) => {
            sessions = data || [];
            renderSessions();
        });

        socket.on('serverEvent', (event) => {
            events.unshift(event);
            renderEvents();
        });

        socket.on('events', (data) => {
            events = data || [];
            renderEvents();
        });

        socket.on('newLog', (log) => {
            logs.unshift(log);
            renderLogs();
        });

        // Render functions
        function renderTickets() {
            const container = document.getElementById('ticketsList');
            const search = document.getElementById('ticketSearch').value.toLowerCase();
            
            const filtered = tickets.filter(t => 
                t.id.toLowerCase().includes(search) || 
                t.userName.toLowerCase().includes(search)
            );

            if (!filtered.length) {
                container.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">📭</div><p>No tickets</p></div>';
                return;
            }

            container.innerHTML = filtered.map(t => \`
                <div class="ticket-card \${currentTicket?.id === t.id ? 'active' : ''}" onclick="selectTicket('\${t.id}')">
                    <div class="ticket-header">
                        <span class="ticket-id">\${t.id}</span>
                        <span class="ticket-badge">\${t.category}</span>
                    </div>
                    <div class="ticket-user">
                        <img class="ticket-avatar" src="\${t.userAvatar}" alt="">
                        <span class="ticket-username">\${t.userName}</span>
                    </div>
                    <div class="ticket-preview">\${t.lastMessage?.content || t.reason}</div>
                    <div class="ticket-meta">
                        <span>💬 \${t.messageCount || t.messages?.length || 0}</span>
                        <span>\${timeAgo(t.createdAt)}</span>
                    </div>
                </div>
            \`).join('');
        }

        function renderTicketsPreview() {
            const container = document.getElementById('ticketsPreview');
            if (!tickets.length) {
                container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No active tickets</div>';
                return;
            }
            container.innerHTML = tickets.slice(0, 5).map(t => \`
                <div class="event-item ticket" onclick="showTab('tickets');selectTicket('\${t.id}')" style="cursor:pointer">
                    <div class="event-title">\${t.id}</div>
                    <div class="event-desc">\${t.userName}: \${t.reason.substring(0, 50)}...</div>
                    <div class="event-time">\${timeAgo(t.createdAt)}</div>
                </div>
            \`).join('');
        }

        function selectTicket(ticketId) {
            currentTicket = tickets.find(t => t.id === ticketId);
            if (!currentTicket) return;

            document.getElementById('chatEmpty').style.display = 'none';
            document.getElementById('chatView').style.display = 'flex';
            
            document.getElementById('chatAvatar').src = currentTicket.userAvatar;
            document.getElementById('chatTitle').textContent = currentTicket.id;
            document.getElementById('chatSubtitle').textContent = \`\${currentTicket.userName} • \${currentTicket.category}\`;

            renderMessages();
            renderTickets();

            // Hide AI suggestion
            document.getElementById('aiSuggestion').classList.remove('show');
        }

        function renderMessages() {
            if (!currentTicket) return;
            
            const container = document.getElementById('chatMessages');
            container.innerHTML = currentTicket.messages.map(m => \`
                <div class="message \${m.isStaff ? 'staff' : ''}">
                    <img class="message-avatar" src="\${m.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="">
                    <div class="message-content">
                        <div class="message-author">\${m.author}</div>
                        <div class="message-text">\${escapeHtml(m.content)}</div>
                        <div class="message-time">\${formatTime(m.timestamp)}</div>
                    </div>
                </div>
            \`).join('');
            
            container.scrollTop = container.scrollHeight;
        }

        function addMessageToChat(message) {
            const container = document.getElementById('chatMessages');
            const div = document.createElement('div');
            div.className = \`message \${message.isStaff ? 'staff' : ''}\`;
            div.innerHTML = \`
                <img class="message-avatar" src="\${message.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="">
                <div class="message-content">
                    <div class="message-author">\${message.author}</div>
                    <div class="message-text">\${escapeHtml(message.content)}</div>
                    <div class="message-time">\${formatTime(message.timestamp)}</div>
                </div>
            \`;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }

        function sendMessage() {
            if (!currentTicket) return;
            const input = document.getElementById('chatInput');
            const content = input.value.trim();
            if (!content) return;

            socket.emit('sendMessage', {
                ticketId: currentTicket.id,
                content: content,
                staffName: 'Dashboard Admin',
                staffAvatar: null
            });

            input.value = '';
            document.getElementById('aiSuggestion').classList.remove('show');
        }

        function getAISuggestion() {
            if (!currentTicket) return;
            document.getElementById('aiSuggestionText').textContent = 'Thinking...';
            document.getElementById('aiSuggestion').classList.add('show');
            socket.emit('getAISuggestion', { ticketId: currentTicket.id });
        }

        socket.on('aiSuggestion', (data) => {
            if (data.suggestion) {
                document.getElementById('aiSuggestionText').textContent = data.suggestion;
            } else {
                document.getElementById('aiSuggestionText').textContent = 'Could not generate suggestion.';
            }
        });

        function useSuggestion() {
            const suggestion = document.getElementById('aiSuggestionText').textContent;
            if (suggestion && suggestion !== 'Thinking...' && suggestion !== 'Could not generate suggestion.') {
                document.getElementById('chatInput').value = suggestion;
                document.getElementById('aiSuggestion').classList.remove('show');
            }
        }

        function closeCurrentTicket() {
            if (!currentTicket) return;
            if (confirm('Close this ticket? This cannot be undone.')) {
                socket.emit('closeTicket', { ticketId: currentTicket.id });
                currentTicket = null;
                document.getElementById('chatEmpty').style.display = 'flex';
                document.getElementById('chatView').style.display = 'none';
            }
        }

        function filterTickets() {
            renderTickets();
        }

        function renderSessions() {
            const container = document.getElementById('sessionsList');
            
            if (!sessions.length) {
                container.innerHTML = '<div class="empty-state" style="padding:60px"><div class="empty-state-icon">✅</div><h3>All Clear</h3><p>No pending verifications</p></div>';
                return;
            }

            container.innerHTML = sessions.map(s => \`
                <div class="session-card">
                    <div class="session-user">
                        <img class="session-avatar" src="\${s.avatar}" alt="">
                        <div class="session-info">
                            <h4>\${s.username}</h4>
                            <span>Progress: \${s.progress} • Attempts: \${s.attempts}</span>
                        </div>
                    </div>
                    <div class="session-meta">
                        <span class="risk-badge risk-\${s.riskLevel}">\${s.riskLevel} (\${s.score})</span>
                        <span style="color:var(--text-muted);font-size:0.8rem">\${timeAgo(s.startedAt)}</span>
                    </div>
                </div>
            \`).join('');
        }

        function renderEvents() {
            const containers = [document.getElementById('eventsContainer'), document.getElementById('allEvents')];
            
            containers.forEach((container, idx) => {
                if (!container) return;
                const limit = idx === 0 ? 10 : 50;
                
                if (!events.length) {
                    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No events yet</div>';
                    return;
                }

                container.innerHTML = events.slice(0, limit).map(e => \`
                    <div class="event-item \${e.type}">
                        <div class="event-title">\${e.title}</div>
                        <div class="event-desc">\${e.description}</div>
                        <div class="event-time">\${formatTime(e.timestamp)}</div>
                    </div>
                \`).join('');
            });
        }

        function renderLogs() {
            const container = document.getElementById('allLogs');
            if (!container) return;
            
            if (!logs.length) {
                container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No logs yet</div>';
                return;
            }

            container.innerHTML = logs.slice(0, 100).map(l => \`
                <div class="log-item \${l.type}">
                    <strong>\${formatTime(l.timestamp)}</strong> \${l.message}
                </div>
            \`).join('');
        }

        // Utility functions
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function timeAgo(timestamp) {
            const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
            if (seconds < 60) return 'Just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
            return Math.floor(seconds / 86400) + 'd ago';
        }

        // Enter to send
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        document.getElementById('chatInput').addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    </script>
</body>
</html>`);
});

// Socket.IO handlers
io.on('connection', (socket) => {
    console.log('📊 Dashboard connected');
    
    socket.emit('stats', bot.getStats());
    socket.emit('tickets', bot.getAllTickets());
    socket.emit('sessions', bot.getPendingSessions());
    socket.emit('events', bot.serverEvents);

    const interval = setInterval(() => {
        socket.emit('stats', bot.getStats());
        socket.emit('sessions', bot.getPendingSessions());
    }, 3000);

    socket.on('sendMessage', async (data) => {
        await bot.sendTicketMessage(data.ticketId, data.content, data.staffName, data.staffAvatar);
    });

    socket.on('getAISuggestion', async (data) => {
        const suggestion = await bot.getAISuggestion(data.ticketId);
        socket.emit('aiSuggestion', { ticketId: data.ticketId, suggestion });
    });

    socket.on('closeTicket', async (data) => {
        const ticket = bot.tickets.get(data.ticketId);
        if (ticket) {
            ticket.status = 'closed';
            bot.stats.ticketsClosed++;
            bot.ticketChannels.delete(ticket.channelId);
            
            try {
                const guild = await bot.client.guilds.fetch(ticket.guildId);
                const channel = await guild.channels.fetch(ticket.channelId);
                await channel.delete();
            } catch (e) {}
            
            bot.tickets.delete(data.ticketId);
            bot.addServerEvent('Ticket Closed', `${data.ticketId} closed from dashboard`, 'ticket');
            bot.emitUpdate();
        }
    });

    socket.on('disconnect', () => clearInterval(interval));
});

const PORT = process.env.PORT || 10148;

server.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  🛡️  NOVA AI - Advanced Discord Bot              ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🌐  Dashboard: http://localhost:${PORT}            ║`);
    console.log('║  🎫  Tickets: !ticket [reason]                   ║');
    console.log('║  🛡️  Verification: Automatic on join             ║');
    console.log('║  🧪  Test: !testvf                               ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    
    if (process.env.DISCORD_TOKEN) {
        await bot.start(process.env.DISCORD_TOKEN);
    } else {
        console.log('⚠️ No DISCORD_TOKEN in .env!');
    }
});

hi