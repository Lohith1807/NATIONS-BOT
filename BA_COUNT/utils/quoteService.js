const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CONFIG_FILE = path.join(__dirname, '../data/dailyQuoteConfig.json');
const HISTORY_FILE = path.join(__dirname, '../data/quoteHistory.json');

// Supported Themes
const THEMES = [
    { id: 'motivational', name: 'Motivational', icon: '🔥', desc: 'Relentless drive, unyielding fire, breaking barriers, overcoming odds.' },
    { id: 'gaming', name: 'Gaming', icon: '🎮', desc: 'Leveling up through defeat, extra lives, clutch moments, boss fights of reality.' },
    { id: 'funny', name: 'Funny', icon: '⚡', desc: 'Witty, sarcastic, clever, and hilarious observations on modern chaos.' },
    { id: 'dark', name: 'Dark', icon: '🖤', desc: 'Moody, introspective, shadow truths, raw reality without sugarcoating.' },
    { id: 'emotional', name: 'Emotional', icon: '🥀', desc: 'Poignant, vulnerable, heartfelt, deeply touching reflections on heartache and healing.' },
    { id: 'friendship', name: 'Friendship', icon: '🤝', desc: 'Unshakable loyalty, brotherhood, comrades who stand shoulder to shoulder in the storm.' },
    { id: 'love', name: 'Love', icon: '✨', desc: 'Intense connection, quiet devotion, electric affinity, beautiful tenderness.' },
    { id: 'life', name: 'Life', icon: '🌿', desc: 'The art of living, seasons of change, unexpected journeys, finding meaning.' },
    { id: 'psychology', name: 'Psychology', icon: '🧠', desc: 'Perception, subconscious desires, mental fortitude, human nature stripped bare.' },
    { id: 'relatable', name: 'Relatable', icon: '☕', desc: 'The unspoken struggles, late-night overthinking, authentic everyday humor and grit.' },
    { id: 'philosophical', name: 'Philosophical', icon: '🏛️', desc: 'Existential wonder, Stoic calmness, cosmic perspective, timeless inquiries.' },
    { id: 'wisdom', name: 'Wisdom', icon: '🦉', desc: 'Distilled experience, clarity over cleverness, learning to bend before breaking.' },
    { id: 'courage', name: 'Courage', icon: '⚔️', desc: 'Stepping into the unknown, standing firm when trembling, defying fate.' },
    { id: 'mindfulness', name: 'Mindfulness', icon: '🌌', desc: 'Stillness, silence, shedding mental weight, existing fully in the present second.' }
];

function getApiKey() {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
        return process.env.GEMINI_API_KEY.trim();
    }
    // Fallback: check gemini-bot/.env
    const fallbackEnv = path.resolve(__dirname, '../../gemini-bot/.env');
    if (fs.existsSync(fallbackEnv)) {
        const text = fs.readFileSync(fallbackEnv, 'utf8');
        const match = text.match(/GEMINI_API_KEY=([^\r\n]+)/);
        if (match && match[1].trim()) {
            return match[1].trim();
        }
    }
    return null;
}

function getConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            const defaultConfig = {
                channelId: '',
                time: '09:00',
                timezone: 'Asia/Kolkata',
                enabled: true
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
        console.error('❌ Error reading quote config:', e);
        return { channelId: '', time: '09:00', timezone: 'Asia/Kolkata', enabled: true };
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.error('❌ Error saving quote config:', e);
        return false;
    }
}

function getHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) {
            fs.writeFileSync(HISTORY_FILE, '[]');
            return [];
        }
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) {
        console.error('❌ Error reading quote history:', e);
        return [];
    }
}

function saveQuoteToHistory(quoteObj) {
    try {
        const history = getHistory();
        history.unshift(quoteObj); // Add to beginning
        // Keep last 300 entries
        const trimmed = history.slice(0, 300);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
    } catch (e) {
        console.error('❌ Error saving quote to history:', e);
    }
}

// Mood Clusters to ensure distinct variety across consecutive quotes
const MOOD_CLUSTERS = {
    fun_and_gaming: ['funny', 'gaming', 'relatable'],
    heart_and_love: ['love', 'friendship', 'emotional'],
    fire_and_courage: ['motivational', 'courage'],
    depth_and_mind: ['dark', 'psychology', 'philosophical', 'wisdom', 'mindfulness', 'life']
};

function getClusterForTheme(themeId) {
    const tid = (themeId || '').toLowerCase();
    for (const [cluster, list] of Object.entries(MOOD_CLUSTERS)) {
        if (list.includes(tid)) return cluster;
    }
    return null;
}

function pickRandomTheme(recentQuotes = []) {
    // 1. Exclude the last 6 themes to ensure no repetition within recent posts
    const recentThemeIds = recentQuotes.slice(0, 6).map(q => (q.theme || '').toLowerCase());
    
    // 2. Identify the mood cluster of the immediate last quote to force a different mood
    const lastTheme = recentQuotes.length > 0 ? (recentQuotes[0].theme || '').toLowerCase() : null;
    const lastCluster = getClusterForTheme(lastTheme);

    // Filter out recently used themes
    let candidates = THEMES.filter(t => !recentThemeIds.includes(t.id.toLowerCase()));

    // Filter out the same mood cluster as the previous quote for maximum contrast
    if (lastCluster && candidates.length > 1) {
        const differentClusterCandidates = candidates.filter(t => getClusterForTheme(t.id) !== lastCluster);
        if (differentClusterCandidates.length > 0) {
            candidates = differentClusterCandidates;
        }
    }

    const pool = candidates.length > 0 ? candidates : THEMES;
    return pool[Math.floor(Math.random() * pool.length)];
}

async function generateQuote(themeIdOverride = null) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in .env or gemini-bot/.env');
    }

    const history = getHistory();
    let themeObj;
    if (themeIdOverride) {
        themeObj = THEMES.find(t => t.id.toLowerCase() === themeIdOverride.toLowerCase()) || {
            id: themeIdOverride.toLowerCase(),
            name: themeIdOverride.charAt(0).toUpperCase() + themeIdOverride.slice(1),
            icon: '✨',
            desc: `Reflections and quotes centered on ${themeIdOverride}.`
        };
    } else {
        themeObj = pickRandomTheme(history);
    }

    const recentQuotesList = history.slice(0, 15).map(h => `"${h.quote}"`).join('\n');

    const prompt = `You are a world-class literary philosopher, poetic writer, and quote curator.
Your task is to craft a 100% ORIGINAL, striking, and deeply memorable quote for the theme "${themeObj.name}".

Theme Description: ${themeObj.desc}

Strict Requirements:
1. It MUST be 100% original and written by you. DO NOT use existing famous quotes (no Einstein, Oscar Wilde, Marcus Aurelius, etc.).
2. Length: Between 12 and 32 words. Concise, punchy, beautiful cadence, and emotionally/intellectually resonant.
3. Tone: Tailor directly to the theme "${themeObj.name}".
4. DO NOT duplicate or closely rephrase any of these recent previous quotes:
${recentQuotesList || '(None yet)'}
5. Provide a fitting author or thematic persona tag (e.g. 'Unknown Wanderer', 'The Midnight Strategist', 'A Quiet Observer', 'Blood Alliance Chronicles', or similar evocative persona).

You MUST return ONLY a clean JSON object with no markdown formatting, no backticks:
{
  "quote": "Your original quote here without surrounding quotation marks",
  "author": "Persona or Author tag",
  "theme": "${themeObj.id}"
}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

    let rawText = '';
    let lastError = null;

    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            rawText = response.text();
            if (rawText && rawText.trim()) {
                break;
            }
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ [QuoteService] Model ${modelName} failed: ${err.message}. Trying next...`);
        }
    }

    if (!rawText || !rawText.trim()) {
        throw new Error(`Failed to generate quote from Gemini API: ${lastError?.message || 'Empty response'}`);
    }

    // Clean JSON response
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (parseErr) {
        const quoteMatch = cleaned.match(/"quote"\s*:\s*"([^"]+)"/);
        const authorMatch = cleaned.match(/"author"\s*:\s*"([^"]+)"/);
        if (quoteMatch) {
            parsed = {
                quote: quoteMatch[1],
                author: authorMatch ? authorMatch[1] : 'Unknown',
                theme: themeObj.id
            };
        } else {
            throw new Error(`Could not parse JSON response from Gemini: ${cleaned}`);
        }
    }

    const finalQuote = {
        id: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        quote: parsed.quote.replace(/^["'“]+|["'”]+$/g, '').trim(),
        author: (parsed.author || 'Anonymous').replace(/^["'—\-]+|["']+$/g, '').trim(),
        theme: themeObj.id,
        themeName: themeObj.name,
        themeIcon: themeObj.icon,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0]
    };

    saveQuoteToHistory(finalQuote);

    return finalQuote;
}

module.exports = {
    THEMES,
    getConfig,
    saveConfig,
    getHistory,
    generateQuote,
    pickRandomTheme
};
