const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const AdvancedAI = require('./ai');
const UltraVerification = require('./verification');
const UltraModeration = require('./moderation'); // 👈 IMPORT THIS

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
        this.verification = new UltraVerification(this.client, io);
        this.moderation = new UltraModeration(this.client, this.ai); // 👈 INITIALIZE THIS
        
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

        this.client.on('guildMemberAdd', async (member) => {
            const session = await this.verification.handleMemberJoin(member);
            if (!session) return;
            await this.sendVerificationMessage(member, session);
            this.emitUpdate();
        });

        this.client.on('interactionCreate', async (i) => {
            if (!i.isButton()) return;
            if (i.customId.startsWith('verify_')) {
                await this.handleVerificationInteraction(i);
                return;
            }
            const [action, ticketId] = i.customId.split('_');
            if (action === 'close') this.closeFromButton(i, ticketId);
            else if (action === 'claim') this.claimTicket(i, ticketId);
        });

        this.client.on('messageCreate', async (msg) => {
            if (msg.author.bot || !msg.guild) return;

            // 🛡️ ULTRA ADVANCED MODERATION SCAN 🛡️
            await this.moderation.scanMessage(msg); // 👈 THIS SCANS EVERY MESSAGE

            if (this.ticketChannels.has(msg.channel.id)) {
                this.addTicketMessage(msg);
                return;
            }

            const content = msg.content.toLowerCase();

            if (content.startsWith('!ticket')) {
                await this.createTicket(msg, msg.content.slice(7).trim() || 'No reason');
            } else if (content === '!help') {
                msg.reply('🎫 `!ticket` - Support\n🛡️ `!setup` - Admin Setup');
            } 
            
            // AI Chat Fallback (Only if not deleted by automod)
            else if (msg.mentions.has(this.client.user)) {
                const r = await this.ai.chat(msg.content.replace(/<@!?\d+>/g, '').trim(), msg.author.username);
                if (r) msg.reply(r);
            }
        });
    }

    // ... (Keep all your existing verification/ticket functions below unchanged) ...
    // Copy them from your previous file or ask me if you need the full file again.
    
    // Helper logging for the bot instance
    log(msg, type = 'info') {
        const entry = { message: msg, type, timestamp: new Date().toISOString() };
        this.logs.push(entry);
        if (this.io) this.io.emit('newLog', entry);
    }
    
    // ... Keep existing Ticket/Verification methods ...
}

module.exports = DiscordBot;