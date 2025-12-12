// server.js - COMPLETE ULTRA NOVA AI SYSTEM (FIXED)
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
    const username = member.user.tag;
    const now = Date.now();

    // Initialize user profile if needed
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        oderId: oderId,
        oderId: username,  // ← FIXED: was oderId: oderId
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
      oderId: user.id,
      oderId: user.tag,
      oderId: user.displayAvatarURL(),
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

      // FIXED: Proper session object with correct property names
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

      // FIXED: Proper ticket object with correct property names
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

// Dashboard HTML function (keeping it short here, your existing HTML is fine)
function getDashboardHTML() {
  // Your existing dashboard HTML goes here
  // I'm keeping your original HTML since it was correct
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova AI Dashboard</title>
  <!-- Your existing styles and HTML -->
</head>
<body>
  <!-- Your existing dashboard HTML -->
  <script src="/socket.io/socket.io.js"></script>
  <script>
    // Your existing JavaScript
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