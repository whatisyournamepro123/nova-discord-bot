/**
 * Ultra-Advanced AI-Powered Moderation System
 * Groq-Based Moderation with Real-Time Decision Making
 * Features: Behavioral Analysis, Pattern Detection, Sentiment Analysis
 * Author: whatisyournamepro123
 * Date: 2025-12-12
 */

const axios = require('axios');
const natural = require('natural');
const SentimentAnalyzer = require('natural').SentimentAnalyzer;
const PorterStemmer = require('natural').PorterStemmer;

class GroqModerationSystem {
  constructor(groqApiKey, options = {}) {
    this.groqApiKey = groqApiKey;
    this.groqBaseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    // Configuration options
    this.config = {
      model: options.model || 'mixtral-8x7b-32768',
      maxTokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.3,
      thresholds: {
        toxicity: options.toxicityThreshold || 0.7,
        spam: options.spamThreshold || 0.75,
        hate: options.hateThreshold || 0.8,
        violence: options.violenceThreshold || 0.75,
        harassment: options.harassmentThreshold || 0.7,
      },
      enableBehavioralAnalysis: options.enableBehavioralAnalysis !== false,
      enablePatternDetection: options.enablePatternDetection !== false,
      enableSentimentAnalysis: options.enableSentimentAnalysis !== false,
    };

    // User behavior tracking
    this.userBehaviors = new Map();
    this.messagePatterns = new Map();
    this.warningHistory = new Map();
    
    // Sentiment analyzer initialization
    this.analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');
    
    // Cache for rapid responses
    this.analysisCache = new Map();
    this.cacheExpiry = 3600000; // 1 hour
  }

  /**
   * Main moderation analysis function
   * Performs comprehensive content analysis using Groq AI
   */
  async analyzeContent(content, userId, options = {}) {
    try {
      const cacheKey = `${userId}-${content}`;
      
      // Check cache first
      if (this.analysisCache.has(cacheKey)) {
        const cached = this.analysisCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.result;
        }
      }

      // Parallel analysis operations
      const [groqAnalysis, sentimentScore, patternAnalysis, behavioralRisk] = await Promise.all([
        this.analyzeWithGroq(content, userId),
        this.config.enableSentimentAnalysis ? this.analyzeSentiment(content) : null,
        this.config.enablePatternDetection ? this.detectPatterns(content, userId) : null,
        this.config.enableBehavioralAnalysis ? this.analyzeBehavioralRisk(userId) : null,
      ]);

      // Aggregate analysis results
      const result = this.aggregateAnalysis({
        groqAnalysis,
        sentimentScore,
        patternAnalysis,
        behavioralRisk,
        userId,
        content,
      });

      // Cache the result
      this.analysisCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error('Error analyzing content:', error.message);
      throw new Error(`Moderation analysis failed: ${error.message}`);
    }
  }

  /**
   * Groq AI-powered content analysis
   * Uses advanced LLM reasoning for nuanced moderation decisions
   */
  async analyzeWithGroq(content, userId) {
    try {
      const systemPrompt = `You are an advanced AI content moderator. Analyze the provided content for:
1. Toxicity level (0-1)
2. Spam probability (0-1)
3. Hate speech indicators (0-1)
4. Violence/Threats (0-1)
5. Harassment indicators (0-1)
6. NSFW content (0-1)
7. Overall violation likelihood (0-1)

Respond in JSON format with these exact fields:
{
  "toxicity": number,
  "spam": number,
  "hate": number,
  "violence": number,
  "harassment": number,
  "nsfw": number,
  "overallRisk": number,
  "reasoning": "brief explanation",
  "actionRequired": boolean,
  "suggestedAction": "none|warn|mute|kick|ban"
}

Be precise and fair in your analysis. Consider context and linguistic nuance.`;

      const userPrompt = `Analyze this Discord message for moderation:\n"${content}"`;

      const response = await axios.post(
        this.groqBaseUrl,
        {
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const analysisText = response.data.choices[0].message.content;
      const analysis = this.parseGroqResponse(analysisText);
      
      return analysis;
    } catch (error) {
      console.error('Groq API error:', error.message);
      throw error;
    }
  }

  /**
   * Parse Groq API response and extract JSON
   */
  parseGroqResponse(responseText) {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse Groq response:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Advanced sentiment analysis using natural language processing
   */
  async analyzeSentiment(content) {
    try {
      const score = this.analyzer.getSentiment(content.split(' '));
      
      return {
        score: (score + 1) / 2, // Normalize to 0-1
        sentiment: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
        intensity: Math.abs(score),
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return { score: 0.5, sentiment: 'unknown', intensity: 0 };
    }
  }

  /**
   * Pattern detection for spam, raids, and repeated violations
   */
  async detectPatterns(content, userId) {
    try {
      const userHistory = this.messagePatterns.get(userId) || [];
      const timestamp = Date.now();

      // Add current message to history
      userHistory.push({
        content,
        timestamp,
        hash: this.hashContent(content),
      });

      // Keep only recent messages (last 24 hours)
      const dayAgo = timestamp - 86400000;
      const recentMessages = userHistory.filter(msg => msg.timestamp > dayAgo);
      this.messagePatterns.set(userId, recentMessages);

      // Analyze patterns
      const patterns = {
        repetitionRate: this.calculateRepetitionRate(recentMessages),
        messageFrequency: this.calculateMessageFrequency(recentMessages),
        contentVariance: this.calculateContentVariance(recentMessages),
        spamScore: 0,
        raidActivity: false,
      };

      // Calculate spam score based on patterns
      patterns.spamScore = (patterns.repetitionRate * 0.5) + (patterns.messageFrequency * 0.3) + ((1 - patterns.contentVariance) * 0.2);

      // Detect raid patterns (multiple messages from same user in short time)
      const lastHour = timestamp - 3600000;
      const recentCount = recentMessages.filter(msg => msg.timestamp > lastHour).length;
      patterns.raidActivity = recentCount > 15;

      return patterns;
    } catch (error) {
      console.error('Pattern detection error:', error);
      return {
        repetitionRate: 0,
        messageFrequency: 0,
        contentVariance: 1,
        spamScore: 0,
        raidActivity: false,
      };
    }
  }

  /**
   * Behavioral risk analysis based on user history
   */
  async analyzeBehavioralRisk(userId) {
    try {
      const behavior = this.userBehaviors.get(userId) || {
        violations: 0,
        warnings: 0,
        lastViolation: null,
        violationTypes: [],
      };

      const warnings = this.warningHistory.get(userId) || [];
      const now = Date.now();
      const dayAgo = now - 86400000;
      const weekAgo = now - 604800000;

      // Calculate risk metrics
      const violations24h = warnings.filter(w => w.timestamp > dayAgo).length;
      const violations7d = warnings.filter(w => w.timestamp > weekAgo).length;
      const recidivismRate = behavior.violations > 0 ? violations24h / behavior.violations : 0;

      // Determine behavioral risk level
      let riskLevel = 'low';
      let riskScore = 0;

      if (violations24h > 3) riskLevel = 'critical', riskScore = 0.9;
      else if (violations24h > 2) riskLevel = 'high', riskScore = 0.7;
      else if (violations24h > 1) riskLevel = 'medium', riskScore = 0.5;
      else if (violations7d > 5) riskLevel = 'medium', riskScore = 0.5;

      return {
        riskLevel,
        riskScore,
        violations24h,
        violations7d,
        recidivismRate,
        totalViolations: behavior.violations,
        lastViolation: behavior.lastViolation,
      };
    } catch (error) {
      console.error('Behavioral analysis error:', error);
      return {
        riskLevel: 'low',
        riskScore: 0,
        violations24h: 0,
        violations7d: 0,
        recidivismRate: 0,
        totalViolations: 0,
      };
    }
  }

  /**
   * Aggregate all analysis results into comprehensive moderation decision
   */
  aggregateAnalysis({ groqAnalysis, sentimentScore, patternAnalysis, behavioralRisk, userId, content }) {
    // Determine if moderation action is needed
    const thresholds = this.config.thresholds;
    
    const violations = {
      toxicity: groqAnalysis.toxicity > thresholds.toxicity,
      spam: patternAnalysis?.spamScore > thresholds.spam || groqAnalysis.spam > thresholds.spam,
      hate: groqAnalysis.hate > thresholds.hate,
      violence: groqAnalysis.violence > thresholds.violence,
      harassment: groqAnalysis.harassment > thresholds.harassment,
      nsfw: groqAnalysis.nsfw > 0.5,
    };

    const violationCount = Object.values(violations).filter(v => v).length;
    
    // Calculate final moderation score
    const scores = [
      groqAnalysis.toxicity,
      groqAnalysis.spam,
      groqAnalysis.hate,
      groqAnalysis.violence,
      groqAnalysis.harassment,
    ];
    const averageScore = scores.reduce((a, b) => a + b) / scores.length;
    const behavioralMultiplier = behavioralRisk?.riskScore || 0;
    const finalModerationScore = Math.min(1, averageScore + (behavioralMultiplier * 0.2));

    // Determine recommended action
    let recommendedAction = 'none';
    if (finalModerationScore > 0.85 || violationCount >= 3) {
      recommendedAction = 'ban';
    } else if (finalModerationScore > 0.75 || violationCount >= 2) {
      recommendedAction = 'kick';
    } else if (finalModerationScore > 0.65 || violationCount === 1) {
      recommendedAction = 'mute';
    } else if (finalModerationScore > 0.5) {
      recommendedAction = 'warn';
    }

    return {
      userId,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString(),
      
      // Individual scores
      analysis: {
        toxicity: groqAnalysis.toxicity,
        spam: groqAnalysis.spam,
        hate: groqAnalysis.hate,
        violence: groqAnalysis.violence,
        harassment: groqAnalysis.harassment,
        nsfw: groqAnalysis.nsfw,
      },
      
      // Sentiment data
      sentiment: sentimentScore,
      
      // Pattern data
      patterns: patternAnalysis,
      
      // Behavioral data
      behavioral: behavioralRisk,
      
      // Violations
      violations,
      violationCount,
      
      // Final decision
      finalScore: finalModerationScore,
      recommendedAction,
      requiresModeration: finalModerationScore > 0.5,
      confidence: this.calculateConfidence(groqAnalysis, patternAnalysis),
      
      // Explanation
      reason: groqAnalysis.reasoning,
    };
  }

  /**
   * Calculate confidence level in moderation decision
   */
  calculateConfidence(groqAnalysis, patternAnalysis) {
    let confidence = 0.8; // Base confidence
    
    // Adjust based on pattern clarity
    if (patternAnalysis?.spamScore > 0.7) confidence += 0.1;
    if (groqAnalysis.overallRisk > 0.8) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  /**
   * Calculate content repetition rate
   */
  calculateRepetitionRate(messages) {
    if (messages.length < 2) return 0;
    
    const hashes = messages.map(m => m.hash);
    const uniqueHashes = new Set(hashes);
    
    return 1 - (uniqueHashes.size / hashes.length);
  }

  /**
   * Calculate message frequency (messages per minute)
   */
  calculateMessageFrequency(messages) {
    if (messages.length < 2) return 0;
    
    const timeSpan = (messages[messages.length - 1].timestamp - messages[0].timestamp) / 60000; // minutes
    if (timeSpan === 0) return Math.min(1, messages.length / 10);
    
    const frequency = messages.length / timeSpan;
    return Math.min(1, frequency / 5); // Normalize to 5 messages per minute as max
  }

  /**
   * Calculate content variance (0-1, where 1 is high variance)
   */
  calculateContentVariance(messages) {
    if (messages.length < 2) return 1;
    
    const lengths = messages.map(m => m.content.length);
    const avgLength = lengths.reduce((a, b) => a + b) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.min(1, stdDev / avgLength || 0);
  }

  /**
   * Simple hash function for content
   */
  hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Record a user violation
   */
  recordViolation(userId, violationType, action) {
    const behavior = this.userBehaviors.get(userId) || {
      violations: 0,
      warnings: 0,
      lastViolation: null,
      violationTypes: [],
    };

    behavior.violations++;
    behavior.lastViolation = new Date().toISOString();
    behavior.violationTypes.push(violationType);

    this.userBehaviors.set(userId, behavior);

    const warnings = this.warningHistory.get(userId) || [];
    warnings.push({
      type: violationType,
      action,
      timestamp: Date.now(),
    });

    this.warningHistory.set(userId, warnings);
  }

  /**
   * Get user moderation history
   */
  getUserHistory(userId) {
    return {
      behavior: this.userBehaviors.get(userId),
      warnings: this.warningHistory.get(userId) || [],
    };
  }

  /**
   * Clear old cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.analysisCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.analysisCache.delete(key);
      }
    }
  }

  /**
   * Get default analysis when parsing fails
   */
  getDefaultAnalysis() {
    return {
      toxicity: 0.3,
      spam: 0.2,
      hate: 0.1,
      violence: 0.1,
      harassment: 0.15,
      nsfw: 0.05,
      overallRisk: 0.25,
      reasoning: 'Analysis unavailable, default safe score applied',
      actionRequired: false,
      suggestedAction: 'none',
    };
  }
}

module.exports = GroqModerationSystem;
