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
                    max_tokens: 500,
                    temperature: jsonMode ? 0.2 : 0.7, // Lower temp for JSON/Safety checks
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

    // 🛡️ NEW: Ultra Advanced Safety Check
    async analyzeSafety(messageContent) {
        const system = `You are a strict Discord Content Moderator. 
        Analyze the message for: TOXICITY, HATE_SPEECH, BULLYING, SELF_HARM, or SEXUAL_CONTENT.
        Context: Gaming server. "Kill" in game context is SAFE. "Kill yourself" is UNSAFE.
        
        Respond with JSON ONLY:
        {
            "safe": boolean,
            "flagged": boolean,
            "category": "safe" | "toxic" | "hate" | "sexual" | "threat",
            "reason": "short explanation",
            "severity": 1-10
        }`;

        const result = await this.askAI(messageContent, system, true);
        try {
            return JSON.parse(result);
        } catch (e) {
            return { safe: true, flagged: false }; // Fail open if AI breaks
        }
    }

    // Existing methods...
    async suggestResponse(messages, category) {
        const convo = messages.map(m => m.author + ': ' + m.content).join('\n');
        return await this.askAI('Suggest a helpful reply for:\n' + convo, 'You are a support agent. Category: ' + category + '. Keep response under 200 chars.');
    }

    async categorize(content) {
        const r = await this.askAI('Categorize: ' + content, 'Reply ONLY: general, technical, billing, report, or other');
        const valid = ['general', 'technical', 'billing', 'report', 'other'];
        return valid.includes((r || '').toLowerCase().trim()) ? r.toLowerCase().trim() : 'general';
    }

    async chat(message, username) {
        return await this.askAI(username + ': ' + message, 'You are Nova bot. Be friendly, cool, and use emojis. Keep under 300 chars.') || 'Hey! Type !ticket for help!';
    }

    getStats() { return { enabled: !!this.groqKey }; }
}

module.exports = AdvancedAI;