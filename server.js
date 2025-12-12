// server.js - NOVA ULTRA AI WITH ADVANCED THINKING SYSTEM
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
// ║         Multi-Stage Reasoning System with Deep Contextual Understanding               ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class NovaThinkingEngine {
  constructor() {
    this.groqKey = process.env.GROQ_API_KEY;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MEMORY SYSTEMS
    // ═══════════════════════════════════════════════════════════════════════════
    this.userMemory = new Map();           // Long-term user behavior memory
    this.conversationContext = new Map();   // Recent conversation context per channel
    this.serverPatterns = new Map();        // Server-specific behavior patterns
    this.moderationDecisions = new Map();   // History of moderation decisions
    this.thinkingLogs = [];                 // Logs of AI thinking process
    this.learningData = new Map();          // Learning from past decisions
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ADVANCED PATTERN DETECTION
    // ═══════════════════════════════════════════════════════════════════════════
    this.patterns = {
      // Critical - Immediate action
      slurs: {
        pattern: /\b(nigger|nigga|faggot|retard|spic|chink|kike|tranny)\b/gi,
        severity: 'critical',
        action: 'ban',
        confidence: 100
      },
      directThreats: {
        pattern: /\b(i will|i'm gonna|going to|ima)\s*(kill|murder|shoot|stab|hurt|attack|find)\s*(you|your|ur)/gi,
        severity: 'critical',
        action: 'ban',
        confidence: 95
      },
      doxxing: {
        pattern: /\b(dox|doxx|leak|expose)\s*(you|your|their|his|her)\s*(address|ip|location|info)/gi,
        severity: 'critical',
        action: 'ban',
        confidence: 95
      },
      
      // High - Requires thinking
      toxicity: {
        pattern: /\b(fuck\s*(you|off|ing)|shit|bitch|asshole|dickhead|cunt|bastard|stfu|kys)\b/gi,
        severity: 'high',
        action: 'think',
        confidence: 70
      },
      harassment: {
        pattern: /\b(ugly|fat|stupid|dumb|idiot|loser|pathetic|worthless|nobody\s*likes\s*you)\b/gi,
        severity: 'high',
        action: 'think',
        confidence: 60
      },
      
      // Medium - Context dependent
      scam: {
        pattern: /(free\s*nitro|gift\s*card|click\s*(here|this)|claim\s*now|limited\s*time|steam\s*gift)/gi,
        severity: 'medium',
        action: 'think',
        confidence: 75
      },
      invites: {
        pattern: /(discord\.gg\/\w+|discordapp\.com\/invite\/\w+)/gi,
        severity: 'medium',
        action: 'think',
        confidence: 50
      },
      
      // Low - Monitor only
      spam: {
        pattern: /(.)\1{6,}|(\b\w+\b)(\s+\2){4,}/gi,
        severity: 'low',
        action: 'monitor',
        confidence: 40
      },
      caps: {
        pattern: /^[A-Z\s!?]{20,}$/,
        severity: 'low',
        action: 'monitor',
        confidence: 30
      },
      zalgo: {
        pattern: /[\u0300-\u036f\u0489]{3,}/g,
        severity: 'low',
        action: 'monitor',
        confidence: 35
      },
      massEmoji: {
        pattern: /([\u{1F300}-\u{1F9FF}][\s]*){10,}/gu,
        severity: 'low',
        action: 'monitor',
        confidence: 25
      }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTEXT UNDERSTANDING
    // ═══════════════════════════════════════════════════════════════════════════
    this.contextIndicators = {
      joking: ['lol', 'lmao', 'jk', 'joking', 'kidding', '😂', '🤣', 'haha', 'xd', 'bruh'],
      sarcasm: ['obviously', 'totally', 'sure thing', 'yeah right', 'of course', '/s'],
      quoting: ['he said', 'she said', 'they said', 'someone said', 'quote', '"', '"'],
      gaming: ['gg', 'ez', 'rekt', 'noob', 'clutch', 'poggers', 'based', 'ratio'],
      friendly: ['bro', 'dude', 'man', 'homie', 'fam', 'bestie', 'love you'],
      heated: ['angry', 'pissed', 'mad', 'furious', 'hate', 'sick of', 'fed up']
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // SENTIMENT ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    this.sentimentWeights = {
      veryPositive: { words: ['love', 'amazing', 'awesome', 'fantastic', 'wonderful', 'perfect', 'excellent', 'beautiful', 'best', 'incredible'], weight: 2 },
      positive: { words: ['good', 'great', 'nice', 'cool', 'thanks', 'appreciate', 'helpful', 'happy', 'glad', 'fun'], weight: 1 },
      neutral: { words: ['okay', 'fine', 'alright', 'sure', 'maybe', 'perhaps', 'idk', 'whatever'], weight: 0 },
      negative: { words: ['bad', 'hate', 'annoying', 'boring', 'stupid', 'dumb', 'ugly', 'terrible', 'awful', 'worst'], weight: -1 },
      veryNegative: { words: ['fuck', 'shit', 'damn', 'hell', 'crap', 'sucks', 'trash', 'garbage', 'disgusting', 'pathetic'], weight: -2 }
    };

    console.log(this.groqKey ? '🧠 Nova Thinking Engine Online [ADVANCED AI MODE]' : '🧠 Nova Thinking Engine Online [PATTERN MODE]');
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                         CORE THINKING PROCESS                                         ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

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
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.3
        })
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error('Thinking Error:', e.message);
      return null;
    }
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                    ULTRA ADVANCED MODERATION PIPELINE                                 ║
  // ║     Stage 1: Observe → Stage 2: Analyze → Stage 3: Think → Stage 4: Decide           ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

  async moderateMessage(message, member, guildSettings) {
    const startTime = Date.now();
    const content = message.content;
    const userId = member.id;
    const guildId = message.guild.id;
    const channelId = message.channel.id;

    // Initialize thinking log for this message
    const thinkingProcess = {
      messageId: message.id,
      content: content.substring(0, 100),
      userId,
      username: member.user.tag,
      timestamp: new Date().toISOString(),
      stages: [],
      finalDecision: null,
      processingTime: 0
    };

    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 1: OBSERVATION - Gather all available data
      // ═══════════════════════════════════════════════════════════════════════════
      
      thinkingProcess.stages.push({ stage: 'OBSERVE', status: 'starting' });
      
      const observation = await this.observe(message, member, guildId, channelId);
      
      thinkingProcess.stages[0] = {
        stage: 'OBSERVE',
        status: 'complete',
        data: {
          userTrust: observation.userProfile.trustScore,
          userWarnings: observation.userProfile.warnings,
          recentMessages: observation.recentMessages.length,
          channelContext: observation.channelContext.topic || 'general',
          serverRisk: observation.serverContext.riskLevel
        }
      };

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 2: ANALYSIS - Pattern matching and initial assessment
      // ═══════════════════════════════════════════════════════════════════════════
      
      thinkingProcess.stages.push({ stage: 'ANALYZE', status: 'starting' });
      
      const analysis = this.analyze(content, observation);
      
      thinkingProcess.stages[1] = {
        stage: 'ANALYZE',
        status: 'complete',
        data: {
          patternsFound: analysis.patterns.map(p => p.type),
          severity: analysis.severity,
          sentiment: analysis.sentiment,
          contextClues: analysis.contextClues,
          initialScore: analysis.score
        }
      };

      // If critical violation with high confidence, skip to decision
      if (analysis.severity === 'critical' && analysis.confidence >= 95) {
        thinkingProcess.stages.push({
          stage: 'THINK',
          status: 'skipped',
          reason: 'Critical violation with high confidence - immediate action required'
        });
        
        const decision = this.createImmediateDecision(analysis, observation);
        thinkingProcess.finalDecision = decision;
        thinkingProcess.processingTime = Date.now() - startTime;
        this.thinkingLogs.unshift(thinkingProcess);
        if (this.thinkingLogs.length > 100) this.thinkingLogs.pop();
        
        return decision;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 3: THINKING - Deep AI reasoning (if needed)
      // ═══════════════════════════════════════════════════════════════════════════
      
      thinkingProcess.stages.push({ stage: 'THINK', status: 'starting' });
      
      let thinking = null;
      const needsDeepThinking = 
        analysis.severity !== 'none' || 
        analysis.score > 15 || 
        analysis.contextClues.includes('ambiguous') ||
        content.length > 100;

      if (needsDeepThinking && this.groqKey) {
        thinking = await this.deepThink(content, observation, analysis);
        
        thinkingProcess.stages[2] = {
          stage: 'THINK',
          status: 'complete',
          data: {
            harmfulProbability: thinking?.harmfulProbability || 0,
            intent: thinking?.intent || 'unknown',
            reasoning: thinking?.reasoning?.substring(0, 200) || 'No reasoning',
            confidence: thinking?.confidence || 0,
            recommendation: thinking?.recommendation || 'none'
          }
        };
      } else {
        thinkingProcess.stages[2] = {
          stage: 'THINK',
          status: 'skipped',
          reason: 'Low risk - pattern analysis sufficient'
        };
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 4: DECISION - Synthesize all information
      // ═══════════════════════════════════════════════════════════════════════════
      
      thinkingProcess.stages.push({ stage: 'DECIDE', status: 'starting' });
      
      const decision = this.decide(observation, analysis, thinking, guildSettings);
      
      thinkingProcess.stages[3] = {
        stage: 'DECIDE',
        status: 'complete',
        data: {
          action: decision.action,
          reason: decision.reason,
          confidence: decision.confidence,
          shouldAct: decision.shouldAct
        }
      };

      thinkingProcess.finalDecision = decision;
      thinkingProcess.processingTime = Date.now() - startTime;

      // Update user profile based on decision
      this.updateUserMemory(userId, decision, observation);

      // Store thinking log
      this.thinkingLogs.unshift(thinkingProcess);
      if (this.thinkingLogs.length > 100) this.thinkingLogs.pop();

      // Learn from this decision
      this.learn(thinkingProcess);

      return decision;

    } catch (error) {
      console.error('Moderation pipeline error:', error);
      thinkingProcess.stages.push({ stage: 'ERROR', error: error.message });
      thinkingProcess.processingTime = Date.now() - startTime;
      this.thinkingLogs.unshift(thinkingProcess);
      
      return { shouldAct: false, action: 'none', reason: 'Processing error', confidence: 0 };
    }
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                         STAGE 1: OBSERVATION                                          ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

  async observe(message, member, guildId, channelId) {
    const userId = member.id;
    const now = Date.now();

    // Get or create user profile
    if (!this.userMemory.has(userId)) {
      this.userMemory.set(userId, {
        oderId: oderId,
        username: member.user.tag,
        avatar: member.user.displayAvatarURL(),
        accountAge: now - member.user.createdTimestamp,
        joinedAt: member.joinedTimestamp,
        messages: [],
        warnings: 0,
        trustScore: 50,
        reputation: 'neutral',
        firstSeen: now,
        lastSeen: now,
        violations: [],
        positiveActions: 0,
        messagesAnalyzed: 0,
        averageSentiment: 0,
        behaviorPatterns: [],
        moderationHistory: []
      });
    }

    const userProfile = this.userMemory.get(userId);
    userProfile.lastSeen = now;
    userProfile.messagesAnalyzed++;

    // Store message in history
    userProfile.messages.push({
      content: message.content.substring(0, 300),
      timestamp: now,
      channelId,
      guildId
    });

    // Keep only last 100 messages per user
    if (userProfile.messages.length > 100) userProfile.messages.shift();

    // Get channel context
    if (!this.conversationContext.has(channelId)) {
      this.conversationContext.set(channelId, {
        messages: [],
        topic: null,
        mood: 'neutral',
        activeUsers: new Set()
      });
    }

    const channelContext = this.conversationContext.get(channelId);
    channelContext.messages.push({
      userId,
      username: member.user.tag,
      content: message.content.substring(0, 200),
      timestamp: now
    });
    channelContext.activeUsers.add(userId);

    // Keep only last 50 messages per channel
    if (channelContext.messages.length > 50) channelContext.messages.shift();

    // Get server context
    if (!this.serverPatterns.has(guildId)) {
      this.serverPatterns.set(guildId, {
        totalMessages: 0,
        violations: 0,
        riskLevel: 'low',
        commonPatterns: [],
        trustedUsers: new Set(),
        flaggedUsers: new Set()
      });
    }

    const serverContext = this.serverPatterns.get(guildId);
    serverContext.totalMessages++;

    // Get recent messages for context
    const recentMessages = userProfile.messages.filter(m => m.timestamp > now - 300000); // Last 5 mins

    // Get conversation flow
    const conversationFlow = channelContext.messages.slice(-10);

    return {
      userProfile,
      channelContext,
      serverContext,
      recentMessages,
      conversationFlow,
      memberInfo: {
        isAdmin: member.permissions.has(PermissionFlagsBits.Administrator),
        isMod: member.permissions.has(PermissionFlagsBits.ManageMessages),
        roles: member.roles.cache.map(r => r.name),
        joinedDaysAgo: Math.floor((now - member.joinedTimestamp) / 86400000)
      }
    };
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                         STAGE 2: ANALYSIS                                             ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

  analyze(content, observation) {
    const lower = content.toLowerCase();
    let score = 0;
    const patterns = [];
    const contextClues = [];

    // ═══════════════════════════════════════════════════════════════════════════
    // Pattern Detection
    // ═══════════════════════════════════════════════════════════════════════════
    
    for (const [type, data] of Object.entries(this.patterns)) {
      const matches = content.match(data.pattern);
      if (matches) {
        patterns.push({
          type,
          matches: matches.length,
          severity: data.severity,
          action: data.action,
          confidence: data.confidence,
          examples: matches.slice(0, 3)
        });
        
        // Add to score based on severity
        const severityScores = { critical: 100, high: 60, medium: 35, low: 15 };
        score += severityScores[data.severity] * matches.length;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Context Detection
    // ═══════════════════════════════════════════════════════════════════════════
    
    for (const [context, indicators] of Object.entries(this.contextIndicators)) {
      const found = indicators.filter(ind => lower.includes(ind.toLowerCase()));
      if (found.length > 0) {
        contextClues.push(context);
      }
    }

    // Check if replying to someone (less likely to be random attack)
    if (content.includes('@') || observation.conversationFlow.length > 3) {
      contextClues.push('in_conversation');
    }

    // Check message length context
    if (content.length < 20) contextClues.push('short_message');
    if (content.length > 500) contextClues.push('long_message');

    // Check if user is active in this channel
    if (observation.channelContext.activeUsers.size > 5) {
      contextClues.push('active_channel');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Sentiment Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    
    let sentimentScore = 0;
    const words = lower.split(/\s+/);
    
    for (const [level, data] of Object.entries(this.sentimentWeights)) {
      const found = words.filter(w => data.words.includes(w));
      sentimentScore += found.length * data.weight;
    }

    const sentiment = sentimentScore > 2 ? 'positive' : 
                      sentimentScore < -2 ? 'negative' : 
                      sentimentScore < -5 ? 'very_negative' : 'neutral';

    // ═══════════════════════════════════════════════════════════════════════════
    // Trust Adjustment
    // ═══════════════════════════════════════════════════════════════════════════
    
    const trustAdjustment = (observation.userProfile.trustScore - 50) / 100;
    score = Math.round(score * (1 - trustAdjustment * 0.3));

    // If user is trusted and context suggests joking, reduce score
    if (observation.userProfile.trustScore > 70 && 
        (contextClues.includes('joking') || contextClues.includes('gaming'))) {
      score = Math.round(score * 0.5);
      contextClues.push('trusted_context');
    }

    // If user has warnings, increase score
    if (observation.userProfile.warnings > 0) {
      score = Math.round(score * (1 + observation.userProfile.warnings * 0.2));
      contextClues.push('has_warnings');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Determine Severity
    // ═══════════════════════════════════════════════════════════════════════════
    
    let severity, confidence;
    
    if (patterns.some(p => p.severity === 'critical')) {
      severity = 'critical';
      confidence = Math.max(...patterns.filter(p => p.severity === 'critical').map(p => p.confidence));
    } else if (score >= 60 || patterns.some(p => p.severity === 'high')) {
      severity = 'high';
      confidence = Math.min(85, 50 + score / 2);
    } else if (score >= 30 || patterns.some(p => p.severity === 'medium')) {
      severity = 'medium';
      confidence = Math.min(70, 40 + score / 2);
    } else if (score >= 15) {
      severity = 'low';
      confidence = Math.min(50, 30 + score / 2);
    } else {
      severity = 'none';
      confidence = 100 - score;
    }

    // Add ambiguous flag if conflicting signals
    if ((contextClues.includes('joking') || contextClues.includes('friendly')) && 
        severity !== 'none') {
      contextClues.push('ambiguous');
      confidence -= 20;
    }

    return {
      score,
      patterns,
      contextClues,
      sentiment,
      severity,
      confidence: Math.max(0, Math.min(100, confidence))
    };
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                         STAGE 3: DEEP THINKING                                        ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

  async deepThink(content, observation, analysis) {
    const recentConvo = observation.conversationFlow
      .slice(-5)
      .map(m => `${m.username}: ${m.content}`)
      .join('\n');

    const userHistory = observation.userProfile.violations.slice(-3)
      .map(v => `${v.type} (${v.severity})`)
      .join(', ') || 'None';

    const prompt = `You are an expert Discord moderator AI. Analyze this message in its full context.

═══════════════════════════════════════════════════════════════════════════════
MESSAGE TO ANALYZE:
"${content}"
═══════════════════════════════════════════════════════════════════════════════

USER PROFILE:
• Username: ${observation.userProfile.username}
• Trust Score: ${observation.userProfile.trustScore}/100
• Warnings: ${observation.userProfile.warnings}
• Account Age: ${Math.floor(observation.userProfile.accountAge / 86400000)} days
• Time in Server: ${observation.memberInfo.joinedDaysAgo} days
• Past Violations: ${userHistory}
• Average Sentiment: ${observation.userProfile.averageSentiment > 0 ? 'positive' : observation.userProfile.averageSentiment < 0 ? 'negative' : 'neutral'}

RECENT CONVERSATION:
${recentConvo || 'No recent messages'}

PATTERN ANALYSIS:
• Patterns Found: ${analysis.patterns.map(p => `${p.type}(${p.severity})`).join(', ') || 'None'}
• Context Clues: ${analysis.contextClues.join(', ') || 'None'}
• Sentiment: ${analysis.sentiment}
• Initial Score: ${analysis.score}/100

═══════════════════════════════════════════════════════════════════════════════
THINKING REQUIREMENTS:

1. INTENT ANALYSIS: Is this genuinely malicious, careless, sarcastic, joking, or friendly banter?

2. CONTEXT CONSIDERATION:
   - Is this part of a heated argument or normal conversation?
   - Are they quoting someone else?
   - Is this common gaming/internet slang?
   - Would a reasonable person be offended?

3. PROPORTIONALITY: Would taking action be fair given:
   - User's history and trust level
   - The actual impact of this message
   - Whether it's a pattern or isolated incident

4. FALSE POSITIVE CHECK: Could this be:
   - A joke between friends
   - Song lyrics or quotes
   - Gaming trash talk
   - Cultural/generational language differences

═══════════════════════════════════════════════════════════════════════════════

Respond in this EXACT JSON format:
{
  "harmfulProbability": 0-100,
  "intent": "malicious|careless|sarcastic|joking|friendly|unclear",
  "targetedAt": "person|group|self|nobody",
  "contextualMeaning": "what the message actually means in context",
  "reasoning": "detailed step-by-step reasoning process",
  "mitigatingFactors": ["list of reasons to be lenient"],
  "aggravatingFactors": ["list of reasons to be strict"],
  "recommendation": "none|monitor|warn|delete|mute|ban",
  "confidence": 0-100,
  "suggestedResponse": "what to tell the user if warning",
  "alternativeInterpretation": "could this message be innocent?"
}`;

    const response = await this.think(prompt, `You are Nova, an advanced AI moderator with deep understanding of internet culture, memes, sarcasm, and context. You protect communities while respecting free expression. You think carefully before acting because false positives destroy trust. You understand that teenagers talk differently than adults, gamers have their own language, and friends often insult each other playfully. Your job is to catch REAL problems, not punish normal human interaction. Always consider the full context. When in doubt, err on the side of not taking action. Output valid JSON only.`, { temperature: 0.2, maxTokens: 800 });

    if (response) {
      try {
        let cleaned = response.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/```json?|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return parsed;
      } catch (e) {
        console.error('Failed to parse AI response:', e.message);
        return null;
      }
    }

    return null;
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                         STAGE 4: DECISION                                             ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

  decide(observation, analysis, thinking, guildSettings) {
    let action = 'none';
    let reason = '';
    let severity = 'none';
    let confidence = 0;
    let shouldAct = false;

    // ═══════════════════════════════════════════════════════════════════════════
    // Decision Matrix
    // ═══════════════════════════════════════════════════════════════════════════

    // CRITICAL: Slurs, direct threats, doxxing - AI confirms or pattern is certain
    if (analysis.severity === 'critical') {
      if (thinking?.harmfulProbability >= 80 || analysis.confidence >= 90) {
        action = 'ban';
        reason = analysis.patterns.map(p => p.type).join(', ');
        severity = 'critical';
        confidence = Math.max(analysis.confidence, thinking?.confidence || 0);
        shouldAct = true;
      } else if (thinking?.harmfulProbability >= 50) {
        action = 'delete_warn';
        reason = thinking?.reasoning?.substring(0, 100) || 'Potential violation';
        severity = 'high';
        confidence = thinking?.confidence || 70;
        shouldAct = true;
      }
    }
    
    // HIGH: Toxicity, harassment - need AI confirmation
    else if (analysis.severity === 'high') {
      if (thinking) {
        if (thinking.harmfulProbability >= 70 && thinking.intent === 'malicious') {
          action = thinking.recommendation || 'delete_warn';
          reason = thinking.reasoning?.substring(0, 100) || analysis.patterns.map(p => p.type).join(', ');
          severity = 'high';
          confidence = thinking.confidence;
          shouldAct = true;
        } else if (thinking.harmfulProbability >= 50 && thinking.intent !== 'joking') {
          action = 'warn';
          reason = thinking.suggestedResponse || 'Please be respectful';
          severity = 'medium';
          confidence = thinking.confidence;
          shouldAct = true;
        } else {
          // AI says it's probably okay
          action = 'monitor';
          reason = thinking.alternativeInterpretation || 'Flagged but not harmful';
          severity = 'low';
          confidence = thinking.confidence;
          shouldAct = false;
        }
      } else {
        // No AI, use pattern analysis with caution
        action = 'warn';
        reason = analysis.patterns.map(p => p.type).join(', ');
        severity = 'medium';
        confidence = analysis.confidence * 0.7; // Reduce confidence without AI
        shouldAct = confidence >= 50;
      }
    }
    
    // MEDIUM: Scams, invites - context matters
    else if (analysis.severity === 'medium') {
      if (thinking?.harmfulProbability >= 60) {
        action = thinking.recommendation || 'delete';
        reason = thinking.reasoning?.substring(0, 100) || 'Suspicious content';
        severity = 'medium';
        confidence = thinking.confidence;
        shouldAct = true;
      } else if (analysis.patterns.some(p => p.type === 'scam') && analysis.confidence >= 70) {
        action = 'delete_warn';
        reason = 'Potential scam/phishing';
        severity = 'medium';
        confidence = 75;
        shouldAct = true;
      } else {
        action = 'monitor';
        reason = 'Low risk';
        shouldAct = false;
      }
    }
    
    // LOW: Spam, caps - usually just monitor
    else if (analysis.severity === 'low') {
      // Only act if it's repetitive behavior
      const recentViolations = observation.userProfile.violations.filter(
        v => v.timestamp > Date.now() - 600000 // Last 10 mins
      );
      
      if (recentViolations.length >= 2) {
        action = 'warn';
        reason = 'Repeated minor violations';
        severity = 'low';
        confidence = 60;
        shouldAct = true;
      } else {
        action = 'monitor';
        shouldAct = false;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Trust-based Adjustments
    // ═══════════════════════════════════════════════════════════════════════════

    // Trusted users get benefit of doubt
    if (observation.userProfile.trustScore >= 80 && severity !== 'critical') {
      confidence -= 15;
      if (confidence < 50 && action !== 'none') {
        action = 'monitor';
        shouldAct = false;
      }
    }

    // Untrusted users with violations get stricter treatment
    if (observation.userProfile.trustScore < 30 && 
        observation.userProfile.violations.length >= 2 &&
        shouldAct) {
      if (action === 'warn') action = 'delete_warn';
      if (action === 'delete_warn') action = 'mute';
      confidence += 10;
    }

    // New users get a bit more scrutiny
    if (observation.memberInfo.joinedDaysAgo < 7 && shouldAct) {
      confidence += 5;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Final Confidence Check
    // ═══════════════════════════════════════════════════════════════════════════

    if (shouldAct && confidence < 50) {
      // Not confident enough to act
      shouldAct = false;
      action = 'monitor';
    }

    const suggestedResponses = {
      critical: '🚫 Your message severely violated our community guidelines. This behavior is not tolerated.',
      high: '⚠️ Your message was removed for violating our rules. Please be respectful to others.',
      medium: '⚠️ Hey! Let\'s keep things friendly here. Please review our community guidelines.',
      low: '📝 Just a heads up - please be mindful of our community rules.',
      none: ''
    };

    return {
      action,
      reason,
      severity,
      confidence: Math.round(Math.max(0, Math.min(100, confidence))),
      shouldAct,
      suggestedResponse: thinking?.suggestedResponse || suggestedResponses[severity],
      thinking: thinking ? {
        intent: thinking.intent,
        harmfulProbability: thinking.harmfulProbability,
        alternativeInterpretation: thinking.alternativeInterpretation
      } : null
    };
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                         HELPER FUNCTIONS                                              ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

  createImmediateDecision(analysis, observation) {
    return {
      action: analysis.patterns.some(p => p.type === 'slurs' || p.type === 'directThreats') ? 'ban' : 'delete_warn',
      reason: analysis.patterns.map(p => p.type).join(', '),
      severity: 'critical',
      confidence: analysis.confidence,
      shouldAct: true,
      suggestedResponse: '🚫 Your message severely violated our community guidelines. This behavior is not tolerated.',
      thinking: null
    };
  }

  updateUserMemory(userId, decision, observation) {
    const profile = this.userMemory.get(userId);
    if (!profile) return;

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

      // Decrease trust
      const trustPenalty = { critical: 40, high: 25, medium: 15, low: 8 };
      profile.trustScore = Math.max(0, profile.trustScore - (trustPenalty[decision.severity] || 0));
      
      // Update reputation
      if (profile.trustScore < 20) profile.reputation = 'problematic';
      else if (profile.trustScore < 40) profile.reputation = 'warned';
    } else {
      // Good behavior
      profile.positiveActions++;
      
      // Slowly increase trust
      if (profile.positiveActions % 20 === 0) {
        profile.trustScore = Math.min(100, profile.trustScore + 2);
      }
      
      // Update reputation positively
      if (profile.trustScore > 80) profile.reputation = 'trusted';
      else if (profile.trustScore > 60) profile.reputation = 'good';
    }

    profile.moderationHistory.push({
      action: decision.action,
      shouldAct: decision.shouldAct,
      confidence: decision.confidence,
      timestamp: Date.now()
    });

    // Keep only last 50 moderation events
    if (profile.moderationHistory.length > 50) profile.moderationHistory.shift();
  }

  learn(thinkingProcess) {
    // Store learning data for pattern improvement
    if (thinkingProcess.finalDecision?.shouldAct) {
      const key = thinkingProcess.finalDecision.severity;
      if (!this.learningData.has(key)) {
        this.learningData.set(key, []);
      }
      this.learningData.get(key).push({
        content: thinkingProcess.content,
        decision: thinkingProcess.finalDecision,
        timestamp: Date.now()
      });
    }
  }

  // ╔═══════════════════════════════════════════════════════════════════════════════════════╗
  // ║                         USER ANALYSIS FOR VERIFICATION                                ║
  // ╚═══════════════════════════════════════════════════════════════════════════════════════╝

  async analyzeNewUser(user) {
    const now = Date.now();
    const daysOld = Math.floor((now - user.createdTimestamp) / 86400000);
    const hoursOld = Math.floor((now - user.createdTimestamp) / 3600000);

    let riskScore = 0;
    const flags = [];

    // Account age
    if (hoursOld < 1) { riskScore += 50; flags.push('🚨 Account < 1 hour'); }
    else if (hoursOld < 24) { riskScore += 35; flags.push('⚠️ Account < 24 hours'); }
    else if (daysOld < 7) { riskScore += 20; flags.push('📝 Account < 1 week'); }
    else if (daysOld > 365) { riskScore -= 10; }

    // Avatar
    if (!user.avatar) { riskScore += 15; flags.push('👤 No avatar'); }
    else if (user.avatar.startsWith('a_')) { riskScore -= 5; } // Animated = Nitro

    // Username patterns
    const username = user.username.toLowerCase();
    if (/^[a-z]{2,4}\d{4,}$/.test(username)) { riskScore += 25; flags.push('🤖 Auto-generated name'); }
    if (/(free|nitro|gift|hack|bot|spam|discord)/i.test(username)) { riskScore += 35; flags.push('🚫 Suspicious keywords'); }
    if (/[\u0300-\u036f\u0489]/.test(username)) { riskScore += 15; flags.push('🔣 Zalgo text'); }

    riskScore = Math.max(0, Math.min(100, riskScore));

    let riskLevel, challengeCount;
    if (riskScore >= 60) { riskLevel = 'critical'; challengeCount = 3; }
    else if (riskScore >= 40) { riskLevel = 'high'; challengeCount = 2; }
    else if (riskScore >= 20) { riskLevel = 'medium'; challengeCount = 2; }
    else { riskLevel = 'low'; challengeCount = 1; }

    return { userId: user.id, username: user.tag, avatar: user.displayAvatarURL(), daysOld, hoursOld, riskScore, riskLevel, flags, challengeCount };
  }

  async generateChallenge(difficulty) {
    const prompt = `Generate a ${difficulty} verification challenge. Make it fun! JSON only:
{"question":"","answer":"","options":["","","",""],"hint":"","type":"math/pattern/logic/knowledge/emoji"}`;

    const response = await this.think(prompt, 'Create engaging verification challenges. JSON only.', { temperature: 0.95, maxTokens: 150 });

    if (response) {
      try {
        const parsed = JSON.parse(response.replace(/```json?|```/g, '').trim());
        if (parsed.question && parsed.answer && parsed.options?.length >= 2) {
          if (!parsed.options.includes(parsed.answer)) parsed.options[0] = parsed.answer;
          parsed.options = parsed.options.sort(() => Math.random() - 0.5);
          return parsed;
        }
      } catch (e) {}
    }

    // Fallbacks
    const fallbacks = [
      { question: "What is 7 + 8?", answer: "15", options: ["15", "14", "16", "13"], hint: "Add them!", type: "math" },
      { question: "🔵🔴🔵🔴🔵❓", answer: "🔴", options: ["🔴", "🔵", "🟢", "🟡"], hint: "Pattern!", type: "pattern" },
      { question: "Capital of France?", answer: "Paris", options: ["Paris", "London", "Berlin", "Rome"], hint: "City of love", type: "knowledge" },
      { question: "2 × 9 = ?", answer: "18", options: ["18", "16", "20", "17"], hint: "Multiply", type: "math" },
      { question: "🐱 is a...", answer: "Cat", options: ["Cat", "Dog", "Bird", "Fish"], hint: "Meow!", type: "emoji" }
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async verifyAnswer(challenge, userAnswer) {
    const correct = String(challenge.answer).toLowerCase().trim();
    const user = String(userAnswer).toLowerCase().trim();
    return { correct: user === correct };
  }

  async categorizeTicket(content) {
    const r = await this.think('Categorize: ' + content, 'Reply ONLY: general, technical, billing, report, other', { temperature: 0, maxTokens: 20 });
    const valid = ['general', 'technical', 'billing', 'report', 'other'];
    return valid.includes((r || '').toLowerCase().trim()) ? r.toLowerCase().trim() : 'general';
  }

  async suggestResponse(messages, category) {
    const convo = messages.slice(-5).map(m => `${m.author}: ${m.content}`).join('\n');
    return await this.think(`Suggest response for ${category} ticket:\n${convo}`, 'Be helpful, concise. Under 200 chars.', { temperature: 0.7, maxTokens: 150 });
  }

  async chat(message, username) {
    return await this.think(`${username}: ${message}`, 'You are Nova, friendly AI. Use emojis. Under 250 chars.', { temperature: 0.8, maxTokens: 200 }) || 'Hey! 👋';
  }

  getStats() {
    return {
      enabled: !!this.groqKey,
      usersTracked: this.userMemory.size,
      channelsTracked: this.conversationContext.size,
      thinkingLogs: this.thinkingLogs.length
    };
  }

  getUserProfile(userId) { return this.userMemory.get(userId); }
  getThinkingLogs() { return this.thinkingLogs.slice(0, 50); }
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
    this.sessions = new Map();
    this.settings = new Map();
    this.tickets = new Map();
    this.ticketChannels = new Map();
    this.ticketCounter = 1;
    this.stats = { verified: 0, failed: 0, kicked: 0, banned: 0, ticketsCreated: 0, ticketsClosed: 0, messagesScanned: 0, messagesDeleted: 0, warningsGiven: 0, mutesDone: 0, aiDetections: 0 };
    this.logs = [];
    this.serverEvents = [];
    this.setupEvents();
  }

  getSettings(guildId) {
    if (!this.settings.has(guildId)) {
      this.settings.set(guildId, {
        modEnabled: true, detectSpam: true, detectToxicity: true, detectInvites: true,
        autoDelete: true, autoWarn: true, autoMute: true, maxWarnings: 3, muteDuration: 10,
        verifyEnabled: true, channelId: null, verifiedRoleId: null, unverifiedRoleId: null,
        kickOnFail: true, maxAttempts: 3
      });
    }
    return this.settings.get(guildId);
  }

  setupEvents() {
    this.client.once(Events.ClientReady, () => {
      console.log(`🤖 ${this.client.user.tag} is online!`);
      this.log('Bot started with Advanced Thinking Engine!', 'success');
      this.addEvent('Bot Online', `${this.client.user.tag} connected`, 'success');
    });

    // Member Join - Verification
    this.client.on(Events.GuildMemberAdd, async (member) => {
      this.addEvent('Member Joined', `${member.user.tag} joined`, 'join');
      const settings = this.getSettings(member.guild.id);
      if (!settings.verifyEnabled || !settings.channelId) return;

      const channel = member.guild.channels.cache.get(settings.channelId);
      if (!channel) return;

      if (settings.unverifiedRoleId) try { await member.roles.add(settings.unverifiedRoleId); } catch (e) {}

      const analysis = await this.ai.analyzeNewUser(member.user);
      this.log(`${member.user.tag} joined - Risk: ${analysis.riskLevel} (${analysis.riskScore})`, analysis.riskLevel === 'critical' ? 'warning' : 'info');

      const challenges = [];
      for (let i = 0; i < analysis.challengeCount; i++) {
        challenges.push(await this.ai.generateChallenge(i === 0 ? 'easy' : 'medium'));
      }

      const session = {
        memberId: member.id, guildId: member.guild.id, username: member.user.tag,
        avatar: member.user.displayAvatarURL(), analysis, challenges, currentIndex: 0,
        attempts: 0, maxAttempts: settings.maxAttempts, status: 'pending', startedAt: Date.now()
      };

      this.sessions.set(`${member.id}-${member.guild.id}`, session);
      await this.sendVerificationEmbed(member, channel, session);
      this.emitUpdate();

      setTimeout(async () => {
        const s = this.sessions.get(`${member.id}-${member.guild.id}`);
        if (s?.status === 'pending') {
          s.status = 'timeout'; this.stats.failed++;
          this.addEvent('Verification Timeout', `${member.user.tag} timed out`, 'warning');
          if (settings.kickOnFail) try { await member.kick('Verification timeout'); this.stats.kicked++; } catch (e) {}
          this.emitUpdate();
        }
      }, 300000);
    });

    this.client.on(Events.GuildMemberRemove, (member) => {
      this.addEvent('Member Left', `${member.user.tag} left`, 'leave');
    });

    // Button Interactions
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;
      const id = interaction.customId;
      try {
        if (id.startsWith('v_')) await this.handleVerifyButton(interaction);
        else if (id.startsWith('claim_')) await this.claimTicket(interaction, id.replace('claim_', ''));
        else if (id.startsWith('close_')) await this.closeTicketBtn(interaction, id.replace('close_', ''));
      } catch (e) { console.error('Interaction error:', e); }
    });

    // Message Moderation
    this.client.on(Events.MessageCreate, async (msg) => {
      if (msg.author.bot || !msg.guild) return;
      const settings = this.getSettings(msg.guild.id);
      this.stats.messagesScanned++;

      // Handle ticket channel messages
      if (this.ticketChannels.has(msg.channel.id)) {
        const ticketId = this.ticketChannels.get(msg.channel.id);
        const ticket = this.tickets.get(ticketId);
        if (ticket) {
          ticket.messages.push({
            id: msg.id, author: msg.author.tag, authorId: msg.author.id,
            authorAvatar: msg.author.displayAvatarURL(), content: msg.content,
            timestamp: new Date().toISOString(),
            isStaff: msg.member?.permissions.has(PermissionFlagsBits.ManageMessages) || false
          });
          this.io?.emit('ticketMessage', { ticketId, message: ticket.messages.at(-1) });
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // ADVANCED AI MODERATION WITH THINKING
      // ═══════════════════════════════════════════════════════════════════════════
      
      if (settings.modEnabled && !msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const result = await this.ai.moderateMessage(msg, msg.member, settings);
        
        if (result.shouldAct) {
          this.stats.aiDetections++;
          
          try {
            // Delete if needed
            if ((result.action === 'delete' || result.action === 'delete_warn') && settings.autoDelete) {
              await msg.delete();
              this.stats.messagesDeleted++;
            }

            // Warn if needed
            if ((result.action === 'warn' || result.action === 'delete_warn') && settings.autoWarn) {
              const profile = this.ai.getUserProfile(msg.author.id);
              
              const embed = new EmbedBuilder()
                .setColor(result.severity === 'critical' ? '#ff0000' : result.severity === 'high' ? '#ff6600' : '#ffaa00')
                .setAuthor({ name: '🛡️ Nova AI Moderation', iconURL: this.client.user.displayAvatarURL() })
                .setDescription(`${result.suggestedResponse}`)
                .addFields(
                  { name: '📊 Confidence', value: `${result.confidence}%`, inline: true },
                  { name: '⚠️ Severity', value: result.severity.toUpperCase(), inline: true },
                  { name: '📝 Warnings', value: `${profile?.warnings || 1}/${settings.maxWarnings}`, inline: true }
                )
                .setFooter({ text: result.thinking?.intent ? `Detected intent: ${result.thinking.intent}` : 'AI-Powered Moderation' })
                .setTimestamp();

              const warning = await msg.channel.send({ content: `${msg.author}`, embeds: [embed] });
              setTimeout(() => warning.delete().catch(() => {}), 15000);
              
              this.stats.warningsGiven++;
              this.log(`⚠️ Warned ${msg.author.tag}: ${result.reason} (${result.confidence}% confidence)`, 'moderation');
              this.addEvent('AI Moderation', `${msg.author.tag}: ${result.reason}`, 'moderation');

              // Auto-mute on max warnings
              if (settings.autoMute && profile?.warnings >= settings.maxWarnings) {
                await msg.member.timeout(settings.muteDuration * 60 * 1000, 'Max warnings reached');
                this.stats.mutesDone++;
                this.log(`🔇 Muted ${msg.author.tag} for ${settings.muteDuration}m`, 'moderation');
                this.addEvent('Auto-Mute', `${msg.author.tag} muted`, 'moderation');
              }
            }

            // Mute if needed
            if (result.action === 'mute') {
              await msg.member.timeout(settings.muteDuration * 60 * 1000, result.reason);
              this.stats.mutesDone++;
              this.log(`🔇 Muted ${msg.author.tag}: ${result.reason}`, 'moderation');
            }

            // Ban if needed
            if (result.action === 'ban') {
              await msg.member.ban({ reason: result.reason, deleteMessageSeconds: 86400 });
              this.stats.banned++;
              this.log(`🚫 Banned ${msg.author.tag}: ${result.reason}`, 'moderation');
              this.addEvent('Auto-Ban', `${msg.author.tag}`, 'moderation');
            }
          } catch (e) {
            console.error('Mod action failed:', e.message);
          }

          this.emitUpdate();
          return;
        }
      }

      // Commands
      const content = msg.content.toLowerCase();
      const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);

      if (content === '!help') await this.sendHelp(msg);
      else if (content.startsWith('!ticket')) await this.createTicket(msg, msg.content.slice(7).trim() || 'No reason');
      else if (content === '!setup' && isAdmin) await this.sendSetup(msg);
      else if (content.startsWith('!setverify') && isAdmin) {
        const ch = msg.mentions.channels.first();
        if (ch) { this.getSettings(msg.guild.id).channelId = ch.id; msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Verification channel: ${ch}`)] }); }
      }
      else if (content.startsWith('!setrole') && isAdmin) {
        const role = msg.mentions.roles.first();
        if (role) { this.getSettings(msg.guild.id).verifiedRoleId = role.id; msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Verified role: ${role}`)] }); }
      }
      else if (content.startsWith('!setunverified') && isAdmin) {
        const role = msg.mentions.roles.first();
        if (role) { this.getSettings(msg.guild.id).unverifiedRoleId = role.id; msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Unverified role: ${role}`)] }); }
      }
      else if (content === '!testvf' && isAdmin) await this.testVerify(msg);
      else if (content === '!thinking' && isAdmin) await this.showThinkingLogs(msg);
      else if (msg.mentions.has(this.client.user)) {
        const response = await this.ai.chat(msg.content.replace(/<@!?\d+>/g, '').trim(), msg.author.username);
        msg.reply(response);
      }
    });
  }

  async showThinkingLogs(msg) {
    const logs = this.ai.getThinkingLogs().slice(0, 5);
    if (!logs.length) return msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription('No thinking logs yet.')] });

    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('🧠 Recent AI Thinking Logs')
      .setDescription(logs.map((log, i) => {
        const decision = log.finalDecision;
        return `**${i + 1}. ${log.username}** - "${log.content.substring(0, 30)}..."\n` +
               `├ Action: \`${decision?.action || 'none'}\` | Confidence: \`${decision?.confidence || 0}%\`\n` +
               `├ Stages: ${log.stages.map(s => s.stage).join(' → ')}\n` +
               `└ Time: ${log.processingTime}ms`;
      }).join('\n\n'))
      .setFooter({ text: 'Advanced AI Moderation' })
      .setTimestamp();

    msg.reply({ embeds: [embed] });
  }

  async sendVerificationEmbed(member, channel, session) {
    const challenge = session.challenges[0];
    const embed = new EmbedBuilder()
      .setColor(session.analysis.riskLevel === 'critical' ? '#ff0000' : session.analysis.riskLevel === 'high' ? '#ffaa00' : '#ffffff')
      .setAuthor({ name: '🛡️ Nova Verification', iconURL: this.client.user.displayAvatarURL() })
      .setThumbnail(session.avatar)
      .setDescription(`Welcome ${member}!\n\nComplete the challenge to verify.\n\n━━━━━━━━━━━━━━━━━━`)
      .addFields(
        { name: `📝 Challenge 1/${session.challenges.length}`, value: '```' + challenge.question + '```' },
        { name: '💡 Hint', value: challenge.hint || 'Think!', inline: true },
        { name: '🔄 Attempts', value: `${session.attempts}/${session.maxAttempts}`, inline: true },
        { name: '⚠️ Risk', value: session.analysis.riskLevel.toUpperCase(), inline: true }
      )
      .setFooter({ text: '⏱️ 5 minutes' }).setTimestamp();

    const row = new ActionRowBuilder();
    challenge.options.slice(0, 4).forEach((opt, i) => {
      row.addComponents(new ButtonBuilder().setCustomId(`v_${member.id}_${member.guild.id}_${i}`).setLabel(String(opt).substring(0, 40)).setStyle([ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger][i]).setEmoji(['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i]));
    });

    await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
  }

  async handleVerifyButton(interaction) {
    const [, oderId, guildId, idx] = interaction.customId.split('_');
    if (interaction.user.id !== oderId) return interaction.reply({ content: '❌ Not for you!', ephemeral: true });

    const session = this.sessions.get(`${oderId}-${guildId}`);
    if (!session || session.status !== 'pending') return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    await interaction.deferUpdate();
    const challenge = session.challenges[session.currentIndex];
    const result = await this.ai.verifyAnswer(challenge, challenge.options[parseInt(idx)]);
    const member = await interaction.guild.members.fetch(oderId).catch(() => null);
    if (!member) return;

    if (result.correct) {
      session.currentIndex++;
      if (session.currentIndex >= session.challenges.length) {
        session.status = 'verified'; this.stats.verified++;
        const settings = this.getSettings(guildId);
        if (settings.verifiedRoleId) try { await member.roles.add(settings.verifiedRoleId); } catch (e) {}
        if (settings.unverifiedRoleId) try { await member.roles.remove(settings.unverifiedRoleId); } catch (e) {}
        await interaction.message.edit({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('🎉 Verified!').setDescription('Welcome!').setTimestamp()], components: [] });
        this.log(`✅ ${session.username} verified!`, 'success');
        this.addEvent('Verified', `${session.username}`, 'success');
      } else {
        const next = session.challenges[session.currentIndex];
        const row = new ActionRowBuilder();
        next.options.slice(0, 4).forEach((opt, i) => row.addComponents(new ButtonBuilder().setCustomId(`v_${oderId}_${guildId}_${i}`).setLabel(String(opt).substring(0, 40)).setStyle([ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger][i])));
        await interaction.message.edit({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅ Correct!').addFields({ name: '📝 Next', value: '```' + next.question + '```' })], components: [row] });
      }
    } else {
      session.attempts++;
      if (session.attempts >= session.maxAttempts) {
        session.status = 'failed'; this.stats.failed++;
        await interaction.message.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('❌ Failed').setTimestamp()], components: [] });
        const settings = this.getSettings(guildId);
        if (settings.kickOnFail) try { await member.kick('Failed verification'); this.stats.kicked++; } catch (e) {}
      } else {
        session.challenges[session.currentIndex] = await this.ai.generateChallenge('medium');
        const newCh = session.challenges[session.currentIndex];
        const row = new ActionRowBuilder();
        newCh.options.slice(0, 4).forEach((opt, i) => row.addComponents(new ButtonBuilder().setCustomId(`v_${oderId}_${guildId}_${i}`).setLabel(String(opt).substring(0, 40)).setStyle([ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger][i])));
        await interaction.message.edit({ embeds: [new EmbedBuilder().setColor('#ffaa00').setTitle('❌ Wrong!').addFields({ name: '📝 Try Again', value: '```' + newCh.question + '```' }, { name: 'Attempts', value: `${session.maxAttempts - session.attempts} left` })], components: [row] });
      }
    }
    this.emitUpdate();
  }

  async testVerify(msg) {
    const settings = this.getSettings(msg.guild.id);
    if (!settings.channelId) return msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('❌ Set channel first: `!setverify #channel`')] });
    const channel = msg.guild.channels.cache.get(settings.channelId);
    if (!channel) return;

    const analysis = await this.ai.analyzeNewUser(msg.author);
    const session = {
      memberId: msg.author.id, guildId: msg.guild.id, username: msg.author.tag,
      avatar: msg.author.displayAvatarURL(), analysis, challenges: [await this.ai.generateChallenge('easy')],
      currentIndex: 0, attempts: 0, maxAttempts: 3, status: 'pending', startedAt: Date.now()
    };
    this.sessions.set(`${msg.author.id}-${msg.guild.id}`, session);
    await this.sendVerificationEmbed(msg.member, channel, session);
    msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Test sent to ${channel}`)] });
  }

  async createTicket(msg, reason) {
    const user = msg.author, guild = msg.guild;
    for (const [, t] of this.tickets) {
      if (t.userId === user.id && t.status === 'open') {
        const ch = guild.channels.cache.get(t.channelId);
        if (ch) return msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`❌ Already have ticket: ${ch}`)] });
      }
    }

    const ticketId = `ticket-${this.ticketCounter++}`;
    const category = await this.ai.categorizeTicket(reason);

    try {
      const channel = await guild.channels.create({
        name: `🎫-${ticketId}`, type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });

      const ticket = {
        id: ticketId, oderId: user.id, userName: user.tag, userAvatar: user.displayAvatarURL(),
        channelId: channel.id, guildId: guild.id, reason, category, status: 'open', claimedBy: null,
        createdAt: new Date().toISOString(),
        messages: [{ id: '1', author: user.tag, authorId: user.id, authorAvatar: user.displayAvatarURL(), content: reason, timestamp: new Date().toISOString(), isStaff: false }]
      };

      this.tickets.set(ticketId, ticket);
      this.ticketChannels.set(channel.id, ticketId);

      const embed = new EmbedBuilder().setColor('#ffffff').setTitle(`🎫 ${ticketId}`)
        .setDescription(`Hello ${user}!\n\nSupport will assist shortly.`)
        .addFields({ name: '📝 Reason', value: reason }, { name: '🏷️ Category', value: category, inline: true })
        .setThumbnail(user.displayAvatarURL()).setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`claim_${ticketId}`).setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('✋'),
        new ButtonBuilder().setCustomId(`close_${ticketId}`).setLabel('Close').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
      );

      await channel.send({ embeds: [embed], components: [row] });
      await msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Created: ${channel}`)] });
      this.stats.ticketsCreated++;
      this.log(`🎫 Ticket ${ticketId} created`, 'success');
      this.addEvent('Ticket Created', `${user.tag}: ${ticketId}`, 'ticket');
      this.emitUpdate();
    } catch (e) { msg.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('❌ Failed')] }); }
  }

  async claimTicket(interaction, ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return interaction.reply({ content: '❌ Not found', ephemeral: true });
    ticket.claimedBy = interaction.user.tag;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription(`✅ Claimed by ${interaction.user}`)] });
    this.addEvent('Ticket Claimed', `${interaction.user.tag}: ${ticketId}`, 'ticket');
    this.emitUpdate();
  }

  async closeTicketBtn(interaction, ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (ticket) { ticket.status = 'closed'; this.stats.ticketsClosed++; }
    await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setDescription('🔒 Closing...')] });
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
      await channel.send({ embeds: [new EmbedBuilder().setColor('#ffffff').setAuthor({ name: `📩 ${staffName}` }).setDescription(content).setTimestamp()] });
      ticket.messages.push({ id: Date.now().toString(), author: `${staffName} (Staff)`, content, timestamp: new Date().toISOString(), isStaff: true });
      this.io?.emit('ticketMessage', { ticketId, message: ticket.messages.at(-1) });
      return { success: true };
    } catch (e) { return { success: false }; }
  }

  async sendHelp(msg) {
    await msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setAuthor({ name: '🤖 Nova AI', iconURL: this.client.user.displayAvatarURL() }).setTitle('Commands').addFields({ name: '🎫 Tickets', value: '`!ticket [reason]`', inline: true }, { name: '⚙️ Setup', value: '`!setup`', inline: true }, { name: '🧪 Test', value: '`!testvf`', inline: true }, { name: '🧠 AI Logs', value: '`!thinking`', inline: true }).setFooter({ text: 'Mention me to chat! | Advanced AI Moderation' })] });
  }

  async sendSetup(msg) {
    const s = this.getSettings(msg.guild.id);
    await msg.reply({ embeds: [new EmbedBuilder().setColor('#ffffff').setTitle('⚙️ Setup').addFields({ name: 'Commands', value: '`!setverify #channel`\n`!setrole @role`\n`!setunverified @role`' }, { name: 'Channel', value: s.channelId ? `<#${s.channelId}>` : '❌', inline: true }, { name: 'Verified', value: s.verifiedRoleId ? `<@&${s.verifiedRoleId}>` : '❌', inline: true }, { name: 'Unverified', value: s.unverifiedRoleId ? `<@&${s.unverifiedRoleId}>` : '❌', inline: true })] });
  }

  log(message, type = 'info') {
    const entry = { message, type, timestamp: new Date().toISOString() };
    this.logs.unshift(entry); if (this.logs.length > 100) this.logs.pop();
    console.log(`[${type.toUpperCase()}] ${message}`);
    this.io?.emit('newLog', entry);
  }

  addEvent(title, description, type) {
    const event = { title, description, type, timestamp: new Date().toISOString() };
    this.serverEvents.unshift(event); if (this.serverEvents.length > 50) this.serverEvents.pop();
    this.io?.emit('serverEvent', event);
  }

  emitUpdate() {
    this.io?.emit('stats', this.getStats());
    this.io?.emit('tickets', this.getAllTickets());
    this.io?.emit('sessions', this.getPendingSessions());
    this.io?.emit('events', this.serverEvents);
    this.io?.emit('thinkingLogs', this.ai.getThinkingLogs().slice(0, 20));
  }

  getAllTickets() { return Array.from(this.tickets.values()).filter(t => t.status === 'open').map(t => ({ ...t, messageCount: t.messages.length, lastMessage: t.messages.at(-1) })); }
  getPendingSessions() { return Array.from(this.sessions.values()).filter(s => s.status === 'pending').map(s => ({ memberId: s.memberId, username: s.username, avatar: s.avatar, riskLevel: s.analysis?.riskLevel, score: s.analysis?.riskScore, currentIndex: s.currentIndex, totalChallenges: s.challenges?.length, attempts: s.attempts, startedAt: s.startedAt })); }
  getStats() { return { guilds: this.client.guilds?.cache.size || 0, users: this.client.guilds?.cache.reduce((a, g) => a + g.memberCount, 0) || 0, ping: this.client.ws?.ping || 0, uptime: this.client.uptime || 0, ...this.stats, openTickets: Array.from(this.tickets.values()).filter(t => t.status === 'open').length, pendingSessions: Array.from(this.sessions.values()).filter(s => s.status === 'pending').length, ai: this.ai.getStats() }; }
  async start(token) { await this.client.login(token); }
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
app.get('/api/thinking', (req, res) => res.json(bot.ai.getThinkingLogs()));
app.get('/', (req, res) => res.send(getDashboardHTML()));

io.on('connection', (socket) => {
  console.log('📊 Dashboard connected');
  socket.emit('stats', bot.getStats());
  socket.emit('tickets', bot.getAllTickets());
  socket.emit('sessions', bot.getPendingSessions());
  socket.emit('events', bot.serverEvents);
  socket.emit('logs', bot.logs);
  socket.emit('thinkingLogs', bot.ai.getThinkingLogs().slice(0, 20));

  const interval = setInterval(() => {
    socket.emit('stats', bot.getStats());
    socket.emit('sessions', bot.getPendingSessions());
    socket.emit('thinkingLogs', bot.ai.getThinkingLogs().slice(0, 10));
  }, 3000);

  socket.on('sendMessage', async (data) => await bot.sendTicketMessage(data.ticketId, data.content, data.staffName || 'Staff'));
  socket.on('getAISuggestion', async (data) => {
    const ticket = bot.tickets.get(data.ticketId);
    if (ticket) socket.emit('aiSuggestion', { ticketId: data.ticketId, suggestion: await bot.ai.suggestResponse(ticket.messages, ticket.category) });
  });
  socket.on('closeTicket', async (data) => {
    const ticket = bot.tickets.get(data.ticketId);
    if (ticket) {
      ticket.status = 'closed'; bot.stats.ticketsClosed++;
      bot.ticketChannels.delete(ticket.channelId);
      try { const g = await bot.client.guilds.fetch(ticket.guildId); const c = await g.channels.fetch(ticket.channelId); await c.delete(); } catch (e) {}
      bot.tickets.delete(data.ticketId);
      bot.addEvent('Ticket Closed', `${data.ticketId}`, 'ticket');
      bot.emitUpdate();
    }
  });
  socket.on('disconnect', () => clearInterval(interval));
});

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                    ULTRA BEAUTIFUL DASHBOARD WITH THINKING VIEW                        ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova AI - Advanced Thinking Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-0: #000000; --bg-1: #050505; --bg-2: #0a0a0a; --bg-3: #0f0f0f;
      --bg-4: #141414; --bg-5: #1a1a1a; --bg-6: #202020; --bg-7: #262626;
      --border-1: #1a1a1a; --border-2: #252525; --border-3: #333333;
      --text-0: #ffffff; --text-1: #e5e5e5; --text-2: #a3a3a3; --text-3: #666666;
      --accent: #ffffff; --success: #22c55e; --warning: #eab308; --error: #ef4444; --info: #3b82f6;
      --critical: #dc2626; --high: #ea580c; --medium: #ca8a04; --low: #65a30d;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg-0); color: var(--text-0); line-height: 1.5; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-3); }
    
    .app { display: flex; height: 100vh; }
    
    /* Sidebar */
    .sidebar { width: 280px; background: var(--bg-1); border-right: 1px solid var(--border-1); display: flex; flex-direction: column; }
    .logo { padding: 24px; border-bottom: 1px solid var(--border-1); }
    .logo-main { display: flex; align-items: center; gap: 14px; }
    .logo-icon { width: 48px; height: 48px; background: linear-gradient(135deg, var(--bg-6), var(--bg-4)); border: 1px solid var(--border-2); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
    .logo-text { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
    .logo-sub { font-size: 0.65rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
    .nav { flex: 1; padding: 16px; overflow-y: auto; }
    .nav-section { margin-bottom: 24px; }
    .nav-label { font-size: 0.6rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 2px; padding: 0 14px; margin-bottom: 10px; }
    .nav-item { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 10px; cursor: pointer; color: var(--text-2); font-size: 0.9rem; font-weight: 500; transition: all 0.2s; position: relative; }
    .nav-item:hover { background: var(--bg-3); color: var(--text-1); }
    .nav-item.active { background: var(--text-0); color: var(--bg-0); font-weight: 600; }
    .nav-item .icon { font-size: 1.2rem; width: 24px; text-align: center; }
    .nav-item .badge { margin-left: auto; background: var(--bg-5); padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; }
    .nav-item.active .badge { background: rgba(0,0,0,0.15); }
    .sidebar-footer { padding: 16px; border-top: 1px solid var(--border-1); }
    .status { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--bg-3); border-radius: 10px; font-size: 0.85rem; color: var(--text-2); }
    .status-dot { width: 10px; height: 10px; background: var(--success); border-radius: 50%; animation: pulse 2s infinite; box-shadow: 0 0 10px var(--success); }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.9); } }
    
    /* Main */
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .header { padding: 20px 32px; border-bottom: 1px solid var(--border-1); display: flex; justify-content: space-between; align-items: center; background: var(--bg-1); }
    .header h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; }
    .header-stats { display: flex; gap: 32px; }
    .header-stat { text-align: right; }
    .header-stat .value { font-size: 1.5rem; font-weight: 800; letter-spacing: -1px; }
    .header-stat .label { font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 1px; }
    .content { flex: 1; overflow: hidden; }
    .tab-content { display: none; height: 100%; overflow: hidden; }
    .tab-content.active { display: flex; }
    
    /* Dashboard */
    .dashboard { flex: 1; padding: 32px; overflow-y: auto; }
    .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 16px; padding: 24px; transition: all 0.3s; position: relative; overflow: hidden; }
    .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent, var(--border-2), transparent); }
    .stat-card:hover { border-color: var(--border-2); transform: translateY(-3px); }
    .stat-card .icon-wrap { width: 50px; height: 50px; background: var(--bg-4); border: 1px solid var(--border-2); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 16px; }
    .stat-card .value { font-size: 2.5rem; font-weight: 800; letter-spacing: -2px; margin-bottom: 4px; }
    .stat-card .label { font-size: 0.85rem; color: var(--text-3); font-weight: 500; }
    .stat-card.success .value { color: var(--success); }
    .stat-card.warning .value { color: var(--warning); }
    .stat-card.error .value { color: var(--error); }
    .stat-card.info .value { color: var(--info); }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
    .card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 16px; overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid var(--border-1); font-weight: 600; font-size: 0.95rem; background: var(--bg-3); display: flex; justify-content: space-between; align-items: center; }
    .card-body { padding: 16px; max-height: 400px; overflow-y: auto; }
    
    /* Events & Logs */
    .event-item { padding: 14px 18px; border-radius: 12px; margin-bottom: 10px; background: var(--bg-4); border-left: 4px solid var(--border-2); transition: all 0.2s; }
    .event-item:hover { background: var(--bg-5); transform: translateX(4px); }
    .event-item.success { border-color: var(--success); }
    .event-item.warning { border-color: var(--warning); }
    .event-item.moderation { border-color: var(--error); }
    .event-item.ticket { border-color: var(--text-0); }
    .event-item.join { border-color: var(--success); }
    .event-item.leave { border-color: var(--warning); }
    .event-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; }
    .event-desc { font-size: 0.8rem; color: var(--text-2); }
    .event-time { font-size: 0.7rem; color: var(--text-3); margin-top: 6px; font-family: 'JetBrains Mono', monospace; }
    
    /* Thinking Logs - NEW SECTION */
    .thinking-card { background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
    .thinking-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .thinking-user { display: flex; align-items: center; gap: 10px; }
    .thinking-avatar { width: 32px; height: 32px; border-radius: 8px; background: var(--bg-5); }
    .thinking-username { font-weight: 600; font-size: 0.9rem; }
    .thinking-time { font-size: 0.7rem; color: var(--text-3); font-family: 'JetBrains Mono', monospace; }
    .thinking-content { background: var(--bg-4); border-radius: 8px; padding: 12px; margin-bottom: 12px; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text-2); }
    .thinking-stages { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .thinking-stage { padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .thinking-stage.observe { background: rgba(59, 130, 246, 0.2); color: var(--info); }
    .thinking-stage.analyze { background: rgba(234, 179, 8, 0.2); color: var(--warning); }
    .thinking-stage.think { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
    .thinking-stage.decide { background: rgba(34, 197, 94, 0.2); color: var(--success); }
    .thinking-decision { display: flex; gap: 16px; align-items: center; }
    .thinking-action { padding: 6px 14px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
    .thinking-action.none { background: var(--bg-5); color: var(--text-3); }
    .thinking-action.monitor { background: rgba(59, 130, 246, 0.2); color: var(--info); }
    .thinking-action.warn { background: rgba(234, 179, 8, 0.2); color: var(--warning); }
    .thinking-action.delete { background: rgba(249, 115, 22, 0.2); color: #f97316; }
    .thinking-action.delete_warn { background: rgba(239, 68, 68, 0.2); color: var(--error); }
    .thinking-action.mute { background: rgba(239, 68, 68, 0.3); color: var(--error); }
    .thinking-action.ban { background: rgba(220, 38, 38, 0.4); color: var(--critical); }
    .thinking-confidence { font-size: 0.8rem; color: var(--text-2); }
    .thinking-confidence strong { color: var(--text-0); }
    .thinking-meta { font-size: 0.75rem; color: var(--text-3); }
    
    /* Tickets */
    .tickets-container { display: flex; flex: 1; overflow: hidden; }
    .tickets-list { width: 360px; background: var(--bg-1); border-right: 1px solid var(--border-1); display: flex; flex-direction: column; }
    .tickets-header { padding: 24px; border-bottom: 1px solid var(--border-1); }
    .tickets-header h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; }
    .search-box { position: relative; }
    .search-box input { width: 100%; padding: 14px 18px 14px 48px; background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 12px; color: var(--text-0); font-size: 0.9rem; font-family: inherit; }
    .search-box input:focus { outline: none; border-color: var(--text-0); }
    .search-box::before { content: '🔍'; position: absolute; left: 18px; top: 50%; transform: translateY(-50%); font-size: 1rem; }
    .tickets-scroll { flex: 1; overflow-y: auto; padding: 16px; }
    .ticket-card { background: var(--bg-3); border: 1px solid var(--border-1); border-radius: 14px; padding: 18px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; }
    .ticket-card:hover { border-color: var(--border-2); transform: translateX(6px); }
    .ticket-card.active { border-color: var(--text-0); background: var(--bg-4); }
    .ticket-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .ticket-id { font-weight: 700; font-size: 0.95rem; }
    .ticket-badge { font-size: 0.65rem; padding: 4px 10px; border-radius: 6px; background: var(--bg-5); color: var(--text-2); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
    .ticket-user { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .ticket-avatar { width: 28px; height: 28px; border-radius: 8px; background: var(--bg-5); }
    .ticket-username { font-size: 0.85rem; color: var(--text-2); font-weight: 500; }
    .ticket-preview { font-size: 0.8rem; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ticket-meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 0.7rem; color: var(--text-3); }
    
    /* Chat Area */
    .chat-area { flex: 1; display: flex; flex-direction: column; background: var(--bg-0); }
    .chat-header { padding: 20px 28px; border-bottom: 1px solid var(--border-1); background: var(--bg-1); display: flex; justify-content: space-between; align-items: center; }
    .chat-header-info { display: flex; align-items: center; gap: 16px; }
    .chat-header-avatar { width: 52px; height: 52px; border-radius: 14px; background: var(--bg-4); border: 2px solid var(--border-2); }
    .chat-header-text h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; }
    .chat-header-text span { font-size: 0.8rem; color: var(--text-3); }
    .chat-actions { display: flex; gap: 10px; }
    .btn { padding: 12px 24px; border: none; border-radius: 10px; font-size: 0.85rem; font-weight: 600; font-family: inherit; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
    .btn:hover { transform: translateY(-2px); }
    .btn-primary { background: var(--text-0); color: var(--bg-0); }
    .btn-secondary { background: var(--bg-4); color: var(--text-0); border: 1px solid var(--border-2); }
    .btn-danger { background: var(--error); color: white; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 28px; display: flex; flex-direction: column; gap: 20px; }
    .message { display: flex; gap: 14px; max-width: 75%; animation: msgIn 0.3s ease; }
    @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .message.staff { margin-left: auto; flex-direction: row-reverse; }
    .message-avatar { width: 44px; height: 44px; border-radius: 12px; background: var(--bg-4); flex-shrink: 0; }
    .message-content { background: var(--bg-3); border: 1px solid var(--border-1); border-radius: 16px; padding: 16px 20px; }
    .message.staff .message-content { background: var(--bg-4); border-color: var(--border-2); }
    .message-author { font-size: 0.8rem; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
    .message-text { font-size: 0.9rem; line-height: 1.6; }
    .message-time { font-size: 0.7rem; color: var(--text-3); margin-top: 8px; font-family: 'JetBrains Mono', monospace; }
    .chat-input-area { padding: 24px 28px; border-top: 1px solid var(--border-1); background: var(--bg-1); }
    .ai-suggestion { background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 12px; padding: 14px 18px; margin-bottom: 14px; display: none; }
    .ai-suggestion.show { display: block; }
    .ai-suggestion-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .ai-suggestion-label { font-size: 0.7rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 1px; }
    .ai-suggestion-text { font-size: 0.9rem; color: var(--text-2); line-height: 1.5; }
    .chat-input-row { display: flex; gap: 14px; }
    .chat-input { flex: 1; padding: 16px 20px; background: var(--bg-3); border: 1px solid var(--border-2); border-radius: 14px; color: var(--text-0); font-size: 0.9rem; font-family: inherit; resize: none; min-height: 54px; max-height: 140px; }
    .chat-input:focus { outline: none; border-color: var(--text-0); }
    .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-3); }
    .empty-state-icon { font-size: 5rem; margin-bottom: 20px; opacity: 0.2; }
    .empty-state h3 { font-size: 1.3rem; color: var(--text-2); margin-bottom: 8px; }
    
    /* Verification */
    .verification-container { flex: 1; padding: 32px; overflow-y: auto; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .section-header h2 { font-size: 1.2rem; font-weight: 700; }
    .session-card { background: var(--bg-2); border: 1px solid var(--border-1); border-radius: 16px; padding: 24px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; }
    .session-card:hover { border-color: var(--border-2); }
    .session-user { display: flex; align-items: center; gap: 18px; }
    .session-avatar { width: 56px; height: 56px; border-radius: 14px; background: var(--bg-5); border: 2px solid var(--border-2); }
    .session-info h4 { font-weight: 600; font-size: 1rem; margin-bottom: 4px; }
    .session-info span { font-size: 0.8rem; color: var(--text-3); }
    .session-meta { display: flex; gap: 24px; align-items: center; }
    .risk-badge { padding: 8px 16px; border-radius: 10px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .risk-low { background: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.3); }
    .risk-medium { background: rgba(234, 179, 8, 0.15); color: var(--warning); border: 1px solid rgba(234, 179, 8, 0.3); }
    .risk-high { background: rgba(239, 68, 68, 0.15); color: var(--error); border: 1px solid rgba(239, 68, 68, 0.3); }
    .risk-critical { background: rgba(220, 38, 38, 0.25); color: var(--critical); border: 1px solid rgba(220, 38, 38, 0.5); }
    
    @media (max-width: 1400px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } .grid-3 { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .grid-2, .grid-3 { grid-template-columns: 1fr; } }
    @media (max-width: 900px) { .sidebar { width: 80px; } .logo-text, .logo-sub, .nav-label, .nav-item span:not(.icon):not(.badge), .status span { display: none; } .nav-item { justify-content: center; padding: 16px; } }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-main">
          <div class="logo-icon">🧠</div>
          <div><div class="logo-text">Nova AI</div><div class="logo-sub">Thinking Engine</div></div>
        </div>
      </div>
      <nav class="nav">
        <div class="nav-section">
          <div class="nav-label">Overview</div>
          <div class="nav-item active" onclick="showTab('dashboard')"><span class="icon">📊</span><span>Dashboard</span></div>
        </div>
        <div class="nav-section">
          <div class="nav-label">AI System</div>
          <div class="nav-item" onclick="showTab('thinking')"><span class="icon">🧠</span><span>AI Thinking</span><span class="badge" id="thinkingBadge">0</span></div>
          <div class="nav-item" onclick="showTab('moderation')"><span class="icon">⚔️</span><span>Moderation</span></div>
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
        <div class="status"><div class="status-dot"></div><span>AI Online</span></div>
      </div>
    </aside>
    
    <main class="main">
      <header class="header">
        <h1 id="pageTitle">Dashboard</h1>
        <div class="header-stats">
          <div class="header-stat"><div class="value" id="headerPing">0ms</div><div class="label">Latency</div></div>
          <div class="header-stat"><div class="value" id="headerUptime">0h</div><div class="label">Uptime</div></div>
          <div class="header-stat"><div class="value" id="headerAI">🧠</div><div class="label">AI Status</div></div>
        </div>
      </header>
      
      <div class="content">
        <!-- Dashboard Tab -->
        <div class="tab-content active" id="tab-dashboard">
          <div class="dashboard">
            <div class="stats-grid">
              <div class="stat-card"><div class="icon-wrap">🌐</div><div class="value" id="statServers">0</div><div class="label">Servers</div></div>
              <div class="stat-card"><div class="icon-wrap">👥</div><div class="value" id="statUsers">0</div><div class="label">Users</div></div>
              <div class="stat-card success"><div class="icon-wrap">✅</div><div class="value" id="statVerified">0</div><div class="label">Verified</div></div>
              <div class="stat-card error"><div class="icon-wrap">🧠</div><div class="value" id="statAIDetections">0</div><div class="label">AI Detections</div></div>
              <div class="stat-card warning"><div class="icon-wrap">⚠️</div><div class="value" id="statWarnings">0</div><div class="label">Warnings</div></div>
            </div>
            <div class="grid-2">
              <div class="card">
                <div class="card-header"><span>🧠 Recent AI Decisions</span></div>
                <div class="card-body" id="recentThinking"></div>
              </div>
              <div class="card">
                <div class="card-header"><span>📡 Live Events</span></div>
                <div class="card-body" id="eventsContainer"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- AI Thinking Tab - NEW -->
        <div class="tab-content" id="tab-thinking">
          <div class="dashboard">
            <div class="section-header">
              <h2>🧠 AI Thinking Process</h2>
              <span style="color:var(--text-3);font-size:0.85rem">Real-time moderation decisions</span>
            </div>
            <div id="thinkingList"></div>
          </div>
        </div>
        
        <!-- Moderation Tab -->
        <div class="tab-content" id="tab-moderation">
          <div class="dashboard">
            <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
              <div class="stat-card"><div class="icon-wrap">🔍</div><div class="value" id="statScanned">0</div><div class="label">Scanned</div></div>
              <div class="stat-card error"><div class="icon-wrap">🗑️</div><div class="value" id="statDeleted">0</div><div class="label">Deleted</div></div>
              <div class="stat-card warning"><div class="icon-wrap">🔇</div><div class="value" id="statMutes">0</div><div class="label">Mutes</div></div>
              <div class="stat-card" style="--value-color: var(--critical);"><div class="icon-wrap">🚫</div><div class="value" id="statBans">0</div><div class="label">Bans</div></div>
            </div>
            <div class="card">
              <div class="card-header"><span>⚔️ Moderation Actions</span></div>
              <div class="card-body" id="modActions" style="max-height:500px"></div>
            </div>
          </div>
        </div>
        
        <!-- Tickets Tab -->
        <div class="tab-content" id="tab-tickets">
          <div class="tickets-container">
            <div class="tickets-list">
              <div class="tickets-header">
                <h2>🎫 Tickets</h2>
                <div class="search-box"><input type="text" placeholder="Search..." id="ticketSearch" oninput="filterTickets()"></div>
              </div>
              <div class="tickets-scroll" id="ticketsList"></div>
            </div>
            <div class="chat-area">
              <div class="empty-state" id="chatEmpty"><div class="empty-state-icon">💬</div><h3>Select a Ticket</h3><p>Choose a ticket to view</p></div>
              <div id="chatView" style="display:none;flex:1;flex-direction:column;">
                <div class="chat-header">
                  <div class="chat-header-info"><img class="chat-header-avatar" id="chatAvatar"><div class="chat-header-text"><h3 id="chatTitle">Ticket</h3><span id="chatSubtitle"></span></div></div>
                  <div class="chat-actions"><button class="btn btn-secondary" onclick="getAISuggestion()">🧠 AI</button><button class="btn btn-danger" onclick="closeCurrentTicket()">🔒 Close</button></div>
                </div>
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-input-area">
                  <div class="ai-suggestion" id="aiSuggestion"><div class="ai-suggestion-header"><span class="ai-suggestion-label">🧠 AI Suggestion</span><button class="btn btn-secondary" style="padding:8px 14px;font-size:0.75rem" onclick="useSuggestion()">Use</button></div><div class="ai-suggestion-text" id="aiSuggestionText"></div></div>
                  <div class="chat-input-row"><textarea class="chat-input" id="chatInput" placeholder="Type response..." rows="1"></textarea><button class="btn btn-primary" onclick="sendMessage()">Send →</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Verification Tab -->
        <div class="tab-content" id="tab-verification">
          <div class="verification-container">
            <div class="section-header"><h2>🛡️ Pending Verifications</h2></div>
            <div id="sessionsList"></div>
          </div>
        </div>
        
        <!-- Events Tab -->
        <div class="tab-content" id="tab-events">
          <div class="dashboard">
            <div class="section-header"><h2>📡 Server Events</h2></div>
            <div class="card"><div class="card-body" id="allEvents" style="max-height:calc(100vh - 220px)"></div></div>
          </div>
        </div>
        
        <!-- Logs Tab -->
        <div class="tab-content" id="tab-logs">
          <div class="dashboard">
            <div class="section-header"><h2>📝 System Logs</h2></div>
            <div class="card"><div class="card-body" id="allLogs" style="max-height:calc(100vh - 220px)"></div></div>
          </div>
        </div>
      </div>
    </main>
  </div>
  
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let tickets = [], currentTicket = null, sessions = [], events = [], logs = [], thinkingLogs = [];

    function showTab(name) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('tab-' + name)?.classList.add('active');
      event?.target?.closest('.nav-item')?.classList.add('active');
      const titles = { dashboard: 'Dashboard', thinking: 'AI Thinking', moderation: 'Moderation', tickets: 'Tickets', verification: 'Verification', events: 'Events', logs: 'Logs' };
      document.getElementById('pageTitle').textContent = titles[name] || name;
    }

    // Stats
    socket.on('stats', s => {
      document.getElementById('statServers').textContent = s.guilds || 0;
      document.getElementById('statUsers').textContent = formatNum(s.users || 0);
      document.getElementById('statVerified').textContent = s.verified || 0;
      document.getElementById('statAIDetections').textContent = s.aiDetections || 0;
      document.getElementById('statWarnings').textContent = s.warningsGiven || 0;
      document.getElementById('statScanned').textContent = formatNum(s.messagesScanned || 0);
      document.getElementById('statDeleted').textContent = s.messagesDeleted || 0;
      document.getElementById('statMutes').textContent = s.mutesDone || 0;
      document.getElementById('statBans').textContent = s.banned || 0;
      document.getElementById('headerPing').textContent = (s.ping || 0) + 'ms';
      document.getElementById('headerUptime').textContent = Math.floor((s.uptime || 0) / 3600000) + 'h';
      document.getElementById('headerAI').textContent = s.ai?.enabled ? '🟢' : '🔴';
      document.getElementById('ticketBadge').textContent = s.openTickets || 0;
      document.getElementById('verifyBadge').textContent = s.pendingSessions || 0;
    });

    // Thinking Logs
    socket.on('thinkingLogs', data => {
      thinkingLogs = data || [];
      document.getElementById('thinkingBadge').textContent = thinkingLogs.length;
      renderThinkingLogs();
      renderRecentThinking();
    });

    function renderThinkingLogs() {
      const c = document.getElementById('thinkingList');
      if (!c) return;
      if (!thinkingLogs.length) {
        c.innerHTML = '<div class="empty-state" style="padding:60px"><div class="empty-state-icon">🧠</div><h3>No AI Decisions Yet</h3><p>AI thinking logs will appear here</p></div>';
        return;
      }
      c.innerHTML = thinkingLogs.map(log => {
        const d = log.finalDecision || {};
        const stages = (log.stages || []).map(s => '<span class="thinking-stage ' + s.stage.toLowerCase() + '">' + s.stage + '</span>').join('');
        return '<div class="thinking-card"><div class="thinking-header"><div class="thinking-user"><div class="thinking-username">' + (log.username || 'Unknown') + '</div></div><div class="thinking-time">' + (log.processingTime || 0) + 'ms</div></div><div class="thinking-content">"' + escapeHtml(log.content || '') + '"</div><div class="thinking-stages">' + stages + '</div><div class="thinking-decision"><span class="thinking-action ' + (d.action || 'none') + '">' + (d.action || 'none') + '</span><span class="thinking-confidence">Confidence: <strong>' + (d.confidence || 0) + '%</strong></span><span class="thinking-meta">' + (d.severity || 'none') + ' severity</span></div></div>';
      }).join('');
    }

    function renderRecentThinking() {
      const c = document.getElementById('recentThinking');
      if (!c) return;
      const recent = thinkingLogs.slice(0, 5);
      if (!recent.length) {
        c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3)">No AI decisions yet</div>';
        return;
      }
      c.innerHTML = recent.map(log => {
        const d = log.finalDecision || {};
        return '<div class="event-item ' + (d.shouldAct ? 'moderation' : 'info') + '"><div class="event-title">' + (log.username || 'Unknown') + ' - ' + (d.action || 'none') + '</div><div class="event-desc">"' + escapeHtml((log.content || '').substring(0, 50)) + '..."</div><div class="event-time">Confidence: ' + (d.confidence || 0) + '% | ' + (log.processingTime || 0) + 'ms</div></div>';
      }).join('');
    }

    // Tickets
    socket.on('tickets', data => { tickets = data || []; renderTickets(); });
    socket.on('ticketMessage', data => { if (currentTicket?.id === data.ticketId) addMsgToChat(data.message); });
    
    function renderTickets() {
      const c = document.getElementById('ticketsList');
      const search = (document.getElementById('ticketSearch')?.value || '').toLowerCase();
      const filtered = tickets.filter(t => t.id.toLowerCase().includes(search) || (t.userName || '').toLowerCase().includes(search));
      if (!filtered.length) { c.innerHTML = '<div class="empty-state" style="padding:60px"><div class="empty-state-icon">📭</div><p>No tickets</p></div>'; return; }
      c.innerHTML = filtered.map(t => '<div class="ticket-card ' + (currentTicket?.id === t.id ? 'active' : '') + '" onclick="selectTicket(\\'' + t.id + '\\')"><div class="ticket-top"><span class="ticket-id">' + t.id + '</span><span class="ticket-badge">' + (t.category || 'general') + '</span></div><div class="ticket-user"><img class="ticket-avatar" src="' + (t.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><span class="ticket-username">' + (t.userName || 'Unknown') + '</span></div><div class="ticket-preview">' + escapeHtml((t.lastMessage?.content || t.reason || '').substring(0, 60)) + '</div><div class="ticket-meta"><span>💬 ' + (t.messageCount || 0) + '</span><span>' + timeAgo(t.createdAt) + '</span></div></div>').join('');
    }

    function selectTicket(id) {
      currentTicket = tickets.find(t => t.id === id);
      if (!currentTicket) return;
      document.getElementById('chatEmpty').style.display = 'none';
      document.getElementById('chatView').style.display = 'flex';
      document.getElementById('chatAvatar').src = currentTicket.userAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
      document.getElementById('chatTitle').textContent = currentTicket.id;
      document.getElementById('chatSubtitle').textContent = (currentTicket.userName || '') + ' • ' + (currentTicket.category || 'general');
      renderMessages();
      renderTickets();
    }

    function renderMessages() {
      if (!currentTicket) return;
      const c = document.getElementById('chatMessages');
      const msgs = currentTicket.messages || [];
      c.innerHTML = msgs.map(m => '<div class="message ' + (m.isStaff ? 'staff' : '') + '"><img class="message-avatar" src="' + (m.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><div class="message-content"><div class="message-author">' + (m.author || 'Unknown') + '</div><div class="message-text">' + escapeHtml(m.content || '') + '</div><div class="message-time">' + formatTime(m.timestamp) + '</div></div></div>').join('');
      c.scrollTop = c.scrollHeight;
    }

    function addMsgToChat(m) {
      const c = document.getElementById('chatMessages');
      const d = document.createElement('div');
      d.className = 'message ' + (m.isStaff ? 'staff' : '');
      d.innerHTML = '<img class="message-avatar" src="' + (m.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><div class="message-content"><div class="message-author">' + (m.author || '') + '</div><div class="message-text">' + escapeHtml(m.content || '') + '</div><div class="message-time">' + formatTime(m.timestamp) + '</div></div>';
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

    socket.on('aiSuggestion', data => {
      document.getElementById('aiSuggestionText').textContent = data.suggestion || 'No suggestion';
    });

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

    // Sessions
    socket.on('sessions', data => { sessions = data || []; renderSessions(); });
    
    function renderSessions() {
      const c = document.getElementById('sessionsList');
      if (!sessions.length) { c.innerHTML = '<div class="empty-state" style="padding:80px"><div class="empty-state-icon">✅</div><h3>All Clear</h3><p>No pending verifications</p></div>'; return; }
      c.innerHTML = sessions.map(s => '<div class="session-card"><div class="session-user"><img class="session-avatar" src="' + (s.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '"><div class="session-info"><h4>' + (s.username || 'Unknown') + '</h4><span>Progress: ' + (s.currentIndex || 0) + '/' + (s.totalChallenges || 1) + ' • Attempts: ' + (s.attempts || 0) + '</span></div></div><div class="session-meta"><span class="risk-badge risk-' + (s.riskLevel || 'low') + '">' + (s.riskLevel || 'low').toUpperCase() + ' (' + (s.score || 0) + ')</span><span style="color:var(--text-3);font-size:0.8rem">' + timeAgo(s.startedAt) + '</span></div></div>').join('');
    }

    // Events
    socket.on('serverEvent', e => { events.unshift(e); if (events.length > 100) events.pop(); renderEvents(); });
    socket.on('events', data => { events = data || []; renderEvents(); });
    
    function renderEvents() {
      [document.getElementById('eventsContainer'), document.getElementById('allEvents')].forEach((c, i) => {
        if (!c) return;
        const limit = i === 0 ? 8 : 100;
        if (!events.length) { c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3)">No events</div>'; return; }
        c.innerHTML = events.slice(0, limit).map(e => '<div class="event-item ' + (e.type || 'info') + '"><div class="event-title">' + (e.title || 'Event') + '</div><div class="event-desc">' + escapeHtml(e.description || '') + '</div><div class="event-time">' + formatTime(e.timestamp) + '</div></div>').join('');
      });
    }

    // Logs
    socket.on('newLog', l => { logs.unshift(l); if (logs.length > 100) logs.pop(); renderLogs(); });
    socket.on('logs', data => { logs = data || []; renderLogs(); });
    
    function renderLogs() {
      const c = document.getElementById('allLogs');
      if (!c) return;
      if (!logs.length) { c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3)">No logs</div>'; return; }
      c.innerHTML = logs.slice(0, 100).map(l => '<div class="event-item ' + (l.type || 'info') + '"><strong>' + formatTime(l.timestamp) + '</strong> ' + escapeHtml(l.message || '') + '</div>').join('');
    }

    function renderModActions() {
      const c = document.getElementById('modActions');
      if (!c) return;
      const modLogs = logs.filter(l => l.type === 'moderation');
      if (!modLogs.length) { c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3)">No moderation actions</div>'; return; }
      c.innerHTML = modLogs.slice(0, 50).map(l => '<div class="event-item moderation"><strong>' + formatTime(l.timestamp) + '</strong> ' + escapeHtml(l.message || '') + '</div>').join('');
    }

    // Utilities
    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function formatTime(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    function timeAgo(ts) { if (!ts) return ''; const s = Math.floor((Date.now() - new Date(ts)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }
    function formatNum(n) { if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n.toString(); }

    document.getElementById('chatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    document.getElementById('chatInput')?.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 140) + 'px'; });

    // Initial render
    renderEvents();
    renderLogs();
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
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                    ║');
  console.log('║   🧠  NOVA ULTRA AI - Advanced Thinking Moderation System         ║');
  console.log('║                                                                    ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                    ║');
  console.log('║   🌐 Dashboard:     http://localhost:' + PORT + '                       ║');
  console.log('║                                                                    ║');
  console.log('║   🧠 AI FEATURES:                                                  ║');
  console.log('║   ├─ 4-Stage Thinking: Observe → Analyze → Think → Decide         ║');
  console.log('║   ├─ Context-Aware Analysis                                        ║');
  console.log('║   ├─ User Trust Scoring                                            ║');
  console.log('║   ├─ Intent Detection                                              ║');
  console.log('║   └─ Learning System                                               ║');
  console.log('║                                                                    ║');
  console.log('║   📋 COMMANDS:                                                     ║');
  console.log('║   ├─ !ticket [reason]  - Create support ticket                     ║');
  console.log('║   ├─ !setup            - View setup                                ║');
  console.log('║   ├─ !testvf           - Test verification                         ║');
  console.log('║   ├─ !thinking         - View AI thinking logs                     ║');
  console.log('║   └─ @bot [message]    - Chat with AI                              ║');
  console.log('║                                                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (process.env.DISCORD_TOKEN) {
    await bot.start(process.env.DISCORD_TOKEN);
  } else {
    console.log('⚠️  No DISCORD_TOKEN found!');
    console.log('   Add DISCORD_TOKEN to your .env file');
  }
});