const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

class UltraVerification {
    constructor(client, io) {
        this.client = client;
        this.io = io;
        this.groqKey = process.env.GROQ_API_KEY;
        
        // Active verification sessions
        this.sessions = new Map();
        
        // Guild settings
        this.settings = new Map();
        
        // Rate limiting & raid detection
        this.joinLog = new Map();
        this.userAttempts = new Map();
        
        // Stats
        this.stats = {
            verified: 0,
            failed: 0,
            kicked: 0,
            banned: 0,
            raidsBlocked: 0,
            challengesGenerated: 0,
            aiAnalyses: 0
        };

        console.log(this.groqKey ? '🛡️ Ultra Verification System Online (AI Enabled)' : '🛡️ Ultra Verification System Online (Fallback Mode)');
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                         GROQ AI CORE ENGINE                               ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    async askGroq(prompt, systemPrompt, options = {}) {
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
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: options.maxTokens || 300,
                    temperature: options.temperature || 0.8,
                    top_p: options.topP || 0.9
                })
            });
            
            const data = await response.json();
            return data.choices?.[0]?.message?.content || null;
        } catch (e) {
            console.error('Groq AI Error:', e.message);
            return null;
        }
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                    ULTRA ADVANCED USER ANALYSIS                           ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    async analyzeUser(user) {
        this.stats.aiAnalyses++;
        
        const now = Date.now();
        const accountAge = now - user.createdTimestamp;
        const daysOld = Math.floor(accountAge / (1000 * 60 * 60 * 24));
        const hoursOld = Math.floor(accountAge / (1000 * 60 * 60));
        const minutesOld = Math.floor(accountAge / (1000 * 60));

        // ═══════════════════════════════════════════════════════════════
        // PHASE 1: BASIC METRICS SCORING
        // ═══════════════════════════════════════════════════════════════
        
        let threatScore = 0;
        const redFlags = [];
        const analysis = {
            accountAge: { days: daysOld, hours: hoursOld, minutes: minutesOld },
            username: user.username,
            displayName: user.displayName || user.username,
            hasAvatar: !!user.avatar,
            hasBanner: !!user.banner,
            isAnimatedAvatar: user.avatar?.startsWith('a_') || false
        };

        // Account age scoring (most important factor)
        if (minutesOld < 30) {
            threatScore += 60;
            redFlags.push('🚨 CRITICAL: Account created less than 30 minutes ago');
        } else if (hoursOld < 1) {
            threatScore += 50;
            redFlags.push('🚨 Account less than 1 hour old');
        } else if (hoursOld < 24) {
            threatScore += 40;
            redFlags.push('⚠️ Account less than 24 hours old');
        } else if (daysOld < 3) {
            threatScore += 30;
            redFlags.push('⚠️ Account less than 3 days old');
        } else if (daysOld < 7) {
            threatScore += 20;
            redFlags.push('📝 Account less than 1 week old');
        } else if (daysOld < 30) {
            threatScore += 10;
            redFlags.push('📝 Account less than 1 month old');
        } else if (daysOld > 365) {
            threatScore -= 15; // Bonus for old accounts
        }

        // Avatar analysis
        if (!user.avatar) {
            threatScore += 15;
            redFlags.push('👤 No custom avatar (default pfp)');
        } else if (analysis.isAnimatedAvatar) {
            threatScore -= 10; // Has Nitro, likely real user
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 2: USERNAME PATTERN ANALYSIS
        // ═══════════════════════════════════════════════════════════════

        const username = user.username.toLowerCase();
        const displayName = (user.displayName || '').toLowerCase();

        // Random string pattern (common in bots)
        const randomPattern = /^[a-z]{1,3}[0-9]{4,}$|^[a-z0-9]{10,}$|^[a-z]{8,}[0-9]+$/;
        if (randomPattern.test(username)) {
            threatScore += 25;
            redFlags.push('🤖 Username matches auto-generated pattern');
        }

        // Suspicious keywords
        const suspiciousWords = /(free|nitro|gift|giveaway|hack|bot|spam|raid|sell|buy|cheap|promo|click|link|discord\.gg|bit\.ly)/i;
        if (suspiciousWords.test(username) || suspiciousWords.test(displayName)) {
            threatScore += 35;
            redFlags.push('🚫 Suspicious keywords detected in name');
        }

        // Impersonation patterns
        const impersonationPattern = /(admin|mod|owner|staff|support|helper|official|system|discord)/i;
        if (impersonationPattern.test(username) || impersonationPattern.test(displayName)) {
            threatScore += 20;
            redFlags.push('⚠️ Potential impersonation attempt');
        }

        // Excessive special characters or zalgo
        const zalgoPattern = /[\u0300-\u036f\u0489]/;
        const specialChars = (username.match(/[^a-z0-9_]/g) || []).length;
        if (zalgoPattern.test(username) || zalgoPattern.test(displayName)) {
            threatScore += 15;
            redFlags.push('🔣 Zalgo/corrupted text detected');
        } else if (specialChars > 4) {
            threatScore += 10;
            redFlags.push('🔣 Excessive special characters');
        }

        // All numbers or mostly numbers
        if (/^\d+$/.test(username) || (username.match(/\d/g) || []).length > username.length * 0.6) {
            threatScore += 20;
            redFlags.push('🔢 Username is mostly/all numbers');
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 3: AI DEEP ANALYSIS (Using Groq)
        // ═══════════════════════════════════════════════════════════════

        let aiInsights = null;
        
        if (this.groqKey && threatScore > 15) {
            const aiPrompt = `Analyze this Discord user for bot/spam risk:

Username: "${user.username}"
Display Name: "${user.displayName || 'None'}"
Account Age: ${daysOld} days (${hoursOld} hours old)
Has Custom Avatar: ${!!user.avatar}
Has Banner: ${!!user.banner}
Current Threat Score: ${threatScore}/100

Existing Red Flags:
${redFlags.map(f => '- ' + f).join('\n')}

Analyze and respond in JSON ONLY:
{
  "humanProbability": 0-100,
  "botProbability": 0-100,
  "spamProbability": 0-100,
  "riskAssessment": "minimal/low/medium/high/critical",
  "suspiciousPatterns": ["list", "of", "patterns"],
  "recommendation": "approve/challenge/reject",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

            const aiResponse = await this.askGroq(
                aiPrompt,
                `You are an expert Discord security analyst. Your job is to identify bots, spammers, and malicious accounts. Be thorough but fair. Only respond with valid JSON, no markdown or extra text.`,
                { maxTokens: 250, temperature: 0.3 }
            );

            if (aiResponse) {
                try {
                    let cleaned = aiResponse.trim();
                    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/```json?|```/g, '').trim();
                    aiInsights = JSON.parse(cleaned);

                    // Adjust threat score based on AI analysis
                    if (aiInsights.botProbability > 70) {
                        threatScore += 25;
                        redFlags.push(`🧠 AI: ${aiInsights.botProbability}% bot probability`);
                    } else if (aiInsights.botProbability > 50) {
                        threatScore += 15;
                        redFlags.push(`🧠 AI: Moderate bot indicators`);
                    } else if (aiInsights.humanProbability > 80) {
                        threatScore -= 10;
                    }

                    if (aiInsights.spamProbability > 60) {
                        threatScore += 20;
                        redFlags.push(`🧠 AI: High spam probability`);
                    }
                } catch (e) {
                    // AI response wasn't valid JSON, continue without it
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 4: CALCULATE FINAL RISK LEVEL
        // ═══════════════════════════════════════════════════════════════

        threatScore = Math.max(0, Math.min(100, threatScore));

        let riskLevel, challengeCount, challengeDifficulty, timeLimit;

        if (threatScore >= 70) {
            riskLevel = 'critical';
            challengeCount = 4;
            challengeDifficulty = 'extreme';
            timeLimit = 60;
        } else if (threatScore >= 50) {
            riskLevel = 'high';
            challengeCount = 3;
            challengeDifficulty = 'hard';
            timeLimit = 90;
        } else if (threatScore >= 30) {
            riskLevel = 'medium';
            challengeCount = 2;
            challengeDifficulty = 'medium';
            timeLimit = 120;
        } else if (threatScore >= 15) {
            riskLevel = 'low';
            challengeCount = 1;
            challengeDifficulty = 'easy';
            timeLimit = 180;
        } else {
            riskLevel = 'minimal';
            challengeCount = 1;
            challengeDifficulty = 'simple';
            timeLimit = 300;
        }

        return {
            userId: user.id,
            username: user.tag,
            avatar: user.displayAvatarURL(),
            ...analysis,
            threatScore,
            riskLevel,
            redFlags,
            aiInsights,
            challengeCount,
            challengeDifficulty,
            timeLimit,
            analyzedAt: Date.now()
        };
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                   ULTRA ADVANCED CHALLENGE GENERATION                     ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    async generateChallenge(difficulty, previousChallenges = []) {
        this.stats.challengesGenerated++;

        // Challenge categories with weights based on difficulty
        const categories = {
            simple: ['basic_knowledge', 'simple_math'],
            easy: ['basic_knowledge', 'simple_math', 'pattern_recognition', 'common_sense'],
            medium: ['logic_puzzle', 'pattern_recognition', 'situational', 'word_puzzle', 'emotional_iq'],
            hard: ['advanced_logic', 'abstract_reasoning', 'creative_thinking', 'multi_step', 'contextual_analysis'],
            extreme: ['complex_reasoning', 'trap_questions', 'behavioral_analysis', 'rapid_fire', 'contradiction_detection']
        };

        const availableCategories = categories[difficulty] || categories.medium;
        
        // Avoid repeating same category
        let selectedCategory;
        do {
            selectedCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        } while (previousChallenges.includes(selectedCategory) && previousChallenges.length < availableCategories.length);

        // Generate challenge using AI
        const challenge = await this.generateChallengeByCategory(selectedCategory, difficulty);
        challenge.category = selectedCategory;
        challenge.difficulty = difficulty;
        challenge.generatedAt = Date.now();

        return challenge;
    }

    async generateChallengeByCategory(category, difficulty) {
        const prompts = {
            basic_knowledge: `Create a simple common knowledge question that any human would know.
Examples: "What color is the sky?", "How many legs does a cat have?"
Difficulty: ${difficulty}`,

            simple_math: `Create a simple math problem.
For easy: basic addition/subtraction (e.g., "5 + 3 = ?")
For medium: multiplication/division (e.g., "7 × 8 = ?")
For hard: order of operations (e.g., "2 + 3 × 4 = ?")
Difficulty: ${difficulty}`,

            pattern_recognition: `Create a pattern recognition challenge using emojis or symbols.
Example: "🔵🔴🔵🔴🔵❓ What comes next?"
Make it progressively harder based on difficulty.
Difficulty: ${difficulty}`,

            common_sense: `Create a common sense question that tests human intuition.
Example: "You're thirsty. What should you drink?" 
Difficulty: ${difficulty}`,

            logic_puzzle: `Create a short logic puzzle.
Example: "If all cats are animals, and Whiskers is a cat, is Whiskers an animal?"
Difficulty: ${difficulty}`,

            situational: `Create a situational awareness question.
Example: "You see someone drop their wallet. What's the right thing to do?"
Difficulty: ${difficulty}`,

            word_puzzle: `Create a word puzzle or anagram.
Example: "Unscramble: PLOAP = ?" (Answer: APPLE)
Difficulty: ${difficulty}`,

            emotional_iq: `Create an emotional intelligence question.
Example: "Your friend is sad because they failed a test. What would you say?"
Difficulty: ${difficulty}`,

            advanced_logic: `Create a challenging logic problem that requires careful thinking.
Example: "A is taller than B. C is shorter than B. Who is the shortest?"
Difficulty: ${difficulty}`,

            abstract_reasoning: `Create an abstract reasoning question.
Example: "If CLOUD is to SKY, then FISH is to ___?"
Difficulty: ${difficulty}`,

            creative_thinking: `Create a creative thinking challenge.
Example: "Name something that is both round and can be eaten."
Difficulty: ${difficulty}`,

            multi_step: `Create a multi-step problem requiring 2-3 steps to solve.
Example: "If you have 10 apples, give away half, then eat 2, how many remain?"
Difficulty: ${difficulty}`,

            contextual_analysis: `Create a question that requires understanding context.
Example: "In 'The bank was steep', does 'bank' refer to money or a river?"
Difficulty: ${difficulty}`,

            complex_reasoning: `Create a complex reasoning challenge.
Example: "If it takes 5 machines 5 minutes to make 5 widgets, how long for 100 machines to make 100 widgets?"
Difficulty: ${difficulty}`,

            trap_questions: `Create a trick question that tests if someone reads carefully.
Example: "A farmer has 17 sheep. All but 9 die. How many are left?"
Difficulty: ${difficulty}`,

            behavioral_analysis: `Create a question about typical human behavior.
Example: "What do most people do first thing in the morning?"
Difficulty: ${difficulty}`,

            rapid_fire: `Create a quick reflex question with an obvious answer.
Example: "Quick! What's 2+2?" or "Quick! What color is grass?"
Difficulty: ${difficulty}`,

            contradiction_detection: `Create a statement with a contradiction to identify.
Example: "I always lie. Am I lying right now? Answer: Yes or No"
Difficulty: ${difficulty}`
        };

        const prompt = prompts[category] || prompts.common_sense;

        const aiPrompt = `${prompt}

Generate a unique verification challenge. Respond in JSON ONLY:
{
  "question": "the question text",
  "correctAnswer": "the exact correct answer",
  "wrongAnswers": ["wrong1", "wrong2", "wrong3"],
  "hint": "a helpful hint",
  "explanation": "why this is the answer",
  "timeRecommended": 15-60 (seconds)
}

Make it:
- Solvable by humans in under 30 seconds
- Clear and unambiguous
- Fun and engaging
- NOT solvable by simple pattern matching`;

        const response = await this.askGroq(
            aiPrompt,
            'You create verification challenges for Discord. Be creative and varied. Only respond with valid JSON.',
            { maxTokens: 200, temperature: 0.9 }
        );

        if (response) {
            try {
                let cleaned = response.trim();
                if (cleaned.startsWith('```')) cleaned = cleaned.replace(/```json?|```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                
                // Validate the response has required fields
                if (parsed.question && parsed.correctAnswer) {
                    return {
                        question: parsed.question,
                        answer: parsed.correctAnswer,
                        options: this.shuffleArray([parsed.correctAnswer, ...(parsed.wrongAnswers || this.generateWrongAnswers(parsed.correctAnswer))]),
                        hint: parsed.hint || 'Think carefully!',
                        explanation: parsed.explanation || '',
                        timeLimit: parsed.timeRecommended || 30
                    };
                }
            } catch (e) {
                // Fall through to fallback
            }
        }

        // Fallback challenges
        return this.getFallbackChallenge(category);
    }

    generateWrongAnswers(correct) {
        // Generate plausible wrong answers
        if (!isNaN(correct)) {
            const num = parseInt(correct);
            return [String(num + 1), String(num - 1), String(num * 2)];
        }
        return ['Maybe', 'Not sure', 'None of these'];
    }

    getFallbackChallenge(category) {
        const fallbacks = {
            basic_knowledge: [
                { question: "What color is a ripe banana?", answer: "Yellow", options: ["Yellow", "Blue", "Green", "Red"], hint: "Think of the fruit 🍌" },
                { question: "What animal barks?", answer: "Dog", options: ["Dog", "Cat", "Fish", "Bird"], hint: "Man's best friend 🐕" },
                { question: "How many wheels does a bicycle have?", answer: "2", options: ["2", "3", "4", "1"], hint: "Bi means two 🚲" },
                { question: "What do you use to write?", answer: "Pen", options: ["Pen", "Fork", "Shoe", "Cup"], hint: "Contains ink ✏️" }
            ],
            simple_math: [
                { question: "What is 7 + 5?", answer: "12", options: ["12", "11", "13", "10"], hint: "Basic addition" },
                { question: "What is 15 - 8?", answer: "7", options: ["7", "6", "8", "9"], hint: "Basic subtraction" },
                { question: "What is 6 × 4?", answer: "24", options: ["24", "20", "28", "18"], hint: "Multiplication" },
                { question: "What is 20 ÷ 4?", answer: "5", options: ["5", "4", "6", "8"], hint: "Division" }
            ],
            pattern_recognition: [
                { question: "🔵🔴🔵🔴🔵❓ What comes next?", answer: "🔴", options: ["🔴", "🔵", "🟢", "🟡"], hint: "Look at the pattern" },
                { question: "2, 4, 6, 8, ❓ What's next?", answer: "10", options: ["10", "9", "11", "12"], hint: "Even numbers" },
                { question: "A, C, E, G, ❓ What's next?", answer: "I", options: ["I", "H", "J", "K"], hint: "Skip a letter" }
            ],
            logic_puzzle: [
                { question: "If all roses are flowers, and this is a rose, is it a flower?", answer: "Yes", options: ["Yes", "No", "Maybe", "Unknown"], hint: "Simple logic" },
                { question: "Tom is taller than Jerry. Jerry is taller than Spike. Who is shortest?", answer: "Spike", options: ["Spike", "Jerry", "Tom", "Equal"], hint: "Follow the order" }
            ],
            emotional_iq: [
                { question: "Your friend is crying. What should you do?", answer: "Comfort them", options: ["Comfort them", "Ignore them", "Laugh", "Walk away"], hint: "Be kind 💙" },
                { question: "Someone gives you a gift. What do you say?", answer: "Thank you", options: ["Thank you", "Whatever", "Nothing", "Go away"], hint: "Be polite" }
            ]
        };

        const categoryFallbacks = fallbacks[category] || fallbacks.basic_knowledge;
        const selected = categoryFallbacks[Math.floor(Math.random() * categoryFallbacks.length)];
        
        return {
            ...selected,
            explanation: 'Common knowledge question',
            timeLimit: 30
        };
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                      AI-POWERED ANSWER VERIFICATION                       ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    async verifyAnswer(challenge, userAnswer) {
        const correct = challenge.answer.toLowerCase().trim();
        const user = userAnswer.toLowerCase().trim();

        // Exact match
        if (user === correct) {
            return { correct: true, confidence: 100, method: 'exact' };
        }

        // Numeric comparison (handles "12" vs 12)
        if (!isNaN(correct) && !isNaN(user)) {
            return { 
                correct: parseFloat(user) === parseFloat(correct), 
                confidence: 100, 
                method: 'numeric' 
            };
        }

        // Common variations (yes/yeah/yep, no/nah/nope)
        const yesVariations = ['yes', 'yeah', 'yep', 'yup', 'correct', 'true', 'right'];
        const noVariations = ['no', 'nah', 'nope', 'wrong', 'false', 'incorrect'];

        if (yesVariations.includes(correct) && yesVariations.includes(user)) {
            return { correct: true, confidence: 95, method: 'variation' };
        }
        if (noVariations.includes(correct) && noVariations.includes(user)) {
            return { correct: true, confidence: 95, method: 'variation' };
        }

        // Use AI for fuzzy matching
        if (this.groqKey) {
            const aiPrompt = `Verify if this answer is correct:

Question: "${challenge.question}"
Expected Answer: "${challenge.answer}"
User's Answer: "${userAnswer}"

Consider:
- Typos and minor spelling errors
- Synonyms and alternative phrasings
- Abbreviations
- Semantic equivalence

Respond with JSON ONLY:
{"correct": true/false, "confidence": 0-100, "reason": "brief explanation"}`;

            const response = await this.askGroq(
                aiPrompt,
                'You verify answers fairly. Accept reasonable variations but reject clearly wrong answers. JSON only.',
                { maxTokens: 80, temperature: 0.2 }
            );

            if (response) {
                try {
                    let cleaned = response.trim();
                    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/```json?|```/g, '').trim();
                    const result = JSON.parse(cleaned);
                    return { ...result, method: 'ai_verified' };
                } catch (e) {}
            }
        }

        // Final fallback - simple string distance
        const similarity = this.stringSimilarity(user, correct);
        if (similarity > 0.85) {
            return { correct: true, confidence: Math.round(similarity * 100), method: 'similarity' };
        }

        return { correct: false, confidence: 80, method: 'no_match' };
    }

    stringSimilarity(s1, s2) {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        
        if (longer.length === 0) return 1.0;
        
        const costs = [];
        for (let i = 0; i <= longer.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= shorter.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (longer[i - 1] !== shorter[j - 1]) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[shorter.length] = lastValue;
        }
        
        return (longer.length - costs[shorter.length]) / longer.length;
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                    BEHAVIORAL ANALYSIS DURING VERIFY                      ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    analyzeBehavior(session) {
        const suspicious = [];
        let botScore = 0;

        if (!session.responses || session.responses.length === 0) {
            return { botScore: 0, suspicious: [], isBot: false };
        }

        // Response time analysis
        const responseTimes = session.responses.map(r => r.responseTime);
        const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

        // Too fast (< 500ms) is very suspicious
        if (avgTime < 500) {
            botScore += 50;
            suspicious.push('⚡ Responses faster than humanly possible');
        } else if (avgTime < 1500) {
            botScore += 25;
            suspicious.push('⚡ Very fast responses');
        }

        // Too consistent timing (bots respond at same speed)
        if (responseTimes.length >= 2) {
            const variance = this.calculateVariance(responseTimes);
            if (variance < 50 && avgTime < 3000) {
                botScore += 30;
                suspicious.push('🤖 Suspiciously consistent timing');
            }
        }

        // All correct answers very fast = suspicious
        const correctCount = session.responses.filter(r => r.correct).length;
        if (correctCount === session.responses.length && avgTime < 2000 && session.responses.length >= 2) {
            botScore += 20;
            suspicious.push('🎯 Perfect score with fast timing');
        }

        // Determine if likely bot
        const isBot = botScore >= 50;

        return { botScore, suspicious, isBot };
    }

    calculateVariance(numbers) {
        if (numbers.length < 2) return Infinity;
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        return numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                           RAID DETECTION                                  ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    detectRaid(guildId, threshold = 10) {
        const now = Date.now();
        
        if (!this.joinLog.has(guildId)) {
            this.joinLog.set(guildId, []);
        }

        const joins = this.joinLog.get(guildId);
        joins.push(now);

        // Keep only last minute
        const recentJoins = joins.filter(t => t > now - 60000);
        this.joinLog.set(guildId, recentJoins);

        if (recentJoins.length >= threshold) {
            this.stats.raidsBlocked++;
            return true;
        }

        return false;
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                      GUILD SETTINGS MANAGEMENT                            ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    getSettings(guildId) {
        if (!this.settings.has(guildId)) {
            this.settings.set(guildId, {
                enabled: true,
                channelId: null,
                verifiedRoleId: null,
                unverifiedRoleId: null,
                logChannelId: null,
                kickOnFail: true,
                banHighRisk: false,
                maxAttempts: 3,
                raidProtection: true,
                raidThreshold: 10
            });
        }
        return this.settings.get(guildId);
    }

    updateSettings(guildId, updates) {
        const current = this.getSettings(guildId);
        this.settings.set(guildId, { ...current, ...updates });
        return this.settings.get(guildId);
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                         SESSION MANAGEMENT                                ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    async createSession(member) {
        const analysis = await this.analyzeUser(member.user);
        
        const challenges = [];
        const usedCategories = [];
        
        for (let i = 0; i < analysis.challengeCount; i++) {
            const challenge = await this.generateChallenge(analysis.challengeDifficulty, usedCategories);
            challenges.push(challenge);
            usedCategories.push(challenge.category);
        }

        const session = {
            oderId: member.id,
            oderId: member.guild.id,
            oderId: member.user.tag,
            avatar: member.user.displayAvatarURL(),
            analysis,
            challenges,
            currentIndex: 0,
            attempts: 0,
            maxAttempts: this.getSettings(member.guild.id).maxAttempts,
            responses: [],
            status: 'pending',
            startedAt: Date.now(),
            expiresAt: Date.now() + (analysis.timeLimit * 1000)
        };

        // Fix property names
        session.oderId = member.id;
        session.oderId = member.guild.id;
        
        const sessionId = `${member.id}-${member.guild.id}`;
        this.sessions.set(sessionId, session);
        
        // Actually set the correct properties
        const s = this.sessions.get(sessionId);
        s.memberId = member.id;
        s.guildId = member.guild.id;
        s.username = member.user.tag;

        return s;
    }

    getSession(memberId, guildId) {
        return this.sessions.get(`${memberId}-${guildId}`);
    }

    deleteSession(memberId, guildId) {
        this.sessions.delete(`${memberId}-${guildId}`);
    }

    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                              PUBLIC API                                   ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝

    async handleMemberJoin(member) {
        const settings = this.getSettings(member.guild.id);
        
        if (!settings.enabled) return null;

        // Raid detection
        if (settings.raidProtection && this.detectRaid(member.guild.id, settings.raidThreshold)) {
            console.log(`🚨 RAID DETECTED in ${member.guild.name}`);
            try {
                await member.kick('Raid protection');
                this.stats.kicked++;
            } catch (e) {}
            return null;
        }

        // Create session with AI analysis
        const session = await this.createSession(member);

        // Assign unverified role
        if (settings.unverifiedRoleId) {
            try {
                await member.roles.add(settings.unverifiedRoleId);
            } catch (e) {}
        }

        return session;
    }

    async processAnswer(memberId, guildId, answerIndex) {
        const session = this.getSession(memberId, guildId);
        if (!session || session.status !== 'pending') return null;

        const challenge = session.challenges[session.currentIndex];
        const userAnswer = challenge.options[answerIndex];
        const startTime = session.lastQuestionTime || session.startedAt;
        const responseTime = Date.now() - startTime;

        // Verify answer
        const result = await this.verifyAnswer(challenge, userAnswer);

        // Record response
        session.responses.push({
            challengeIndex: session.currentIndex,
            userAnswer,
            correct: result.correct,
            responseTime,
            timestamp: Date.now()
        });

        session.lastQuestionTime = Date.now();

        if (result.correct) {
            session.currentIndex++;
            
            if (session.currentIndex >= session.challenges.length) {
                // Behavioral analysis before final approval
                const behavior = this.analyzeBehavior(session);
                
                if (behavior.isBot) {
                    session.status = 'failed';
                    session.failReason = 'Detected as bot: ' + behavior.suspicious.join(', ');
                    this.stats.failed++;
                    return { success: false, reason: 'bot_detected', behavior };
                }

                session.status = 'verified';
                session.completedAt = Date.now();
                this.stats.verified++;
                return { success: true, completed: true };
            }

            return { success: true, completed: false, nextChallenge: session.challenges[session.currentIndex] };
        } else {
            session.attempts++;

            if (session.attempts >= session.maxAttempts) {
                session.status = 'failed';
                session.failReason = 'Max attempts exceeded';
                this.stats.failed++;
                return { success: false, reason: 'max_attempts' };
            }

            // Generate new challenge for this position
            session.challenges[session.currentIndex] = await this.generateChallenge(
                session.analysis.challengeDifficulty,
                session.challenges.map(c => c.category)
            );

            return { 
                success: false, 
                reason: 'wrong_answer', 
                attemptsLeft: session.maxAttempts - session.attempts,
                newChallenge: session.challenges[session.currentIndex]
            };
        }
    }

    async processTextAnswer(memberId, guildId, textAnswer) {
        const session = this.getSession(memberId, guildId);
        if (!session || session.status !== 'pending') return null;

        const challenge = session.challenges[session.currentIndex];
        const startTime = session.lastQuestionTime || session.startedAt;
        const responseTime = Date.now() - startTime;

        // Verify answer using AI
        const result = await this.verifyAnswer(challenge, textAnswer);

        session.responses.push({
            challengeIndex: session.currentIndex,
            userAnswer: textAnswer,
            correct: result.correct,
            responseTime,
            timestamp: Date.now()
        });

        session.lastQuestionTime = Date.now();

        if (result.correct) {
            session.currentIndex++;
            
            if (session.currentIndex >= session.challenges.length) {
                const behavior = this.analyzeBehavior(session);
                
                if (behavior.isBot) {
                    session.status = 'failed';
                    this.stats.failed++;
                    return { success: false, reason: 'bot_detected', behavior };
                }

                session.status = 'verified';
                session.completedAt = Date.now();
                this.stats.verified++;
                return { success: true, completed: true };
            }

            return { success: true, completed: false, nextChallenge: session.challenges[session.currentIndex] };
        } else {
            session.attempts++;

            if (session.attempts >= session.maxAttempts) {
                session.status = 'failed';
                this.stats.failed++;
                return { success: false, reason: 'max_attempts' };
            }

            session.challenges[session.currentIndex] = await this.generateChallenge(
                session.analysis.challengeDifficulty,
                session.challenges.map(c => c.category)
            );

            return { 
                success: false, 
                reason: 'wrong_answer', 
                attemptsLeft: session.maxAttempts - session.attempts,
                newChallenge: session.challenges[session.currentIndex]
            };
        }
    }

    // Get all pending sessions for dashboard
    getPendingSessions() {
        return Array.from(this.sessions.values())
            .filter(s => s.status === 'pending')
            .map(s => ({
                memberId: s.memberId,
                guildId: s.guildId,
                username: s.username,
                avatar: s.avatar,
                riskLevel: s.analysis.riskLevel,
                threatScore: s.analysis.threatScore,
                redFlags: s.analysis.redFlags,
                challengeProgress: `${s.currentIndex}/${s.challenges.length}`,
                attempts: s.attempts,
                maxAttempts: s.maxAttempts,
                startedAt: s.startedAt,
                timeRemaining: Math.max(0, s.expiresAt - Date.now())
            }))
            .sort((a, b) => b.threatScore - a.threatScore);
    }

    getStats() {
        return {
            ...this.stats,
            pendingSessions: Array.from(this.sessions.values()).filter(s => s.status === 'pending').length,
            aiEnabled: !!this.groqKey
        };
    }
}

module.exports = UltraVerification;