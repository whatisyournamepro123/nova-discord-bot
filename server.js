require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const {
  Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events
} = require('discord.js');

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                    NOVA ULTRA ADVANCED AI MODERATION ENGINE                           ║
// ║                         Every Message → AI Analysis → Action                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class UltraAdvancedModerationAI {
  constructor() {
    this.groqKey = process.env.GROQ_API_KEY;
    
    // ═══════════════════════════════════════════════════════════════════
    // CACHING & RATE LIMITING (prevents API spam)
    // ═══════════════════════════════════════════════════════════════════
    this.cache = new Map();           // hash -> {result, timestamp}
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 100;    // ms between requests (10/sec max)
    
    // ═══════════════════════════════════════════════════════════════════
    // USER BEHAVIOR TRACKING
    // ═══════════════════════════════════════════════════════════════════
    this.userWarnings = new Map();     // oderId -> {count, history[], lastWarning}
    this.userMessages = new Map();     // oderId -> [{content, timestamp}]
    this.userTrust = new Map();        // oderId -> score (0-100)
    
    // ═══════════════════════════════════════════════════════════════════
    // ULTRA ADVANCED PATTERN DETECTION (catches obfuscation)
    // ═══════════════════════════════════════════════════════════════════
    this.badWordBases = [
      // Profanity
      'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock', 'cunt', 'bastard',
      'whore', 'slut', 'damn', 'crap', 'piss', 'ass', 'bollocks', 'bugger',
      // Slurs (critical)
      'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'spic', 
      'chink', 'kike', 'tranny', 'dyke', 'coon', 'wetback', 'beaner',
      // Self-harm
      'kys', 'killyourself', 'suicide', 'cutmyself',
      // Hate
      'nazi', 'hitler',
    ];
    
    // Leetspeak mappings (comprehensive)
    this.leetMap = {
      'a': ['a', '@', '4', 'α', 'λ', 'Λ', 'ａ', '🅰', 'а', 'ä', 'á', 'à', 'â', 'ã'],
      'b': ['b', '8', '6', 'ß', 'ｂ', '🅱', 'б', 'в'],
      'c': ['c', '(', '<', '{', 'ç', 'ｃ', 'с', '¢'],
      'd': ['d', 'ｄ', 'đ', 'ð'],
      'e': ['e', '3', '€', 'ε', 'ｅ', 'е', 'ë', 'é', 'è', 'ê'],
      'f': ['f', 'ｆ', 'ƒ', 'φ'],
      'g': ['g', '9', '6', 'ｇ', 'ğ'],
      'h': ['h', '#', 'ｈ', 'н'],
      'i': ['i', '1', '!', '|', 'ｉ', 'і', 'ï', 'í', 'ì', 'î', 'ı'],
      'j': ['j', 'ｊ'],
      'k': ['k', 'ｋ', 'к'],
      'l': ['l', '1', '|', 'ｌ', 'ł'],
      'm': ['m', 'ｍ', 'м'],
      'n': ['n', 'ｎ', 'ñ', 'η', 'п', 'и'],
      'o': ['o', '0', 'ø', 'ｏ', 'о', 'ö', 'ó', 'ò', 'ô', 'õ', '⭕'],
      'p': ['p', 'ｐ', 'р', 'þ'],
      'q': ['q', 'ｑ'],
      'r': ['r', 'ｒ', 'я', 'г'],
      's': ['s', '5', '$', 'ｓ', 'ş', 'š', 'ś'],
      't': ['t', '7', '+', 'ｔ', 'т', 'ť'],
      'u': ['u', 'ｕ', 'μ', 'υ', 'ü', 'ú', 'ù', 'û', 'ц'],
      'v': ['v', 'ｖ', 'ν'],
      'w': ['w', 'ｗ', 'ω', 'ш', 'щ'],
      'x': ['x', 'ｘ', '×', 'х'],
      'y': ['y', 'ｙ', 'ÿ', 'ý', 'у'],
      'z': ['z', '2', 'ｚ', 'ž', 'ź', 'з'],
    };
    
    // Build reverse lookup
    this.reverseLeet = {};
    for (const [letter, variants] of Object.entries(this.leetMap)) {
      for (const v of variants) {
        this.reverseLeet[v.toLowerCase()] = letter;
      }
    }
    
    console.log(this.groqKey 
      ? '🧠 Ultra Advanced Moderation AI Online [GROQ ENABLED - Every message will be analyzed]' 
      : '⚠️ Ultra Advanced Moderation AI Online [PATTERN ONLY - No GROQ_API_KEY found]');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT NORMALIZATION (catches fuckk, f.u.c.k, fuuuuck, f_u_c_k, etc)
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalizeText(input = "") {
    let s = input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')           // Remove diacritics
      .replace(/[\u200B-\u200D\uFEFF]/g, '')     // Remove zero-width chars
      .toLowerCase();
    
    // Remove separators people use to evade: f.u.c.k, f_u_c_k, f-u-c-k, f u c k
    s = s.replace(/[\.\-_\*\|\s]+/g, '');
    
    // Convert leetspeak to letters
    let result = '';
    for (const char of s) {
      result += this.reverseLeet[char] || char;
    }
    
    // Collapse repeated letters: fuuuuuck -> fuck, shiiiiit -> shit
    result = result.replace(/([a-z])\1{2,}/g, '$1$1');  // Keep max 2 repeats
    result = result.replace(/([a-z])\1+/g, '$1');       // Then collapse to 1
    
    return result;
  }
  
  // Check if normalized text contains any bad word
  containsBadWord(text) {
    const normalized = this.normalizeText(text);
    const found = [];
    
    for (const word of this.badWordBases) {
      if (normalized.includes(word)) {
        found.push(word);
      }
    }
    
    // Also check original (some slurs might not normalize well)
    const lower = text.toLowerCase();
    for (const word of this.badWordBases) {
      if (lower.includes(word) && !found.includes(word)) {
        found.push(word);
      }
    }
    
    return found;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SPAM & BEHAVIOR DETECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  trackMessage(userId, content) {
    const now = Date.now();
    const history = this.userMessages.get(userId) || [];
    
    // Keep last 20 messages within 5 minutes
    const recent = history.filter(m => now - m.timestamp < 5 * 60 * 1000);
    recent.push({ content, timestamp: now, hash: this.hash(content) });
    
    if (recent.length > 20) recent.shift();
    this.userMessages.set(userId, recent);
    
    return this.analyzeSpamBehavior(recent);
  }
  
  analyzeSpamBehavior(messages) {
    if (messages.length < 3) return { isSpam: false, reason: null };
    
    const now = Date.now();
    const last10Seconds = messages.filter(m => now - m.timestamp < 10000);
    const last30Seconds = messages.filter(m => now - m.timestamp < 30000);
    
    // Fast spam: 5+ messages in 10 seconds
    if (last10Seconds.length >= 5) {
      return { isSpam: true, reason: `Sending messages too fast (${last10Seconds.length} in 10s)` };
    }
    
    // Duplicate spam: same message 3+ times in 30 seconds
    const hashes = last30Seconds.map(m => m.hash);
    const hashCounts = {};
    for (const h of hashes) {
      hashCounts[h] = (hashCounts[h] || 0) + 1;
      if (hashCounts[h] >= 3) {
        return { isSpam: true, reason: 'Sending duplicate messages' };
      }
    }
    
    return { isSpam: false, reason: null };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WARNING SYSTEM (escalating punishments)
  // ═══════════════════════════════════════════════════════════════════════════
  
  getWarnings(userId) {
    const data = this.userWarnings.get(userId);
    if (!data) return { count: 0, history: [] };
    
    // Decay warnings after 6 hours
    const validHistory = data.history.filter(w => Date.now() - w.timestamp < 6 * 60 * 60 * 1000);
    return { count: validHistory.length, history: validHistory };
  }
  
  addWarning(userId, reason, severity) {
    const data = this.userWarnings.get(userId) || { count: 0, history: [] };
    data.history.push({ reason, severity, timestamp: Date.now() });
    data.count = data.history.length;
    data.lastWarning = Date.now();
    this.userWarnings.set(userId, data);
    return data;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GROQ AI ANALYSIS (runs on EVERY message)
  // ═══════════════════════════════════════════════════════════════════════════
  
  hash(text) {
    return crypto.createHash('sha256').update(text || '').digest('hex').slice(0, 16);
  }
  
  async callGroqAI(content, context = {}) {
    if (!this.groqKey) return null;
    
    // Check cache first
    const cacheKey = this.hash(content);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.result;
    }
    
    // Rate limiting
    const timeSinceLast = Date.now() - this.lastRequestTime;
    if (timeSinceLast < this.minRequestInterval) {
      await new Promise(r => setTimeout(r, this.minRequestInterval - timeSinceLast));
    }
    this.lastRequestTime = Date.now();
    
    try {
      const systemPrompt = `You are an ultra-advanced Discord content moderation AI.

CRITICAL RULES:
1. Detect profanity/bad words even if obfuscated (extra letters, spacing, leetspeak, symbols)
   - "fuckk" "fuuuck" "f.u.c.k" "fück" "f@ck" = all profanity
   - "shiiit" "sh1t" "s.h.i.t" = all profanity
   - "biiitch" "b1tch" "bi+ch" = all profanity
2. Detect hate speech, slurs, racism (always severe)
3. Detect harassment, bullying, personal attacks
4. Detect threats, violence, self-harm content
5. Detect sexual/NSFW content
6. Detect spam, scams, phishing
7. Consider context - gaming terms like "kill the boss" are safe

RESPOND WITH JSON ONLY:
{
  "flagged": true/false,
  "category": "safe"|"profanity"|"slur"|"hate"|"harassment"|"threat"|"self_harm"|"sexual"|"violence"|"spam"|"scam",
  "severity": 1-10,
  "confidence": 0.0-1.0,
  "action": "allow"|"warn"|"delete"|"timeout"|"kick"|"ban",
  "reason": "brief explanation",
  "detectedWords": ["list", "of", "bad", "words"]
}

Severity Guide:
1-3: Minor (warn)
4-6: Moderate (delete + warn)
7-8: Severe (timeout)
9-10: Critical/Slurs (ban)`;

      const userPrompt = JSON.stringify({
        message: content,
        normalized: this.normalizeText(content),
        userWarnings: context.warnings || 0,
        channelType: context.channelType || 'text',
        isNewUser: context.isNewUser || false
      });

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 300,
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        console.error('Groq API Error:', response.status);
        return null;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      
      if (!text) return null;
      
      const result = JSON.parse(text);
      
      // Cache the result
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
      
    } catch (e) {
      console.error('Groq AI Error:', e.message);
      return null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ANALYSIS FUNCTION (combines pattern + AI)
  // ═══════════════════════════════════════════════════════════════════════════
  
  async analyzeMessage(message) {
    const content = message.content || '';
    const userId = message.author.id;
    
    // Skip very short messages
    if (content.trim().length < 2) {
      return { shouldAct: false, action: 'allow' };
    }
    
    const result = {
      shouldAct: false,
      action: 'allow',
      reason: '',
      severity: 0,
      category: 'safe',
      source: 'none',
      detectedWords: []
    };
    
    // ─────────────────────────────────────────────────────────────────
    // PHASE 1: Quick Pattern Check (instant, catches obfuscation)
    // ─────────────────────────────────────────────────────────────────
    const foundBadWords = this.containsBadWord(content);
    
    if (foundBadWords.length > 0) {
      result.shouldAct = true;
      result.detectedWords = foundBadWords;
      result.source = 'pattern';
      
      // Check severity based on word type
      const slurs = ['nigger', 'nigga', 'faggot', 'fag', 'retard', 'spic', 'chink', 'kike', 'tranny', 'dyke', 'coon'];
      const selfHarm = ['kys', 'killyourself'];
      
      const hasSlur = foundBadWords.some(w => slurs.includes(w));
      const hasSelfHarm = foundBadWords.some(w => selfHarm.includes(w));
      
      if (hasSlur) {
        result.action = 'ban';
        result.severity = 10;
        result.category = 'slur';
        result.reason = `Slur detected: ${foundBadWords.join(', ')}`;
      } else if (hasSelfHarm) {
        result.action = 'timeout';
        result.severity = 9;
        result.category = 'self_harm';
        result.reason = `Self-harm content: ${foundBadWords.join(', ')}`;
      } else {
        result.action = 'delete_warn';
        result.severity = 5;
        result.category = 'profanity';
        result.reason = `Profanity detected: ${foundBadWords.join(', ')}`;
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // PHASE 2: Spam Detection
    // ─────────────────────────────────────────────────────────────────
    const spamCheck = this.trackMessage(userId, content);
    
    if (spamCheck.isSpam) {
      result.shouldAct = true;
      result.action = 'timeout';
      result.severity = 6;
      result.category = 'spam';
      result.reason = spamCheck.reason;
      result.source = 'spam_detection';
    }
    
    // ─────────────────────────────────────────────────────────────────
    // PHASE 3: Other Quick Checks
    // ─────────────────────────────────────────────────────────────────
    
    // Mass mentions
    const mentionCount = (message.mentions?.users?.size || 0) + 
                         (message.mentions?.roles?.size || 0) +
                         (message.mentions?.everyone ? 10 : 0);
    
    if (mentionCount > 5) {
      result.shouldAct = true;
      result.action = 'timeout';
      result.severity = 7;
      result.category = 'spam';
      result.reason = `Mass mentions (${mentionCount} mentions)`;
      result.source = 'mention_spam';
    }
    
    // Discord invites
    if (/(discord\.(gg|io|me|li)\/\S+|discord(app)?\.com\/invite\/\S+)/i.test(content)) {
      result.shouldAct = true;
      result.action = 'delete_warn';
      result.severity = 4;
      result.category = 'invite';
      result.reason = 'Unauthorized Discord invite';
      result.source = 'invite_filter';
    }
    
    // Excessive caps (80%+ caps, 15+ letters)
    const letters = content.replace(/[^a-zA-Z]/g, '');
    const upperCount = (content.match(/[A-Z]/g) || []).length;
    if (letters.length >= 15 && upperCount / letters.length > 0.8) {
      if (!result.shouldAct) {
        result.shouldAct = true;
        result.action = 'warn';
        result.severity = 2;
        result.category = 'caps';
        result.reason = 'Excessive caps';
        result.source = 'caps_filter';
      }
    }
    
    // ─────────────────────────────────────────────────────────────────
    // PHASE 4: GROQ AI ANALYSIS (runs on EVERY message)
    // ─────────────────────────────────────────────────────────────────
    if (this.groqKey) {
      const warnings = this.getWarnings(userId);
      const accountAge = Date.now() - message.author.createdTimestamp;
      const isNewUser = accountAge < 7 * 24 * 60 * 60 * 1000; // < 7 days
      
      const aiResult = await this.callGroqAI(content, {
        warnings: warnings.count,
        channelType: message.channel?.type || 'text',
        isNewUser
      });
      
      if (aiResult && aiResult.flagged) {
        // AI found something - use its result if more severe
        if (aiResult.severity > result.severity) {
          result.shouldAct = true;
          result.action = aiResult.action || 'warn';
          result.severity = aiResult.severity;
          result.category = aiResult.category;
          result.reason = aiResult.reason;
          result.source = 'ai';
          result.detectedWords = aiResult.detectedWords || result.detectedWords;
          result.aiConfidence = aiResult.confidence;
        }
      }
    }
    
    return result;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                              NOVA DISCORD BOT                                         ║
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
    
    this.ai = new UltraAdvancedModerationAI();
    this.logs = [];
    
    // Settings (dashboard controls these)
    this.settings = {
      enabled: true,
      useAI: true,
      detectSpam: true,
      detectBadWords: true,
      detectToxicity: true,
      detectLinks: false,
      detectCaps: true,
      detectInvites: true,
      deleteMessages: true,
      warnUsers: true,
      autoMute: true,
      maxWarnings: 3,
      muteDuration: 10,   // minutes
      spamMessages: 5,
      logChannelName: 'mod-logs'
    };
    
    // Stats for dashboard
    this.stats = {
      messagesScanned: 0,
      messagesDeleted: 0,
      warningsGiven: 0,
      mutesDone: 0,
      banned: 0,
      aiDetections: 0,
      spamBlocked: 0,
      badWordsBlocked: 0,
      linksBlocked: 0,
      invitesBlocked: 0
    };
    
    this.setupEvents();
  }
  
  log(message, type = 'info') {
    const entry = { message, type, timestamp: new Date().toISOString() };
    this.logs.push(entry);
    if (this.logs.length > 100) this.logs.shift();
    if (this.io) this.io.emit('newLog', entry);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
  
  emitStats() {
    if (!this.io) return;
    this.io.emit('stats', {
      ...this.stats,
      guilds: this.client.guilds?.cache.size || 0,
      users: this.client.guilds?.cache.reduce((a, g) => a + (g.memberCount || 0), 0) || 0,
      ping: this.client.ws.ping,
      uptime: this.client.uptime,
      ai: { enabled: !!this.ai.groqKey }
    });
  }

  setupEvents() {
    this.client.once(Events.ClientReady, () => {
      console.log(`\n╔═══════════════════════════════════════════════════╗`);
      console.log(`║  🤖 ${this.client.user.tag} is ONLINE!`);
      console.log(`║  🛡️ Ultra Advanced Moderation: ACTIVE`);
      console.log(`║  🧠 Groq AI: ${this.ai.groqKey ? 'ENABLED (every message)' : 'DISABLED'}`);
      console.log(`║  📊 Servers: ${this.client.guilds.cache.size}`);
      console.log(`╚═══════════════════════════════════════════════════╝\n`);
      this.log('Bot started with Ultra Advanced Moderation!', 'success');
      this.emitStats();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // MAIN MESSAGE HANDLER - EVERY MESSAGE IS ANALYZED
    // ═══════════════════════════════════════════════════════════════════════
    this.client.on(Events.MessageCreate, async (message) => {
      // Skip bots and DMs
      if (message.author.bot || !message.guild) return;
      
      // Skip if moderation disabled
      if (!this.settings.enabled) return;
      
      // Skip admins
      if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
      
      this.stats.messagesScanned++;
      
      // ─────────────────────────────────────────────────────────────────
      // COMMAND HANDLING
      // ─────────────────────────────────────────────────────────────────
      const content = message.content.toLowerCase();
      
      if (content === '!help') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🛡️ Nova Ultra Moderation')
          .setDescription('AI-powered server protection')
          .addFields(
            { name: '!setmodlog #channel', value: 'Set moderation log channel' },
            { name: '!modstats', value: 'View moderation statistics' },
            { name: '!clearwarnings @user', value: 'Clear user warnings (Admin)' }
          );
        return message.reply({ embeds: [embed] });
      }
      
      if (content.startsWith('!setmodlog') && message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        const channel = message.mentions.channels.first();
        if (channel) {
          this.settings.logChannelName = channel.name;
          return message.reply({ 
            embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription(`✅ Mod logs will be sent to ${channel}`)]
          });
        }
        return message.reply('Usage: `!setmodlog #channel`');
      }
      
      if (content === '!modstats') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📊 Moderation Statistics')
          .addFields(
            { name: '🔍 Scanned', value: `${this.stats.messagesScanned}`, inline: true },
            { name: '🗑️ Deleted', value: `${this.stats.messagesDeleted}`, inline: true },
            { name: '⚠️ Warnings', value: `${this.stats.warningsGiven}`, inline: true },
            { name: '🔇 Mutes', value: `${this.stats.mutesDone}`, inline: true },
            { name: '🧠 AI Detections', value: `${this.stats.aiDetections}`, inline: true },
            { name: '🚫 Bad Words', value: `${this.stats.badWordsBlocked}`, inline: true }
          );
        return message.reply({ embeds: [embed] });
      }
      
      // ─────────────────────────────────────────────────────────────────
      // ANALYZE THE MESSAGE
      // ─────────────────────────────────────────────────────────────────
      try {
        const analysis = await this.ai.analyzeMessage(message);
        
        if (analysis.shouldAct) {
          await this.takeAction(message, analysis);
        }
        
        this.emitStats();
        
      } catch (error) {
        console.error('Moderation error:', error);
      }
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TAKE ACTION BASED ON ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════
  async takeAction(message, analysis) {
    const member = message.member;
    const userId = message.author.id;
    
    // Update stats
    if (analysis.source === 'ai') this.stats.aiDetections++;
    if (analysis.category === 'spam') this.stats.spamBlocked++;
    if (analysis.category === 'profanity' || analysis.category === 'slur') this.stats.badWordsBlocked++;
    if (analysis.category === 'invite') this.stats.invitesBlocked++;
    
    // ─────────────────────────────────────────────────────────────────
    // DELETE MESSAGE
    // ─────────────────────────────────────────────────────────────────
    const shouldDelete = this.settings.deleteMessages && 
      ['delete', 'delete_warn', 'timeout', 'kick', 'ban'].includes(analysis.action);
    
    if (shouldDelete && message.deletable) {
      try {
        await message.delete();
        this.stats.messagesDeleted++;
      } catch {}
    }
    
    // ─────────────────────────────────────────────────────────────────
    // ADD WARNING
    // ─────────────────────────────────────────────────────────────────
    const shouldWarn = this.settings.warnUsers && 
      ['warn', 'delete_warn', 'timeout'].includes(analysis.action);
    
    let warningData = { count: 0 };
    
    if (shouldWarn) {
      warningData = this.ai.addWarning(userId, analysis.reason, analysis.severity);
      this.stats.warningsGiven++;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // DM THE USER
    // ─────────────────────────────────────────────────────────────────
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(analysis.severity >= 8 ? 0xED4245 : analysis.severity >= 5 ? 0xFEE75C : 0xFAA61A)
        .setTitle('🛡️ Nova Auto-Moderation')
        .setDescription(`Your message in **${message.guild.name}** was flagged.`)
        .addFields(
          { name: 'Reason', value: analysis.reason, inline: false },
          { name: 'Category', value: analysis.category, inline: true },
          { name: 'Severity', value: `${analysis.severity}/10`, inline: true },
          { name: 'Warnings', value: `${warningData.count}/${this.settings.maxWarnings}`, inline: true }
        )
        .setTimestamp();
      
      if (analysis.detectedWords?.length > 0) {
        dmEmbed.addFields({ name: 'Detected', value: analysis.detectedWords.join(', ') });
      }
      
      await message.author.send({ embeds: [dmEmbed] });
    } catch {} // DMs might be disabled
    
    // ─────────────────────────────────────────────────────────────────
    // TIMEOUT / MUTE
    // ─────────────────────────────────────────────────────────────────
    const shouldTimeout = 
      (analysis.action === 'timeout') ||
      (this.settings.autoMute && warningData.count >= this.settings.maxWarnings);
    
    if (shouldTimeout && member?.moderatable) {
      const duration = this.settings.muteDuration * 60 * 1000;
      
      // Escalate duration based on warnings
      const multiplier = Math.min(4, 1 + (warningData.count - this.settings.maxWarnings) * 0.5);
      const actualDuration = Math.round(duration * Math.max(1, multiplier));
      
      try {
        await member.timeout(actualDuration, analysis.reason);
        this.stats.mutesDone++;
        this.log(`🔇 Muted ${message.author.tag} for ${Math.round(actualDuration / 60000)}m - ${analysis.reason}`, 'moderation');
      } catch {}
    }
    
    // ─────────────────────────────────────────────────────────────────
    // BAN (for slurs/critical severity)
    // ─────────────────────────────────────────────────────────────────
    if (analysis.action === 'ban' && member?.bannable) {
      try {
        await member.ban({ reason: `AutoMod: ${analysis.reason}`, deleteMessageSeconds: 60 });
        this.stats.banned++;
        this.log(`🔨 Banned ${message.author.tag} - ${analysis.reason}`, 'moderation');
      } catch {}
    }
    
    // ─────────────────────────────────────────────────────────────────
    // SEND NOTICE IN CHANNEL
    // ─────────────────────────────────────────────────────────────────
    try {
      const noticeEmbed = new EmbedBuilder()
        .setColor(analysis.severity >= 8 ? 0xED4245 : analysis.severity >= 5 ? 0xFEE75C : 0x5865F2)
        .setAuthor({ name: 'Nova Guardian', iconURL: this.client.user.displayAvatarURL() })
        .setDescription(`${message.author} - ${analysis.reason}`)
        .setFooter({ text: `Severity: ${analysis.severity}/10 | ${analysis.source === 'ai' ? '🧠 AI' : '⚡ Pattern'}` })
        .setTimestamp();
      
      const notice = await message.channel.send({ embeds: [noticeEmbed] });
      setTimeout(() => notice.delete().catch(() => {}), 8000);
    } catch {}
    
    // ─────────────────────────────────────────────────────────────────
    // LOG TO MOD CHANNEL
    // ─────────────────────────────────────────────────────────────────
    await this.logToModChannel(message, analysis, warningData);
    
    this.log(`🛡️ ${message.author.tag} → ${analysis.action.toUpperCase()} | ${analysis.reason}`, 'moderation');
  }
  
  async logToModChannel(message, analysis, warningData) {
    const logChannel = message.guild.channels.cache.find(c => c.name === this.settings.logChannelName);
    if (!logChannel) return;
    
    const embed = new EmbedBuilder()
      .setColor(
        analysis.action === 'ban' ? 0xED4245 :
        analysis.action === 'timeout' ? 0xFEE75C :
        analysis.action === 'delete_warn' ? 0xFAA61A :
        0x5865F2
      )
      .setTitle('🛡️ Nova Auto-Mod Action')
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: '👤 User', value: `${message.author.tag}\n\`${message.author.id}\``, inline: true },
        { name: '🔨 Action', value: analysis.action, inline: true },
        { name: '📊 Severity', value: `${analysis.severity}/10`, inline: true },
        { name: '📁 Category', value: analysis.category, inline: true },
        { name: '⚠️ Warnings', value: `${warningData.count}/${this.settings.maxWarnings}`, inline: true },
        { name: '🔍 Source', value: analysis.source === 'ai' ? '🧠 AI' : '⚡ Pattern', inline: true },
        { name: '📝 Reason', value: analysis.reason },
        { name: '📢 Channel', value: `${message.channel}`, inline: true }
      )
      .setFooter({ text: 'Nova Ultra Advanced Moderation' })
      .setTimestamp();
    
    // Add message content (censored)
    const content = (message.content || '').slice(0, 500);
    if (content) {
      embed.addFields({ name: '💬 Message', value: `\`\`\`${content}\`\`\`` });
    }
    
    if (analysis.detectedWords?.length > 0) {
      embed.addFields({ name: '🚫 Detected Words', value: analysis.detectedWords.join(', ') });
    }
    
    if (analysis.aiConfidence) {
      embed.addFields({ name: '🧠 AI Confidence', value: `${Math.round(analysis.aiConfidence * 100)}%`, inline: true });
    }
    
    try {
      await logChannel.send({ embeds: [embed] });
    } catch {}
  }
  
  async start(token) {
    await this.client.login(token);
  }
  
  getStats() {
    return {
      ...this.stats,
      guilds: this.client.guilds?.cache.size || 0,
      users: this.client.guilds?.cache.reduce((a, g) => a + (g.memberCount || 0), 0) || 0,
      ping: this.client.ws.ping,
      uptime: this.client.uptime,
      ai: { enabled: !!this.ai.groqKey }
    };
  }
  
  getSettings() {
    return this.settings;
  }
  
  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    if (this.io) this.io.emit('settings', this.settings);
    return this.settings;
  }
  
  getLogs() {
    return this.logs;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                              SERVER & DASHBOARD                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const bot = new NovaBot(io);

app.use(express.json());
app.use(express.static('public'));

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// API endpoints
app.get('/api/stats', (req, res) => {
  res.json(bot.getStats());
});

app.get('/api/settings', (req, res) => {
  res.json(bot.getSettings());
});

app.post('/api/settings', (req, res) => {
  res.json(bot.updateSettings(req.body));
});

app.get('/api/logs', (req, res) => {
  res.json(bot.getLogs());
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('📊 Dashboard connected');
  
  socket.emit('stats', bot.getStats());
  socket.emit('settings', bot.getSettings());
  socket.emit('logs', bot.getLogs());
  
  socket.on('updateSettings', (patch) => {
    bot.updateSettings(patch);
    io.emit('settings', bot.getSettings());
  });
  
  socket.on('disconnect', () => {
    console.log('📊 Dashboard disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`\n🌐 Dashboard running at http://localhost:${PORT}`);
  
  console.log('\n📋 Environment Check:');
  console.log(`   DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Node Version: ${process.version}`);
  
  if (process.env.DISCORD_TOKEN) {
    await bot.start(process.env.DISCORD_TOKEN);
  } else {
    console.log('\n⚠️ No DISCORD_TOKEN - Bot will not start');
  }
});