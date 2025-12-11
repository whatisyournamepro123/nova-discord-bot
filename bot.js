const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const AdvancedAI = require('./ai');
const UltraVerification = require('./verification'); // ← ADD THIS

class DiscordBot {
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
        
        this.ai = new AdvancedAI();
        this.verification = new UltraVerification(this.client, io); // ← ADD THIS
        
        // ... rest of your existing code stays the same ...
        this.logs = [];
        this.tickets = new Map();
        this.ticketChannels = new Map();
        this.ticketCounter = 1;
        this.stats = { ticketsCreated: 0, ticketsClosed: 0, ticketsResponded: 0 };
        this.setupEvents();
    }

    setupEvents() {
        this.client.once('ready', () => {
            console.log('🤖 Bot online: ' + this.client.user.tag);
            this.log('Bot started!', 'success');
        });

        // ═══════════════════════════════════════════════════════════════
        // ADD THIS: MEMBER JOIN HANDLER
        // ═══════════════════════════════════════════════════════════════
        
        this.client.on('guildMemberAdd', async (member) => {
            const session = await this.verification.handleMemberJoin(member);
            if (!session) return;

            // Send verification DM
            await this.sendVerificationMessage(member, session);
            this.emitUpdate();
        });

        // ═══════════════════════════════════════════════════════════════
        // ADD THIS: VERIFICATION INTERACTIONS
        // ═══════════════════════════════════════════════════════════════

        this.client.on('interactionCreate', async (i) => {
            if (!i.isButton()) return;
            
            // Verification buttons
            if (i.customId.startsWith('verify_')) {
                await this.handleVerificationInteraction(i);
                return;
            }

            // Existing ticket buttons
            const [action, ticketId] = i.customId.split('_');
            if (action === 'close') this.closeFromButton(i, ticketId);
            else if (action === 'claim') this.claimTicket(i, ticketId);
        });

        // Your existing messageCreate handler stays the same
        this.client.on('messageCreate', async (msg) => {
            if (msg.author.bot || !msg.guild) return;

            if (this.ticketChannels.has(msg.channel.id)) {
                this.addTicketMessage(msg);
                return;
            }

            const content = msg.content.toLowerCase();

            if (content.startsWith('!ticket')) {
                await this.createTicket(msg, msg.content.slice(7).trim() || 'No reason');
            } else if (content === '!help') {
                msg.reply('🎫 `!ticket [reason]` - Create ticket\n🛡️ Verification is automatic on join\n❓ `!help` - Show help');
            } 
            // ADD THESE SETUP COMMANDS
            else if (content.startsWith('!setverify') && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const channel = msg.mentions.channels.first();
                if (channel) {
                    this.verification.updateSettings(msg.guild.id, { channelId: channel.id });
                    msg.reply(`✅ Verification channel set to ${channel}`);
                }
            }
            else if (content.startsWith('!setrole') && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const role = msg.mentions.roles.first();
                if (role) {
                    this.verification.updateSettings(msg.guild.id, { verifiedRoleId: role.id });
                    msg.reply(`✅ Verified role set to ${role}`);
                }
            }
            else if (content.startsWith('!setunverified') && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const role = msg.mentions.roles.first();
                if (role) {
                    this.verification.updateSettings(msg.guild.id, { unverifiedRoleId: role.id });
                    msg.reply(`✅ Unverified role set to ${role}`);
                }
            }
            else if (msg.mentions.has(this.client.user)) {
                const r = await this.ai.chat(msg.content.replace(/<@!?\d+>/g, '').trim(), msg.author.username);
                msg.reply(r);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADD THESE NEW METHODS
    // ═══════════════════════════════════════════════════════════════════

    async sendVerificationMessage(member, session) {
        const challenge = session.challenges[0];
        const analysis = session.analysis;

        const riskColors = {
            minimal: '#00ff00',
            low: '#57F287',
            medium: '#FEE75C',
            high: '#ED4245',
            critical: '#ff0000'
        };

        const embed = new EmbedBuilder()
            .setColor(riskColors[analysis.riskLevel] || '#5865F2')
            .setTitle('🛡️ Verification Required')
            .setDescription(`Welcome to **${member.guild.name}**!\n\nPlease complete the verification challenge${session.challenges.length > 1 ? 's' : ''} below.`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: `📝 Challenge 1/${session.challenges.length}`, value: challenge.question },
                { name: '⏱️ Time Limit', value: `${Math.floor((session.expiresAt - Date.now()) / 1000)}s`, inline: true },
                { name: '🎯 Difficulty', value: analysis.challengeDifficulty, inline: true },
                { name: '🔄 Attempts', value: `${session.attempts}/${session.maxAttempts}`, inline: true }
            )
            .setFooter({ text: `Security Level: ${analysis.riskLevel.toUpperCase()} | Powered by AI` })
            .setTimestamp();

        if (analysis.riskLevel !== 'minimal' && analysis.riskLevel !== 'low') {
            embed.addFields({
                name: '⚠️ Enhanced Verification',
                value: 'Your account requires additional verification for security reasons.'
            });
        }

        // Create option buttons
        const row = new ActionRowBuilder();
        challenge.options.forEach((option, index) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_${member.id}_${index}`)
                    .setLabel(option.length > 40 ? option.substring(0, 37) + '...' : option)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        try {
            await member.send({ embeds: [embed], components: [row] });
            this.log(`Sent verification to ${member.user.tag} (${analysis.riskLevel} risk)`, 'info');
        } catch (e) {
            // DMs disabled - try verification channel
            const settings = this.verification.getSettings(member.guild.id);
            if (settings.channelId) {
                const channel = member.guild.channels.cache.get(settings.channelId);
                if (channel) {
                    await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
                }
            }
        }

        // Timeout handler
        setTimeout(async () => {
            const currentSession = this.verification.getSession(member.id, member.guild.id);
            if (currentSession && currentSession.status === 'pending') {
                currentSession.status = 'timeout';
                this.verification.stats.failed++;
                
                const settings = this.verification.getSettings(member.guild.id);
                if (settings.kickOnFail) {
                    try {
                        await member.kick('Verification timeout');
                        this.verification.stats.kicked++;
                        this.log(`Kicked ${member.user.tag} (timeout)`, 'moderation');
                    } catch (e) {}
                }
                this.emitUpdate();
            }
        }, session.expiresAt - Date.now());
    }

    async handleVerificationInteraction(interaction) {
        const [, oderId, answerIndex] = interaction.customId.split('_');

        if (interaction.user.id !== oderId) {
            return interaction.reply({ content: '❌ This verification is not for you!', ephemeral: true });
        }

        const result = await this.verification.processAnswer(
            interaction.user.id,
            interaction.guildId,
            parseInt(answerIndex)
        );

        if (!result) {
            return interaction.reply({ content: '❌ Session expired or not found.', ephemeral: true });
        }

        if (result.success && result.completed) {
            // VERIFIED!
            await this.handleVerificationSuccess(interaction);
        } else if (result.success && !result.completed) {
            // Next challenge
            await this.sendNextChallenge(interaction, result.nextChallenge);
        } else if (result.reason === 'bot_detected') {
            await this.handleBotDetected(interaction, result.behavior);
        } else if (result.reason === 'max_attempts') {
            await this.handleMaxAttempts(interaction);
        } else {
            // Wrong answer, try again
            await this.sendRetryChallenge(interaction, result);
        }

        this.emitUpdate();
    }

    async handleVerificationSuccess(interaction) {
        const session = this.verification.getSession(interaction.user.id, interaction.guildId);
        const settings = this.verification.getSettings(interaction.guildId);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Verification Complete!')
            .setDescription('Welcome! You now have full access to the server.')
            .addFields(
                { name: '⏱️ Time', value: `${Math.floor((Date.now() - session.startedAt) / 1000)}s`, inline: true },
                { name: '✅ Challenges', value: `${session.challenges.length}/${session.challenges.length}`, inline: true }
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            
            if (settings.verifiedRoleId) {
                await member.roles.add(settings.verifiedRoleId);
            }
            if (settings.unverifiedRoleId) {
                await member.roles.remove(settings.unverifiedRoleId);
            }
        } catch (e) {}

        this.log(`✅ ${interaction.user.tag} verified successfully!`, 'success');
    }

    async sendNextChallenge(interaction, challenge) {
        const session = this.verification.getSession(interaction.user.id, interaction.guildId);

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Correct!')
            .setDescription('Great job! Here\'s your next challenge:')
            .addFields(
                { name: `📝 Challenge ${session.currentIndex + 1}/${session.challenges.length}`, value: challenge.question },
                { name: '🔄 Progress', value: `${session.currentIndex}/${session.challenges.length} completed`, inline: true }
            );

        const row = new ActionRowBuilder();
        challenge.options.forEach((option, index) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_${interaction.user.id}_${index}`)
                    .setLabel(option.length > 40 ? option.substring(0, 37) + '...' : option)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        await interaction.update({ embeds: [embed], components: [row] });
    }

    async sendRetryChallenge(interaction, result) {
        const embed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('❌ Incorrect')
            .setDescription('That wasn\'t right. Try this new question:')
            .addFields(
                { name: '📝 New Challenge', value: result.newChallenge.question },
                { name: '🔄 Attempts Remaining', value: `${result.attemptsLeft}` }
            );

        const row = new ActionRowBuilder();
        result.newChallenge.options.forEach((option, index) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_${interaction.user.id}_${index}`)
                    .setLabel(option.length > 40 ? option.substring(0, 37) + '...' : option)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        await interaction.update({ embeds: [embed], components: [row] });
    }

    async handleMaxAttempts(interaction) {
        const settings = this.verification.getSettings(interaction.guildId);

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('❌ Verification Failed')
            .setDescription('You have exceeded the maximum number of attempts.')
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        if (settings.kickOnFail) {
            try {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                await member.kick('Failed verification');
                this.verification.stats.kicked++;
                this.log(`Kicked ${interaction.user.tag} (max attempts)`, 'moderation');
            } catch (e) {}
        }
    }

    async handleBotDetected(interaction, behavior) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🤖 Bot Detected')
            .setDescription('Your behavior patterns indicate automated activity.')
            .addFields({ name: 'Indicators', value: behavior.suspicious.join('\n') })
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        const settings = this.verification.getSettings(interaction.guildId);
        
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (settings.banHighRisk) {
                await member.ban({ reason: 'Bot detected during verification' });
                this.verification.stats.banned++;
                this.log(`Banned ${interaction.user.tag} (bot detected)`, 'moderation');
            } else {
                await member.kick('Bot detected during verification');
                this.verification.stats.kicked++;
                this.log(`Kicked ${interaction.user.tag} (bot detected)`, 'moderation');
            }
        } catch (e) {}
    }

    // ═══════════════════════════════════════════════════════════════════
    // YOUR EXISTING METHODS STAY UNCHANGED BELOW
    // ═══════════════════════════════════════════════════════════════════

    async createTicket(msg, reason) {
        // ... your existing ticket code ...
    }

    // ... all your other existing methods stay the same ...

    emitUpdate() {
        if (this.io) {
            this.io.emit('tickets', this.getAllTickets());
            this.io.emit('stats', this.getStats());
            this.io.emit('verificationSessions', this.verification.getPendingSessions()); // ← ADD
            this.io.emit('verificationStats', this.verification.getStats()); // ← ADD
        }
    }

    getStats() {
        return {
            guilds: this.client.guilds?.cache.size || 0,
            users: this.client.guilds?.cache.reduce((a, g) => a + g.memberCount, 0) || 0,
            ping: this.client.ws?.ping || 0,
            uptime: this.client.uptime || 0,
            openTickets: Array.from(this.tickets.values()).filter(t => t.status === 'open').length,
            totalTickets: this.stats.ticketsCreated,
            closedTickets: this.stats.ticketsClosed,
            responses: this.stats.ticketsResponded,
            ai: this.ai.getStats(),
            verification: this.verification.getStats() // ← ADD
        };
    }

    // ... rest of your existing code ...
}

module.exports = DiscordBot;