class AdvancedAI {
    constructor() {
        this.groqKey = process.env.GROQ_API_KEY;
        console.log(this.groqKey ? '✅ Groq AI Ready!' : '⚠️ No Groq API key');
    }

    async askAI(prompt, systemPrompt) {
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
                        { role: "system", content: systemPrompt || "You are helpful." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });
            const data = await response.json();
            return data.choices?.[0]?.message?.content || null;
        } catch (e) {
            return null;
        }
    }

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
        return await this.askAI(username + ': ' + message, 'You are Nova bot. Be friendly. Use emojis. Keep under 300 chars.') || 'Hey! Type !ticket [reason] for support!';
    }

    getStats() { return { enabled: !!this.groqKey }; }
}

module.exports = AdvancedAI;