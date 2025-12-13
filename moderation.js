const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class UltraModeration {
    constructor(client, ai) {
        this.client = client;
        this.ai = ai;
        this.spamMap = new Map(); // Tracks message rates
        
        // Settings (In a real bot, fetch these from DB per guild)
        this.config = {
            logChannel: 'mod-logs', // Name of channel to log to
            maxMentions: 5,
            antiInvite: true,
            antiLink: false, // Set true to ban all links
            aiModeration: true
        };
    }

    async scanMessage(message) {
        if (message.author.bot) return;
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return; // Admins bypass

        // 1. Anti-Invite Check
        if (this.config.antiInvite && /(discord\.(gg|io|me|li)|discordapp\.com\/invite)/i.test(message.content)) {
            return await this.punish(message, 'Warn', 'Unauthorized Discord Invite');
        }

        // 2. Mass Mention Check
        if (message.mentions.users.size > this.config.maxMentions) {
            return await this.punish(message, 'Timeout', 'Mass Mention Spam');
        }

        // 3. Anti-Spam (Fast messaging)
        if (this.checkSpam(message)) {
            return await this.punish(message, 'Timeout', 'Sending messages too fast');
        }

        // 4. AI Content Analysis (The "Ultra Advanced" part)
        if (this.config.aiModeration && this.ai) {
            const analysis = await this.ai.analyzeSafety(message.content);
            if (analysis && !analysis.safe && analysis.flagged) {
                const action = analysis.severity > 7 ? 'Ban' : (analysis.severity > 4 ? 'Timeout' : 'Warn');
                return await this.punish(message, action, `AI Detected: ${analysis.category.toUpperCase()} (${analysis.reason})`);
            }
        }
    }

    checkSpam(message) {
        const limit = 5; // messages
        const timeFrame = 5000; // ms
        
        const key = `${message.author.id}:${message.guild.id}`;
        const userData = this.spamMap.get(key) || [];
        const now = Date.now();

        // Filter old messages
        const recent = userData.filter(t => now - t < timeFrame);
        recent.push(now);
        this.spamMap.set(key, recent);

        return recent.length > limit;
    }

    async punish(message, action, reason) {
        try {
            // Delete the triggering message
            if (message.deletable) await message.delete();

            // Send Feedback to User
            const userEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`🛡️ Auto-Moderation: ${action}`)
                .setDescription(`You were flagged in **${message.guild.name}**`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Action', value: action }
                )
                .setTimestamp();
            
            try { await message.author.send({ embeds: [userEmbed] }); } catch(e) {}

            // Execute Discord Action
            const member = message.member;
            if (action === 'Timeout' && member.moderatable) {
                await member.timeout(10 * 60 * 1000, reason); // 10 mins
            } else if (action === 'Ban' && member.bannable) {
                await member.ban({ reason: `AutoMod: ${reason}` });
            } else if (action === 'Kick' && member.kickable) {
                await member.kick(`AutoMod: ${reason}`);
            }

            // Log to Channel
            await this.logToChannel(message, action, reason);

        } catch (error) {
            console.error('Moderation Error:', error);
        }
    }

    async logToChannel(message, action, reason) {
        const channel = message.guild.channels.cache.find(c => c.name === this.config.logChannel);
        if (!channel) return;

        const logEmbed = new EmbedBuilder()
            .setColor(action === 'Ban' ? '#FF0000' : '#FFA500')
            .setTitle(`🛡️ NOVA Auto-Mod Action`)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: '👤 User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: '🔨 Action', value: action, inline: true },
                { name: '📝 Reason', value: reason, inline: false },
                { name: '💬 Content', value: `\`\`\`${message.content.substring(0, 1000)}\`\`\``, inline: false }
            )
            .setFooter({ text: 'Nova AI Security System' })
            .setTimestamp();

        await channel.send({ embeds: [logEmbed] });
    }
}

module.exports = UltraModeration;