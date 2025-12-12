# Groq-Powered Moderation System Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation & Setup](#installation--setup)
4. [Configuration](#configuration)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)

---

## Overview

The Nova Discord Bot integrates a powerful AI-driven moderation system powered by Groq's language models. This system enables intelligent content moderation, user behavior analysis, and automated enforcement of server rules.

### Key Features
- **Real-time Content Analysis**: Analyzes messages for harmful content, spam, and policy violations
- **Context-Aware Decisions**: Understands context to reduce false positives
- **Customizable Rules**: Define server-specific moderation policies
- **Audit Logging**: Complete audit trail of all moderation actions
- **User Reputation Tracking**: Monitors user behavior over time
- **Automated Actions**: Automatic warnings, mutes, and kicks based on severity
- **Admin Dashboard**: Easy monitoring and manual intervention

---

## Prerequisites

Before integrating the Groq-powered moderation system, ensure you have:

### Required
- **Python 3.8+** - For running the bot
- **discord.py 2.0+** - Discord API library
- **Groq API Key** - Available from [console.groq.com](https://console.groq.com)
- **Database** - SQLite (default) or PostgreSQL for moderation records
- **Admin Permissions** - On your Discord server

### Optional but Recommended
- **Redis** - For caching and rate limiting
- **Webhooks** - For logging to external services
- **Environment Management** - Tools like `python-dotenv`

### System Requirements
- **Memory**: Minimum 512MB, recommended 1GB
- **Storage**: 500MB for logs and database
- **Network**: Stable internet connection
- **Disk I/O**: Suitable for logging high-traffic servers

---

## Installation & Setup

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/whatisyournamepro123/nova-discord-bot.git
cd nova-discord-bot

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install required packages
pip install -r requirements.txt
pip install groq python-dotenv
```

### Step 2: Obtain API Credentials

1. **Discord Bot Token**:
   - Visit [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Navigate to "Bot" section and click "Add Bot"
   - Copy the token

2. **Groq API Key**:
   - Visit [Groq Console](https://console.groq.com)
   - Sign up or log in
   - Navigate to API Keys section
   - Create a new API key
   - Copy the key securely

3. **Database Setup**:
   ```bash
   # For SQLite (default)
   sqlite3 moderation.db < schema.sql
   
   # For PostgreSQL
   psql -U postgres -d nova_bot -f schema.sql
   ```

### Step 3: Environment Configuration

Create a `.env` file in the root directory:

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_server_id_here

# Groq Configuration
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=mixtral-8x7b-32768

# Database Configuration
DB_TYPE=sqlite  # sqlite or postgresql
DB_PATH=./moderation.db
# For PostgreSQL:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=nova_bot
# DB_USER=postgres
# DB_PASSWORD=your_password

# Moderation Settings
MODERATION_ENABLED=true
AUTO_MOD_ENABLED=true
LOG_CHANNEL_ID=your_log_channel_id
ADMIN_ROLE_ID=your_admin_role_id

# Optional Services
REDIS_URL=redis://localhost:6379
WEBHOOK_URL=https://your-webhook-endpoint.com
DEBUG_MODE=false
```

### Step 4: Initialize the Bot

```bash
# Test the installation
python bot.py

# You should see:
# > Connected to Discord as [Bot Name]
# > Groq moderation system initialized
# > Database connected
```

---

## Configuration

### Basic Configuration

#### 1. Server-Level Settings

```python
# In your bot configuration file (config.py)

MODERATION_CONFIG = {
    "enabled": True,
    "auto_mod": True,
    "severity_levels": {
        "low": {"action": "warn", "threshold": 2},
        "medium": {"action": "mute", "duration": 3600},
        "high": {"action": "kick", "threshold": 1},
        "critical": {"action": "ban", "threshold": 1}
    },
    "filters": {
        "spam": True,
        "hate_speech": True,
        "profanity": True,
        "phishing": True,
        "advertisement": True
    }
}
```

#### 2. Sensitivity Levels

```python
SENSITIVITY = {
    "conservative": 0.7,    # 70% confidence required
    "balanced": 0.6,        # 60% confidence required (recommended)
    "aggressive": 0.5       # 50% confidence required
}

# Set in environment or config
MODERATION_SENSITIVITY=0.6
```

#### 3. Custom Rules

```python
CUSTOM_RULES = [
    {
        "name": "no_invite_links",
        "pattern": r"discord\.gg/\w+",
        "action": "delete",
        "severity": "medium"
    },
    {
        "name": "no_external_links",
        "pattern": r"https?://(?!discord\.com|youtube\.com)",
        "action": "warn",
        "severity": "low"
    }
]
```

#### 4. Mute/Ban Durations

```python
PUNISHMENT_DURATIONS = {
    "mute_short": 600,          # 10 minutes
    "mute_medium": 3600,        # 1 hour
    "mute_long": 86400,         # 24 hours
    "ban_temporary": 604800,    # 7 days
    "ban_permanent": None       # Permanent
}
```

---

## Usage Examples

### Basic Command Usage

#### 1. Manual Moderation

```
# Warn a user
/warn @username "spam" "Repeated spam messages"

# Mute a user for 1 hour
/mute @username 1h "Harassment"

# Kick a user
/kick @username "Repeated violations"

# Ban a user permanently
/ban @username "Severe harassment"

# Unban a user
/unban username "Appeal approved"
```

#### 2. Checking User Status

```
# View user moderation history
/modinfo @username

# View recent moderation actions
/modlog
/modlog --user @username
/modlog --action warn
/modlog --date "2025-12-12"

# View server moderation statistics
/modstats
```

#### 3. Automated Moderation Setup

```
# Enable auto-moderation
/automod enable

# Set auto-mod sensitivity
/automod sensitivity balanced

# Configure auto-mod filters
/automod filter spam enable
/automod filter hate_speech enable
/automod filter phishing enable

# View current auto-mod configuration
/automod config
```

### Python Integration Examples

#### Example 1: Custom Moderation Handler

```python
from nova.moderation import ModerationManager, ModerationAction
import discord
from discord.ext import commands

class ModerationCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.mod_manager = ModerationManager(bot)
    
    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return
        
        # Analyze message with Groq
        analysis = await self.mod_manager.analyze_message(message)
        
        if analysis.should_action:
            action = ModerationAction(
                user_id=message.author.id,
                action_type=analysis.recommended_action,
                reason=analysis.reason,
                severity=analysis.severity
            )
            
            await self.mod_manager.apply_action(action)
            
            # Log the action
            log_channel = self.bot.get_channel(LOG_CHANNEL_ID)
            await log_channel.send(
                f"**Moderation Action**: {action.action_type}\n"
                f"**User**: {message.author.mention}\n"
                f"**Reason**: {action.reason}\n"
                f"**Severity**: {action.severity}"
            )

async def setup(bot):
    await bot.add_cog(ModerationCog(bot))
```

#### Example 2: Advanced Content Analysis

```python
from nova.moderation import GroqModerator

async def analyze_content(content: str) -> dict:
    moderator = GroqModerator()
    
    analysis = await moderator.analyze(
        content,
        context={
            "channel_type": "general",
            "user_history": "clean",
            "server_rules": ["no_spam", "no_hate_speech"]
        }
    )
    
    return {
        "is_safe": analysis.is_safe,
        "confidence": analysis.confidence,
        "violations": analysis.violations,
        "suggested_action": analysis.suggested_action,
        "explanation": analysis.explanation
    }
```

#### Example 3: Batch Moderation Review

```python
from nova.moderation import ModerationManager
from datetime import datetime, timedelta

async def review_recent_actions():
    mod_manager = ModerationManager()
    
    # Get actions from the last 24 hours
    since = datetime.utcnow() - timedelta(hours=24)
    actions = await mod_manager.get_actions(since=since)
    
    summary = {
        "total_actions": len(actions),
        "by_type": {},
        "by_severity": {},
        "by_moderator": {}
    }
    
    for action in actions:
        action_type = action.action_type
        summary["by_type"][action_type] = summary["by_type"].get(action_type, 0) + 1
        summary["by_severity"][action.severity] = summary["by_severity"].get(action.severity, 0) + 1
        summary["by_moderator"][action.moderator_id] = summary["by_moderator"].get(action.moderator_id, 0) + 1
    
    return summary
```

---

## Best Practices

### 1. Configuration Best Practices

✅ **DO:**
- Start with "balanced" sensitivity level and adjust based on results
- Regularly review and update custom rules
- Enable logging for all moderation actions
- Test rules in a private channel first
- Document your server's moderation policy
- Regularly backup your moderation database

❌ **DON'T:**
- Set sensitivity too high initially (leads to false positives)
- Ignore moderation logs and audit trails
- Change configurations during peak activity
- Store credentials in version control
- Disable logging in production

### 2. Moderation Policy

```
Create a clear moderation policy including:
- Clear rules and expectations
- Severity levels and corresponding actions
- Appeal process
- Moderator responsibilities
- Escalation procedures
```

### 3. Moderator Training

- Document common violation types
- Provide examples of actionable content
- Train on false positive handling
- Establish consistent enforcement
- Regular review meetings

### 4. Performance Optimization

```python
# Use caching for frequently analyzed content
from functools import lru_cache

@lru_cache(maxsize=1000)
async def get_cached_analysis(content: str):
    # Analysis is cached for identical content
    return await analyze_content(content)

# Batch process messages during off-peak hours
async def batch_review_logs():
    await asyncio.sleep(3600)  # Wait 1 hour
    # Process backlog of messages
```

### 5. Handling False Positives

```python
async def handle_false_positive(action_id: int, feedback: str):
    """
    Record false positives to improve future moderation
    """
    await mod_manager.log_feedback({
        "action_id": action_id,
        "type": "false_positive",
        "feedback": feedback,
        "timestamp": datetime.utcnow()
    })
    
    # Optionally adjust sensitivity
    await mod_manager.recalibrate_model()
```

### 6. Privacy Considerations

- Only log necessary information
- Implement data retention policies
- Comply with GDPR/privacy regulations
- Secure database with encryption
- Limit moderator access appropriately

---

## Troubleshooting

### Issue: Bot Not Responding to Commands

**Symptoms**: Commands registered but not executed

**Solutions**:
1. Verify bot permissions in Discord:
   ```
   Server Settings → Roles → Nova Bot → Check permissions
   ```
2. Check if bot token is valid:
   ```python
   # In bot startup
   try:
       await bot.login(DISCORD_TOKEN)
   except discord.LoginFailure:
       print("Invalid token!")
   ```
3. Verify command prefix and intents:
   ```python
   bot = commands.Bot(
       command_prefix="/",
       intents=discord.Intents.all()
   )
   ```

### Issue: Groq API Errors

**Symptoms**: "API Error", "Rate Limited", or "Invalid API Key"

**Solutions**:
1. Verify API key is correct:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.groq.com/openai/v1/models
   ```
2. Check rate limits:
   ```python
   # Implement exponential backoff
   async def call_groq_with_retry(prompt, max_retries=3):
       for attempt in range(max_retries):
           try:
               return await groq_client.chat.completions.create(...)
           except Exception as e:
               if attempt < max_retries - 1:
                   await asyncio.sleep(2 ** attempt)
               else:
                   raise
   ```
3. Monitor API usage:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.groq.com/openai/v1/usage
   ```

### Issue: Database Connection Failed

**Symptoms**: "Database connection error", moderation actions not saved

**Solutions**:
1. Check database file/service:
   ```bash
   # SQLite
   sqlite3 moderation.db ".tables"
   
   # PostgreSQL
   psql -U postgres -l
   ```
2. Verify credentials in `.env`:
   ```bash
   # Test connection
   python -c "import sqlite3; sqlite3.connect('moderation.db').execute('SELECT 1')"
   ```
3. Check file permissions:
   ```bash
   chmod 644 moderation.db
   ```

### Issue: High False Positive Rate

**Symptoms**: Many innocent messages flagged, users complaining

**Solutions**:
1. Lower sensitivity setting:
   ```env
   MODERATION_SENSITIVITY=0.7
   ```
2. Review and refine custom rules:
   ```python
   # Analyze false positives
   false_positives = await mod_manager.get_false_positives()
   for fp in false_positives:
       print(f"Content: {fp.content}")
       print(f"Reason: {fp.flagged_reason}")
   ```
3. Update context awareness:
   ```python
   # Add more context to analysis
   analysis = await moderator.analyze(
       message.content,
       context={
           "user_reputation": user.reputation_score,
           "channel_type": message.channel.name,
           "is_new_user": user.created_at < datetime.utcnow() - timedelta(days=7)
       }
   )
   ```

### Issue: Memory Leaks

**Symptoms**: Bot memory usage constantly increasing

**Solutions**:
1. Monitor memory usage:
   ```python
   import psutil
   
   async def log_memory_usage():
       process = psutil.Process()
       memory_info = process.memory_info()
       print(f"Memory: {memory_info.rss / 1024 / 1024:.2f} MB")
   ```
2. Clear caches regularly:
   ```python
   @tasks.loop(hours=1)
   async def clear_caches():
       await mod_manager.clear_old_cache()
       gc.collect()
   ```

### Issue: Slow Message Analysis

**Symptoms**: Long delays before moderation actions, users experience lag

**Solutions**:
1. Enable caching and batch processing
2. Adjust confidence threshold for faster analysis
3. Use webhooks for asynchronous logging:
   ```python
   # Don't await webhook sends
   asyncio.create_task(log_to_webhook(action))
   ```
4. Monitor Groq API latency
5. Consider using a faster model for real-time analysis

---

## API Reference

### ModerationManager Class

```python
class ModerationManager:
    async def analyze_message(message: discord.Message) -> Analysis
    async def apply_action(action: ModerationAction) -> ActionResult
    async def get_user_history(user_id: int) -> List[Action]
    async def get_actions(since: datetime, **filters) -> List[Action]
    async def log_feedback(feedback: dict) -> None
    async def recalibrate_model() -> None
```

### ModerationAction Object

```python
class ModerationAction:
    user_id: int
    action_type: str  # warn, mute, kick, ban
    reason: str
    severity: str     # low, medium, high, critical
    duration: Optional[int]  # in seconds
    moderator_id: int
    timestamp: datetime
```

### Analysis Object

```python
class Analysis:
    is_safe: bool
    confidence: float
    violations: List[str]
    suggested_action: str
    severity: str
    explanation: str
    tokens_used: int
```

---

## Support & Resources

- **Documentation**: [GitHub Wiki](https://github.com/whatisyournamepro123/nova-discord-bot/wiki)
- **Issues**: [GitHub Issues](https://github.com/whatisyournamepro123/nova-discord-bot/issues)
- **Discord Support**: Join our [support server](https://discord.gg/your-invite)
- **Groq Documentation**: [docs.groq.com](https://docs.groq.com)

---

## Version History

- **v2.0.0** (2025-12-12): Groq integration, context-aware moderation
- **v1.5.0**: Redis caching, batch processing
- **v1.0.0**: Initial release

---

**Last Updated**: 2025-12-12
**Maintained By**: whatisyournamepro123
