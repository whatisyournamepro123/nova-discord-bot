// server.js - COMPLETE ULTRA NOVA AI SYSTEM (FULLY FIXED)
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType
} = require('discord.js');

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                           NOVA ULTRA AI ENGINE                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class NovaUltraAI {
  constructor() {
    this.groqKey = process.env.GROQ_API_KEY;
    this.contextMemory = new Map();
    this.userProfiles = new Map();
    this.moderationHistory = new Map();
    this.thinkingCache = new Map();
    
    this.patterns = {
      toxicity: /\b(fuck|shit|bitch|ass|dick|cunt|bastard|damn|hell)\b/gi,
      slurs: /\b(nigger|nigga|faggot|retard|spic|chink|kike)\b/gi,
      threats: /\b(kill|murder|die|death|shoot|stab|hurt|attack)\s*(you|him|her|them|yourself)/gi,
      spam: /(.)\1{5,}|(\b\w+\b)(\s+\1){3,}/gi,
      links: /(https?:\/\/[^\s]+)|(discord\.gg\/\w+)|(bit\.ly\/\w+)/gi,
      invites: /discord\.gg\/\w+|discordapp\.com\/invite\/\w+/gi,
      scam: /(free nitro|gift card|click here|claim now|limited time)/gi,
      caps: /^[A-Z\s!?]{15,}$/,
      zalgo: /[\u0300-\u036f\u0489]{3,}/g
    };

    this.sentimentLexicon = {
      positive: ['good', 'great', 'awesome', 'amazing', 'love', 'like', 'thanks', 'thank', 'nice', 'cool', 'best', 'happy', 'wonderful', 'excellent', 'perfect', 'beautiful'],
      negative: ['bad', 'hate', 'worst', 'terrible', 'awful', 'horrible', 'sucks', 'stupid', 'dumb', 'ugly', 'annoying', 'boring', 'angry', 'sad'],
      toxic: ['fuck', 'shit', 'bitch', 'ass', 'damn', 'crap', 'hell', 'dick', 'bastard', 'idiot', 'moron', 'loser', 'pathetic', 'trash']
    };

    console.log(this.groqKey ? '🧠 Nova Ultra AI Engine Online [GROQ ENABLED]' : '🧠 Nova Ultra AI Engine Online [FALLBACK MODE]');
  }

  async think(prompt, systemContext, options = {}) {
    if (!this.groqKey) return null;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemContext },
            { role: "user", content: prompt }
          ],
          max_tokens: options.maxTokens || 500,
          temperature: options.temperature || 0.7
        })
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error('AI Think Error:', e.message);
      return null;
    }
  }

  async moderateMessage(message, member, guildSettings) {
    const content = message.content;
    const oderId = member.id;
    const username = member.user.tag;
    const now = Date.now();

    if (!this.userProfiles.has(oderId)) {
      this.userProfiles.set(oderId, {
        oderId: oderId,
        username: username,
        messages: [],
        warnings: 0,
        trustScore: 50,
        firstSeen: now,
        lastSeen: now,
        violations: [],
        positiveActions: 0,
        messagesAnalyzed: 0,
        averageSentiment: 0
      });
    }

    const profile = this.userProfiles.get(oderId);
    profile.lastSeen = now;
    profile.messagesAnalyzed++;

    profile.messages.push({
      content: content.substring(0, 200),
      timestamp: now,
      channelId: message.channel.id
    });

    if (profile.messages.length > 50) profile.messages.shift();

    const quickAnalysis = this.quickAnalyze(content, profile);

    if (quickAnalysis.severity === 'critical') {
      return this.buildModerationResult(quickAnalysis, profile, 'quick');
    }

    const contextAnalysis = this.analyzeContext(content, profile, message);

    let aiAnalysis = null;
    const needsAI = quickAnalysis.score > 20 || contextAnalysis.suspicious || content.length > 50;

    if (needsAI && this.groqKey) {
      aiAnalysis = await this.deepAnalyze(content, profile, message, guildSettings);
    }

    const finalDecision = this.synthesizeDecision(quickAnalysis, contextAnalysis, aiAnalysis, profile);
    this.updateProfile(profile, finalDecision);

    return finalDecision;
  }

  quickAnalyze(content, profile) {
    let score = 0;
    const flags = [];
    const lower = content.toLowerCase();

    if (this.patterns.slurs.test(content)) {
      score += 100;
      flags.push({ type: 'slur', severity: 'critical', detail: 'Racial/discriminatory slur detected' });
    }

    if (this.patterns.threats.test(content)) {
      score += 80;
      flags.push({ type: 'threat', severity: 'critical', detail: 'Threat of violence detected' });
    }

    if (this.patterns.scam.test(lower)) {
      score += 70;
      flags.push({ type: 'scam', severity: 'high', detail: 'Potential scam/phishing' });
    }

    const toxicMatches = content.match(this.patterns.toxicity);
    if (toxicMatches) {
      score += Math.min(toxicMatches.length * 15, 60);
      flags.push({ type: 'toxicity', severity: 'medium', detail: `${toxicMatches.length} toxic word(s)` });
    }

    if (this.patterns.spam.test(content)) {
      score += 40;
      flags.push({ type: 'spam', severity: 'medium', detail: 'Spam pattern detected' });
    }

    if (this.patterns.caps.test(content) && content.length > 15) {
      score += 25;
      flags.push({ type: 'caps', severity: 'low', detail: 'Excessive caps' });
    }

    if (this.patterns.invites.test(content)) {
      score += 35;
      flags.push({ type: 'invite', severity: 'medium', detail: 'Discord invite link' });
    }

    if (this.patterns.zalgo.test(content)) {
      score += 30;
      flags.push({ type: 'zalgo', severity: 'low', detail: 'Zalgo/corrupted text' });
    }

    const sentiment = this.calculateSentiment(lower);
    score = Math.round(score * (1 - (profile.trustScore - 50) / 200));

    let severity;
    if (score >= 80) severity = 'critical';
    else if (score >= 50) severity = 'high';
    else if (score >= 30) severity = 'medium';
    else if (score >= 15) severity = 'low';
    else severity = 'none';

    return { score, flags, severity, sentiment };
  }

  calculateSentiment(text) {
    const words = text.split(/\s+/);
    let positive = 0, negative = 0, toxic = 0;

    words.forEach(word => {
      if (this.sentimentLexicon.positive.includes(word)) positive++;
      if (this.sentimentLexicon.negative.includes(word)) negative++;
      if (this.sentimentLexicon.toxic.includes(word)) toxic++;
    });

    const total = words.length || 1;
    return {
      positive: positive / total,
      negative: negative / total,
      toxic: toxic / total,
      overall: (positive - negative - toxic * 2) / total
    };
  }

  analyzeContext(content, profile, message) {
    const suspicious = [];
    let contextScore = 0;

    const recentMessages = profile.messages.filter(m => m.timestamp > Date.now() - 10000);
    if (recentMessages.length > 5) {
      suspicious.push('Rapid message sending');
      contextScore += 20;
    }

    const duplicates = profile.messages.filter(m => 
      m.content === content.substring(0, 200) && m.timestamp > Date.now() - 60000
    );
    if (duplicates.length > 2) {
      suspicious.push('Repeated messages');
      contextScore += 30;
    }

    if (profile.warnings >= 3) {
      suspicious.push('Multiple prior warnings');
      contextScore += 15;
    }

    if (profile.trustScore < 30) {
      suspicious.push('Low trust score');
      contextScore += 10;
    }

    const recentViolations = profile.violations.filter(v => v.timestamp > Date.now() - 3600000);
    if (recentViolations.length >= 2) {
      suspicious.push('Recent violation history');
      contextScore += 25;
    }

    return {
      suspicious: suspicious.length > 0,
      reasons: suspicious,
      score: contextScore,
      recentViolations: recentViolations.length,
      userTrust: profile.trustScore
    };
  }

  async deepAnalyze(content, profile, message, guildSettings) {
    const recentContext = profile.messages.slice(-5).map(m => m.content).join(' | ');

    const prompt = `ANALYZE THIS DISCORD MESSAGE FOR MODERATION:

MESSAGE: "${content}"

USER CONTEXT:
- Trust Score: ${profile.trustScore}/100
- Warning Count: ${profile.warnings}
- Recent Messages: "${recentContext}"
- Account Age in Server: ${Math.floor((Date.now() - profile.firstSeen) / 86400000)} days

RESPOND IN JSON ONLY:
{
  "harmful": true/false,
  "confidence": 0-100,
  "toxicityScore": 0-100,
  "categories": ["list"],
  "intent": "malicious/careless/joking/unclear",
  "recommendation": "ignore/warn/delete/mute/ban",
  "reasoning": "explanation",
  "suggestedResponse": "what to tell user"
}`;

    const response = await this.think(prompt, 'You are an expert Discord moderator AI. Output valid JSON only.', { temperature: 0.3, maxTokens: 400 });

    if (response) {
      try {
        let cleaned = response.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/```json?|```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  synthesizeDecision(quick, context, ai, profile) {
    let action = 'none';
    let reason = '';
    let severity = 'none';
    let confidence = 0;

    if (quick.severity === 'critical') {
      action = quick.flags.some(f => f.type === 'slur' || f.type === 'threat') ? 'ban' : 'delete_warn';
      reason = quick.flags.map(f => f.detail).join(', ');
      severity = 'critical';
      confidence = 95;
    }
    else if (quick.severity === 'high' || (quick.score + context.score) > 60) {
      if (ai && ai.harmful) {
        action = ai.recommendation === 'ban' ? 'mute' : ai.recommendation;
        reason = ai.reasoning || quick.flags.map(f => f.detail).join(', ');
        severity = 'high';
        confidence = ai.confidence || 75;
      } else if (!ai) {
        action = 'delete_warn';
        reason = quick.flags.map(f => f.detail).join(', ');
        severity = 'high';
        confidence = 70;
      }
    }
    else if (quick.severity === 'medium' && ai) {
      if (ai.harmful && ai.confidence > 60) {
        action = ai.recommendation;
        reason = ai.reasoning;
        severity = 'medium';
        confidence = ai.confidence;
      }
    }
    else if (context.score > 40) {
      action = 'warn';
      reason = context.reasons.join(', ');
      severity = 'low';
      confidence = 60;
    }

    if (profile.trustScore > 80 && severity !== 'critical') {
      confidence -= 15;
      if (confidence < 50) action = 'none';
    }

    return {
      action,
      reason,
      severity,
      confidence,
      quickAnalysis: quick,
      contextAnalysis: context,
      aiAnalysis: ai,
      suggestedResponse: ai?.suggestedResponse || this.getDefaultResponse(severity),
      shouldAct: action !== 'none' && confidence >= 50
    };
  }

  getDefaultResponse(severity) {
    const responses = {
      critical: 'Your message violated our community guidelines. Further violations will result in a ban.',
      high: 'Please keep the chat respectful. Your message was removed.',
      medium: 'Let\'s keep things friendly here. Please review our guidelines.',
      low: 'Please be mindful of our community rules.',
      none: ''
    };
    return responses[severity] || '';
  }

  updateProfile(profile, decision) {
    if (decision.shouldAct) {
      profile.violations.push({
        type: decision.reason,
        severity: decision.severity,
        action: decision.action,
        timestamp: Date.now()
      });

      if (decision.action === 'warn' || decision.action === 'delete_warn') {
        profile.warnings++;
      }

      const trustPenalty = { critical: 30, high: 20, medium: 10, low: 5 };
      profile.trustScore = Math.max(0, profile.trustScore - (trustPenalty[decision.severity] || 0));
    } else {
      profile.positiveActions++;
      if (profile.positiveActions % 10 === 0) {
        profile.trustScore = Math.min(100, profile.trustScore + 1);
      }
    }
  }

  buildModerationResult(analysis, profile, method) {
    return {
      action: analysis.severity === 'critical' ? 'delete_warn' : 'warn',
      reason: analysis.flags.map(f => f.detail).join(', '),
      severity: analysis.severity,
      confidence: 90,
      quickAnalysis: analysis,
      contextAnalysis: null,
      aiAnalysis: null,
      suggestedResponse: this.getDefaultResponse(analysis.severity),
      shouldAct: true,
      method
    };
  }

  async analyzeNewUser(user) {
    const now = Date.now();
    const accountAge = now - user.createdTimestamp;
    const daysOld = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const hoursOld = Math.floor(accountAge / (1000 * 60 * 60));

    let riskScore = 0;
    const flags = [];

    if (hoursOld < 1) { riskScore += 50; flags.push('🚨 Account < 1 hour old'); }
    else if (hoursOld < 24) { riskScore += 35; flags.push('⚠️ Account < 24 hours old'); }
    else if (daysOld < 7) { riskScore += 20; flags.push('📝 Account < 1 week old'); }
    else if (daysOld < 30) { riskScore += 10; }
    else if (daysOld > 365) { riskScore -= 10; }

    if (!user.avatar) { riskScore += 15; flags.push('👤 No avatar'); }
    else if (user.avatar.startsWith('a_')) { riskScore -= 5; }

    const username = user.username.toLowerCase();
    if (/^[a-z]{2,4}\d{4,}$/.test(username)) { riskScore += 20; flags.push('🤖 Auto-generated name'); }
    if (/(free|nitro|gift|hack|bot|spam)/i.test(username)) { riskScore += 30; flags.push('🚫 Suspicious keywords'); }

    riskScore = Math.max(0, Math.min(100, riskScore));

    let riskLevel, challengeCount;
    if (riskScore >= 60) { riskLevel = 'critical'; challengeCount = 3; }
    else if (riskScore >= 40) { riskLevel = 'high'; challengeCount = 2; }
    else if (riskScore >= 20) { riskLevel = 'medium'; challengeCount = 2; }
    else { riskLevel = 'low'; challengeCount = 1; }

    return {
      oderId: user.id,
      username: user.tag,
      avatar: user.displayAvatarURL(),
      daysOld,
      hoursOld,
      riskScore,
      riskLevel,
      flags,
      challengeCount
    };
  }

  async generateChallenge(difficulty) {
    const aiPrompt = `Generate a ${difficulty} verification challenge. JSON ONLY:
{
  "question": "the question",
  "answer": "correct answer",
  "options": ["correct", "wrong1", "wrong2", "wrong3"],
  "hint": "helpful hint",
  "type": "math/pattern/knowledge/emoji"
}`;

    const response = await this.think(aiPrompt, 'Create fun verification challenges. JSON only.', { temperature: 0.95, maxTokens: 200 });

    if (response) {
      try {
        let cleaned = response.trim().replace(/```json?|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.question && parsed.answer && parsed.options?.length >= 2) {
          if (!parsed.options.includes(parsed.answer)) parsed.options[0] = parsed.answer;
          parsed.options = parsed.options.sort(() => Math.random() - 0.5);
          return parsed;
        }
      } catch (e) {}
    }

    const fallbacks = [
      { question: "What is 7 + 8?", answer: "15", options: ["15", "14", "16", "13"], hint: "Basic math", type: "math" },
      { question: "🔵🔴🔵🔴🔵❓", answer: "🔴", options: ["🔴", "🔵", "🟢", "🟡"], hint: "Pattern!", type: "pattern" },
      { question: "What color is grass?", answer: "Green", options: ["Green", "Blue", "Red", "Yellow"], hint: "Look outside", type: "knowledge" },
      { question: "2 × 9 = ?", answer: "18", options: ["18", "16", "20", "17"], hint: "Multiply", type: "math" },
      { question: "🐶 is a...", answer: "Dog", options: ["Dog", "Cat", "Bird", "Fish"], hint: "Woof!", type: "emoji" }
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

  async categorizeTicket(content) {
    const r = await this.think('Categorize: ' + content, 'Reply ONLY: general, technical, billing, report, or other', { temperature: 0, maxTokens: 20 });
    const valid = ['general', 'technical', 'billing', 'report', 'other'];
    return valid.includes((r || '').toLowerCase().trim()) ? r.toLowerCase().trim() : 'general';
  }

  async suggestResponse(messages, category) {
    const convo = messages.slice(-5).map(m => `${m.author}: ${m.content}`).join('\n');
    return await this.think(`Suggest response for ${category} ticket:\n${convo}`, 'Be helpful and concise. Under 200 chars.', { temperature: 0.7, maxTokens: 150 });
  }

  async chat(message, username) {
    return await this.think(`${username}: ${message}`, 'You are Nova, a friendly AI. Use emojis, under 250 chars.', { temperature: 0.8, maxTokens: 200 }) || 'Hey there! 👋';
  }

  getStats() {
    return {
      enabled: !!this.groqKey,
      usersTracked: this.userProfiles.size,
      cacheSize: this.thinkingCache.size
    };
  }

  getUserProfile(oderId) {
    return this.userProfiles.get(oderId);
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                              NOVA DISCORD BOT                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

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

    this.ai = new NovaUltraAI();
    this.sessions = new Map();
    this.settings = new Map();
    this.tickets = new Map();
    this.ticketChannels = new Map();
    this.ticketCounter = 1;
    
    this.stats = {
      verified: 0,
      failed: 0,
      kicked: 0,
      banned: 0,
      ticketsCreated: 0,
      ticketsClosed: 0,
      messagesScanned: 0,
      messagesDeleted: 0,
      warningsGiven: 0,
      mutesDone: 0,
      aiDetections: 0
    };
    
    this.logs = [];
    this.serverEvents = [];
    
    this.setupEvents();
  }

  getSettings(guildId) {
    if (!this.settings.has(guildId)) {
      this.settings.set(guildId, {
        modEnabled: true,
        detectSpam: true,
        detectToxicity: true,
        detectLinks: false,
        detectInvites: true,
        autoDelete: true,
        autoWarn: true,
        autoMute: true,
        maxWarnings: 3,
        muteDuration: 10,
        verifyEnabled: true,
        channelId: null,
        verifiedRoleId: null,
        unverifiedRoleId: null,
        kickOnFail: true,
        maxAttempts: 3
      });
    }
    return this.settings.get(guildId);
  }

  setupEvents() {
    this.client.once('clientReady', () => {
      console.log(`🤖 ${this.client.user.tag} is online!`);
      this.log('Bot started successfully!', 'success');
      this.addEvent('Bot Online', `${this.client.user.tag} connected`, 'success');
    });

    this.client.on('guildMemberAdd', async (member) => {
      this.addEvent('Member Joined', `${member.user.tag} joined`, 'join');
      
      const settings = this.getSettings(member.guild.id);
      if (!settings.verifyEnabled || !settings.channelId) return;

      const channel = member.guild.channels.cache.get(settings.channelId);
      if (!channel) return;

      if (settings.unverifiedRoleId) {
        try { await member.roles.add(settings.unverifiedRoleId); } catch (e) {}
      }

      const analysis = await this.ai.analyzeNewUser(member.user);
      this.log(`${member.user.tag} joined - Risk: ${analysis.riskLevel} (${analysis.riskScore})`, analysis.riskLevel === 'critical' ? 'warning' : 'info');

      const challenges = [];
      for (let i = 0; i < analysis.challengeCount; i++) {
        challenges.push(await this.ai.generateChallenge(i === 0 ? 'easy' : 'medium'));
      }

      const session = {
        memberId: member.id,
        guildId: member.guild.id,
        username: member.user.tag,
        avatar: member.user.displayAvatarURL(),
        analysis,
        challenges,
        currentIndex: 0,
        attempts: 0,
        maxAttempts: settings.maxAttempts,
        status: 'pending',
        startedAt: Date.now(),
        expiresAt: Date.now() + 300000
      };

      this.sessions.set(`${member.id}-${member.guild.id}`, session);
      await this.sendVerificationEmbed(member, channel, session);
      this.emitUpdate();

      setTimeout(async () => {
        const s = this.sessions.get(`${member.id}-${member.guild.id}`);
        if (s && s.status === 'pending') {
          s.status = 'timeout';
          this.stats.failed++;
          this.addEvent('Verification Timeout', `${member.user.tag} timed out`, 'warning');
          if (settings.kickOnFail) {
            try { await member.kick('Verification timeout'); this.stats.kicked++; } catch (e) {}
          }
          this.emitUpdate();
        }
      }, 300000);
    });

    this.client.on('guildMemberRemove', (member) => {
      this.addEvent('Member Left', `${member.user.tag} left`, 'leave');
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isButton()) {
          const id = interaction.customId;
          if (id.startsWith('v_')) await this.handleVerifyButton(interaction);
          else if (id.startsWith('claim_')) await this.claimTicket(interaction, id.replace('claim_', ''));
          else if (id.startsWith('close_')) await this.closeTicketBtn(interaction, id.replace('close_', ''));
        }
      } catch (e) {
        console.error('Interaction error:', e);
      }
    });

    this.client.on('messageCreate', async (msg) => {
      if (msg.author.bot || !msg.guild) return;

      const settings = this.getSettings(msg.guild.id);
      this.stats.messagesScanned++;

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
          this.io?.emit('ticketMessage', { ticketId, message: ticket.messages[ticket.messages.length - 1] });
          this.io?.emit('tickets', this.getAllTickets());
        }
        return;
      }

      if (settings.modEnabled && !msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const result = await this.ai.moderateMessage(msg, msg.member, settings);
        
        if (result.shouldAct) {
          this.stats.aiDetections++;
          
          try {
            if (result.action === 'delete' || result.action === 'delete_warn') {
              if (settings.autoDelete) {
                await msg.delete();
                this.stats.messagesDeleted++;
              }
            }

            if (result.action === 'warn' || result.action === 'delete_warn') {
              if (settings.autoWarn) {
                const profile = this.ai.getUserProfile(msg.author.id);
                
                const embed = new EmbedBuilder()
                  .setColor(result.severity === 'critical' ? '#ff0000' : '#ffaa00')
                  .setDescription(`⚠️ **Warning** | ${result.suggestedResponse || result.reason}`)
                  .setFooter({ text: `Warning ${profile?.warnings || 1}/${settings.maxWarnings}` });

                const warning = await msg.channel.send({ content: `${msg.author}`, embeds: [embed] });
                setTimeout(() => warning.delete().catch(() => {}), 10000);
                
                this.stats.warningsGiven++;
                this.log(`Warned ${msg.author.tag}: ${result.reason}`, 'moderation');
                this.addEvent('Auto-Moderation', `${msg.author.tag}: ${result.reason}`, 'moderation');

                if (settings.autoMute && profile && profile.warnings >= settings.maxWarnings) {
                  try {
                    await msg.member.timeout(settings.muteDuration * 60 * 1000, 'Max warnings reached');
                    this.stats.mutesDone++;
                    this.log(`Muted ${msg.author.tag} for ${settings.muteDuration}m`, 'moderation');
                    this.addEvent('Auto-Mute', `${msg.author.tag} muted`, 'moderation');
                  } catch (e) {}
                }
              }
            }

            if (result.action === 'mute') {
              try {
                await msg.member.timeout(settings.muteDuration * 60 * 1000, result.reason);
                this.stats.mutesDone++;
                this.log(`Muted ${msg.author.tag}: ${result.reason}`, 'moderation');
              } catch (e) {}
            }

            if (result.action === 'ban') {
              try {
                await msg.member.ban({ reason: result.reason, deleteMessageSeconds: 86400 });
                this.stats.banned++;
                this.log(`Banned ${msg.author.tag}: ${result.reason}`, 'moderation');
                this.addEvent('Auto-Ban', `${msg.author.tag}: ${result.reason}`, 'moderation');
              } catch (e) {}
            }
          } catch (e) {
            console.error('Moderation action failed:', e.message);
          }

          this.emitUpdate();
          return;
        }
      }

      const content = msg.content.toLowerCase();
      const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);

      if (content === '!help') {
        await this.sendHelp(msg);
      }
      else if (content.startsWith('!ticket')) {
        await this.createTicket(msg, msg.content.slice(7).trim() || 'No reason');
      }
      else if (content === '!setup' && isAdmin) {
        await this.sendSetup(msg);
      }
      else if (content.startsWith('!setverify') && isAdmin) {
        const ch = msg.mentions.channels.first();
        if (ch) {
          this.getSettings(msg.guild.id).channelId = ch.id;
          msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Verification channel: ${ch}`)] });
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
      else if (content === '!testvf' && isAdmin) {
        await this.testVerify(msg);
      }
      else if (msg.mentions.has(this.client.user)) {
        const response = await this.ai.chat(msg.content.replace(/<@!?\d+>/g, '').trim(), msg.author.username);
        msg.reply(response);
      }
    });
  }

  async sendVerificationEmbed(member, channel, session) {
    const challenge = session.challenges[0];
    const analysis = session.analysis;

    const embed = new EmbedBuilder()
      .setColor(analysis.riskLevel === 'critical' ? '#ff0000' : analysis.riskLevel === 'high' ? '#ffaa00' : '#ffffff')
      .setAuthor({ name: '🛡️ Nova Verification', iconURL: this.client.user.displayAvatarURL() })
      .setThumbnail(session.avatar)
      .setDescription(`Welcome ${member}!\n\nComplete the challenge below to access the server.\n\n━━━━━━━━━━━━━━━━━━━━━━`)
      .addFields(
        { name: `📝 Challenge 1/${session.challenges.length}`, value: '```' + challenge.question + '```', inline: false },
        { name: '💡 Hint', value: challenge.hint || 'Think!', inline: true },
        { name: '🔄 Attempts', value: `${session.attempts}/${session.maxAttempts}`, inline: true },
        { name: '⚠️ Risk', value: analysis.riskLevel.toUpperCase(), inline: true }
      )
      .setFooter({ text: '⏱️ 5 minutes • AI-Powered Security' })
      .setTimestamp();

    const row = new ActionRowBuilder();
    const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

    challenge.options.slice(0, 4).forEach((opt, i) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`v_${member.id}_${member.guild.id}_${i}`)
          .setLabel(String(opt).substring(0, 40))
          .setStyle(styles[i])
          .setEmoji(emojis[i])
      );
    });

    const message = await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
    session.messageId = message.id;
  }

  async handleVerifyButton(interaction) {
    const parts = interaction.customId.split('_');
    const memberId = parts[1];
    const guildId = parts[2];
    const answerIndex = parseInt(parts[3]);

    if (interaction.user.id !== memberId) {
      return interaction.reply({ content: '❌ Not for you!', ephemeral: true });
    }

    const session = this.sessions.get(`${memberId}-${guildId}`);
    if (!session || session.status !== 'pending') {
      return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
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

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎉 Verification Complete!')
          .setDescription('Welcome! You now have full access.')
          .setTimestamp();

        await interaction.message.edit({ embeds: [embed], components: [] });
        this.log(`✅ ${session.username} verified!`, 'success');
        this.addEvent('Verification Success', `${session.username} verified`, 'success');
      } else {
        const next = session.challenges[session.currentIndex];
        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('✅ Correct!')
          .setDescription(`Challenge ${session.currentIndex + 1}/${session.challenges.length}`)
          .addFields({ name: '📝 Next Challenge', value: '```' + next.question + '```' });

        const row = new ActionRowBuilder();
        const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
        next.options.slice(0, 4).forEach((opt, i) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`v_${memberId}_${guildId}_${i}`)
              .setLabel(String(opt).substring(0, 40))
              .setStyle(styles[i])
          );
        });

        await interaction.message.edit({ embeds: [embed], components: [row] });
      }
    } else {
      session.attempts++;

      if (session.attempts >= session.maxAttempts) {
        session.status = 'failed';
        this.stats.failed++;

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Verification Failed')
          .setDescription('Maximum attempts exceeded.')
          .setTimestamp();

        await interaction.message.edit({ embeds: [embed], components: [] });

        const settings = this.getSettings(guildId);
        if (settings.kickOnFail) {
          try { await member.kick('Failed verification'); this.stats.kicked++; } catch (e) {}
        }

        this.addEvent('Verification Failed', `${session.username} failed`, 'warning');
      } else {
        session.challenges[session.currentIndex] = await this.ai.generateChallenge('medium');
        const newChallenge = session.challenges[session.currentIndex];

        const embed = new EmbedBuilder()
          .setColor('#ffaa00')
          .setTitle('❌ Wrong! Try Again')
          .addFields(
            { name: '📝 New Challenge', value: '```' + newChallenge.question + '```' },
            { name: 'Attempts Left', value: `${session.maxAttempts - session.attempts}` }
          );

        const row = new ActionRowBuilder();
        const styles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
        newChallenge.options.slice(0, 4).forEach((opt, i) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`v_${memberId}_${guildId}_${i}`)
              .setLabel(String(opt).substring(0, 40))
              .setStyle(styles[i])
          );
        });

        await interaction.message.edit({ embeds: [embed], components: [row] });
      }
    }

    this.emitUpdate();
  }

  async testVerify(msg) {
    const settings = this.getSettings(msg.guild.id);
    if (!settings.channelId) {
      return msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('❌ Set channel: `!setverify #channel`')] });
    }

    const channel = msg.guild.channels.cache.get(settings.channelId);
    if (!channel) return;

    const analysis = await this.ai.analyzeNewUser(msg.author);
    const challenges = [await this.ai.generateChallenge('easy')];

    const session = {
      memberId: msg.author.id,
      guildId: msg.guild.id,
      username: msg.author.tag,
      avatar: msg.author.displayAvatarURL(),
      analysis,
      challenges,
      currentIndex: 0,
      attempts: 0,
      maxAttempts: 3,
      status: 'pending',
      startedAt: Date.now()
    };

    this.sessions.set(`${msg.author.id}-${msg.guild.id}`, session);
    await this.sendVerificationEmbed(msg.member, channel, session);
    msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Test sent to ${channel}`)] });
  }

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
    const category = await this.ai.categorizeTicket(reason);

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
        userName: user.tag,
        userAvatar: user.displayAvatarURL(),
        channelId: channel.id,
        guildId: guild.id,
        guildName: guild.name,
        reason,
        category,
        status: 'open',
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

      this.tickets.set(ticketId, ticket);
      this.ticketChannels.set(channel.id, ticketId);

      const embed = new EmbedBuilder()
        .setColor('#ffffff')
        .setTitle(`🎫 ${ticketId}`)
        .setDescription(`Hello ${user}!\n\nSupport will assist you shortly.\n\n━━━━━━━━━━━━━━━━━━━━━━`)
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
      this.addEvent('Ticket Created', `${user.tag} opened ${ticketId}`, 'ticket');
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
    this.addEvent('Ticket Claimed', `${interaction.user.tag} claimed ${ticketId}`, 'ticket');
    this.emitUpdate();
  }

  async closeTicketBtn(interaction, ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      ticket.status = 'closed';
      this.stats.ticketsClosed++;
      this.addEvent('Ticket Closed', `${ticketId} closed`, 'ticket');
    }

    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription('🔒 Closing in 3s...')] });

    setTimeout(async () => {
      this.ticketChannels.delete(ticket?.channelId);
      this.tickets.delete(ticketId);
      try { await interaction.channel.delete(); } catch (e) {}
      this.emitUpdate();
    }, 3000);
  }

  async sendTicketMessage(ticketId, content, staffName) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return { success: false };

    try {
      const guild = await this.client.guilds.fetch(ticket.guildId);
      const channel = await guild.channels.fetch(ticket.channelId);

      const embed = new EmbedBuilder()
        .setColor('#ffffff')
        .setAuthor({ name: `📩 ${staffName}`, iconURL: this.client.user.displayAvatarURL() })
        .setDescription(content)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      const message = {
        id: Date.now().toString(),
        author: `${staffName} (Staff)`,
        authorId: 'dashboard',
        authorAvatar: this.client.user.displayAvatarURL(),
        content,
        timestamp: new Date().toISOString(),
        isStaff: true
      };

      ticket.messages.push(message);
      this.io?.emit('ticketMessage', { ticketId, message });
      this.io?.emit('tickets', this.getAllTickets());
      this.log(`Staff replied to ${ticketId}`, 'response');
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }

  async sendHelp(msg) {
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

  async sendSetup(msg) {
    const settings = this.getSettings(msg.guild.id);
    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('⚙️ Setup')
      .addFields(
        { name: 'Commands', value: '`!setverify #channel`\n`!setrole @role`\n`!setunverified @role`' },
        { name: 'Verify Channel', value: settings.channelId ? `<#${settings.channelId}>` : '❌', inline: true },
        { name: 'Verified Role', value: settings.verifiedRoleId ? `<@&${settings.verifiedRoleId}>` : '❌', inline: true },
        { name: 'Unverified Role', value: settings.unverifiedRoleId ? `<@&${settings.unverifiedRoleId}>` : '❌', inline: true }
      );
    await msg.reply({ embeds: [embed] });
  }

  log(message, type = 'info') {
    const entry = { message, type, timestamp: new Date().toISOString() };
    this.logs.unshift(entry);
    if (this.logs.length > 100) this.logs.pop();
    console.log(`[${type.toUpperCase()}] ${message}`);
    this.io?.emit('newLog', entry);
  }

  addEvent(title, description, type) {
    const event = { title, description, type, timestamp: new Date().toISOString() };
    this.serverEvents.unshift(event);
    if (this.serverEvents.length > 50) this.serverEvents.pop();
    this.io?.emit('serverEvent', event);
  }

  emitUpdate() {
    this.io?.emit('stats', this.getStats());
    this.io?.emit('tickets', this.getAllTickets());
    this.io?.emit('sessions', this.getPendingSessions());
    this.io?.emit('events', this.serverEvents);
  }

  getAllTickets() {
    return Array.from(this.tickets.values()).filter(t => t.status === 'open').map(t => ({
      ...t,
      messageCount: t.messages.length,
      lastMessage: t.messages[t.messages.length - 1]
    }));
  }

  getPendingSessions() {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'pending')
      .map(s => ({
        memberId: s.memberId,
        username: s.username,
        avatar: s.avatar,
        riskLevel: s.analysis?.riskLevel,
        score: s.analysis?.riskScore,
        currentIndex: s.currentIndex,
        totalChallenges: s.challenges?.length,
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
      pendingSessions: Array.from(this.sessions.values()).filter(s => s.status === 'pending').length,
      ai: this.ai.getStats()
    };
  }

  async start(token) {
    await this.client.login(token);
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                              EXPRESS & DASHBOARD                                        ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const bot = new NovaBot(io);

app.use(express.json());

app.get('/api/stats', (req, res) => res.json(bot.getStats()));
app.get('/api/tickets', (req, res) => res.json(bot.getAllTickets()));
app.get('/api/sessions', (req, res) => res.json(bot.getPendingSessions()));
app.get('/api/logs', (req, res) => res.json(bot.logs));
app.get('/api/events', (req, res) => res.json(bot.serverEvents));

app.get('/', (req, res) => {
  res.send(getDashboardHTML());
});

io.on('connection', (socket) => {
  console.log('📊 Dashboard connected');

  socket.emit('stats', bot.getStats());
  socket.emit('tickets', bot.getAllTickets());
  socket.emit('sessions', bot.getPendingSessions());
  socket.emit('events', bot.serverEvents);
  socket.emit('logs', bot.logs);

  const interval = setInterval(() => {
    socket.emit('stats', bot.getStats());
    socket.emit('sessions', bot.getPendingSessions());
  }, 3000);

  socket.on('sendMessage', async (data) => {
    await bot.sendTicketMessage(data.ticketId, data.content, data.staffName || 'Staff');
  });

  socket.on('getAISuggestion', async (data) => {
    const ticket = bot.tickets.get(data.ticketId);
    if (ticket) {
      const suggestion = await bot.ai.suggestResponse(ticket.messages, ticket.category);
      socket.emit('aiSuggestion', { ticketId: data.ticketId, suggestion });
    }
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
      bot.addEvent('Ticket Closed', `${data.ticketId} closed from dashboard`, 'ticket');
      bot.emitUpdate();
    }
  });

  socket.on('disconnect', () => clearInterval(interval));
});

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova AI Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-0: #000; --bg-1: #050505; --bg-2: #0a0a0a; --bg-3: #0f0f0f;
      --bg-4: #141414; --bg-5: #1a1a1a; --bg-6: #202020;
      --border-1: #1a1a1a; --border-2: #252525; --border-3: #303030;
      --text-0: #fff; --text-1: #e0e0e0; --text-2: #a0a0a0; --text-3: #666;
      --success: #10b981; --warning: #f59e0b; --error: #ef4444; --info: #3b82f6;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    body { font-family: 'Inter', sans-serif; background: var(--bg-0); color: var(--text-0); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 3px; }
    .app { display: flex; height: 100vh; }
    .sidebar { width: 260px; background: var(--bg-1); border-right: 1px solid var(--border-1); display: flex; flex-direction: column; }
    .logo { padding: 20px; border-bottom: 1px solid var(--border-1); display: flex; align-items: center; gap: 12px; }
    .logo-icon { width: 40px; height: 40px; background: var(--bg-5); border: 1px solid var(--border-2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .logo-text { font-size: 1.3rem; font-weight: 800; }
    .logo-sub { font-size: 0.65rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 1px; }
    .nav { flex: 1; padding: 16px; overflow-y: auto; }
    .nav-section { margin-bottom: 20px; }
    .nav-label { font-size: 0.6rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 1.5px; padding: 0 12px; margin-bottom: 8px; }
    .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 8px; cursor: pointer; color: var(--text-2); font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
    .nav-item:hover { background: var(--bg-3); color: var(--text-1); }
    .nav-item.active { background: var(--text-0); color: var(--bg-0); font-weight: 600; }
    .nav-item .icon { font-size: 1.1rem; width: 22px; text-align: center; }
    .nav-item .badge { margin-left: auto; background: var(--bg-5); padding: 2px 8px; border-radius: 12px; font-size: 0.65rem; font-weight: 700; }
    .nav-item.active .badge { background: rgba(0,0,0,0.15); }
    .sidebar-footer { padding: 16px; border-top: 1px solid var(--border-1); }
    .status { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-3); border-radius: 8px; font-size: 0.8rem; color: var(--text-2); }
    .status-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .header { padding: 18px 28px; border-bottom: 1px solid var(--border-1); display: flex; justify-content: space-between; align-items: center; background: var(--bg-1); }
    .header h1 { font-size: 1.4rem; font-weight: 700; }
    .header-stats { display: flex; gap: 28px; }
    .header-stat { text-align: right; }
    .header-stat .value { font-size: 1.4rem; font-weight: 800; }
    .header-stat .label { font-size: 0.65rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; }
    .content { flex: 1; overflow: hidden; }
    .tab-content { display: none; height: 100%; }
    .tab-content.active { display: flex; }
    .dashboard { flex: 1; padding: 28px; overflow-y: auto; }
    .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 28px; }
    .stat-card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 14px; padding: 20px; }
    .stat-card:hover { border-color: var(--border-2); transform: translateY(-2px); transition: all 0.2s; }
    .stat-card .icon-wrap { width: 42px; height: 42px; background: var(--bg-4); border: 1px solid var(--border-2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; margin-bottom: 14px; }
    .stat-card .value { font-size: 2rem; font-weight: 800; margin-bottom: 4px; }
    .stat-card .label { font-size: 0.75rem; color: var(--text-3); }
    .stat-card.success .value { color: var(--success); }
    .stat-card.warning .value { color: var(--warning); }
    .stat-card.error .value { color: var(--error); }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 14px; overflow: hidden; }
    .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border-1); font-weight: 600; font-size: 0.9rem; background: var(--bg-3); display: flex; justify-content: space-between; }
    .card-body { padding: 14px; max-height: 350px; overflow-y: auto; }
    .event-item { padding: 12px 14px; border-radius: 8px; margin-bottom: 8px; background: var(--bg-4); border-left: 3px solid var(--border-2); }
    .event-item.success { border-color: var(--success); }
    .event-item.warning { border-color: var(--warning); }
    .event-item.moderation { border-color: var(--error); }
    .event-item.ticket { border-color: var(--text-0); }
    .event-item.join { border-color: var(--success); }
    .event-item.leave { border-color: var(--warning); }
    .event-title { font-weight: 600; font-size: 0.85rem; margin-bottom: 4px; }
    .event-desc { font-size: 0.75rem; color: var(--text-2); }
    .event-time { font-size: 0.65rem; color: var(--text-3); margin-top: 6px; }
    .tickets-container { display: flex; flex: 1; }
    .tickets-list { width: 320px; background: var(--bg-1); border-right: 1px solid var(--border-1); display: flex; flex-direction: column; }
    .tickets-header { padding: 20px; border-bottom: 1px solid var(--border-1); }
    .tickets-header h2 { font-size: 1rem; font-weight: 700; margin-bottom: 14px; }
    .search-box { position: relative; }
    .search-box input { width: 100%; padding: 12px 16px 12px 40px; background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 10px; color: var(--text-0); font-size: 0.85rem; }
    .search-box input:focus { outline: none; border-color: var(--text-0); }
    .search-box::before { content: '🔍'; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 0.9rem; }
    .tickets-scroll { flex: 1; overflow-y: auto; padding: 14px; }
    .ticket-card { background: var(--bg-3); border: 1px solid var(--border-1); border-radius: 12px; padding: 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; }
    .ticket-card:hover { border-color: var(--border-2); transform: translateX(4px); }
    .ticket-card.active { border-color: var(--text-0); background: var(--bg-4); }
    .ticket-top { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .ticket-id { font-weight: 700; font-size: 0.9rem; }
    .ticket-badge { font-size: 0.6rem; padding: 3px 8px; border-radius: 5px; background: var(--bg-5); color: var(--text-2); text-transform: uppercase; font-weight: 700; }
    .ticket-user { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .ticket-avatar { width: 24px; height: 24px; border-radius: 6px; background: var(--bg-5); }
    .ticket-username { font-size: 0.8rem; color: var(--text-2); }
    .ticket-preview { font-size: 0.75rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ticket-meta { display: flex; justify-content: space-between; margin-top: 10px; font-size: 0.65rem; color: var(--text-3); }
    .chat-area { flex: 1; display: flex; flex-direction: column; background: var(--bg-0); }
    .chat-header { padding: 18px 24px; border-bottom: 1px solid var(--border-1); background: var(--bg-1); display: flex; justify-content: space-between; align-items: center; }
    .chat-header-info { display: flex; align-items: center; gap: 14px; }
    .chat-header-avatar { width: 48px; height: 48px; border-radius: 12px; background: var(--bg-4); border: 2px solid var(--border-2); }
    .chat-header-text h3 { font-size: 1rem; font-weight: 700; margin-bottom: 2px; }
    .chat-header-text span { font-size: 0.75rem; color: var(--text-3); }
    .chat-actions { display: flex; gap: 8px; }
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .btn:hover { transform: translateY(-2px); }
    .btn-primary { background: var(--text-0); color: var(--bg-0); }
    .btn-secondary { background: var(--bg-4); color: var(--text-0); border: 1px solid var(--border-2); }
    .btn-danger { background: var(--error); color: white; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    .message { display: flex; gap: 12px; max-width: 70%; }
    .message.staff { margin-left: auto; flex-direction: row-reverse; }
    .message-avatar { width: 40px; height: 40px; border-radius: 10px; background: var(--bg-4); flex-shrink: 0; }
    .message-content { background: var(--bg-3); border: 1px solid var(--border-1); border-radius: 14px; padding: 14px 18px; }
    .message.staff .message-content { background: var(--bg-4); border-color: var(--border-2); }
    .message-author { font-size: 0.75rem; font-weight: 600; color: var(--text-2); margin-bottom: 4px; }
    .message-text { font-size: 0.85rem; line-height: 1.5; }
    .message-time { font-size: 0.65rem; color: var(--text-3); margin-top: 6px; }
    .chat-input-area { padding: 20px 24px; border-top: 1px solid var(--border-1); background: var(--bg-1); }
    .ai-suggestion { background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; display: none; }
    .ai-suggestion.show { display: block; }
    .ai-suggestion-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .ai-suggestion-label { font-size: 0.65rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; }
    .ai-suggestion-text { font-size: 0.85rem; color: var(--text-2); }
    .chat-input-row { display: flex; gap: 12px; }
    .chat-input { flex: 1; padding: 14px 18px; background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 12px; color: var(--text-0); font-size: 0.85rem; resize: none; min-height: 50px; max-height: 120px; }
    .chat-input:focus { outline: none; border-color: var(--text-0); }
    .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-3); }
    .empty-state-icon { font-size: 4rem; margin-bottom: 16px; opacity: 0.2; }
    .empty-state h3 { font-size: 1.2rem; color: var(--text-2); margin-bottom: 6px; }
    .verification-container { flex: 1; padding: 28px; overflow-y: auto; }
    .section-header { margin-bottom: 20px; }
    .section-header h2 { font-size: 1.1rem; font-weight: 700; }
    .session-card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 14px; padding: 20px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    .session-user { display: flex; align-items: center; gap: 16px; }
    .session-avatar { width: 50px; height: 50px; border-radius: 12px; background: var(--bg-5); border: 2px solid var(--border-2); }
    .session-info h4 { font-weight: 600; margin-bottom: 4px; }
    .session-info span { font-size: 0.75rem; color: var(--text-3); }
    .session-meta { display: flex; gap: 20px; align-items: center; }
    .risk-badge { padding: 6px 14px; border-radius: 8px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
    .risk-low { background: rgba(16,185,129,0.15); color: var(--success); border: 1px solid rgba(16,185,129,0.3); }
    .risk-medium { background: rgba(245,158,11,0.15); color: var(--warning); border: 1px solid rgba(245,158,11,0.3); }
    .risk-high { background: rgba(239,68,68,0.15); color: var(--error); border: 1px solid rgba(239,68,68,0.3); }
    .risk-critical { background: rgba(239,68,68,0.25); color: var(--error); border: 1px solid rgba(239,68,68,0.5); }
    @media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon">🛡️</div>
        <div><div class="logo-text">Nova AI</div><div class="logo-sub">Dashboard</div></div>
      </div>
      <nav class="nav">
        <div class="nav-section">
          <div class="nav-label">Overview</div>
          <div class="nav-item active" onclick="showTab('dashboard')"><span class="icon">📊</span><span>Dashboard</span></div>
        </div>
        <div class="nav-section">
          <div class="nav-label">Modules</div>
          <div class="nav-item" onclick="showTab('tickets')"><span class="icon">🎫</span><span>Tickets</span><span class="badge" id="ticketBadge">0</span></div>
          <div class="nav-item" onclick="showTab('verification')"><span class="icon">🛡️</span><span>Verification</span><span class="badge" id="verifyBadge">0</span></div>
        </div>
        <div class="nav-section">
          <div class="nav-label">System</div>
                    <div class="nav-item" onclick="showTab('events')"><span class="icon">📡</span><span>Events</span></div>
          <div class="nav-item" onclick="showTab('logs')"><span class="icon">📝</span><span>Logs</span></div>
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="status"><div class="status-dot"></div><span>System Online</span></div>
      </div>
    </aside>
    <main class="main">
      <header class="header">
        <h1 id="pageTitle">Dashboard</h1>
        <div class="header-stats">
          <div class="header-stat"><div class="value" id="headerPing">0ms</div><div class="label">Latency</div></div>
          <div class="header-stat"><div class="value" id="headerUptime">0h</div><div class="label">Uptime</div></div>
        </div>
      </header>
      <div class="content">
        <div class="tab-content active" id="tab-dashboard">
          <div class="dashboard">
            <div class="stats-grid">
              <div class="stat-card"><div class="icon-wrap">🌐</div><div class="value" id="statServers">0</div><div class="label">Servers</div></div>
              <div class="stat-card"><div class="icon-wrap">👥</div><div class="value" id="statUsers">0</div><div class="label">Users</div></div>
              <div class="stat-card success"><div class="icon-wrap">✅</div><div class="value" id="statVerified">0</div><div class="label">Verified</div></div>
              <div class="stat-card error"><div class="icon-wrap">🗑️</div><div class="value" id="statDeleted">0</div><div class="label">Deleted</div></div>
              <div class="stat-card warning"><div class="icon-wrap">⚠️</div><div class="value" id="statWarnings">0</div><div class="label">Warnings</div></div>
            </div>
            <div class="grid-2">
              <div class="card"><div class="card-header"><span>📡 Live Events</span></div><div class="card-body" id="eventsContainer"></div></div>
              <div class="card"><div class="card-header"><span>🎫 Active Tickets</span><span id="ticketCount">0 open</span></div><div class="card-body" id="ticketsPreview"></div></div>
            </div>
          </div>
        </div>
        <div class="tab-content" id="tab-tickets">
          <div class="tickets-container">
            <div class="tickets-list">
              <div class="tickets-header"><h2>🎫 Support Tickets</h2><div class="search-box"><input type="text" placeholder="Search..." id="ticketSearch" oninput="filterTickets()"></div></div>
              <div class="tickets-scroll" id="ticketsList"></div>
            </div>
            <div class="chat-area">
              <div class="empty-state" id="chatEmpty"><div class="empty-state-icon">💬</div><h3>No Ticket Selected</h3><p>Select a ticket to view</p></div>
              <div id="chatView" style="display:none;flex:1;flex-direction:column;">
                <div class="chat-header">
                  <div class="chat-header-info"><img class="chat-header-avatar" id="chatAvatar"><div class="chat-header-text"><h3 id="chatTitle">Ticket</h3><span id="chatSubtitle">Loading...</span></div></div>
                  <div class="chat-actions"><button class="btn btn-secondary" onclick="getAISuggestion()">🧠 AI Suggest</button><button class="btn btn-danger" onclick="closeCurrentTicket()">🔒 Close</button></div>
                </div>
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-input-area">
                  <div class="ai-suggestion" id="aiSuggestion"><div class="ai-suggestion-header"><span class="ai-suggestion-label">🧠 AI Suggestion</span><button class="btn btn-secondary" style="padding:6px 12px;font-size:0.7rem" onclick="useSuggestion()">Use</button></div><div class="ai-suggestion-text" id="aiSuggestionText"></div></div>
                  <div class="chat-input-row"><textarea class="chat-input" id="chatInput" placeholder="Type response..." rows="1"></textarea><button class="btn btn-primary" onclick="sendMessage()">Send →</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="tab-content" id="tab-verification">
          <div class="verification-container"><div class="section-header"><h2>🛡️ Pending Verifications</h2></div><div id="sessionsList"></div></div>
        </div>
        <div class="tab-content" id="tab-events">
          <div class="dashboard"><div class="section-header"><h2>📡 Server Events</h2></div><div class="card"><div class="card-body" id="allEvents" style="max-height:calc(100vh - 200px)"></div></div></div>
        </div>
        <div class="tab-content" id="tab-logs">
          <div class="dashboard"><div class="section-header"><h2>📝 System Logs</h2></div><div class="card"><div class="card-body" id="allLogs" style="max-height:calc(100vh - 200px)"></div></div></div>
        </div>
      </div>
    </main>
  </div>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let tickets = [], currentTicket = null, sessions = [], events = [], logs = [];

    function showTab(name) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('tab-' + name).classList.add('active');
      event.target.closest('.nav-item').classList.add('active');
      const titles = { dashboard: 'Dashboard', tickets: 'Support Tickets', verification: 'Verification', events: 'Server Events', logs: 'System Logs' };
      document.getElementById('pageTitle').textContent = titles[name] || name;
    }

    socket.on('stats', s => {
      document.getElementById('statServers').textContent = s.guilds || 0;
      document.getElementById('statUsers').textContent = formatNum(s.users || 0);
      document.getElementById('statVerified').textContent = s.verified || 0;
      document.getElementById('statDeleted').textContent = s.messagesDeleted || 0;
      document.getElementById('statWarnings').textContent = s.warningsGiven || 0;
      document.getElementById('headerPing').textContent = (s.ping || 0) + 'ms';
      document.getElementById('headerUptime').textContent = Math.floor((s.uptime || 0) / 3600000) + 'h';
      document.getElementById('ticketBadge').textContent = s.openTickets || 0;
      document.getElementById('ticketCount').textContent = (s.openTickets || 0) + ' open';
      document.getElementById('verifyBadge').textContent = s.pendingSessions || 0;
    });

    socket.on('tickets', data => { tickets = data || []; renderTickets(); renderTicketsPreview(); });
    socket.on('ticketMessage', data => { if (currentTicket?.id === data.ticketId) addMessageToChat(data.message); });
    socket.on('sessions', data => { sessions = data || []; renderSessions(); });
    socket.on('serverEvent', e => { events.unshift(e); if (events.length > 100) events.pop(); renderEvents(); });
    socket.on('events', data => { events = data || []; renderEvents(); });
    socket.on('newLog', l => { logs.unshift(l); if (logs.length > 100) logs.pop(); renderLogs(); });
    socket.on('logs', data => { logs = data || []; renderLogs(); });
    socket.on('aiSuggestion', data => { document.getElementById('aiSuggestionText').textContent = data.suggestion || 'No suggestion'; });

    function renderTickets() {
      const c = document.getElementById('ticketsList');
      const search = (document.getElementById('ticketSearch').value || '').toLowerCase();
      const filtered = tickets.filter(t => t.id.toLowerCase().includes(search) || (t.userName || '').toLowerCase().includes(search));
      if (!filtered.length) { c.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">📭</div><p>No tickets</p></div>'; return; }
      c.innerHTML = filtered.map(t => '<div class="ticket-card ' + (currentTicket?.id === t.id ? 'active' : '') + '" onclick="selectTicket(\\'' + t.id + '\\')"><div class="ticket-top"><span class="ticket-id">' + t.id + '</span><span class="ticket-badge">' + (t.category || 'general') + '</span></div><div class="ticket-user"><img class="ticket-avatar" src="' + (t.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><span class="ticket-username">' + (t.userName || 'Unknown') + '</span></div><div class="ticket-preview">' + (t.lastMessage?.content || t.reason || 'No messages') + '</div><div class="ticket-meta"><span>💬 ' + (t.messageCount || 0) + '</span><span>' + timeAgo(t.createdAt) + '</span></div></div>').join('');
    }

    function renderTicketsPreview() {
      const c = document.getElementById('ticketsPreview');
      if (!tickets.length) { c.innerHTML = '<div class="empty-state" style="padding:30px"><p>No active tickets</p></div>'; return; }
      c.innerHTML = tickets.slice(0, 5).map(t => '<div class="event-item ticket" style="cursor:pointer" onclick="showTab(\\\'tickets\\\');setTimeout(()=>selectTicket(\\'' + t.id + '\\'),100)"><div class="event-title">' + t.id + '</div><div class="event-desc">' + (t.userName || 'Unknown') + ': ' + (t.reason || '').substring(0, 50) + '</div><div class="event-time">' + timeAgo(t.createdAt) + '</div></div>').join('');
    }

    function selectTicket(id) {
      currentTicket = tickets.find(t => t.id === id);
      if (!currentTicket) return;
      document.getElementById('chatEmpty').style.display = 'none';
      document.getElementById('chatView').style.display = 'flex';
      document.getElementById('chatAvatar').src = currentTicket.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
      document.getElementById('chatTitle').textContent = currentTicket.id;
      document.getElementById('chatSubtitle').textContent = (currentTicket.userName || 'Unknown') + ' • ' + (currentTicket.category || 'general');
      renderMessages();
      renderTickets();
      document.getElementById('aiSuggestion').classList.remove('show');
    }

    function renderMessages() {
      if (!currentTicket) return;
      const c = document.getElementById('chatMessages');
      const msgs = currentTicket.messages || [];
      if (!msgs.length) { c.innerHTML = '<div class="empty-state"><p>No messages</p></div>'; return; }
      c.innerHTML = msgs.map(m => '<div class="message ' + (m.isStaff ? 'staff' : '') + '"><img class="message-avatar" src="' + (m.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><div class="message-content"><div class="message-author">' + (m.author || 'Unknown') + '</div><div class="message-text">' + escapeHtml(m.content || '') + '</div><div class="message-time">' + formatTime(m.timestamp) + '</div></div></div>').join('');
      c.scrollTop = c.scrollHeight;
    }

    function addMessageToChat(m) {
      const c = document.getElementById('chatMessages');
      const d = document.createElement('div');
      d.className = 'message ' + (m.isStaff ? 'staff' : '');
      d.innerHTML = '<img class="message-avatar" src="' + (m.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><div class="message-content"><div class="message-author">' + (m.author || 'Unknown') + '</div><div class="message-text">' + escapeHtml(m.content || '') + '</div><div class="message-time">' + formatTime(m.timestamp) + '</div></div>';
      c.appendChild(d);
      c.scrollTop = c.scrollHeight;
    }

    function sendMessage() {
      if (!currentTicket) return;
      const input = document.getElementById('chatInput');
      const content = input.value.trim();
      if (!content) return;
      socket.emit('sendMessage', { ticketId: currentTicket.id, content, staffName: 'Dashboard Admin' });
      input.value = '';
      document.getElementById('aiSuggestion').classList.remove('show');
    }

    function getAISuggestion() {
      if (!currentTicket) return;
      document.getElementById('aiSuggestionText').textContent = 'Thinking...';
      document.getElementById('aiSuggestion').classList.add('show');
      socket.emit('getAISuggestion', { ticketId: currentTicket.id });
    }

    function useSuggestion() {
      const s = document.getElementById('aiSuggestionText').textContent;
      if (s && s !== 'Thinking...' && s !== 'No suggestion') {
        document.getElementById('chatInput').value = s;
        document.getElementById('aiSuggestion').classList.remove('show');
      }
    }

    function closeCurrentTicket() {
      if (!currentTicket || !confirm('Close this ticket?')) return;
      socket.emit('closeTicket', { ticketId: currentTicket.id });
      currentTicket = null;
      document.getElementById('chatEmpty').style.display = 'flex';
      document.getElementById('chatView').style.display = 'none';
    }

    function filterTickets() { renderTickets(); }

    function renderSessions() {
      const c = document.getElementById('sessionsList');
      if (!sessions.length) { c.innerHTML = '<div class="empty-state" style="padding:60px"><div class="empty-state-icon">✅</div><h3>All Clear</h3><p>No pending verifications</p></div>'; return; }
      c.innerHTML = sessions.map(s => '<div class="session-card"><div class="session-user"><img class="session-avatar" src="' + (s.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><div class="session-info"><h4>' + (s.username || 'Unknown') + '</h4><span>Progress: ' + (s.currentIndex || 0) + '/' + (s.totalChallenges || 1) + ' • Attempts: ' + (s.attempts || 0) + '</span></div></div><div class="session-meta"><span class="risk-badge risk-' + (s.riskLevel || 'low') + '">' + (s.riskLevel || 'low').toUpperCase() + ' (' + (s.score || 0) + ')</span><span style="color:var(--text-3);font-size:0.75rem">' + timeAgo(s.startedAt) + '</span></div></div>').join('');
    }

    function renderEvents() {
      [document.getElementById('eventsContainer'), document.getElementById('allEvents')].forEach((c, i) => {
        if (!c) return;
        const limit = i === 0 ? 10 : 100;
        if (!events.length) { c.innerHTML = '<div class="empty-state" style="padding:30px"><p>No events</p></div>'; return; }
        c.innerHTML = events.slice(0, limit).map(e => '<div class="event-item ' + (e.type || 'info') + '"><div class="event-title">' + (e.title || 'Event') + '</div><div class="event-desc">' + (e.description || '') + '</div><div class="event-time">' + formatTime(e.timestamp) + '</div></div>').join('');
      });
    }

    function renderLogs() {
      const c = document.getElementById('allLogs');
      if (!c) return;
      if (!logs.length) { c.innerHTML = '<div class="empty-state" style="padding:30px"><p>No logs</p></div>'; return; }
      c.innerHTML = logs.slice(0, 100).map(l => '<div class="event-item ' + (l.type || 'info') + '"><strong>' + formatTime(l.timestamp) + '</strong> ' + (l.message || '') + '</div>').join('');
    }

    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function formatTime(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    function timeAgo(ts) { if (!ts) return ''; const s = Math.floor((Date.now() - new Date(ts)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }
    function formatNum(n) { if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return (n / 1000).toFixed(1) + 'K'; return n.toString(); }

    document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    document.getElementById('chatInput').addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; });

    renderEvents(); renderLogs();
  </script>
</body>
</html>`;
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║   🛡️  NOVA ULTRA AI - Advanced Discord Protection System    ║');
  console.log('║                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║   🌐 Dashboard:     http://localhost:' + PORT + '                    ║');
  console.log('║   🎫 Tickets:       !ticket [reason]                         ║');
  console.log('║   🛡️ Verification:  Automatic on member join                 ║');
  console.log('║   🧪 Test:          !testvf                                  ║');
  console.log('║   ⚙️ Setup:         !setup                                   ║');
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (process.env.DISCORD_TOKEN) {
    await bot.start(process.env.DISCORD_TOKEN);
  } else {
    console.log('⚠️  No DISCORD_TOKEN found in environment variables!');
    console.log('   Add DISCORD_TOKEN to your .env file to start the bot.');
  }
});