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
// ║              NOVA ULTRA ADVANCED AI ENGINE - CONTEXT-AWARE MODERATION                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class NovaUltraAI {
  constructor() {
    this.groqKey = process.env.GROQ_API_KEY;
    
    // Caching & Rate Limiting
    this.cache = new Map();
    this.cacheExpiry = 15 * 60 * 1000;
    this.lastRequest = 0;
    this.minInterval = 80;
    
    // User Intelligence
    this.userProfiles = new Map();
    this.conversationHistory = new Map();
    this.serverContext = new Map();
    
    // Learning Data
    this.moderationHistory = [];
    this.appealHistory = [];
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BAD WORDS LIST (catches stretched versions like fuuuck, fuckk, f.u.c.k)
    // ═══════════════════════════════════════════════════════════════════════════
    this.badWordBases = [
      'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock', 'cunt', 'bastard',
      'whore', 'slut', 'piss', 'damn', 'crap', 'stfu', 'wtf', 'fck', 'sht'
    ];
    
    this.slurBases = [
      'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'spic', 
      'chink', 'kike', 'tranny', 'dyke', 'coon', 'wetback', 'beaner'
    ];
    
    this.selfHarmPhrases = [
      'kys', 'kill yourself', 'kill urself', 'kill ur self', 'end yourself'
    ];
    
    console.log(this.groqKey 
      ? '🧠 Nova Ultra AI Engine: ONLINE [Full AI Mode]' 
      : '⚠️ Nova Ultra AI Engine: LIMITED [Pattern Only Mode - No API Key]');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE AI COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  async callAI(systemPrompt, userPrompt, options = {}) {
    if (!this.groqKey) return null;
    
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastRequest = Date.now();
    
    try {
      const body = {
        model: options.model || "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature ?? 0.3
      };
      
      if (options.json) {
        body.response_format = { type: "json_object" };
      }
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        console.error('AI API Error:', response.status);
        return null;
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (options.json && content) {
        try {
          return JSON.parse(content);
        } catch {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
          return null;
        }
      }
      
      return content;
    } catch (e) {
      console.error('AI Error:', e.message);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROFILE & REPUTATION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  
  getProfile(userId) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        id: userId,
        oderId: userId,
        userId: userId,
        trustScore: 50,
        warnings: [],
        violations: [],
        positiveActions: 0,
        messageCount: 0,
        toxicityAvg: 0,
        lastSeen: Date.now(),
        joinedAt: null,
        notes: []
      });
    }
    return this.userProfiles.get(userId);
  }
  
  updateTrust(userId, change, reason) {
    const profile = this.getProfile(userId);
    profile.trustScore = Math.max(0, Math.min(100, profile.trustScore + change));
    profile.notes.push({ change, reason, timestamp: Date.now() });
    return profile;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT NORMALIZATION (catches fuckk, f.u.c.k, fuuuck, f@ck, etc)
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalize(text) {
    if (!text) return '';
    
    let s = text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')      // Remove diacritics
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
      .toLowerCase();
    
    // Remove separators: f.u.c.k, f-u-c-k, f_u_c_k, f u c k
    s = s.replace(/[\.\-_\*\|\s]+/g, '');
    
    // Leetspeak conversion
    s = s.replace(/[@4]/g, 'a');
    s = s.replace(/[0]/g, 'o');
    s = s.replace(/[1!|]/g, 'i');
    s = s.replace(/[3]/g, 'e');
    s = s.replace(/[5$]/g, 's');
    s = s.replace(/[7+]/g, 't');
    s = s.replace(/[8]/g, 'b');
    
    // Collapse repeated letters: fuuuuck -> fuck, shiiit -> shit
    s = s.replace(/(.)\1{2,}/g, '$1$1'); // fuuuck -> fuuck
    s = s.replace(/(.)\1+/g, '$1');       // fuuck -> fuck
    
    return s;
  }
  
  // Check if text contains bad word
  containsBadWord(text) {
    const norm = this.normalize(text);
    const found = [];
    
    for (const word of this.badWordBases) {
      if (norm.includes(word)) {
        found.push({ word, type: 'profanity', severity: 5 });
      }
    }
    
    for (const word of this.slurBases) {
      if (norm.includes(word)) {
        found.push({ word, type: 'slur', severity: 10 });
      }
    }
    
    const lower = text.toLowerCase();
    for (const phrase of this.selfHarmPhrases) {
      if (lower.includes(phrase)) {
        found.push({ word: phrase, type: 'self_harm', severity: 9 });
      }
    }
    
    return found;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ANALYSIS FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  async analyzeMessage(message, recentMessages = []) {
    const content = message.content || '';
    const userId = message.author.id;
    const profile = this.getProfile(userId);
    
    profile.messageCount++;
    profile.lastSeen = Date.now();
    
    console.log(`[MODERATION] Analyzing: "${content.slice(0, 50)}..." from ${message.author.tag}`);
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 1: Pattern Detection (ALWAYS runs first)
    // ─────────────────────────────────────────────────────────────────
    const foundBadWords = this.containsBadWord(content);
    
    if (foundBadWords.length > 0) {
      console.log(`[MODERATION] Pattern detected: ${foundBadWords.map(w => w.word).join(', ')}`);
      
      // Find worst violation
      const worst = foundBadWords.reduce((a, b) => a.severity > b.severity ? a : b);
      
      // Slurs = instant ban (no AI override)
      if (worst.type === 'slur') {
        console.log(`[MODERATION] SLUR DETECTED - Instant ban`);
        return {
          shouldAct: true,
          action: 'ban',
          severity: 10,
          category: 'slur',
          reason: `Slur detected: ${worst.word}`,
          confidence: 0.99,
          source: 'pattern',
          userProfile: profile,
          detectedWords: foundBadWords.map(w => w.word)
        };
      }
      
      // Self-harm = instant timeout (no AI override)
      if (worst.type === 'self_harm') {
        console.log(`[MODERATION] SELF-HARM DETECTED - Timeout`);
        return {
          shouldAct: true,
          action: 'timeout',
          severity: 9,
          category: 'self_harm',
          reason: `Self-harm encouragement: ${worst.word}`,
          confidence: 0.95,
          source: 'pattern',
          userProfile: profile,
          detectedWords: foundBadWords.map(w => w.word)
        };
      }
      
      // ─────────────────────────────────────────────────────────────────
      // STEP 2: For profanity, check with AI for context (if available)
      // ─────────────────────────────────────────────────────────────────
      if (this.groqKey) {
        console.log(`[MODERATION] Profanity found, checking AI for context...`);
        
        const context = {
          message: content,
          detectedWords: foundBadWords.map(w => w.word),
          channelName: message.channel?.name || 'unknown',
          channelType: this.getChannelContext(message.channel?.name),
          userTrustScore: profile.trustScore,
          userWarningCount: profile.warnings.length,
          recentMessages: recentMessages.slice(-3).map(m => ({
            author: m.author?.username || 'unknown',
            content: (m.content || '').slice(0, 80)
          }))
        };
        
        const aiResult = await this.aiContextCheck(content, context);
        
        if (aiResult) {
          console.log(`[MODERATION] AI says: shouldAct=${aiResult.shouldAct}, action=${aiResult.action}, reason=${aiResult.reason}`);
          
          // AI can say "allow" only if it's VERY confident it's safe (gaming context, etc)
          if (!aiResult.shouldAct && aiResult.confidence >= 0.8) {
            console.log(`[MODERATION] AI override: Allowing (confidence ${aiResult.confidence})`);
            return {
              shouldAct: false,
              action: 'allow',
              severity: 0,
              category: 'safe',
              reason: aiResult.reason || 'AI determined safe in context',
              confidence: aiResult.confidence,
              source: 'ai_override',
              userProfile: profile
            };
          }
          
          // AI confirms it's bad or is unsure - take action
          return {
            shouldAct: true,
            action: aiResult.action || 'delete',
            severity: aiResult.severity || 5,
            category: aiResult.category || 'profanity',
            reason: aiResult.reason || 'Profanity detected',
            confidence: aiResult.confidence || 0.8,
            source: 'ai',
            userProfile: profile,
            detectedWords: foundBadWords.map(w => w.word),
            intent: aiResult.intent,
            sentiment: aiResult.sentiment
          };
        }
      }
      
      // No AI or AI failed - use pattern result
      console.log(`[MODERATION] Using pattern result: delete + warn`);
      return {
        shouldAct: true,
        action: 'delete',
        severity: 5,
        category: 'profanity',
        reason: `Profanity detected: ${foundBadWords.map(w => w.word).join(', ')}`,
        confidence: 0.9,
        source: 'pattern',
        userProfile: profile,
        detectedWords: foundBadWords.map(w => w.word)
      };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 3: No bad words found by pattern - check other things
    // ─────────────────────────────────────────────────────────────────
    
    // Mass mentions
    const mentionCount = (message.mentions?.users?.size || 0) + 
                         (message.mentions?.roles?.size || 0) +
                         (message.mentions?.everyone ? 10 : 0);
    
    if (mentionCount > 5) {
      console.log(`[MODERATION] Mass mentions detected: ${mentionCount}`);
      return {
        shouldAct: true,
        action: 'timeout',
        severity: 7,
        category: 'spam',
        reason: `Mass mentions: ${mentionCount} mentions`,
        confidence: 0.95,
        source: 'pattern',
        userProfile: profile
      };
    }
    
    // Discord invites
    if (/(discord\.(gg|io|me|li)\/\S+|discord(app)?\.com\/invite\/\S+)/i.test(content)) {
      console.log(`[MODERATION] Discord invite detected`);
      return {
        shouldAct: true,
        action: 'delete',
        severity: 4,
        category: 'invite',
        reason: 'Unauthorized Discord invite',
        confidence: 0.95,
        source: 'pattern',
        userProfile: profile
      };
    }
    
    // Excessive caps (80%+ caps, 15+ letters)
    const letters = content.replace(/[^a-zA-Z]/g, '');
    const upperCount = (content.match(/[A-Z]/g) || []).length;
    if (letters.length >= 15 && upperCount / letters.length > 0.8) {
      console.log(`[MODERATION] Excessive caps detected`);
      return {
        shouldAct: true,
        action: 'warn',
        severity: 2,
        category: 'caps',
        reason: 'Excessive caps usage',
        confidence: 0.9,
        source: 'pattern',
        userProfile: profile
      };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // STEP 4: Run full AI analysis for subtle toxicity (if available)
    // ─────────────────────────────────────────────────────────────────
    if (this.groqKey && content.length > 10) {
      const context = {
        message: content,
        channelName: message.channel?.name || 'unknown',
        channelType: this.getChannelContext(message.channel?.name),
        userTrustScore: profile.trustScore,
        userWarningCount: profile.warnings.length,
        recentMessages: recentMessages.slice(-3).map(m => ({
          author: m.author?.username || 'unknown',
          content: (m.content || '').slice(0, 80)
        }))
      };
      
      const aiResult = await this.aiFullAnalysis(content, context);
      
      if (aiResult && aiResult.shouldAct) {
        console.log(`[MODERATION] AI detected: ${aiResult.category} - ${aiResult.reason}`);
        return {
          ...aiResult,
          userProfile: profile,
          source: 'ai'
        };
      }
    }
    
    // Nothing detected
    console.log(`[MODERATION] Message is clean`);
    return {
      shouldAct: false,
      action: 'allow',
      severity: 0,
      category: 'safe',
      reason: 'No issues detected',
      confidence: 1,
      source: 'none',
      userProfile: profile
    };
  }
  
  getChannelContext(channelName) {
    if (!channelName) return 'general';
    const name = channelName.toLowerCase();
    if (name.includes('gaming') || name.includes('game') || name.includes('play')) return 'gaming';
    if (name.includes('meme') || name.includes('funny') || name.includes('shitpost')) return 'memes';
    if (name.includes('support') || name.includes('help') || name.includes('ticket')) return 'support';
    if (name.includes('nsfw') || name.includes('adult')) return 'nsfw';
    return 'general';
  }
  
  // AI check specifically for context on detected profanity
  async aiContextCheck(content, context) {
    const systemPrompt = `You are a Discord moderation AI checking if profanity is acceptable in context.

DETECTED WORDS: ${context.detectedWords.join(', ')}

RULES:
- "fuck yeah!" or "holy shit!" as EXCITEMENT = might be OK in gaming/memes channels
- "fuck you" or insults directed at users = NOT OK
- Gaming context like "kill the boss" or "rekt that noob" = usually OK
- If unsure, err on the side of moderation

Respond with JSON:
{
  "shouldAct": boolean,
  "action": "allow"|"warn"|"delete"|"timeout",
  "severity": 0-10,
  "category": "safe"|"profanity"|"toxicity"|"harassment",
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "intent": "excitement"|"frustration"|"insult"|"friendly"|"hostile"|"unknown"
}`;

    const userPrompt = JSON.stringify(context);
    return await this.callAI(systemPrompt, userPrompt, { json: true, maxTokens: 200 });
  }
  
  // Full AI analysis for subtle toxicity
  async aiFullAnalysis(content, context) {
    const systemPrompt = `You are Nova, a Discord moderation AI. Analyze this message for toxicity, harassment, hate, threats, or spam.

Be strict but fair. Consider context.

Respond with JSON:
{
  "shouldAct": boolean,
  "action": "allow"|"warn"|"delete"|"timeout"|"ban",
  "severity": 0-10,
  "category": "safe"|"toxicity"|"harassment"|"hate"|"threat"|"spam"|"scam",
  "confidence": 0.0-1.0,
  "reason": "explanation",
  "sentiment": "positive"|"neutral"|"negative"|"hostile"
}

SEVERITY: 0-2=safe, 3-4=warn, 5-6=delete, 7-8=timeout, 9-10=ban`;

    const userPrompt = JSON.stringify(context);
    return await this.callAI(systemPrompt, userPrompt, { json: true, maxTokens: 250 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICKET AI FEATURES
  // ═══════════════════════════════════════════════════════════════════════════
  
  async categorizeTicket(content) {
    const result = await this.callAI(
      `You categorize support tickets. Categories: general, technical, billing, report, appeal, suggestion, other.
      Respond with JSON: {"category": "...", "priority": "low|medium|high|urgent", "summary": "brief summary"}`,
      `Ticket content: "${content}"`,
      { json: true, maxTokens: 150 }
    );
    return result || { category: 'general', priority: 'medium', summary: content.slice(0, 50) };
  }
  
  async suggestResponse(ticketMessages, category) {
    const conversation = ticketMessages.slice(-10).map(m => 
      `${m.author}: ${m.content}`
    ).join('\n');
    
    const result = await this.callAI(
      `You are a helpful support agent for a Discord server. 
      Category: ${category}
      Generate a helpful, friendly response. Be concise but thorough.`,
      `Conversation:\n${conversation}\n\nSuggest a response:`,
      { maxTokens: 300, temperature: 0.7 }
    );
    
    return result || "Thank you for reaching out! Let me look into this for you.";
  }
  
  async analyzeTicketSentiment(messages) {
    const conversation = messages.slice(-5).map(m => m.content).join(' ');
    
    const result = await this.callAI(
      `Analyze the sentiment and urgency of this support conversation.
      JSON response: {"sentiment": "positive|neutral|frustrated|angry", "urgency": 1-10, "needs_escalation": boolean, "summary": "brief"}`,
      conversation,
      { json: true, maxTokens: 150 }
    );
    
    return result || { sentiment: 'neutral', urgency: 5, needs_escalation: false };
  }
  
  async generateWelcomeMessage(user, serverName) {
    const result = await this.callAI(
      `Generate a friendly welcome message for a new Discord member.
      Server: ${serverName}. Include emojis. Mention !ticket for help. Under 200 chars.`,
      `New member: ${user.username}`,
      { maxTokens: 100, temperature: 0.8 }
    );
    
    return result || `Welcome to ${serverName}, ${user.username}! 🎉 Need help? Type \`!ticket\``;
  }
  
  async summarizeConversation(messages) {
    const conversation = messages.map(m => `${m.author}: ${m.content}`).join('\n');
    return await this.callAI(
      `Summarize this conversation in 2-3 sentences.`,
      conversation,
      { maxTokens: 150 }
    );
  }

  getStats() {
    return {
      enabled: !!this.groqKey,
      profilesTracked: this.userProfiles.size,
      cacheSize: this.cache.size
    };
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                           ULTRA TICKET SYSTEM                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

class TicketSystem {
  constructor(client, ai, io) {
    this.client = client;
    this.ai = ai;
    this.io = io;
    
    this.tickets = new Map();
    this.ticketChannels = new Map();
    this.ticketCounter = 1;
    
    this.stats = { created: 0, closed: 0, responded: 0 };
  }
  
  async createTicket(message, reason) {
    const guild = message.guild;
    const user = message.author;
    
    for (const [id, ticket] of this.tickets) {
      if (ticket.userId === user.id && ticket.guildId === guild.id && ticket.status === 'open') {
        return { success: false, error: 'You already have an open ticket!' };
      }
    }
    
    const aiCategorization = await this.ai.categorizeTicket(reason);
    const ticketId = `TICKET-${String(this.ticketCounter++).padStart(4, '0')}`;
    
    let channel;
    try {
      channel = await guild.channels.create({
        name: `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        type: ChannelType.GuildText,
        topic: `${ticketId} | ${user.tag} | ${aiCategorization.category}`,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });
    } catch (e) {
      console.error('Failed to create ticket channel:', e);
      return { success: false, error: 'Failed to create ticket channel. Check bot permissions.' };
    }
    
    const ticket = {
      id: ticketId,
      oderId: user.id,
      userId: user.id,
      username: user.tag,
      avatar: user.displayAvatarURL(),
      channelId: channel.id,
      guildId: guild.id,
      reason: reason,
      category: aiCategorization.category,
      priority: aiCategorization.priority,
      summary: aiCategorization.summary,
      status: 'open',
      claimedBy: null,
      claimedByName: null,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      sentiment: 'neutral'
    };
    
    this.tickets.set(ticketId, ticket);
    this.ticketChannels.set(channel.id, ticketId);
    
    this.addMessage(ticketId, {
      author: user.tag,
      authorId: user.id,
      content: reason,
      isStaff: false,
      timestamp: Date.now()
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🎫 ${ticketId}`)
      .setDescription(`Thank you for creating a ticket, ${user}!`)
      .addFields(
        { name: '📁 Category', value: aiCategorization.category, inline: true },
        { name: '🔥 Priority', value: aiCategorization.priority, inline: true },
        { name: '📝 Reason', value: reason.slice(0, 500) }
      )
      .setFooter({ text: 'A staff member will assist you shortly!' })
      .setTimestamp();
    
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`close_${ticketId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId(`claim_${ticketId}`).setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('✋')
    );
    
    await channel.send({ embeds: [embed], components: [buttons] });
    
    this.stats.created++;
    this.emitUpdate();
    
    return { success: true, ticket, channel };
  }
  
  addMessage(ticketId, messageData) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return;
    
    const msg = {
      id: crypto.randomUUID(),
      author: messageData.author,
      authorId: messageData.authorId,
      content: messageData.content,
      isStaff: messageData.isStaff || false,
      fromDashboard: messageData.fromDashboard || false,
      timestamp: messageData.timestamp || Date.now()
    };
    
    ticket.messages.push(msg);
    ticket.updatedAt = Date.now();
    this.emitUpdate();
    return msg;
  }
  
  async sendMessageFromDashboard(ticketId, content, staffName) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.status !== 'open') return { success: false };
    
    const channel = this.client.channels.cache.get(ticket.channelId);
    if (!channel) return { success: false, error: 'Channel not found' };
    
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({ name: `${staffName} (Staff)`, iconURL: this.client.user.displayAvatarURL() })
      .setDescription(content)
      .setTimestamp();
    
    try {
      await channel.send({ embeds: [embed] });
    } catch (e) {
      return { success: false, error: 'Failed to send message' };
    }
    
    this.addMessage(ticketId, {
      author: staffName,
      authorId: 'dashboard',
      content,
      isStaff: true,
      fromDashboard: true
    });
    
    this.stats.responded++;
    return { success: true };
  }
  
  async claimTicket(ticketId, staffId, staffName) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return { success: false };
    
    ticket.claimedBy = staffId;
    ticket.claimedByName = staffName;
    ticket.updatedAt = Date.now();
    
    const channel = this.client.channels.cache.get(ticket.channelId);
    if (channel) {
      await channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`✋ This ticket has been claimed by **${staffName}**`)
        ]
      });
    }
    
    this.emitUpdate();
    return { success: true };
  }
  
  async closeTicket(ticketId, closedBy) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return { success: false };
    
    ticket.status = 'closed';
    ticket.closedAt = Date.now();
    ticket.closedBy = closedBy;
    
    if (ticket.messages.length > 2) {
      ticket.aiSummary = await this.ai.summarizeConversation(ticket.messages);
    }
    
    const channel = this.client.channels.cache.get(ticket.channelId);
    if (channel) {
      await channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔒 Ticket Closed')
          .setDescription(`Closed by **${closedBy}**. Channel deletes in 10s.`)
          .addFields(ticket.aiSummary ? { name: '📋 Summary', value: ticket.aiSummary } : { name: '\u200b', value: '\u200b' })
        ]
      });
      
      setTimeout(() => {
        channel.delete().catch(() => {});
        this.ticketChannels.delete(ticket.channelId);
      }, 10000);
    }
    
    this.stats.closed++;
    this.emitUpdate();
    return { success: true };
  }
  
  async getSuggestedResponse(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return null;
    return await this.ai.suggestResponse(ticket.messages, ticket.category);
  }
  
  getTickets(filter = 'all') {
    const tickets = Array.from(this.tickets.values());
    switch (filter) {
      case 'open': return tickets.filter(t => t.status === 'open');
      case 'closed': return tickets.filter(t => t.status === 'closed');
      case 'unclaimed': return tickets.filter(t => t.status === 'open' && !t.claimedBy);
      default: return tickets;
    }
  }
  
  getTicket(ticketId) { return this.tickets.get(ticketId); }
  
  emitUpdate() {
    if (this.io) {
      this.io.emit('ticketsUpdate', { tickets: this.getTickets('open'), stats: this.stats });
    }
  }
  
  getStats() {
    return { ...this.stats, open: this.getTickets('open').length, total: this.tickets.size };
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
    
    this.ai = new NovaUltraAI();
    this.tickets = new TicketSystem(this.client, this.ai, io);
    
    this.logs = [];
    this.recentMessages = new Map();
    
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
      muteDuration: 10,
      spamMessages: 5,
      welcomeMessages: true,
      aiWelcome: true,
      ticketsEnabled: true
    };
    
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
    if (this.logs.length > 200) this.logs.shift();
    if (this.io) this.io.emit('newLog', entry);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
  
  emitStats() {
    if (!this.io) return;
    this.io.emit('stats', {
      ...this.stats,
      tickets: this.tickets.getStats(),
      guilds: this.client.guilds?.cache.size || 0,
      users: this.client.guilds?.cache.reduce((a, g) => a + (g.memberCount || 0), 0) || 0,
      ping: this.client.ws.ping,
      uptime: this.client.uptime,
      ai: this.ai.getStats()
    });
  }

  trackRecentMessages(message) {
    const channelId = message.channel.id;
    if (!this.recentMessages.has(channelId)) {
      this.recentMessages.set(channelId, []);
    }
    const messages = this.recentMessages.get(channelId);
    messages.push({ author: message.author, content: message.content, timestamp: Date.now() });
    if (messages.length > 20) messages.shift();
    return messages;
  }

  setupEvents() {
    this.client.once(Events.ClientReady, () => {
      console.log(`\n╔════════════════════════════════════════════════════════╗`);
      console.log(`║  🤖 ${this.client.user.tag} is ONLINE!`);
      console.log(`║  🧠 Ultra AI: ${this.ai.groqKey ? 'ENABLED' : 'DISABLED'}`);
      console.log(`║  🎫 Tickets: ENABLED`);
      console.log(`║  📊 Servers: ${this.client.guilds.cache.size}`);
      console.log(`╚════════════════════════════════════════════════════════╝\n`);
      this.log('Nova Ultra Bot started!', 'success');
      this.emitStats();
    });

    this.client.on(Events.GuildMemberAdd, async (member) => {
      if (!this.settings.welcomeMessages) return;
      
      const welcomeChannel = member.guild.channels.cache.find(c => 
        c.name.includes('welcome') || c.name.includes('general')
      );
      
      if (welcomeChannel) {
        let welcomeMsg;
        if (this.settings.aiWelcome && this.ai.groqKey) {
          welcomeMsg = await this.ai.generateWelcomeMessage(member.user, member.guild.name);
        } else {
          welcomeMsg = `Welcome to ${member.guild.name}, ${member}! 🎉 Need help? Type \`!ticket\``;
        }
        
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('👋 Welcome!')
          .setDescription(welcomeMsg)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();
        
        try { await welcomeChannel.send({ embeds: [embed] }); this.log(`Welcomed ${member.user.tag}`, 'join'); } catch {}
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;
      
      const [action, ticketId] = interaction.customId.split('_');
      
      if (action === 'close') {
        await this.tickets.closeTicket(ticketId, interaction.user.tag);
        await interaction.reply({ content: '🔒 Ticket closed!', ephemeral: true });
      } else if (action === 'claim') {
        await this.tickets.claimTicket(ticketId, interaction.user.id, interaction.user.tag);
        await interaction.reply({ content: '✋ You claimed this ticket!', ephemeral: true });
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || !message.guild) return;
      
      const content = message.content || '';
      const lower = content.toLowerCase();
      
      const recentMsgs = this.trackRecentMessages(message);
      
      // TICKET SYSTEM
      const ticketId = this.tickets.ticketChannels.get(message.channel.id);
      if (ticketId) {
        const ticket = this.tickets.getTicket(ticketId);
        if (ticket && ticket.status === 'open') {
          this.tickets.addMessage(ticketId, {
            author: message.author.tag,
            authorId: message.author.id,
            content: content,
            isStaff: message.member?.permissions.has(PermissionFlagsBits.ManageMessages) || false
          });
          
          if (ticket.messages.length % 5 === 0 && this.ai.groqKey) {
            const sentiment = await this.ai.analyzeTicketSentiment(ticket.messages);
            ticket.sentiment = sentiment.sentiment;
            if (sentiment.needs_escalation) {
              this.log(`⚠️ Ticket ${ticketId} may need escalation`, 'warning');
            }
          }
        }
        return;
      }
      
      // COMMANDS
      if (lower.startsWith('!ticket')) {
        if (!this.settings.ticketsEnabled) return message.reply('❌ Tickets disabled.');
        const reason = content.slice(7).trim() || 'No reason provided';
        const result = await this.tickets.createTicket(message, reason);
        if (result.success) {
          await message.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ Ticket created! Check ${result.channel}`)] });
          this.log(`🎫 Ticket created by ${message.author.tag}: ${result.ticket.id}`, 'success');
        } else {
          await message.reply(`❌ ${result.error}`);
        }
        return;
      }
      
      if (lower === '!help') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🤖 Nova Ultra Bot')
          .addFields(
            { name: '🎫 !ticket [reason]', value: 'Create a support ticket' },
            { name: '📊 !stats', value: 'View moderation stats' },
            { name: '🧠 !analyze [text]', value: 'AI analyzes text' }
          );
        return message.reply({ embeds: [embed] });
      }
      
      if (lower === '!stats') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📊 Nova Statistics')
          .addFields(
            { name: '🔍 Scanned', value: `${this.stats.messagesScanned}`, inline: true },
            { name: '🗑️ Deleted', value: `${this.stats.messagesDeleted}`, inline: true },
            { name: '⚠️ Warnings', value: `${this.stats.warningsGiven}`, inline: true },
            { name: '🧠 AI Actions', value: `${this.stats.aiDetections}`, inline: true },
            { name: '🎫 Tickets', value: `${this.tickets.getStats().open}`, inline: true }
          );
        return message.reply({ embeds: [embed] });
      }
      
      if (lower.startsWith('!analyze ')) {
        const text = content.slice(9);
        const result = await this.ai.analyzeMessage({ ...message, content: text }, []);
        const embed = new EmbedBuilder()
          .setColor(result.severity >= 7 ? 0xED4245 : result.severity >= 4 ? 0xFEE75C : 0x57F287)
          .setTitle('🧠 AI Analysis')
          .addFields(
            { name: 'Category', value: result.category || 'safe', inline: true },
            { name: 'Severity', value: `${result.severity || 0}/10`, inline: true },
            { name: 'Action', value: result.action || 'allow', inline: true },
            { name: 'Reason', value: result.reason || 'No issues' }
          );
        return message.reply({ embeds: [embed] });
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // MODERATION - This is where the magic happens!
      // ═══════════════════════════════════════════════════════════════════
      
      if (!this.settings.enabled) return;
      if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
      
      this.stats.messagesScanned++;
      
      try {
        const analysis = await this.ai.analyzeMessage(message, recentMsgs);
        
        if (analysis.shouldAct) {
          console.log(`[ACTION] Taking action: ${analysis.action} for ${message.author.tag}`);
          await this.takeAction(message, analysis);
        }
        
        this.emitStats();
      } catch (error) {
        console.error('Moderation error:', error);
      }
    });
  }
  
  async takeAction(message, analysis) {
    const member = message.member;
    const userId = message.author.id;
    const profile = analysis.userProfile || this.ai.getProfile(userId);
    
    // Update stats
    if (analysis.source === 'ai' || analysis.source === 'ai_override') this.stats.aiDetections++;
    if (analysis.category === 'spam') this.stats.spamBlocked++;
    if (['profanity', 'slur', 'toxicity'].includes(analysis.category)) this.stats.badWordsBlocked++;
    if (analysis.category === 'invite') this.stats.invitesBlocked++;
    
    // Delete message
    const shouldDelete = this.settings.deleteMessages && 
      ['delete', 'timeout', 'kick', 'ban'].includes(analysis.action);
    
    if (shouldDelete && message.deletable) {
      try { await message.delete(); this.stats.messagesDeleted++; } catch {}
    }
    
    // Add warning
    if (['warn', 'delete'].includes(analysis.action)) {
      profile.warnings.push({ reason: analysis.reason, severity: analysis.severity, timestamp: Date.now() });
      this.stats.warningsGiven++;
      this.ai.updateTrust(userId, -5, analysis.reason);
    }
    
    // DM User
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(analysis.severity >= 8 ? 0xED4245 : analysis.severity >= 5 ? 0xFEE75C : 0xFAA61A)
        .setTitle('🛡️ Nova Moderation Notice')
        .setDescription(`Your message in **${message.guild.name}** was flagged.`)
        .addFields(
          { name: 'Reason', value: analysis.reason },
          { name: 'Severity', value: `${analysis.severity}/10`, inline: true },
          { name: 'Action', value: analysis.action, inline: true },
          { name: 'Warnings', value: `${profile.warnings.length}/${this.settings.maxWarnings}`, inline: true }
        );
      
      if (analysis.detectedWords?.length) {
        dmEmbed.addFields({ name: 'Detected', value: analysis.detectedWords.join(', ') });
      }
      
      await message.author.send({ embeds: [dmEmbed] });
    } catch {}
    
    // Timeout
    const shouldTimeout = analysis.action === 'timeout' || 
      (this.settings.autoMute && profile.warnings.length >= this.settings.maxWarnings);
    
    if (shouldTimeout && member?.moderatable) {
      const duration = this.settings.muteDuration * 60 * 1000 * Math.min(3, Math.ceil(profile.warnings.length / 3));
      try { await member.timeout(duration, analysis.reason); this.stats.mutesDone++; this.log(`🔇 Muted ${message.author.tag} for ${duration / 60000}m`, 'moderation'); } catch {}
    }
    
    // Ban
    if (analysis.action === 'ban' && member?.bannable) {
      try { await member.ban({ reason: analysis.reason }); this.stats.banned++; this.log(`🔨 Banned ${message.author.tag}`, 'moderation'); } catch {}
    }
    
    // Channel notice
    try {
      const notice = await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(analysis.severity >= 7 ? 0xED4245 : 0xFEE75C)
          .setAuthor({ name: 'Nova Guardian', iconURL: this.client.user.displayAvatarURL() })
          .setDescription(`${message.author} - ${analysis.reason}`)
          .setFooter({ text: `${analysis.source === 'ai' ? '🧠 AI' : '⚡ Pattern'} | Severity: ${analysis.severity}/10` })
        ]
      });
      setTimeout(() => notice.delete().catch(() => {}), 8000);
    } catch {}
    
    this.log(`🛡️ ${message.author.tag} → ${analysis.action.toUpperCase()} | ${analysis.reason}`, 'moderation');
  }
  
  async start(token) { await this.client.login(token); }
  
  getStats() {
    return {
      ...this.stats,
      tickets: this.tickets.getStats(),
      guilds: this.client.guilds?.cache.size || 0,
      users: this.client.guilds?.cache.reduce((a, g) => a + (g.memberCount || 0), 0) || 0,
      ping: this.client.ws.ping,
      uptime: this.client.uptime,
      ai: this.ai.getStats()
    };
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════╗
// ║                              SERVER & API                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════╝

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const bot = new NovaBot(io);

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.get('/api/stats', (req, res) => res.json(bot.getStats()));
app.get('/api/settings', (req, res) => res.json(bot.settings));
app.post('/api/settings', (req, res) => {
  bot.settings = { ...bot.settings, ...req.body };
  io.emit('settings', bot.settings);
  res.json(bot.settings);
});
app.get('/api/logs', (req, res) => res.json(bot.logs));

app.get('/api/tickets', (req, res) => res.json(bot.tickets.getTickets(req.query.filter)));
app.get('/api/tickets/:id', (req, res) => {
  const ticket = bot.tickets.getTicket(req.params.id);
  if (ticket) res.json(ticket);
  else res.status(404).json({ error: 'Not found' });
});
app.post('/api/tickets/:id/message', async (req, res) => {
  const result = await bot.tickets.sendMessageFromDashboard(req.params.id, req.body.content, req.body.staffName || 'Staff');
  res.json(result);
});
app.post('/api/tickets/:id/close', async (req, res) => {
  res.json(await bot.tickets.closeTicket(req.params.id, req.body.closedBy || 'Dashboard'));
});
app.post('/api/tickets/:id/claim', async (req, res) => {
  res.json(await bot.tickets.claimTicket(req.params.id, 'dashboard', req.body.staffName || 'Staff'));
});
app.get('/api/tickets/:id/suggest', async (req, res) => {
  res.json({ suggestion: await bot.tickets.getSuggestedResponse(req.params.id) });
});

io.on('connection', (socket) => {
  console.log('📊 Dashboard connected');
  socket.emit('stats', bot.getStats());
  socket.emit('settings', bot.settings);
  socket.emit('logs', bot.logs);
  socket.emit('ticketsUpdate', { tickets: bot.tickets.getTickets('open'), stats: bot.tickets.getStats() });
  
  socket.on('updateSettings', (patch) => { bot.settings = { ...bot.settings, ...patch }; io.emit('settings', bot.settings); });
  socket.on('getTickets', (filter) => { socket.emit('ticketsUpdate', { tickets: bot.tickets.getTickets(filter), stats: bot.tickets.getStats() }); });
  socket.on('sendTicketMessage', async ({ ticketId, content, staffName }) => { await bot.tickets.sendMessageFromDashboard(ticketId, content, staffName); });
  socket.on('closeTicket', async ({ ticketId, closedBy }) => { await bot.tickets.closeTicket(ticketId, closedBy); });
  socket.on('claimTicket', async ({ ticketId, staffId, staffName }) => { await bot.tickets.claimTicket(ticketId, staffId, staffName); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`\n🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`📋 DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`📋 GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`📋 Node Version: ${process.version}\n`);
  
  if (process.env.DISCORD_TOKEN) await bot.start(process.env.DISCORD_TOKEN);
  else console.log('⚠️ No DISCORD_TOKEN');
});