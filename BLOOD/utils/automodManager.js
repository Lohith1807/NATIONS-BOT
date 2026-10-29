const fs = require('fs');
const path = require('path');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getEmoji } = require('./botemoji.js');

const CONFIG_PATH = path.join(__dirname, '../data/automodConfig.json');

// Memory cache for user message history
// Key: `${guildId}:${userId}` -> Array<{ id: string, channelId: string, content: string, timestamp: number }>
const userMessageHistory = new Map();

// Configuration store
let automodConfig = {};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
            automodConfig = JSON.parse(raw);
        } else {
            automodConfig = {
                default: {
                    enabled: true,
                    logChannelId: '',
                    muteDurationMinutes: 15,
                    blockedWords: ['dalal', 'dalals']
                }
            };
            saveConfig();
        }
    } catch (err) {
        console.error('[Automod] Error loading config:', err);
        automodConfig = {
            default: {
                enabled: true,
                logChannelId: '',
                muteDurationMinutes: 15,
                blockedWords: ['dalal', 'dalals']
            }
        };
    }
}
loadConfig();

function saveConfig() {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(automodConfig, null, 2), 'utf8');
    } catch (err) {
        console.error('[Automod] Error saving config:', err);
    }
}

function getAutomodConfig(guildId) {
    if (automodConfig[guildId]) {
        return {
            ...automodConfig.default,
            ...automodConfig[guildId]
        };
    }
    return automodConfig.default || {
        enabled: true,
        logChannelId: '',
        muteDurationMinutes: 15,
        blockedWords: ['dalal', 'dalals']
    };
}

function setAutomodLogChannel(guildId, channelId) {
    if (!automodConfig[guildId]) {
        automodConfig[guildId] = { ...getAutomodConfig(guildId) };
    }
    automodConfig[guildId].logChannelId = channelId;
    automodConfig[guildId].enabled = true;
    saveConfig();
}

function setAutomodEnabled(guildId, enabled) {
    if (!automodConfig[guildId]) {
        automodConfig[guildId] = { ...getAutomodConfig(guildId) };
    }
    automodConfig[guildId].enabled = Boolean(enabled);
    saveConfig();
}

function setMuteDuration(guildId, minutes) {
    if (!automodConfig[guildId]) {
        automodConfig[guildId] = { ...getAutomodConfig(guildId) };
    }
    automodConfig[guildId].muteDurationMinutes = Math.max(1, parseInt(minutes, 10) || 15);
    saveConfig();
}

function addBlockedWord(guildId, word) {
    if (!automodConfig[guildId]) {
        automodConfig[guildId] = { ...getAutomodConfig(guildId) };
    }
    const cleanWord = word.toLowerCase().trim();
    if (!automodConfig[guildId].blockedWords) {
        automodConfig[guildId].blockedWords = ['dalal', 'dalals'];
    }
    if (!automodConfig[guildId].blockedWords.includes(cleanWord)) {
        automodConfig[guildId].blockedWords.push(cleanWord);
        saveConfig();
        clearRegexCache();
        return true;
    }
    return false;
}

function removeBlockedWord(guildId, word) {
    if (!automodConfig[guildId]) {
        automodConfig[guildId] = { ...getAutomodConfig(guildId) };
    }
    const cleanWord = word.toLowerCase().trim();
    if (automodConfig[guildId].blockedWords) {
        const index = automodConfig[guildId].blockedWords.indexOf(cleanWord);
        if (index !== -1) {
            automodConfig[guildId].blockedWords.splice(index, 1);
            saveConfig();
            clearRegexCache();
            return true;
        }
    }
    return false;
}

function getBlockedWords(guildId) {
    const config = getAutomodConfig(guildId);
    return config.blockedWords || ['dalal', 'dalals'];
}

// -------------------------------------------------------------
// Advanced Anti-Evasion & Normalization Engine
// -------------------------------------------------------------

const CHAR_SUBSTITUTIONS = {
    'a': ['a', '@', '4', '/\\\\', '\\^', 'а', 'α'],
    'b': ['b', '8', '\\|3', '13', 'ß', 'в'],
    'c': ['c', '\\(', '<', '\\{', '\\[', '¢', 'с'],
    'd': ['d', '\\|\\)', '\\|\\]', 'cl', 'ԁ'],
    'e': ['e', '3', '€', '&', 'е', 'є'],
    'f': ['f', 'ph', '\\|=', 'ƒ'],
    'g': ['g', '9', '6'],
    'h': ['h', '#', '\\|-\\|', '\\[-\\]', 'н'],
    'i': ['i', '1', '!', '\\|', 'l', 'j', 'і', 'ι'],
    'j': ['j', '_\\|', 'ј'],
    'k': ['k', '\\|<', '\\|\\{', 'к'],
    'l': ['l', '1', '\\|', '!', 'i', '£', 'ⅼ', 'ӏ'],
    'm': ['m', '/\\\\/\\\\', '\\|\\\\/\\|', 'nn', 'rn', 'м'],
    'n': ['n', '\\|\\\\\\|', '/\\\\/', 'ñ', 'п'],
    'o': ['o', '0', '\\(\\)', '\\[\\]', 'о', 'ο'],
    'p': ['p', '\\|\\*', '\\|o', 'р'],
    'q': ['q', '9', 'kw', 'ԛ'],
    'r': ['r', '\\|2', 'г'],
    's': ['s', '\\$', '5', 'z', '§', 'ѕ'],
    't': ['t', '7', '\\+', '†', 'т'],
    'u': ['u', 'v', '\\|_\\|', 'µ', 'у'],
    'v': ['v', 'u', '\\\\/', 'ν'],
    'w': ['w', 'vv', '\\\\/\\\\/', 'uu', 'ԝ'],
    'x': ['x', '><', '%', '\\}\\{', 'х', 'χ'],
    'y': ['y', 'j', '¥', 'у'],
    'z': ['z', '2', '%']
};

const CONFUSABLES_MAP = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
    'А': 'a', 'В': 'b', 'Е': 'e', 'К': 'k', 'М': 'm', 'Н': 'h', 'О': 'o', 'Р': 'p', 'С': 'c', 'Т': 't', 'Х': 'x',
    'α': 'a', 'β': 'b', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'τ': 't', 'κ': 'k', 'ι': 'i', 'χ': 'x',
    'ⅼ': 'l', 'ӏ': 'l', 'Ӏ': 'l'
};

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    // 1. Unicode decomposition (NFKD) handles math bold/italic, fullwidth, circled characters, etc.
    let normalized = text.normalize('NFKD');
    // 2. Remove combining diacritical marks
    normalized = normalized.replace(/[\u0300-\u036f]/g, '');
    // 3. Remove zero-width & invisible characters
    normalized = normalized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD\u2060-\u206F]/g, '');
    // 4. Map confusable lookalike characters (Cyrillic, Greek, etc.)
    normalized = normalized.replace(/./g, ch => CONFUSABLES_MAP[ch] || ch);
    return normalized;
}

const regexCache = new Map();

function clearRegexCache() {
    regexCache.clear();
}

function getWordRegex(word) {
    const clean = word.toLowerCase().trim();
    if (regexCache.has(clean)) {
        return regexCache.get(clean);
    }

    const parts = [];
    for (const char of clean) {
        const subs = CHAR_SUBSTITUTIONS[char] || [escapeRegex(char)];
        parts.push('(?:' + subs.join('|') + ')+');
    }
    // Allow non-alphanumeric separators, newlines, spaces, emojis between characters
    const inner = parts.join('[\\s\\W_]*');
    // Enforce non-alphanumeric boundary around word to prevent false positives in innocent words
    const regex = new RegExp('(?:^|[\\s\\W_])(' + inner + ')(?:[\\s\\W_]|$)', 'i');
    regexCache.set(clean, regex);
    return regex;
}

function checkAgainstWords(text, words) {
    const normalized = normalizeText(text);
    for (const word of words) {
        const regex = getWordRegex(word);
        if (regex.test(normalized)) {
            return { matched: true, word };
        }
    }
    return { matched: false, word: null };
}

// Clean up stale message history entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, history] of userMessageHistory.entries()) {
        const filtered = history.filter(item => now - item.timestamp < 60000);
        if (filtered.length === 0) {
            userMessageHistory.delete(key);
        } else {
            userMessageHistory.set(key, filtered);
        }
    }
}, 5 * 60 * 1000).unref();

// -------------------------------------------------------------
// Main Automod Message Handler
// -------------------------------------------------------------

async function handleAutomodMessage(message) {
    if (!message || message.author?.bot || !message.guild) return false;

    const isAdmin = Boolean(message.member && message.member.permissions.has(PermissionFlagsBits.Administrator));

    const guildId = message.guild.id;
    const config = getAutomodConfig(guildId);

    if (!config.enabled) return false;

    const blockedWords = config.blockedWords && config.blockedWords.length > 0
        ? config.blockedWords
        : ['dalal', 'dalals'];

    const content = message.content ? message.content.trim() : '';
    console.log(`[Automod] 📩 Message in #${message.channel.name || message.channel.id} from ${message.author.tag} (Admin: ${isAdmin}): "${content}"`);

    const now = message.createdTimestamp || Date.now();
    // Cache per user across all server channels
    const cacheKey = `${guildId}:${message.author.id}`;

    // Get or initialize user message history
    let history = userMessageHistory.get(cacheKey) || [];
    // Keep messages from the last 45 seconds
    history = history.filter(item => now - item.timestamp < 45000);

    // 1. Check current message directly (supports single message obfuscation, e.g. d@l@l, multiline d\na\nl\na\nl, symbols, etc.)
    let matchResult = content ? checkAgainstWords(content, blockedWords) : { matched: false };
    let isMulti = false;
    let matchedSlice = null;

    if (matchResult.matched) {
        // Direct single message hit
        matchedSlice = [{ id: message.id, channelId: message.channel.id, content: message.content, timestamp: now }];
    } else if (content) {
        // 2. Check multi-message evasion across channels (e.g. user sending 'd', then 'a', then 'l', then 'a', then 'l', or 'da', 'lal')
        history.push({ id: message.id, channelId: message.channel.id, content: message.content, timestamp: now });
        if (history.length > 15) history = history.slice(-15);
        userMessageHistory.set(cacheKey, history);

        // Check sliding slices ending at the current message (from length 2 up to history length)
        for (let k = 2; k <= history.length; k++) {
            const slice = history.slice(-k);
            const candidates = [
                slice.map(m => m.content).join(' '),
                slice.map(m => m.content).join('\n'),
                slice.map(m => m.content).join('')
            ];

            for (const cand of candidates) {
                const subResult = checkAgainstWords(cand, blockedWords);
                if (subResult.matched) {
                    matchResult = subResult;
                    isMulti = true;
                    matchedSlice = slice;
                    break;
                }
            }
            if (matchResult.matched) break;
        }
    }

    if (!matchResult.matched) {
        return false;
    }

    // -------------------------------------------------------------
    // Violation Detected: Take Action
    // -------------------------------------------------------------
    const detectedWord = matchResult.word;
    const muteDurationMinutes = config.muteDurationMinutes || 15;
    const muteDurationMs = muteDurationMinutes * 60 * 1000;

    console.log(`[Automod] 🚨 MATCH DETECTED for forbidden word "${detectedWord}" from user ${message.author.tag} (Admin: ${isAdmin})! Deleting message...`);

    // Reset user buffer immediately to prevent repeated triggers
    userMessageHistory.delete(cacheKey);

    // 1. Delete offending messages (from any channel where they were sent)
    if (matchedSlice && matchedSlice.length > 0) {
        for (const msgItem of matchedSlice) {
            try {
                if (msgItem.id === message.id) {
                    await message.delete();
                    console.log(`[Automod] 🗑️ Deleted message ${message.id} from #${message.channel.name || message.channel.id}`);
                } else {
                    const targetChan = message.guild.channels.cache.get(msgItem.channelId) ||
                        await message.guild.channels.fetch(msgItem.channelId).catch(() => null);
                    if (targetChan) {
                        const fetchedMsg = await targetChan.messages.fetch(msgItem.id).catch(() => null);
                        if (fetchedMsg) {
                            await fetchedMsg.delete();
                            console.log(`[Automod] 🗑️ Deleted previous message ${msgItem.id} from #${targetChan.name || targetChan.id}`);
                        }
                    }
                }
            } catch (delErr) {
                console.error(`[Automod] ❌ Failed to delete message ${msgItem.id}:`, delErr.message, `(Code: ${delErr.code})`);
            }
        }
    }

    // 2. Timeout user for 15 minutes (skip muting if user is Administrator)
    let isMuted = false;
    let muteErrorMsg = '';
    if (isAdmin) {
        muteErrorMsg = 'User is Administrator (cannot be muted)';
    } else {
        try {
            if (message.member) {
                await message.member.timeout(muteDurationMs, `Automod: Forbidden word / evasion detected ("${detectedWord}")`);
                isMuted = true;
            }
        } catch (muteErr) {
            muteErrorMsg = muteErr.code === 50013
                ? 'Bot missing permissions or user has higher role'
                : muteErr.message;
            console.error(`[Automod] Failed to mute ${message.author.tag}:`, muteErrorMsg);
        }
    }

    // 3. Send DM to the user (only if muted)
    if (isMuted) {
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('⚠️ Automod Warning - You Have Been Muted')
                .setDescription(
                    `You have been muted in **${message.guild.name}** for **${muteDurationMinutes} minutes**.\n\n` +
                    `**Reason:** Using prohibited words or attempting to bypass word filters (\`${detectedWord}\`).\n\n` +
                    `Please adhere to server guidelines and refrain from bypassing the chat automod.`
                )
                .setFooter({ text: 'Blood Alliance Automod' })
                .setTimestamp();

            await message.author.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (dmErr) {
            // Ignore DM failed (e.g. user closed DMs)
        }
    }

    // 4. Send Log to the configured channel
    const logChannelId = config.logChannelId || process.env.AUTOMOD_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
    if (logChannelId) {
        try {
            const logChannel = message.guild.channels.cache.get(logChannelId) ||
                await message.guild.channels.fetch(logChannelId).catch(() => null);

            if (logChannel) {
                let contentDisplay = '';
                if (isMulti) {
                    contentDisplay = matchedSlice.map((m, idx) => `**Message ${idx + 1}:** \`${m.content.slice(0, 100)}\``).join('\n');
                } else {
                    contentDisplay = `\`\`\`\n${message.content.slice(0, 500)}\n\`\`\``;
                }

                const logEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle(`${getEmoji('bluex') || '🚫'} Automod Violation Detected`)
                    .setAuthor({
                        name: `${message.author.tag} (${message.author.id})`,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .addFields(
                        { name: '👤 User', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                        { name: '📍 Channel', value: `${message.channel} (\`${message.channel.id}\`)`, inline: true },
                        {
                            name: '⏳ Action Taken',
                            value: isMuted
                                ? `Muted for **${muteDurationMinutes}m** & deleted message(s)`
                                : `Deleted message(s) *(Mute failed: ${muteErrorMsg || 'No permission'})*`,
                            inline: false
                        },
                        { name: '🛑 Forbidden Word', value: `\`${detectedWord}\``, inline: true },
                        {
                            name: '🔍 Detection Type',
                            value: isMulti
                                ? `Split across **${matchedSlice.length}** separate messages`
                                : 'Single message (obfuscation/leetspeak/multiline)',
                            inline: true
                        },
                        { name: '📝 Message Content', value: contentDisplay || '*Empty*' }
                    )
                    .setFooter({ text: 'Blood Alliance Security' })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] }).catch(err => {
                    console.error('[Automod] Failed to send embed to log channel:', err);
                });
            } else {
                console.warn(`[Automod] Configured log channel ${logChannelId} was not found.`);
            }
        } catch (logErr) {
            console.error('[Automod] Error logging violation:', logErr);
        }
    }

    return true;
}

module.exports = {
    getAutomodConfig,
    setAutomodLogChannel,
    setAutomodEnabled,
    setMuteDuration,
    addBlockedWord,
    removeBlockedWord,
    getBlockedWords,
    normalizeText,
    checkAgainstWords,
    handleAutomodMessage
};
