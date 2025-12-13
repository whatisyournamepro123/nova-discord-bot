// ai.js
class AdvancedAI {
  constructor() {
    this.groqKey = process.env.GROQ_API_KEY;
    console.log(this.groqKey ? '🧠 Groq AI Ready!' : '⚠️ No Groq API key - AI features disabled');
  }

  async askAI(prompt, systemPrompt, jsonMode = false) {
    if (!this.groqKey) return null;
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.groqKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt || "You are a helpful AI." },
            { role: "user", content: prompt }
          ],
          max_tokens: 450,
          temperature: jsonMode ? 0.2 : 0.7,
          response_format: jsonMode ? { type: "json_object" } : undefined
        })
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error("AI Error:", e);
      return null;
    }
  }

  // ✅ NEW: More advanced moderation decision (used by UltraModeration v2)
  async moderateDecision(messageContent, context = {}) {
    const system = `You are a strict but fair Discord moderation AI.
Rules:
- Consider CONTEXT (gaming slang, joking, quotes, roleplay).
- "kill" in gaming context can be safe. "kill yourself"/"kys" is unsafe.
- Slurs/hate speech are never acceptable.
- Do not invent details not present.
Return JSON ONLY with EXACT fields:

{
  "allow": boolean,
  "flagged": boolean,
  "action": "allow"|"warn"|"delete"|"timeout"|"kick"|"ban",
  "severity": 0-10,
  "confidence": 0-1,
  "category": "safe"|"toxicity"|"harassment"|"hate"|"self_harm"|"sexual"|"violence"|"spam"|"scam",
  "scores": {
    "toxicity": 0-1,
    "harassment": 0-1,
    "hate": 0-1,
    "self_harm": 0-1,
    "sexual": 0-1,
    "violence": 0-1,
    "spam": 0-1,
    "scam": 0-1
  },
  "reason": "short explanation"
}`;

    const userPrompt = JSON.stringify({
      message: messageContent,
      context: {
        guild: context.guildName || null,
        channel: context.channelName || null,
        author: context.authorTag || null,
        authorIsNew: !!context.authorIsNew,
        recentMessages: context.recentMessages || [],
        userWarnings: context.userWarnings ?? null
      }
    });

    const raw = await this.askAI(userPrompt, system, true);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      // Minimal validation + hardening
      const safeNum = (n, min, max, fallback) => {
        const x = Number(n);
        return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
      };

      const actionSet = new Set(["allow", "warn", "delete", "timeout", "kick", "ban"]);
      const catSet = new Set(["safe", "toxicity", "harassment", "hate", "self_harm", "sexual", "violence", "spam", "scam"]);

      return {
        allow: !!parsed.allow,
        flagged: !!parsed.flagged,
        action: actionSet.has(parsed.action) ? parsed.action : (parsed.flagged ? "warn" : "allow"),
        severity: safeNum(parsed.severity, 0, 10, parsed.flagged ? 4 : 0),
        confidence: safeNum(parsed.confidence, 0, 1, 0.6),
        category: catSet.has(parsed.category) ? parsed.category : (parsed.flagged ? "toxicity" : "safe"),
        scores: {
          toxicity: safeNum(parsed.scores?.toxicity, 0, 1, 0),
          harassment: safeNum(parsed.scores?.harassment, 0, 1, 0),
          hate: safeNum(parsed.scores?.hate, 0, 1, 0),
          self_harm: safeNum(parsed.scores?.self_harm, 0, 1, 0),
          sexual: safeNum(parsed.scores?.sexual, 0, 1, 0),
          violence: safeNum(parsed.scores?.violence, 0, 1, 0),
          spam: safeNum(parsed.scores?.spam, 0, 1, 0),
          scam: safeNum(parsed.scores?.scam, 0, 1, 0),
        },
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 220) : "No reason provided"
      };
    } catch {
      return null;
    }
  }

  // Backwards compatible wrapper (your old moderation.js called this)
  async analyzeSafety(messageContent) {
    const d = await this.moderateDecision(messageContent);
    if (!d) return { safe: true, flagged: false };

    // Map to your old shape
    return {
      safe: d.allow,
      flagged: d.flagged,
      category: d.category === "violence" ? "threat"
        : d.category === "hate" ? "hate"
        : d.category === "sexual" ? "sexual"
        : d.category === "toxicity" || d.category === "harassment" ? "toxic"
        : "safe",
      reason: d.reason,
      severity: d.severity
    };
  }

  // Existing methods...
  async suggestResponse(messages, category) {
    const convo = messages.map(m => m.author + ': ' + m.content).join('\n');
    return await this.askAI(
      'Suggest a helpful reply for:\n' + convo,
      'You are a support agent. Category: ' + category + '. Keep response under 200 chars.'
    );
  }

  async categorize(content) {
    const r = await this.askAI('Categorize: ' + content, 'Reply ONLY: general, technical, billing, report, or other');
    const valid = ['general', 'technical', 'billing', 'report', 'other'];
    return valid.includes((r || '').toLowerCase().trim()) ? r.toLowerCase().trim() : 'general';
  }

  async chat(message, username) {
    return await this.askAI(
      username + ': ' + message,
      'You are Nova bot. Be friendly, cool, and use emojis. Keep under 300 chars.'
    ) || 'Hey! Type !ticket for help!';
  }

  getStats() { return { enabled: !!this.groqKey }; }
}

module.exports = AdvancedAI;