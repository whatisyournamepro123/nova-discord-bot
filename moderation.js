// moderation.js
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const crypto = require('crypto');

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.trunc(x))) : fallback;
}

function clampNum(n, min, max, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
}

function now() { return Date.now(); }

function normalizeForMatch(input) {
  const s = (input || "")
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase();

  // crude leetspeak normalization + strip separators
  return s
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sha1(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

function extractUrls(text) {
  const t = text || '';
  const re = /((https?:\/\/|www\.)[^\s<>()]+)|([a-z0-9-]+\.[a-z]{2,}(\/[^\s<>()]*)?)/gi;
  const hits = t.match(re) || [];
  // Filter obvious false positives by requiring at least a dot and no spaces (already)
  return hits.slice(0, 8);
}

function getHostname(raw) {
  try {
    const u = raw.startsWith('http') ? new URL(raw) : new URL('https://' + raw);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function countUppercaseRatio(text) {
  const s = text || '';
  let letters = 0;
  let upper = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (!isLetter) continue;
    letters++;
    if (code >= 65 && code <= 90) upper++;
  }
  if (letters === 0) return { ratio: 0, letters: 0 };
  return { ratio: upper / letters, letters };
}

function hasZalgo(text) {
  return /[\u0300-\u036f\u0489]/.test(text || '');
}

function countEmojis(text) {
  const s = text || '';
  let custom = (s.match(/<a?:\w{2,32}:\d{17,20}>/g) || []).length;
  let unicode = 0;

  // Unicode property escapes can fail in some environments; guard it.
  try {
    unicode = (s.match(/\p{Extended_Pictographic}/gu) || []).length;
  } catch {
    // fallback: very rough
    unicode = (s.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
  }
  return custom + unicode;
}

// Simple token bucket limiter (per guild) for AI calls
class TokenBucket {
  constructor({ capacity, refillPerMs }) {
    this.capacity = capacity;
    this.refillPerMs = refillPerMs;
    this.tokens = capacity;
    this.last = now();
  }
  take(n = 1) {
    const t = now();
    const elapsed = t - this.last;
    this.last = t;

    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }
}

class UltraModeration {
  constructor(client, ai, io = null) {
    this.client = client;
    this.ai = ai;
    this.io = io;

    // Rolling behavior state
    this.userMsgTimes = new Map();      // key guild:user -> [timestamps]
    this.userLastHashes = new Map();    // key guild:user -> [{hash, ts}]
    this.userWarnings = new Map();      // key guild:user -> {count, lastTs}

    // AI cache (avoid re-analyzing identical content)
    this.aiCache = new Map();           // key guild:hash -> {ts, decision}
    this.aiCacheMs = 20 * 60 * 1000;

    // AI limiter per guild
    this.aiBuckets = new Map();         // guildId -> TokenBucket

    // Dashboard-ish stats
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
      invitesBlocked: 0,
    };

    // Default settings (match your dashboard element IDs)
    this.defaultSettings = {
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
      muteDuration: 10,      // minutes
      spamMessages: 5,       // msgs per window

      // Advanced knobs (not in dashboard yet, but safe defaults)
      spamWindowMs: 7000,
      maxMentions: 5,
      maxEmojiPerMsg: 18,
      capsRatio: 0.72,
      minCapsLetters: 12,
      warningDecayMs: 6 * 60 * 60 * 1000, // 6h

      // Links
      allowDomains: [
        'discord.com',
        'discord.gg', // if you want to allow some invites, handle separately
        'tenor.com',
        'giphy.com',
        'youtube.com',
        'youtu.be',
        'twitch.tv'
      ],

      // Invites
      allowInvites: false, // stronger than your old antiInvite
      allowInviteInChannelIds: [],

      // Bypass/ignore
      bypassRoleIds: [],
      ignoredChannelIds: [],

      // Logging
      logChannelName: 'mod-logs',

      // AI limiter
      aiCallsPerMinute: 20,
      aiMinHeuristicScore: 35, // don’t call AI for clearly safe messages
    };

    this.guildSettings = new Map(); // guildId -> overrides

    // Basic “bad words” (keep it generic; extend in your own config if desired)
    // NOTE: This is intentionally not a huge slur list. AI covers nuance.
    this.badWordPatterns = [
      /\b(f+u+c+k+)\b/i,
      /\b(s+h+i+t+)\b/i,
      /\b(b+i+t+c+h+)\b/i,
      /\b(a+s+s+h+o+l+e+)\b/i,
      /\b(stfu)\b/i,
      /\b(kys)\b/i,                // self-harm shorthand
      /\b(kill\s+yourself)\b/i,    // self-harm phrase
    ];

    // scam-ish phrases
    this.scamPatterns = [
      /free\s*nitro/i,
      /steam\s*gift/i,
      /gift\s*card/i,
      /claim\s*now/i,
      /click\s*here/i,
    ];
  }

  getSettings(guildId) {
    const overrides = guildId ? (this.guildSettings.get(guildId) || {}) : {};
    const merged = { ...this.defaultSettings, ...overrides };

    // clamp the important numbers
    merged.maxWarnings = clampInt(merged.maxWarnings, 1, 10, 3);
    merged.muteDuration = clampInt(merged.muteDuration, 1, 1440, 10);
    merged.spamMessages = clampInt(merged.spamMessages, 3, 30, 5);
    merged.spamWindowMs = clampInt(merged.spamWindowMs, 2000, 30000, 7000);
    merged.maxMentions = clampInt(merged.maxMentions, 1, 25, 5);
    merged.aiCallsPerMinute = clampInt(merged.aiCallsPerMinute, 0, 120, 20);
    merged.aiMinHeuristicScore = clampInt(merged.aiMinHeuristicScore, 0, 100, 35);

    merged.capsRatio = clampNum(merged.capsRatio, 0.5, 0.95, 0.72);
    merged.minCapsLetters = clampInt(merged.minCapsLetters, 6, 50, 12);

    return merged;
  }

  // Dashboard can call this (global defaults)
  updateDefaultSettings(patch = {}) {
    this.defaultSettings = { ...this.defaultSettings, ...patch };
    this.emitSettings();
    return this.defaultSettings;
  }

  // Optional per-guild override if you later add guild selector on dashboard
  updateGuildSettings(guildId, patch = {}) {
    const cur = this.guildSettings.get(guildId) || {};
    this.guildSettings.set(guildId, { ...cur, ...patch });
    this.emitSettings(guildId);
    return this.getSettings(guildId);
  }

  emitStats() {
    if (!this.io) return;
    this.io.emit('stats', {
      ...this.stats,
      ai: this.ai?.getStats?.() || { enabled: false },
      guilds: this.client.guilds?.cache.size || 0,
      users: this.client.guilds?.cache.reduce((a, g) => a + (g.memberCount || 0), 0) || 0,
      ping: this.client.ws.ping,
      uptime: this.client.uptime,
    });
  }

  emitSettings(guildId = null) {
    if (!this.io) return;
    // Dashboard currently expects one settings object; we send defaults.
    // If you later add guild picker, you can send per-guild.
    const settings = this.getSettings(guildId || (this.client.guilds?.cache.first()?.id));
    this.io.emit('settings', settings);
  }

  pushLog(message, type = 'info') {
    if (!this.io) return;
    this.io.emit('newLog', { message, type, timestamp: new Date().toISOString() });
  }

  getStats() {
    return { ...this.stats };
  }

  getDefaultSettings() {
    return this.getSettings(null);
  }

  _bucketForGuild(guildId, settings) {
    if (!guildId) return new TokenBucket({ capacity: 1, refillPerMs: 0 });
    if (!this.aiBuckets.has(guildId)) {
      const cap = settings.aiCallsPerMinute;
      const refillPerMs = cap / 60000;
      this.aiBuckets.set(guildId, new TokenBucket({ capacity: cap, refillPerMs }));
    }
    return this.aiBuckets.get(guildId);
  }

  _getWarnKey(message) {
    return `${message.guild.id}:${message.author.id}`;
  }

  _getWarnState(message, settings) {
    const k = this._getWarnKey(message);
    const st = this.userWarnings.get(k);
    if (!st) return { count: 0, lastTs: 0 };

    // decay
    if (now() - st.lastTs > settings.warningDecayMs) {
      return { count: 0, lastTs: 0 };
    }
    return st;
  }

  _setWarnState(message, count) {
    const k = this._getWarnKey(message);
    this.userWarnings.set(k, { count, lastTs: now() });
  }

  _trackSpam(message, settings) {
    const k = `${message.guild.id}:${message.author.id}`;
    const arr = this.userMsgTimes.get(k) || [];
    const t = now();
    const recent = arr.filter(x => t - x < settings.spamWindowMs);
    recent.push(t);
    this.userMsgTimes.set(k, recent);
    return recent.length;
  }

  _trackDuplicates(message) {
    const k = `${message.guild.id}:${message.author.id}`;
    const t = now();
    const norm = normalizeForMatch(message.content || '');
    const h = sha1(norm);

    const list = (this.userLastHashes.get(k) || []).filter(x => t - x.ts < 60_000);
    list.push({ hash: h, ts: t });
    this.userLastHashes.set(k, list);

    const same = list.filter(x => x.hash === h).length;
    return { hash: h, sameCountLastMinute: same, normalized: norm };
  }

  _isBypassed(message, settings) {
    const member = message.member;
    if (!member) return true; // fail-safe: if no member object, don't act
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (settings.bypassRoleIds?.length) {
      if (member.roles.cache.some(r => settings.bypassRoleIds.includes(r.id))) return true;
    }
    if (settings.ignoredChannelIds?.includes(message.channel.id)) return true;
    return false;
  }

  _inviteDetected(content) {
    return /(discord\.(gg|io|me|li)\/\S+|discord(app)?\.com\/invite\/\S+)/i.test(content || '');
  }

  _heuristicDecision(message, settings) {
    const content = message.content || '';
    const norm = normalizeForMatch(content);

    let score = 0;
    const triggers = [];

    // Mention spam
    const mentionCount =
      (message.mentions?.users?.size || 0) +
      (message.mentions?.roles?.size || 0) +
      (message.mentions?.everyone ? 10 : 0);

    if (mentionCount > settings.maxMentions) {
      score += 90;
      triggers.push(`mass_mentions:${mentionCount}`);
    }

    // Invites
    const hasInvite = this._inviteDetected(content);
    const inviteAllowed = settings.allowInvites ||
      settings.allowInviteInChannelIds?.includes(message.channel.id);

    if (settings.detectInvites && hasInvite && !inviteAllowed) {
      score += 80;
      triggers.push('invite');
    }

    // Links
    const urls = extractUrls(content);
    if (settings.detectLinks && urls.length) {
      // block if any hostname not allowlisted
      const bad = [];
      for (const u of urls) {
        const host = getHostname(u);
        if (!host) continue;
        const allowed = (settings.allowDomains || []).some(d => host === d || host.endsWith('.' + d));
        if (!allowed) bad.push(host);
      }
      if (bad.length) {
        score += 60;
        triggers.push(`links:${bad.slice(0, 3).join(',')}`);
      }
    }

    // Caps
    if (settings.detectCaps) {
      const { ratio, letters } = countUppercaseRatio(content);
      if (letters >= settings.minCapsLetters && ratio >= settings.capsRatio) {
        score += 35;
        triggers.push(`caps:${Math.round(ratio * 100)}%`);
      }
    }

    // Zalgo / corrupted text
    if (hasZalgo(content)) {
      score += 25;
      triggers.push('zalgo');
    }

    // Emoji spam
    const emojiCount = countEmojis(content);
    if (emojiCount >= settings.maxEmojiPerMsg) {
      score += 30;
      triggers.push(`emoji_spam:${emojiCount}`);
    }

    // Bad words / self-harm phrases
    if (settings.detectBadWords) {
      const hit = this.badWordPatterns.find(r => r.test(norm));
      if (hit) {
        score += 55;
        triggers.push('bad_words');
      }
    }

    // Scams
    const scamHit = this.scamPatterns.find(r => r.test(content));
    if (scamHit) {
      score += 45;
      triggers.push('scam_phrase');
    }

    // Spam behavior (burst + duplicates)
    let spamBurstCount = 0;
    if (settings.detectSpam) {
      spamBurstCount = this._trackSpam(message, settings);
      if (spamBurstCount > settings.spamMessages) {
        score += 65;
        triggers.push(`spam_burst:${spamBurstCount}/${settings.spamMessages}`);
      }

      const dup = this._trackDuplicates(message);
      if (dup.normalized.length >= 6 && dup.sameCountLastMinute >= 3) {
        score += 55;
        triggers.push(`duplicate:${dup.sameCountLastMinute}x`);
      }
    } else {
      // still track duplicates lightly (avoid memory growing unbounded)
      this._trackDuplicates(message);
    }

    // Suggested action from heuristics
    let action = "allow";
    let severity = 0;
    let reason = "ok";

    if (score >= 90) {
      action = "timeout";
      severity = 8;
      reason = triggers.includes('invite') ? 'Unauthorized invite or severe spam' : 'Severe rule violation';
    } else if (score >= 65) {
      action = "delete";
      severity = 6;
      reason = 'Spam/unsafe content signals';
    } else if (score >= 35) {
      action = "warn";
      severity = 4;
      reason = 'Potentially disruptive content';
    }

    return { score, triggers, action, severity, reason, urls };
  }

  _shouldCallAI(message, settings, heuristic) {
    if (!settings.useAI) return false;
    if (!this.ai?.moderateDecision) return false;

    // Don’t call AI for empty or trivial
    const content = message.content || '';
    if (content.trim().length < 2) return false;

    // Only call AI when heuristics suggest risk
    if (heuristic.score < settings.aiMinHeuristicScore) return false;

    // Also call AI for “contexty” cases (e.g., threats/self-harm words)
    const norm = normalizeForMatch(content);
    if (/\b(kys|kill yourself|suicide)\b/i.test(norm)) return true;

    return true;
  }

  async scanMessage(message) {
    if (!message.guild || message.author.bot) return;

    const settings = this.getSettings(message.guild.id);
    if (!settings.enabled) return;
    if (!message.member) return;
    if (this._isBypassed(message, settings)) return;

    this.stats.messagesScanned++;

    const heuristic = this._heuristicDecision(message, settings);

    // AI (cached + rate-limited)
    let aiDecision = null;
    if (this._shouldCallAI(message, settings, heuristic)) {
      const contentNorm = normalizeForMatch(message.content || '');
      const cacheKey = `${message.guild.id}:${sha1(contentNorm)}`;

      const cached = this.aiCache.get(cacheKey);
      if (cached && (now() - cached.ts) < this.aiCacheMs) {
        aiDecision = cached.decision;
      } else {
        const bucket = this._bucketForGuild(message.guild.id, settings);
        if (bucket.take(1)) {
          const warnState = this._getWarnState(message, settings);
          const recent = await this._getRecentChannelMessages(message, 6);

          aiDecision = await this.ai.moderateDecision(message.content || '', {
            guildName: message.guild.name,
            channelName: message.channel?.name,
            authorTag: message.author.tag,
            authorIsNew: this._isNewAccountOrJoin(message),
            recentMessages: recent,
            userWarnings: warnState.count,
          });

          if (aiDecision) {
            this.aiCache.set(cacheKey, { ts: now(), decision: aiDecision });
          }
        }
      }
    }

    const final = this._mergeDecisions(settings, heuristic, aiDecision);

    if (final.action !== "allow") {
      await this._applyAction(message, settings, final);
    }

    this.emitStats();
  }

  _isNewAccountOrJoin(message) {
    const m = message.member;
    if (!m) return false;
    const joinedMs = m.joinedTimestamp ? (now() - m.joinedTimestamp) : Infinity;
    const acctMs = message.author.createdTimestamp ? (now() - message.author.createdTimestamp) : Infinity;
    // "new" = joined < 24h OR account < 7d
    return joinedMs < 24 * 60 * 60 * 1000 || acctMs < 7 * 24 * 60 * 60 * 1000;
  }

  async _getRecentChannelMessages(message, limit = 6) {
    try {
      const msgs = await message.channel.messages.fetch({ limit });
      // oldest -> newest (except current message might be in there)
      return Array.from(msgs.values())
        .reverse()
        .filter(m => m.id !== message.id)
        .slice(-5)
        .map(m => ({
          author: m.author?.tag || 'unknown',
          content: (m.content || '').slice(0, 160),
        }));
    } catch {
      return [];
    }
  }

  _mergeDecisions(settings, heuristic, aiDecision) {
    // Start from heuristics
    let action = heuristic.action;
    let severity = heuristic.severity;
    let reason = `[Heuristic] ${heuristic.reason} (${heuristic.triggers.join(', ') || 'none'})`;
    let usedAI = false;

    if (aiDecision && aiDecision.flagged) {
      usedAI = true;
      this.stats.aiDetections++;

      // If AI confidence is low and heuristic is mild, don't over-punish
      const aiStrong = aiDecision.confidence >= 0.65 || aiDecision.severity >= 7;

      // Take the stronger action, but avoid instant ban unless high confidence/severity
      const rank = { allow: 0, warn: 1, delete: 2, timeout: 3, kick: 4, ban: 5 };
      let aiAction = aiDecision.action;

      if (aiAction === 'ban' && !(aiDecision.confidence >= 0.8 && aiDecision.severity >= 8)) {
        aiAction = 'timeout'; // safer default
      }

      const pick =
        (aiStrong && rank[aiAction] > rank[action]) ? aiAction :
        (rank[action] >= rank[aiAction]) ? action :
        aiAction;

      action = pick;
      severity = Math.max(severity, aiDecision.severity);
      reason = `[AI] ${aiDecision.category} (sev ${aiDecision.severity}, conf ${aiDecision.confidence}) — ${aiDecision.reason}`
        + ` | [Heuristic score ${heuristic.score}] ${heuristic.triggers.join(', ') || 'none'}`;
    }

    // Convert "delete" into "delete + warn" behavior if warnUsers is on
    // The apply step will handle warnings/escalation.

    return { action, severity, reason, usedAI, triggers: heuristic.triggers };
  }

  _timeoutMs(settings, warnCount) {
    // Escalate timeout duration with repeated warnings
    const base = settings.muteDuration * 60 * 1000;
    const mult = Math.min(4, 1 + Math.max(0, warnCount - 1) * 0.5); // 1.0, 1.5, 2.0, 2.5, 3.0...
    return Math.round(base * mult);
  }

  async _applyAction(message, settings, decision) {
    const member = message.member;
    if (!member) return;

    const wantDelete = settings.deleteMessages && (decision.action === 'delete' || decision.action === 'timeout' || decision.action === 'kick' || decision.action === 'ban');
    const wantWarn = settings.warnUsers && (decision.action === 'warn' || decision.action === 'delete' || decision.action === 'timeout' || decision.action === 'kick' || decision.action === 'ban');

    // Track category stats from heuristic triggers (fast counters)
    if (decision.triggers?.some(t => t.startsWith('spam_') || t.startsWith('duplicate'))) this.stats.spamBlocked++;
    if (decision.triggers?.includes('invite')) this.stats.invitesBlocked++;
    if (decision.triggers?.includes('bad_words')) this.stats.badWordsBlocked++;
    if (decision.triggers?.some(t => t.startsWith('links:'))) this.stats.linksBlocked++;

    // Delete message
    if (wantDelete && message.deletable) {
      try {
        await message.delete();
        this.stats.messagesDeleted++;
      } catch {}
    }

    // Warnings & escalation
    const warnState = this._getWarnState(message, settings);
    let newWarns = warnState.count;

    if (wantWarn) {
      newWarns++;
      this._setWarnState(message, newWarns);
      this.stats.warningsGiven++;
      await this._dmUserNotice(message, decision, newWarns, settings).catch(() => {});
    }

    // Escalate to timeout if needed
    // - If decision says timeout OR user reached maxWarnings
    let doTimeout = decision.action === 'timeout' || (settings.autoMute && newWarns >= settings.maxWarnings);
    if (doTimeout && member.moderatable) {
      const ms = this._timeoutMs(settings, newWarns);
      try {
        await member.timeout(ms, decision.reason || 'AutoMod');
        this.stats.mutesDone++;
        // reset warnings after timeout to avoid perma escalation loops
        this._setWarnState(message, 0);
      } catch {}
    }

    // Kick/ban (only if explicitly asked by decision)
    if (decision.action === 'kick' && member.kickable) {
      try { await member.kick(decision.reason || 'AutoMod'); } catch {}
    }

    if (decision.action === 'ban' && member.bannable) {
      try {
        await member.ban({ reason: decision.reason || 'AutoMod' });
        this.stats.banned++;
      } catch {}
    }

    await this._logToChannel(message, settings, decision, newWarns);

    this.pushLog(`🛡️ ${message.author.tag} → ${decision.action.toUpperCase()} | ${decision.reason}`, 'moderation');
  }

  async _dmUserNotice(message, decision, warns, settings) {
    const embed = new EmbedBuilder()
      .setColor(decision.action === 'ban' ? 0xED4245 : decision.action === 'timeout' ? 0xFEE75C : 0xFAA61A)
      .setTitle(`🛡️ Auto-Moderation Notice`)
      .setDescription(`Server: **${message.guild.name}**`)
      .addFields(
        { name: 'Action', value: decision.action, inline: true },
        { name: 'Warnings', value: `${warns}/${settings.maxWarnings}`, inline: true },
        { name: 'Reason', value: decision.reason.slice(0, 900) }
      )
      .setTimestamp();

    // include a snippet only (avoid leaking big content)
    const snippet = (message.content || '').slice(0, 200);
    if (snippet) embed.addFields({ name: 'Message', value: `\`\`\`${snippet}\`\`\`` });

    await message.author.send({ embeds: [embed] });
  }

  async _logToChannel(message, settings, decision, warns) {
    const channel = message.guild.channels.cache.find(c => c.name === settings.logChannelName);
    if (!channel) return;

    const color =
      decision.action === 'ban' ? 0xED4245 :
      decision.action === 'timeout' ? 0xFEE75C :
      decision.action === 'delete' ? 0xFAA61A :
      0x5865F2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🛡️ Nova Auto-Mod Action`)
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: 'User', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
        { name: 'Action', value: decision.action, inline: true },
        { name: 'Warnings', value: `${warns}/${settings.maxWarnings}`, inline: true },
        { name: 'Channel', value: `${message.channel}`, inline: true },
        { name: 'Reason', value: decision.reason.slice(0, 1000) },
      )
      .setFooter({ text: 'Nova AI Security System' })
      .setTimestamp();

    const content = (message.content || '').slice(0, 1000);
    if (content) embed.addFields({ name: 'Content', value: `\`\`\`${content}\`\`\`` });

    try { await channel.send({ embeds: [embed] }); } catch {}
  }
}

module.exports = UltraModeration;