// server.js - COMPLETE ULTRA NOVA AI SYSTEM
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                           NOVA ULTRA AI ENGINE                                         ║
// ║                    Advanced Reasoning & Decision Making System                         ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class NovaUltraAI {
  constructor() {
    this.groqKey = process.env.GROQ_API_KEY;
    this.contextMemory = new Map();
    this.userProfiles = new Map();
    this.moderationHistory = new Map();
    this.thinkingCache = new Map();
    
    // Advanced pattern detection
    this.patterns = {
      toxicity: /\b(fuck|shit|bitch|ass|dick|cunt|bastard|damn|hell)\b/gi,
      slurs: /\b(nigger|nigga|faggot|retard|spic|chink|kike)\b/gi,
      threats: /\b(kill|murder|die|death|shoot|stab|hurt|attack)\s*(you|him|her|them|yourself)/gi,
      spam: /(.)\1{5,}|(\b\w+\b)(\s+\1){3,}/gi,
      links: /(https?:\/\/[^\s]+)|(discord\.gg\/\w+)|(bit\.ly\/\w+)/gi,
      invites: /discord\.gg\/\w+|discordapp\.com\/invite\/\w+/gi,
      selfPromo: /(sub|follow|like|check out|my channel|my server)/gi,
      scam: /(free nitro|gift card|click here|claim now|limited time)/gi,
      caps: /^[A-Z\s!?]{15,}$/,
      zalgo: /[\u0300-\u036f\u0489]{3,}/g,
      emoji: /[\u{1F300}-\u{1F9FF}]/gu
    };

    // Sentiment lexicon for offline analysis
    this.sentimentLexicon = {
      positive: ['good', 'great', 'awesome', 'amazing', 'love', 'like', 'thanks', 'thank', 'nice', 'cool', 'best', 'happy', 'glad', 'wonderful', 'excellent', 'perfect', 'beautiful', 'fantastic'],
      negative: ['bad', 'hate', 'worst', 'terrible', 'awful', 'horrible', 'sucks', 'stupid', 'dumb', 'idiot', 'ugly', 'annoying', 'boring', 'angry', 'sad', 'disappointed'],
      toxic: ['fuck', 'shit', 'bitch', 'ass', 'damn', 'crap', 'hell', 'dick', 'bastard', 'idiot', 'moron', 'loser', 'pathetic', 'trash', 'garbage']
    };

    console.log(this.groqKey ? '🧠 Nova Ultra AI Engine Online [GROQ ENABLED]' : '🧠 Nova Ultra AI Engine Online [FALLBACK MODE]');
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // CORE AI INTERFACE
  // ═══════════════════════════════════════════════════════════════════════════════════════

  async think(prompt, systemContext, options = {}) {
    if (!this.groqKey) return null;

    const cacheKey = `${prompt.substring(0, 50)}_${options.temperature || 0.7}`;
    if (options.useCache && this.thinkingCache.has(cacheKey)) {
      return this.thinkingCache.get(cacheKey);
    }

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
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          stream: false
        })
      });

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || null;

      if (result && options.useCache) {
        this.thinkingCache.set(cacheKey, result);
        setTimeout(() => this.thinkingCache.delete(cacheKey), 300000);
      }

      return result;
    } catch (e) {
      console.error('AI Think Error:', e.message);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // ULTRA ADVANCED MODERATION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════════════════

  async moderateMessage(message, member, guildSettings) {
    const content = message.content;
    const userId = member.id;
    const now = Date.now();

    // Initialize user profile if needed
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        oderId: oderId,
        oderId: username,
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

    const profile = this.userProfiles.get(userId);
    profile.lastSeen = now;
    profile.messagesAnalyzed++;

    // Store message for context
    profile.messages.push({
      content: content.substring(0, 200),
      timestamp: now,
      channelId: message.channel.id
    });

    // Keep only last 50 messages per user
    if (profile.messages.length > 50) profile.messages.shift();

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: QUICK LOCAL ANALYSIS (No AI needed)
    // ═══════════════════════════════════════════════════════════════

    const quickAnalysis = this.quickAnalyze(content, profile);

    if (quickAnalysis.severity === 'critical') {
      return this.buildModerationResult(quickAnalysis, profile, 'quick');
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: CONTEXT-AWARE ANALYSIS
    // ═══════════════════════════════════════════════════════════════

    const contextAnalysis = this.analyzeContext(content, profile, message);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: AI DEEP ANALYSIS (For ambiguous cases)
    // ═══════════════════════════════════════════════════════════════

    let aiAnalysis = null;
    const needsAI = quickAnalysis.score > 20 || contextAnalysis.suspicious || content.length > 50;

    if (needsAI && this.groqKey) {
      aiAnalysis = await this.deepAnalyze(content, profile, message, guildSettings);
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4: DECISION SYNTHESIS
    // ═══════════════════════════════════════════════════════════════

    const finalDecision = this.synthesizeDecision(quickAnalysis, contextAnalysis, aiAnalysis, profile);

    // Update user profile based on decision
    this.updateProfile(profile, finalDecision);

    return finalDecision;
  }

  quickAnalyze(content, profile) {
    let score = 0;
    const flags = [];
    const lower = content.toLowerCase();

    // Check for slurs (highest priority)
    if (this.patterns.slurs.test(content)) {
      score += 100;
      flags.push({ type: 'slur', severity: 'critical', detail: 'Racial/discriminatory slur detected' });
    }

    // Check for threats
    if (this.patterns.threats.test(content)) {
      score += 80;
      flags.push({ type: 'threat', severity: 'critical', detail: 'Threat of violence detected' });
    }

    // Check for scams
    if (this.patterns.scam.test(lower)) {
      score += 70;
      flags.push({ type: 'scam', severity: 'high', detail: 'Potential scam/phishing' });
    }

    // Check for toxicity
    const toxicMatches = content.match(this.patterns.toxicity);
    if (toxicMatches) {
      score += Math.min(toxicMatches.length * 15, 60);
      flags.push({ type: 'toxicity', severity: 'medium', detail: `${toxicMatches.length} toxic word(s)` });
    }

    // Check for spam patterns
    if (this.patterns.spam.test(content)) {
      score += 40;
      flags.push({ type: 'spam', severity: 'medium', detail: 'Spam pattern detected' });
    }

    // Check for excessive caps
    if (this.patterns.caps.test(content) && content.length > 15) {
      score += 25;
      flags.push({ type: 'caps', severity: 'low', detail: 'Excessive caps' });
    }

    // Check for discord invites
    if (this.patterns.invites.test(content)) {
      score += 35;
      flags.push({ type: 'invite', severity: 'medium', detail: 'Discord invite link' });
    }

    // Check for zalgo text
    if (this.patterns.zalgo.test(content)) {
      score += 30;
      flags.push({ type: 'zalgo', severity: 'low', detail: 'Zalgo/corrupted text' });
    }

    // Calculate sentiment
    const sentiment = this.calculateSentiment(lower);

    // Adjust score based on trust
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

    // Check message frequency (spam detection)
    const recentMessages = profile.messages.filter(m => m.timestamp > Date.now() - 10000);
    if (recentMessages.length > 5) {
      suspicious.push('Rapid message sending');
      contextScore += 20;
    }

    // Check for repeated content
    const duplicates = profile.messages.filter(m => 
      m.content === content.substring(0, 200) && m.timestamp > Date.now() - 60000
    );
    if (duplicates.length > 2) {
      suspicious.push('Repeated messages');
      contextScore += 30;
    }

    // Check user history
    if (profile.warnings >= 3) {
      suspicious.push('Multiple prior warnings');
      contextScore += 15;
    }

    // Check trust score
    if (profile.trustScore < 30) {
      suspicious.push('Low trust score');
      contextScore += 10;
    }

    // Check for escalating behavior
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
- Total Messages Analyzed: ${profile.messagesAnalyzed}

ANALYSIS REQUIREMENTS:
1. Detect subtle toxicity, passive aggression, or veiled insults
2. Identify manipulation, gaslighting, or emotional abuse
3. Check for coded language, dog whistles, or hidden meanings
4. Assess intent: Is this genuinely harmful or just edgy humor?
5. Consider cultural context and sarcasm
6. Evaluate if action would be proportionate

RESPOND IN JSON ONLY:
{
  "harmful": true/false,
  "confidence": 0-100,
  "toxicityScore": 0-100,
  "categories": ["list", "of", "violation", "types"],
  "intent": "malicious/careless/joking/unclear",
  "subtleIssues": ["list", "of", "subtle", "problems"],
  "recommendation": "ignore/warn/delete/mute/ban",
  "reasoning": "detailed explanation of decision",
  "suggestedResponse": "what to tell the user if warned"
}`;

    const response = await this.think(prompt, `You are an expert Discord moderator AI. You understand internet culture, memes, sarcasm, and context. You are fair but firm. You protect communities while respecting free expression. False positives damage trust - only flag genuinely problematic content. Consider the FULL context before deciding. Output valid JSON only.`, { temperature: 0.3, maxTokens: 400 });

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

    // Critical violations always act
    if (quick.severity === 'critical') {
      action = quick.flags.some(f => f.type === 'slur' || f.type === 'threat') ? 'ban' : 'delete_warn';
      reason = quick.flags.map(f => f.detail).join(', ');
      severity = 'critical';
      confidence = 95;
    }
    // High severity with context
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
    // Medium severity - AI decides
    else if (quick.severity === 'medium' && ai) {
      if (ai.harmful && ai.confidence > 60) {
        action = ai.recommendation;
        reason = ai.reasoning;
        severity = 'medium';
        confidence = ai.confidence;
      }
    }
    // Context-based action
    else if (context.score > 40) {
      action = 'warn';
      reason = context.reasons.join(', ');
      severity = 'low';
      confidence = 60;
    }

    // Trust score adjustment
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
      critical: 'Your message violated our community guidelines and has been removed. Further violations will result in a ban.',
      high: 'Please keep the chat respectful. Your message was removed for violating our rules.',
      medium: 'Hey! Let\'s keep things friendly here. Please review our community guidelines.',
      low: 'Just a heads up - please be mindful of our community rules.',
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

      // Decrease trust score
      const trustPenalty = { critical: 30, high: 20, medium: 10, low: 5 };
      profile.trustScore = Math.max(0, profile.trustScore - (trustPenalty[decision.severity] || 0));
    } else {
      // Slowly increase trust for good behavior
      profile.positiveActions++;
      if (profile.positiveActions % 10 === 0) {
        profile.trustScore = Math.min(100, profile.trustScore + 1);
      }
    }

    // Update average sentiment
    if (decision.quickAnalysis?.sentiment) {
      const s = decision.quickAnalysis.sentiment;
      profile.averageSentiment = (profile.averageSentiment * 0.9) + (s.overall * 0.1);
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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // USER ANALYSIS FOR VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════════════

  async analyzeNewUser(user) {
    const now = Date.now();
    const accountAge = now - user.createdTimestamp;
    const daysOld = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const hoursOld = Math.floor(accountAge / (1000 * 60 * 60));

    let riskScore = 0;
    const flags = [];

    // Account age analysis
    if (hoursOld < 1) { riskScore += 50; flags.push('🚨 Account < 1 hour old'); }
    else if (hoursOld < 24) { riskScore += 35; flags.push('⚠️ Account < 24 hours old'); }
    else if (daysOld < 7) { riskScore += 20; flags.push('📝 Account < 1 week old'); }
    else if (daysOld < 30) { riskScore += 10; }
    else if (daysOld > 365) { riskScore -= 10; }

    // Avatar check
    if (!user.avatar) { riskScore += 15; flags.push('👤 No avatar'); }
    else if (user.avatar.startsWith('a_')) { riskScore -= 5; }

    // Username analysis
    const username = user.username.toLowerCase();
    if (/^[a-z]{2,4}\d{4,}$/.test(username)) { riskScore += 20; flags.push('🤖 Auto-generated name pattern'); }
    if (/(free|nitro|gift|hack|bot|spam|discord\.gg)/i.test(username)) { riskScore += 30; flags.push('🚫 Suspicious keywords in name'); }
    if (/[\u0300-\u036f\u0489]/.test(username)) { riskScore += 10; flags.push('🔣 Zalgo text'); }

    riskScore = Math.max(0, Math.min(100, riskScore));

    let riskLevel, challengeCount;
    if (riskScore >= 60) { riskLevel = 'critical'; challengeCount = 3; }
    else if (riskScore >= 40) { riskLevel = 'high'; challengeCount = 2; }
    else if (riskScore >= 20) { riskLevel = 'medium'; challengeCount = 2; }
    else { riskLevel = 'low'; challengeCount = 1; }

    return {
      userId: user.id,
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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // CHALLENGE GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════════════

  async generateChallenge(difficulty) {
    const aiPrompt = `Generate a ${difficulty} verification challenge that a human can solve easily but a bot cannot.

Types: math, pattern, logic, knowledge, emoji, word
Make it FUN and engaging!

JSON ONLY:
{
  "question": "the question",
  "answer": "correct answer",
  "options": ["correct", "wrong1", "wrong2", "wrong3"],
  "hint": "helpful hint",
  "type": "challenge type"
}`;

    const response = await this.think(aiPrompt, 'Create fun, varied verification challenges. Humans should solve them in under 15 seconds. JSON only.', { temperature: 0.95, maxTokens: 200 });

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

    // Fallback
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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // TICKET SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════════════════

  async categorizeTicket(content) {
    const r = await this.think('Categorize this support request: ' + content, 'Reply with ONLY one word: general, technical, billing, report, or other', { temperature: 0, maxTokens: 20 });
    const valid = ['general', 'technical', 'billing', 'report', 'other'];
    return valid.includes((r || '').toLowerCase().trim()) ? r.toLowerCase().trim() : 'general';
  }

  async suggestResponse(messages, category) {
    const convo = messages.slice(-5).map(m => `${m.author}: ${m.content}`).join('\n');
    return await this.think(`Suggest a helpful support response for this ${category} ticket:\n${convo}`, 'You are a professional support agent. Be helpful, concise, and friendly. Under 200 characters.', { temperature: 0.7, maxTokens: 150 });
  }

  async analyzeTicket(messages) {
    const convo = messages.slice(-10).map(m => `${m.author}: ${m.content}`).join('\n');
    const response = await this.think(
      `Analyze this ticket:\n${convo}\n\nJSON: {"sentiment":"positive/neutral/negative","urgency":"low/medium/high","summary":"one sentence"}`,
      'Analyze tickets briefly. JSON only.', { temperature: 0.3, maxTokens: 100 }
    );
    try {
      return JSON.parse(response.replace(/```json?|```/g, '').trim());
    } catch (e) {
      return { sentiment: 'neutral', urgency: 'medium', summary: 'Support request' };
    }
  }

  async chat(message, username) {
    return await this.think(`${username}: ${message}`, 'You are Nova, a friendly AI assistant. Be helpful, use emojis, keep responses under 250 characters.', { temperature: 0.8, maxTokens: 200 }) || 'Hey there! 👋 How can I help?';
  }

  // Get stats for dashboard
  getStats() {
    return {
      enabled: !!this.groqKey,
      usersTracked: this.userProfiles.size,
      cacheSize: this.thinkingCache.size
    };
  }

  getUserProfile(userId) {
    return this.userProfiles.get(userId);
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
    
    // Data stores
    this.sessions = new Map();
    this.settings = new Map();
    this.tickets = new Map();
    this.ticketChannels = new Map();
    this.ticketCounter = 1;
    
    // Statistics
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
        // Moderation
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
        // Verification
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
    this.client.once('ready', () => {
      console.log(`🤖 ${this.client.user.tag} is online!`);
      this.log('Bot started successfully!', 'success');
      this.addEvent('Bot Online', `${this.client.user.tag} connected`, 'success');
    });

    // ═══════════════════════════════════════════════════════════════
    // MEMBER JOIN - VERIFICATION
    // ═══════════════════════════════════════════════════════════════

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
        oderId: oderId,
        oderId: oderId,
        oderId: username,
        oderId: avatar,
        analysis,
        challenges,
        currentIndex: 0,
        attempts: 0,
        maxAttempts: settings.maxAttempts,
        status: 'pending',
        startedAt: Date.now(),
        expiresAt: Date.now() + 300000
      };

      // Fix property names
      session.memberId = member.id;
      session.guildId = member.guild.id;
      session.username = member.user.tag;
      session.avatar = member.user.displayAvatarURL();

      this.sessions.set(`${member.id}-${member.guild.id}`, session);

      await this.sendVerificationEmbed(member, channel, session);
      this.emitUpdate();

      // Timeout
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

    // ═══════════════════════════════════════════════════════════════
    // INTERACTIONS
    // ═══════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════
    // MESSAGES - ULTRA MODERATION
    // ═══════════════════════════════════════════════════════════════

    this.client.on('messageCreate', async (msg) => {
      if (msg.author.bot || !msg.guild) return;

      const settings = this.getSettings(msg.guild.id);
      this.stats.messagesScanned++;

      // Ticket channel handling
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

      // ═══════════════════════════════════════════════════════════════
      // ULTRA AI MODERATION
      // ═══════════════════════════════════════════════════════════════

      if (settings.modEnabled && !msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const result = await this.ai.moderateMessage(msg, msg.member, settings);
        
        if (result.shouldAct) {
          this.stats.aiDetections++;
          
          // Execute action
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

                // Auto-mute on max warnings
                if (settings.autoMute && profile && profile.warnings >= settings.maxWarnings) {
                  try {
                    await msg.member.timeout(settings.muteDuration * 60 * 1000, 'Max warnings reached');
                    this.stats.mutesDone++;
                    this.log(`Muted ${msg.author.tag} for ${settings.muteDuration}m`, 'moderation');
                    this.addEvent('Auto-Mute', `${msg.author.tag} muted (${settings.muteDuration}m)`, 'moderation');
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

      // ═══════════════════════════════════════════════════════════════
      // COMMANDS
      // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // VERIFICATION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════════════════

  async sendVerificationEmbed(member, channel, session) {
    const challenge = session.challenges[0];
    const analysis = session.analysis;

    const embed = new EmbedBuilder()
      .setColor(analysis.riskLevel === 'critical' ? '#ff0000' : analysis.riskLevel === 'high' ? '#ffaa00' : '#ffffff')
      .setAuthor({ name: '🛡️ Nova Verification', iconURL: this.client.user.displayAvatarURL() })
      .setThumbnail(session.avatar)
      .setDescription(`Welcome ${member}!\n\nComplete the challenge below to access the server.\n\n━━━━━━━━━━━━━━━━━━━━━━`)
      .addFields(
        { name: `📝 Challenge 1/${session.challenges.length}`, value: `\`\`\`${challenge.question}\`\`\``, inline: false },
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
          .addFields({ name: '📝 Next Challenge', value: `\`\`\`${next.question}\`\`\`` });

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
            { name: '📝 New Challenge', value: `\`\`\`${newChallenge.question}\`\`\`` },
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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // TICKET SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════════════════

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
        oderId: oderId,
        oderId: username,
        oderId: avatar,
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

      ticket.userId = user.id;
      ticket.userName = user.tag;
      ticket.userAvatar = user.displayAvatarURL();

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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // HELP & SETUP
  // ═══════════════════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════════════════

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
        oderId: s.memberId,
        oderId: s.username,
        oderId: s.avatar,
        oderId: s.analysis?.riskLevel,
        oderId: s.analysis?.riskScore,
        oderId: s.currentIndex,
        oderId: s.challenges?.length,
        oderId: s.attempts,
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

// API endpoints
app.get('/api/stats', (req, res) => res.json(bot.getStats()));
app.get('/api/tickets', (req, res) => res.json(bot.getAllTickets()));
app.get('/api/sessions', (req, res) => res.json(bot.getPendingSessions()));
app.get('/api/logs', (req, res) => res.json(bot.logs));
app.get('/api/events', (req, res) => res.json(bot.serverEvents));

app.get('/api/settings/:guildId', (req, res) => {
  res.json(bot.getSettings(req.params.guildId));
});

app.post('/api/settings/:guildId', (req, res) => {
  const settings = bot.getSettings(req.params.guildId);
  Object.assign(settings, req.body);
  res.json(settings);
});

// Dashboard HTML
app.get('/', (req, res) => {
  res.send(getDashboardHTML());
});

// Socket.IO
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

  socket.on('updateSettings', async (data) => {
    if (data.guildId) {
      const settings = bot.getSettings(data.guildId);
      Object.assign(settings, data.settings);
      socket.emit('settings', settings);
    }
  });

  socket.on('disconnect', () => clearInterval(interval));
});

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                           ULTRA BEAUTIFUL DASHBOARD                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

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
      --bg-0: #000000;
      --bg-1: #050505;
      --bg-2: #0a0a0a;
      --bg-3: #0f0f0f;
      --bg-4: #141414;
      --bg-5: #1a1a1a;
      --bg-6: #202020;
      --border-1: #1a1a1a;
      --border-2: #252525;
      --border-3: #303030;
      --text-0: #ffffff;
      --text-1: #e0e0e0;
      --text-2: #a0a0a0;
      --text-3: #666666;
      --accent: #ffffff;
      --success: #10b981;
      --warning: #f59e0b;
      --error: #ef4444;
      --info: #3b82f6;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-0);
      color: var(--text-0);
      line-height: 1.5;
    }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-3); }

    .app {
      display: flex;
      height: 100vh;
    }

    /* ═══════════════════════════════════════════════════════════════
       SIDEBAR
    ═══════════════════════════════════════════════════════════════ */

    .sidebar {
      width: 280px;
      background: var(--bg-1);
      border-right: 1px solid var(--border-1);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .logo {
      padding: 24px;
      border-bottom: 1px solid var(--border-1);
    }

    .logo-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, var(--bg-6), var(--bg-4));
      border: 1px solid var(--border-2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }

    .logo-text {
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    .logo-sub {
      font-size: 0.7rem;
      color: var(--text-3);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 2px;
    }

    .nav {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    }

    .nav-section {
      margin-bottom: 24px;
    }

    .nav-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      padding: 0 16px;
      margin-bottom: 8px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--text-2);
      font-size: 0.9rem;
      font-weight: 500;
      position: relative;
      border: 1px solid transparent;
    }

    .nav-item:hover {
      background: var(--bg-3);
      color: var(--text-1);
    }

    .nav-item.active {
      background: var(--text-0);
      color: var(--bg-0);
      font-weight: 600;
    }

    .nav-item .icon {
      font-size: 1.2rem;
      width: 24px;
      text-align: center;
    }

    .nav-item .badge {
      margin-left: auto;
      background: var(--bg-5);
      color: var(--text-2);
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .nav-item.active .badge {
      background: rgba(0,0,0,0.15);
      color: var(--bg-0);
    }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid var(--border-1);
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--bg-3);
      border-radius: 10px;
      font-size: 0.85rem;
      color: var(--text-2);
    }

    .status-dot {
      width: 10px;
      height: 10px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
      box-shadow: 0 0 10px var(--success);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.9); }
    }

    /* ═══════════════════════════════════════════════════════════════
       MAIN CONTENT
    ═══════════════════════════════════════════════════════════════ */

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-0);
    }

    .header {
      padding: 20px 32px;
      border-bottom: 1px solid var(--border-1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-1);
    }

    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .header-stats {
      display: flex;
      gap: 32px;
    }

    .header-stat {
      text-align: right;
    }

    .header-stat .value {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -1px;
    }

    .header-stat .label {
      font-size: 0.7rem;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }

    .content {
      flex: 1;
      overflow: hidden;
    }

    .tab-content {
      display: none;
      height: 100%;
      overflow: hidden;
    }

    .tab-content.active {
      display: flex;
    }

    /* ═══════════════════════════════════════════════════════════════
       DASHBOARD TAB
    ═══════════════════════════════════════════════════════════════ */

    .dashboard {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--bg-2);
      border: 1px solid var(--border-1);
      border-radius: 16px;
      padding: 24px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--border-2), transparent);
    }

    .stat-card:hover {
      border-color: var(--border-2);
      transform: translateY(-2px);
    }

    .stat-card .icon-wrap {
      width: 48px;
      height: 48px;
      background: var(--bg-4);
      border: 1px solid var(--border-2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      margin-bottom: 16px;
    }

    .stat-card .value {
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -1px;
      margin-bottom: 4px;
    }

    .stat-card .label {
      font-size: 0.8rem;
      color: var(--text-3);
      font-weight: 500;
    }

    .stat-card.success .value { color: var(--success); }
    .stat-card.warning .value { color: var(--warning); }
    .stat-card.error .value { color: var(--error); }
    .stat-card.info .value { color: var(--info); }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .card {
      background: var(--bg-2);
      border: 1px solid var(--border-1);
      border-radius: 16px;
      overflow: hidden;
    }

    .card-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-1);
      font-weight: 600;
      font-size: 0.95rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-3);
    }

    .card-body {
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }

    .event-item, .log-item {
      padding: 14px 16px;
      border-radius: 10px;
      margin-bottom: 8px;
      background: var(--bg-4);
      border-left: 3px solid var(--border-2);
      transition: all 0.2s;
    }

    .event-item:hover, .log-item:hover {
      background: var(--bg-5);
    }

    .event-item.success, .log-item.success { border-color: var(--success); }
    .event-item.warning, .log-item.warning { border-color: var(--warning); }
    .event-item.error, .log-item.error, 
    .event-item.moderation, .log-item.moderation { border-color: var(--error); }
    .event-item.info, .log-item.info { border-color: var(--info); }
    .event-item.ticket, .log-item.ticket { border-color: var(--text-0); }
    .event-item.join { border-color: var(--success); }
    .event-item.leave { border-color: var(--warning); }
    .event-item.response { border-color: var(--info); }

    .event-title {
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 4px;
    }

    .event-desc {
      font-size: 0.8rem;
      color: var(--text-2);
    }

    .event-time {
      font-size: 0.7rem;
      color: var(--text-3);
      margin-top: 6px;
      font-family: monospace;
    }

    /* ═══════════════════════════════════════════════════════════════
       TICKETS TAB
    ═══════════════════════════════════════════════════════════════ */

    .tickets-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .tickets-list {
      width: 360px;
      background: var(--bg-1);
      border-right: 1px solid var(--border-1);
      display: flex;
      flex-direction: column;
    }

    .tickets-header {
      padding: 24px;
      border-bottom: 1px solid var(--border-1);
    }

    .tickets-header h2 {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 16px;
    }

    .search-box {
      position: relative;
    }

    .search-box input {
      width: 100%;
      padding: 14px 18px 14px 44px;
      background: var(--bg-3);
      border: 1px solid var(--border-2);
      border-radius: 12px;
      color: var(--text-0);
      font-size: 0.9rem;
      font-family: inherit;
      transition: all 0.2s;
    }

    .search-box input:focus {
      outline: none;
      border-color: var(--text-0);
      background: var(--bg-4);
    }

    .search-box input::placeholder {
      color: var(--text-3);
    }

    .search-box::before {
      content: '🔍';
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1rem;
    }

    .tickets-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .ticket-card {
      background: var(--bg-3);
      border: 1px solid var(--border-1);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ticket-card:hover {
      border-color: var(--border-2);
      transform: translateX(4px);
    }

    .ticket-card.active {
      border-color: var(--text-0);
      background: var(--bg-4);
    }

    .ticket-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .ticket-id {
      font-weight: 700;
      font-size: 0.95rem;
    }

    .ticket-badge {
      font-size: 0.65rem;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--bg-5);
      color: var(--text-2);
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .ticket-user {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .ticket-avatar {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--bg-5);
      object-fit: cover;
    }

    .ticket-username {
      font-size: 0.85rem;
      color: var(--text-2);
      font-weight: 500;
    }

    .ticket-preview {
      font-size: 0.8rem;
      color: var(--text-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ticket-meta {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      font-size: 0.7rem;
      color: var(--text-3);
    }

    /* Chat Area */
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--bg-0);
    }

    .chat-header {
      padding: 20px 28px;
      border-bottom: 1px solid var(--border-1);
      background: var(--bg-1);
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
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: var(--bg-4);
      object-fit: cover;
      border: 2px solid var(--border-2);
    }

    .chat-header-text h3 {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .chat-header-text span {
      font-size: 0.8rem;
      color: var(--text-3);
    }

    .chat-actions {
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn:hover {
      transform: translateY(-2px);
    }

    .btn-primary {
      background: var(--text-0);
      color: var(--bg-0);
    }

    .btn-secondary {
      background: var(--bg-4);
      color: var(--text-0);
      border: 1px solid var(--border-2);
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
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .message {
      display: flex;
      gap: 14px;
      max-width: 75%;
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
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--bg-4);
      flex-shrink: 0;
      object-fit: cover;
    }

    .message-content {
      background: var(--bg-3);
      border: 1px solid var(--border-1);
      border-radius: 16px;
      padding: 16px 20px;
    }

    .message.staff .message-content {
      background: var(--bg-4);
      border-color: var(--border-2);
    }

    .message-author {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-2);
      margin-bottom: 6px;
    }

    .message-text {
      font-size: 0.9rem;
      line-height: 1.6;
      color: var(--text-1);
    }

    .message-time {
      font-size: 0.7rem;
      color: var(--text-3);
      margin-top: 8px;
      font-family: monospace;
    }

    .chat-input-area {
      padding: 24px 28px;
      border-top: 1px solid var(--border-1);
      background: var(--bg-1);
    }

    .ai-suggestion {
      background: var(--bg-3);
      border: 1px solid var(--border-2);
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 14px;
      display: none;
    }

    .ai-suggestion.show {
      display: block;
    }

    .ai-suggestion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .ai-suggestion-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .ai-suggestion-text {
      font-size: 0.9rem;
      color: var(--text-2);
      line-height: 1.5;
    }

    .chat-input-row {
      display: flex;
      gap: 14px;
    }

    .chat-input {
      flex: 1;
      padding: 16px 20px;
      background: var(--bg-3);
      border: 1px solid var(--border-2);
      border-radius: 14px;
      color: var(--text-0);
      font-size: 0.9rem;
      font-family: inherit;
      resize: none;
      min-height: 54px;
      max-height: 140px;
      transition: all 0.2s;
    }

    .chat-input:focus {
      outline: none;
      border-color: var(--text-0);
      background: var(--bg-4);
    }

    .chat-input::placeholder {
      color: var(--text-3);
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-3);
      padding: 40px;
    }

    .empty-state-icon {
      font-size: 5rem;
      margin-bottom: 20px;
      opacity: 0.2;
    }

    .empty-state h3 {
      font-size: 1.3rem;
      color: var(--text-2);
      margin-bottom: 8px;
      font-weight: 600;
    }

    .empty-state p {
      font-size: 0.9rem;
    }

    /* ═══════════════════════════════════════════════════════════════
       VERIFICATION TAB
    ═══════════════════════════════════════════════════════════════ */

    .verification-container {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .section-header h2 {
      font-size: 1.2rem;
      font-weight: 700;
    }

    .session-card {
      background: var(--bg-2);
      border: 1px solid var(--border-1);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    }

    .session-card:hover {
      border-color: var(--border-2);
    }

    .session-user {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .session-avatar {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: var(--bg-5);
      object-fit: cover;
      border: 2px solid var(--border-2);
    }

    .session-info h4 {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 4px;
    }

    .session-info span {
      font-size: 0.8rem;
      color: var(--text-3);
    }

    .session-meta {
      display: flex;
      gap: 24px;
      align-items: center;
    }

    .risk-badge {
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .risk-low { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
    .risk-medium { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    .risk-high { background: rgba(239, 68, 68, 0.15); color: var(--error); border: 1px solid rgba(239, 68, 68, 0.3); }
    .risk-critical { background: rgba(239, 68, 68, 0.25); color: var(--error); border: 1px solid rgba(239, 68, 68, 0.5); }

    /* ═══════════════════════════════════════════════════════════════
       SETTINGS TAB
    ═══════════════════════════════════════════════════════════════ */

    .settings-container {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
    }

    .settings-section {
      background: var(--bg-2);
      border: 1px solid var(--border-1);
      border-radius: 16px;
      margin-bottom: 24px;
      overflow: hidden;
    }

    .settings-section-header {
      padding: 20px 24px;
      background: var(--bg-3);
      border-bottom: 1px solid var(--border-1);
      font-weight: 600;
      font-size: 0.95rem;
    }

    .settings-section-body {
      padding: 8px;
    }

    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      border-radius: 10px;
      transition: background 0.2s;
    }

    .setting-row:hover {
      background: var(--bg-4);
    }

    .setting-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .setting-name {
      font-weight: 500;
      font-size: 0.9rem;
    }

    .setting-desc {
      font-size: 0.75rem;
      color: var(--text-3);
    }

    .toggle {
      position: relative;
      width: 52px;
      height: 28px;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-5);
      border: 1px solid var(--border-2);
      border-radius: 28px;
      transition: 0.3s;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background: var(--text-2);
      border-radius: 50%;
      transition: 0.3s;
    }

    .toggle input:checked + .toggle-slider {
      background: var(--text-0);
      border-color: var(--text-0);
    }

    .toggle input:checked + .toggle-slider:before {
      transform: translateX(24px);
      background: var(--bg-0);
    }

    .number-input {
      width: 80px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border-2);
      background: var(--bg-4);
      color: var(--text-0);
      text-align: center;
      font-size: 0.9rem;
      font-family: inherit;
      font-weight: 600;
    }

    .number-input:focus {
      outline: none;
      border-color: var(--text-0);
    }

    /* ═══════════════════════════════════════════════════════════════
       RESPONSIVE
    ═══════════════════════════════════════════════════════════════ */

    @media (max-width: 1400px) {
      .stats-grid { grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 1100px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .grid-2 { grid-template-columns: 1fr; }
    }

    @media (max-width: 900px) {
      .sidebar {
        width: 80px;
      }
      .logo-text, .logo-sub, .nav-label, 
      .nav-item span:not(.icon):not(.badge),
      .status-indicator span:not(.status-dot) {
        display: none;
      }
      .nav-item {
        justify-content: center;
        padding: 16px;
      }
      .nav-item .badge {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 2px 6px;
      }
      .logo {
        padding: 16px;
        display: flex;
        justify-content: center;
      }
      .logo-main {
        justify-content: center;
      }
      .logo-icon {
        width: 48px;
        height: 48px;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-main">
          <div class="logo-icon">🛡️</div>
          <div>
            <div class="logo-text">Nova AI</div>
            <div class="logo-sub">Ultra Dashboard</div>
          </div>
        </div>
      </div>

      <nav class="nav">
        <div class="nav-section">
          <div class="nav-label">Overview</div>
          <div class="nav-item active" onclick="showTab('dashboard')">
            <span class="icon">📊</span>
            <span>Dashboard</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-label">Modules</div>
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
          <div class="nav-item" onclick="showTab('moderation')">
            <span class="icon">⚔️</span>
            <span>Moderation</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-label">System</div>
          <div class="nav-item" onclick="showTab('events')">
            <span class="icon">📡</span>
            <span>Events</span>
          </div>
          <div class="nav-item" onclick="showTab('logs')">
            <span class="icon">📝</span>
            <span>Logs</span>
          </div>
          <div class="nav-item" onclick="showTab('settings')">
            <span class="icon">⚙️</span>
            <span>Settings</span>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="status-indicator">
          <div class="status-dot"></div>
          <span>System Online</span>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main">
      <header class="header">
        <h1 id="pageTitle">Dashboard</h1>
        <div class="header-stats">
          <div class="header-stat">
            <div class="value" id="headerPing">0<span style="font-size:0.7em">ms</span></div>
            <div class="label">Latency</div>
          </div>
          <div class="header-stat">
            <div class="value" id="headerUptime">0<span style="font-size:0.7em">h</span></div>
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
                <div class="icon-wrap">🌐</div>
                <div class="value" id="statServers">0</div>
                <div class="label">Servers</div>
              </div>
              <div class="stat-card">
                <div class="icon-wrap">👥</div>
                <div class="value" id="statUsers">0</div>
                <div class="label">Users</div>
              </div>
              <div class="stat-card success">
                <div class="icon-wrap">✅</div>
                <div class="value" id="statVerified">0</div>
                <div class="label">Verified</div>
              </div>
              <div class="stat-card error">
                <div class="icon-wrap">🗑️</div>
                <div class="value" id="statDeleted">0</div>
                <div class="label">Deleted</div>
              </div>
              <div class="stat-card warning">
                <div class="icon-wrap">⚠️</div>
                <div class="value" id="statWarnings">0</div>
                <div class="label">Warnings</div>
              </div>
            </div>

            <div class="grid-2">
              <div class="card">
                <div class="card-header">
                  <span>📡 Live Events</span>
                  <span style="font-size:0.75rem;color:var(--text-3)">Real-time</span>
                </div>
                <div class="card-body" id="eventsContainer"></div>
              </div>
              <div class="card">
                <div class="card-header">
                  <span>🎫 Active Tickets</span>
                  <span style="font-size:0.75rem;color:var(--text-3)" id="ticketCount">0 open</span>
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
                <h2>🎫 Support Tickets</h2>
                <div class="search-box">
                  <input type="text" placeholder="Search tickets..." id="ticketSearch" oninput="filterTickets()">
                </div>
              </div>
              <div class="tickets-scroll" id="ticketsList"></div>
            </div>

            <div class="chat-area" id="chatArea">
              <div class="empty-state" id="chatEmpty">
                <div class="empty-state-icon">💬</div>
                <h3>No Ticket Selected</h3>
                <p>Select a ticket to view the conversation</p>
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
                      <button class="btn btn-secondary" style="padding:8px 14px;font-size:0.75rem" onclick="useSuggestion()">Use This</button>
                    </div>
                    <div class="ai-suggestion-text" id="aiSuggestionText"></div>
                  </div>
                  <div class="chat-input-row">
                    <textarea class="chat-input" id="chatInput" placeholder="Type your response..." rows="1"></textarea>
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
            <div class="section-header">
              <h2>🛡️ Pending Verifications</h2>
            </div>
            <div id="sessionsList"></div>
          </div>
        </div>

        <!-- Moderation Tab -->
        <div class="tab-content" id="tab-moderation">
          <div class="dashboard">
            <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
              <div class="stat-card">
                <div class="icon-wrap">🔍</div>
                <div class="value" id="statScanned">0</div>
                <div class="label">Messages Scanned</div>
              </div>
              <div class="stat-card error">
                <div class="icon-wrap">🗑️</div>
                <div class="value" id="statModDeleted">0</div>
                <div class="label">Deleted</div>
              </div>
              <div class="stat-card warning">
                <div class="icon-wrap">⚠️</div>
                <div class="value" id="statModWarnings">0</div>
                <div class="label">Warnings</div>
              </div>
              <div class="stat-card info">
                <div class="icon-wrap">🧠</div>
                <div class="value" id="statAI">0</div>
                <div class="label">AI Detections</div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <span>⚔️ Recent Moderation Actions</span>
              </div>
              <div class="card-body" id="modActions" style="max-height:500px"></div>
            </div>
          </div>
        </div>

        <!-- Events Tab -->
        <div class="tab-content" id="tab-events">
          <div class="dashboard">
            <div class="section-header">
              <h2>📡 Server Events</h2>
            </div>
            <div class="card">
              <div class="card-body" id="allEvents" style="max-height:calc(100vh - 250px)"></div>
            </div>
          </div>
        </div>

        <!-- Logs Tab -->
        <div class="tab-content" id="tab-logs">
          <div class="dashboard">
            <div class="section-header">
              <h2>📝 System Logs</h2>
            </div>
            <div class="card">
              <div class="card-body" id="allLogs" style="max-height:calc(100vh - 250px)"></div>
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div class="tab-content" id="tab-settings">
          <div class="settings-container">
            <div class="section-header">
              <h2>⚙️ Bot Settings</h2>
            </div>

            <div class="settings-section">
              <div class="settings-section-header">🛡️ Moderation</div>
              <div class="settings-section-body">
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Enable Moderation</div>
                    <div class="setting-desc">Automatically moderate messages using AI</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="modEnabled" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Detect Toxicity</div>
                    <div class="setting-desc">Use AI to detect toxic and harmful content</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="detectToxicity" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Detect Spam</div>
                    <div class="setting-desc">Detect and remove spam messages</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="detectSpam" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Auto Delete</div>
                    <div class="setting-desc">Automatically delete flagged messages</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="autoDelete" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Auto Warn</div>
                    <div class="setting-desc">Automatically warn users for violations</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="autoWarn" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Auto Mute</div>
                    <div class="setting-desc">Mute users who reach max warnings</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="autoMute" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Max Warnings</div>
                    <div class="setting-desc">Warnings before auto-mute</div>
                  </div>
                  <input type="number" class="number-input" id="maxWarnings" value="3" min="1" max="10">
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Mute Duration</div>
                    <div class="setting-desc">Minutes to mute users</div>
                  </div>
                  <input type="number" class="number-input" id="muteDuration" value="10" min="1" max="1440">
                </div>
              </div>
            </div>

            <div class="settings-section">
              <div class="settings-section-header">✅ Verification</div>
              <div class="settings-section-body">
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Enable Verification</div>
                    <div class="setting-desc">Require new members to verify</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="verifyEnabled" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Kick on Fail</div>
                    <div class="setting-desc">Kick users who fail verification</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" id="kickOnFail" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-name">Max Attempts</div>
                    <div class="setting-desc">Attempts before failure</div>
                  </div>
                  <input type="number" class="number-input" id="maxAttempts" value="3" min="1" max="10">
                </div>
              </div>
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

      const titles = {
        dashboard: 'Dashboard',
        tickets: 'Support Tickets',
        verification: 'Verification',
        moderation: 'Moderation',
        events: 'Server Events',
        logs: 'System Logs',
        settings: 'Settings'
      };
      document.getElementById('pageTitle').textContent = titles[name] || name;
    }

    // Socket events
    socket.on('stats', (s) => {
      document.getElementById('statServers').textContent = s.guilds || 0;
      document.getElementById('statUsers').textContent = formatNumber(s.users || 0);
      document.getElementById('statVerified').textContent = s.verified || 0;
      document.getElementById('statDeleted').textContent = s.messagesDeleted || 0;
      document.getElementById('statWarnings').textContent = s.warningsGiven || 0;
      document.getElementById('statScanned').textContent = formatNumber(s.messagesScanned || 0);
      document.getElementById('statModDeleted').textContent = s.messagesDeleted || 0;
      document.getElementById('statModWarnings').textContent = s.warningsGiven || 0;
      document.getElementById('statAI').textContent = s.aiDetections || 0;
      document.getElementById('headerPing').innerHTML = (s.ping || 0) + '<span style="font-size:0.7em">ms</span>';
      document.getElementById('headerUptime').innerHTML = Math.floor((s.uptime || 0) / 3600000) + '<span style="font-size:0.7em">h</span>';
      document.getElementById('ticketBadge').textContent = s.openTickets || 0;
      document.getElementById('ticketCount').textContent = (s.openTickets || 0) + ' open';
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
      // Update ticket in list
      const ticket = tickets.find(t => t.id === data.ticketId);
      if (ticket) {
        ticket.messages = ticket.messages || [];
        ticket.messages.push(data.message);
        ticket.lastMessage = data.message;
        ticket.messageCount = ticket.messages.length;
      }
    });

    socket.on('sessions', (data) => {
      sessions = data || [];
      renderSessions();
    });

    socket.on('serverEvent', (event) => {
      events.unshift(event);
      if (events.length > 100) events.pop();
      renderEvents();
    });

    socket.on('events', (data) => {
      events = data || [];
      renderEvents();
    });

    socket.on('newLog', (log) => {
      logs.unshift(log);
      if (logs.length > 100) logs.pop();
      renderLogs();
      renderModActions();
    });

    socket.on('logs', (data) => {
      logs = data || [];
      renderLogs();
      renderModActions();
    });

    socket.on('aiSuggestion', (data) => {
      if (data.suggestion) {
        document.getElementById('aiSuggestionText').textContent = data.suggestion;
      } else {
        document.getElementById('aiSuggestionText').textContent = 'Could not generate a suggestion.';
      }
    });

    // Render functions
    function renderTickets() {
      const container = document.getElementById('ticketsList');
      const search = (document.getElementById('ticketSearch').value || '').toLowerCase();

      const filtered = tickets.filter(t =>
        t.id.toLowerCase().includes(search) ||
        (t.userName || '').toLowerCase().includes(search)
      );

      if (!filtered.length) {
        container.innerHTML = '<div class="empty-state" style="padding:60px"><div class="empty-state-icon">📭</div><h3>No Tickets</h3><p>All caught up!</p></div>';
        return;
      }

      container.innerHTML = filtered.map(t => \`
        <div class="ticket-card \${currentTicket?.id === t.id ? 'active' : ''}" onclick="selectTicket('\${t.id}')">
          <div class="ticket-top">
            <span class="ticket-id">\${t.id}</span>
            <span class="ticket-badge">\${t.category || 'general'}</span>
          </div>
          <div class="ticket-user">
            <img class="ticket-avatar" src="\${t.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <span class="ticket-username">\${t.userName || 'Unknown'}</span>
          </div>
          <div class="ticket-preview">\${t.lastMessage?.content || t.reason || 'No messages'}</div>
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
        container.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">✨</div><p>No active tickets</p></div>';
        return;
      }
      container.innerHTML = tickets.slice(0, 5).map(t => \`
        <div class="event-item ticket" onclick="showTab('tickets');setTimeout(()=>selectTicket('\${t.id}'),100)" style="cursor:pointer">
          <div class="event-title">\${t.id}</div>
          <div class="event-desc">\${t.userName}: \${(t.reason || '').substring(0, 60)}...</div>
          <div class="event-time">\${timeAgo(t.createdAt)}</div>
        </div>
      \`).join('');
    }

    function selectTicket(ticketId) {
      currentTicket = tickets.find(t => t.id === ticketId);
      if (!currentTicket) return;

      document.getElementById('chatEmpty').style.display = 'none';
      document.getElementById('chatView').style.display = 'flex';

      document.getElementById('chatAvatar').src = currentTicket.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
      document.getElementById('chatTitle').textContent = currentTicket.id;
      document.getElementById('chatSubtitle').textContent = \`\${currentTicket.userName || 'Unknown'} • \${currentTicket.category || 'general'}\`;

      renderMessages();
      renderTickets();
      document.getElementById('aiSuggestion').classList.remove('show');
    }

    function renderMessages() {
      if (!currentTicket) return;

      const container = document.getElementById('chatMessages');
      const messages = currentTicket.messages || [];

      if (!messages.length) {
        container.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
        return;
      }

      container.innerHTML = messages.map(m => \`
        <div class="message \${m.isStaff ? 'staff' : ''}">
          <img class="message-avatar" src="\${m.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          <div class="message-content">
            <div class="message-author">\${m.author || 'Unknown'}</div>
            <div class="message-text">\${escapeHtml(m.content || '')}</div>
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
          <div class="message-author">\${message.author || 'Unknown'}</div>
          <div class="message-text">\${escapeHtml(message.content || '')}</div>
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
        staffName: 'Dashboard Admin'
      });

      input.value = '';
      input.style.height = 'auto';
      document.getElementById('aiSuggestion').classList.remove('show');
    }

    function getAISuggestion() {
      if (!currentTicket) return;
      document.getElementById('aiSuggestionText').textContent = 'Thinking...';
      document.getElementById('aiSuggestion').classList.add('show');
      socket.emit('getAISuggestion', { ticketId: currentTicket.id });
    }

    function useSuggestion() {
      const suggestion = document.getElementById('aiSuggestionText').textContent;
      if (suggestion && suggestion !== 'Thinking...' && !suggestion.includes('Could not')) {
        document.getElementById('chatInput').value = suggestion;
        document.getElementById('aiSuggestion').classList.remove('show');
      }
    }

    function closeCurrentTicket() {
      if (!currentTicket) return;
      if (confirm('Close this ticket? This action cannot be undone.')) {
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
        container.innerHTML = '<div class="empty-state" style="padding:80px"><div class="empty-state-icon">✅</div><h3>All Clear</h3><p>No pending verifications</p></div>';
        return;
      }

      container.innerHTML = sessions.map(s => \`
        <div class="session-card">
          <div class="session-user">
            <img class="session-avatar" src="\${s.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="">
            <div class="session-info">
              <h4>\${s.username || 'Unknown'}</h4>
              <span>Progress: \${s.currentIndex || 0}/\${s.totalChallenges || 1} • Attempts: \${s.attempts || 0}</span>
            </div>
          </div>
          <div class="session-meta">
            <span class="risk-badge risk-\${s.riskLevel || 'low'}">\${(s.riskLevel || 'low').toUpperCase()} (\${s.score || 0})</span>
            <span style="color:var(--text-3);font-size:0.8rem">\${timeAgo(s.startedAt)}</span>
          </div>
        </div>
      \`).join('');
    }

    function renderEvents() {
      const containers = [document.getElementById('eventsContainer'), document.getElementById('allEvents')];

      containers.forEach((container, idx) => {
        if (!container) return;
        const limit = idx === 0 ? 10 : 100;

        if (!events.length) {
          container.innerHTML = '<div class="empty-state" style="padding:40px"><p>No events yet</p></div>';
          return;
        }

        container.innerHTML = events.slice(0, limit).map(e => \`
          <div class="event-item \${e.type || 'info'}">
            <div class="event-title">\${e.title || 'Event'}</div>
            <div class="event-desc">\${e.description || ''}</div>
            <div class="event-time">\${formatTime(e.timestamp)}</div>
          </div>
        \`).join('');
      });
    }

    function renderLogs() {
      const container = document.getElementById('allLogs');
      if (!container) return;

      if (!logs.length) {
        container.innerHTML = '<div class="empty-state" style="padding:40px"><p>No logs yet</p></div>';
        return;
      }

      container.innerHTML = logs.slice(0, 100).map(l => \`
        <div class="log-item \${l.type || 'info'}">
          <strong>\${formatTime(l.timestamp)}</strong> \${l.message || ''}
        </div>
      \`).join('');
    }

    function renderModActions() {
      const container = document.getElementById('modActions');
      if (!container) return;

      const modLogs = logs.filter(l => l.type === 'moderation' || l.type === 'warning');

      if (!modLogs.length) {
        container.innerHTML = '<div class="empty-state" style="padding:40px"><p>No moderation actions yet</p></div>';
        return;
      }

      container.innerHTML = modLogs.slice(0, 50).map(l => \`
        <div class="log-item moderation">
          <strong>\${formatTime(l.timestamp)}</strong> \${l.message || ''}
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
      if (!timestamp) return '';
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function timeAgo(timestamp) {
      if (!timestamp) return '';
      const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
      if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
      return Math.floor(seconds / 86400) + 'd ago';
    }

    function formatNumber(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    }

    // Input handlers
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.getElementById('chatInput').addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 140) + 'px';
    });

    // Initial render
    renderEvents();
    renderLogs();
    renderModActions();
  </script>
</body>
</html>`;
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                                    START SERVER                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║   🛡️  NOVA ULTRA AI - Advanced Discord Protection System    ║');
  console.log('║                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║   🌐 Dashboard:     http://localhost:${PORT}                    ║`);
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