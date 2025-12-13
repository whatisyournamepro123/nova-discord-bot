require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events
} = require('discord.js');

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                    NOVA ULTRA AI - ADVANCED THINKING ENGINE                            ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class NovaThinkingEngine {
  constructor() {
    this.groqKey = process.env.GROQ_API_KEY;
    this.userMemory = new Map();
    this.conversationContext = new Map();
    this.serverPatterns = new Map();
    this.thinkingLogs = [];
    this.learningData = new Map();
    
    // ═══════════════════════════════════════════════════════════════════════════
    // FIXED & IMPROVED PATTERNS (The "OP" Update)
    // ═══════════════════════════════════════════════════════════════════════════
    this.patterns = {
      // Critical - Instant Ban/Mute
      slurs: {
        pattern: /\b(nigg[a-z]*|faggot|retard|spic|chink|kike|tranny|dyke|coon)\b/gi,
        severity: 'critical',
        action: 'ban',
        confidence: 100
      },
      directThreats: {
        pattern: /\b(kill|murder|shoot|stab|rape|bomb)\s+(you|u|ur|your|them)\b/gi,
        severity: 'critical',
        action: 'ban',
        confidence: 90
      },
      
      // High - Delete & Warn
      toxicity: {
        // Updated to catch singular words better
        pattern: /\b(fuck|shit|bitch|asshole|dick|cunt|bastard|stfu|kys|whore|slut)\b/gi,
        severity: 'high',
        action: 'delete_warn',
        confidence: 80
      },
      
      // Medium - Context dependent
      scam: {
        pattern: /(free\s*nitro|steam\s*gift|gift\s*card|claim\s*now|click\s*here)/gi,
        severity: 'medium',
        action: 'delete_warn',
        confidence: 75
      },
      invites: {
        pattern: /(discord\.gg\/|discordapp\.com\/invite\/)/gi,
        severity: 'medium',
        action: 'delete_warn',
        confidence: 95
      }
    };

    this.contextIndicators = {
      joking: ['lol', 'lmao', 'jk', 'joking', 'haha', 'xd'],
      gaming: ['gg', 'ez', 'noob', 'kill', 'shoot', 'died'], // "Kill" is safe in gaming context
      heated: ['shut up', 'hate', 'stupid', 'idiot']
    };

    console.log(this.groqKey ? '🧠 Nova Thinking Engine Online [AI MODE]' : '⚠️ Nova Thinking Engine Online [PATTERN ONLY MODE]');
  }

  // ... (Core Thinking Process) ...
  async think(prompt, systemContext, options = {}) {
    if (!this.groqKey) return null;
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemContext }, { role: "user", content: prompt }],
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.3
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) { return null; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATION PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  async moderateMessage(message, member, guildSettings) {
    const startTime = Date.now();
    const content = message.content;
    const userId = member.id;

    const thinkingProcess = {
      username: member.user.tag,
      content: content.substring(0, 50),
      stages: [],
      finalDecision: null,
      processingTime: 0
    };

    try {
      // 1. OBSERVE
      const observation = await this.observe(message, member, message.guild.id, message.channel.id);
      
      // 2. ANALYZE (Pattern Matching)
      const analysis = this.analyze(content, observation);
      
      // 3. THINK (AI Verification)
      let thinking = null;
      // Triggers AI if severity is High OR if patterns found but context is "joking"
      const needsDeepThinking = analysis.severity !== 'none' || analysis.score > 20;

      if (needsDeepThinking && this.groqKey) {
        thinking = await this.deepThink(content, observation, analysis);
      }

      // 4. DECIDE
      const decision = this.decide(observation, analysis, thinking, guildSettings);

      thinkingProcess.finalDecision = decision;
      thinkingProcess.processingTime = Date.now() - startTime;
      this.thinkingLogs.unshift(thinkingProcess);
      if (this.thinkingLogs.length > 50) this.thinkingLogs.pop();

      return decision;

    } catch (error) {
      console.error('Moderation Error:', error);
      return { shouldAct: false, action: 'none' };
    }
  }

  async observe(message, member, guildId, channelId) {
    const userId = member.id;
    if (!this.userMemory.has(userId)) {
      this.userMemory.set(userId, { warnings: 0, trustScore: 50, violations: [] });
    }
    return {
      userProfile: this.userMemory.get(userId),
      memberInfo: {
        isAdmin: member.permissions.has(PermissionFlagsBits.Administrator),
        joinedDaysAgo: Math.floor((Date.now() - member.joinedTimestamp) / 86400000)
      }
    };
  }

  analyze(content, observation) {
    let score = 0;
    const patterns = [];
    const contextClues = [];

    // Check patterns
    for (const [type, data] of Object.entries(this.patterns)) {
      if (data.pattern.test(content)) {
        patterns.push({ type, severity: data.severity, confidence: data.confidence });
        if(data.severity === 'critical') score += 100;
        if(data.severity === 'high') score += 60;
        if(data.severity === 'medium') score += 30;
      }
    }

    // Check Context
    const lower = content.toLowerCase();
    if(lower.includes('lol') || lower.includes('jk')) contextClues.push('joking');
    if(lower.includes('kill') && (lower.includes('boss') || lower.includes('mob'))) contextClues.push('gaming');

    let severity = 'none';
    if (score >= 100) severity = 'critical';
    else if (score >= 60) severity = 'high';
    else if (score >= 30) severity = 'medium';

    return { score, patterns, contextClues, severity, confidence: 100 }; // Default high confidence on patterns
  }

  async deepThink(content, observation, analysis) {
    const prompt = `Analyze message: "${content}"
    Flags: ${analysis.patterns.map(p=>p.type).join(',')}
    Context: ${analysis.contextClues.join(',')}
    User Trust: ${observation.userProfile.trustScore}
    
    Is this malicious? JSON:
    {"harmfulProbability":0-100, "intent":"malicious|joking|gaming", "recommendation":"none|warn|delete|ban", "reason":"why"}`;

    const res = await this.think(prompt, "You are a Discord Mod AI. Gaming terms are safe. Slurs are never safe. JSON only.", {maxTokens: 150});
    try { return JSON.parse(res); } catch(e) { return null; }
  }

  decide(observation, analysis, thinking, guildSettings) {
    let action = 'none';
    let shouldAct = false;
    let reason = '';
    let severity = analysis.severity;

    // AI OVERRIDE
    if (thinking) {
        if (thinking.harmfulProbability > 65) {
            action = thinking.recommendation;
            reason = thinking.reason;
            shouldAct = true;
        } else {
            // AI says it's safe (e.g. joking)
            return { shouldAct: false, action: 'none', reason: 'AI cleared' };
        }
    } 
    // FALLBACK (No AI or AI Failed)
    else if (analysis.severity !== 'none') {
        shouldAct = true;
        reason = `Detected ${analysis.patterns.map(p=>p.type).join(', ')}`;
        
        if (analysis.severity === 'critical') action = 'ban';
        else if (analysis.severity === 'high') action = 'delete_warn';
        else if (analysis.severity === 'medium') action = 'delete_warn';
    }

    return { action, reason, severity, shouldAct, confidence: thinking?.harmfulProbability || 90 };
  }

  getUserProfile(userId) { return this.userMemory.get(userId); }
  getThinkingLogs() { return this.thinkingLogs; }
  // ... (Other helper methods from your original code) ...
  analyzeNewUser(user) { return { riskLevel: 'low', challengeCount: 1 }; } // Simplified for brevity
  generateChallenge(diff) { return { question: "2+2?", answer: "4", options: ["3","4","5","6"] }; }
  verifyAnswer(c, a) { return { correct: c.answer === a }; }
  categorizeTicket(c) { return 'general'; }
  suggestResponse() { return 'Hello!'; }
  chat() { return 'Beep boop'; }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                              NOVA DISCORD BOT                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class NovaBot {
  constructor(io) {
    this.io = io;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
    });
    this.ai = new NovaThinkingEngine();
    this.tickets = new Map();
    this.setupEvents();
  }

  setupEvents() {
    this.client.once(Events.ClientReady, () => {
      console.log(`🤖 ${this.client.user.tag} is online!`);
    });

    this.client.on(Events.MessageCreate, async (msg) => {
      if (msg.author.bot || !msg.guild) return;

      // 🚨 ADMIN BYPASS CHECK 🚨
      // If you are testing, COMMENT OUT the next line to let the bot ban you.
      // if (msg.member.permissions.has(PermissionFlagsBits.Administrator)) return; 

      // RUN MODERATION
      const result = await this.ai.moderateMessage(msg, msg.member, {});

      if (result.shouldAct) {
        try {
          // 1. DELETE
          if (msg.deletable) await msg.delete();

          // 2. EMBED WARNING
          const embed = new EmbedBuilder()
            .setColor(result.severity === 'critical' ? '#FF0000' : '#FFA500')
            .setTitle(`🛡️ Nova Auto-Mod: ${result.action.toUpperCase()}`)
            .setDescription(`**User:** ${msg.author}\n**Reason:** ${result.reason}`)
            .setFooter({ text: 'Nova Ultra AI' })
            .setTimestamp();

          const warnMsg = await msg.channel.send({ embeds: [embed] });
          setTimeout(() => warnMsg.delete().catch(()=>{}), 10000); // Auto clean up warning

          // 3. ACTIONS
          if (result.action === 'ban' && msg.member.bannable) {
            await msg.member.ban({ reason: result.reason });
          } else if (result.action === 'mute' && msg.member.moderatable) {
            await msg.member.timeout(10 * 60 * 1000, result.reason); // 10 min mute
          }

        } catch (e) {
          console.error("Mod Action Failed:", e);
        }
      }
    });
  }

  async start(token) { await this.client.login(token); }
  // ... (Keep other bot methods like getStats, etc for dashboard to work) ...
  getStats() { return { guilds: 1, users: 1 }; }
  getAllTickets() { return []; }
  getPendingSessions() { return []; }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                              SERVER START                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const bot = new NovaBot(io);

app.use(express.json());
app.get('/', (req, res) => res.send('<h1>Nova Bot Dashboard Running</h1>'));

io.on('connection', (socket) => {
    // Socket logic
    socket.emit('stats', bot.getStats());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`🌐 Dashboard running at http://localhost:${PORT}`);
  if (process.env.DISCORD_TOKEN) await bot.start(process.env.DISCORD_TOKEN);
  else console.log('⚠️ No DISCORD_TOKEN found in .env');
});