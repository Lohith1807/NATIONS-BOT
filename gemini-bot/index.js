import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, Partials } from 'discord.js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// 1. Startup validation
const token = process.env.DISCORD_BOT_TOKEN || process.env.GEMINI_BOT_TOKEN;
const apiKey = process.env.GEMINI_API_KEY;

if (!token || token.trim() === '' || token.toLowerCase().startsWith('your_')) {
    console.error('Error: DISCORD_BOT_TOKEN is missing or contains placeholder values.');
    process.exit(1);
}

if (!apiKey || apiKey.trim() === '' || apiKey.toLowerCase().startsWith('your_')) {
    console.error('Error: GEMINI_API_KEY is missing or contains placeholder values.');
    process.exit(1);
}

// Process safety
process.on('unhandledRejection', error => {
    console.error('Unhandled Promise Rejection:', error);
});
process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});

// 2. Initialize Clients
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User
    ]
});

const genAI = new GoogleGenerativeAI(apiKey);

// State Management
const enabledChannels = new Set();
const targetUsers = new Map(); // Map: userId -> { mode: string }
const ghostReactionCooldowns = new Map();

// Ghost reaction detection definitions
const GHOST_LETTERS = new Set(['g', 'h', 'o', 's', 't']);
const GHOST_UNICODE_CHARS = new Set([
    '🇬', '🇭', '🇴', '🇸', '🇹', // Regional indicator letters
    '🅖', '🅗', '🅞', '🅢', '🅣', // Circled / boxed letters
    '🅶', '🅷', '🅾️', '🅾', '🆂', '🆃', // Squared letters
    'Ⓖ', 'Ⓗ', 'Ⓞ', 'Ⓢ', 'Ⓣ', // Circled latin
    'ⓖ', 'ⓗ', 'ⓞ', 'ⓢ', 'ⓣ', // Small circled latin
    '👻' // Ghost emoji
]);

function isGhostReaction(emoji) {
    if (!emoji || !emoji.name) return false;

    // Check direct unicode set match
    if (GHOST_UNICODE_CHARS.has(emoji.name)) return true;

    // Check code points for regional indicators: G (0x1F1EC), H (0x1F1ED), O (0x1F1F4), S (0x1F1F8), T (0x1F1F9)
    // and blood type O (0x1F17E), ghost emoji (0x1F47B)
    const codePoint = emoji.name.codePointAt(0);
    if (codePoint) {
        if ([0x1f1ec, 0x1f1ed, 0x1f1f4, 0x1f1f8, 0x1f1f9, 0x1f17e, 0x1f47b].includes(codePoint)) {
            return true;
        }
    }

    const cleanName = emoji.name.toLowerCase().trim();

    // Check single letter
    if (GHOST_LETTERS.has(cleanName)) return true;

    // Check if name contains 'ghost'
    if (cleanName.includes('ghost')) return true;

    // Check custom emoji names like regional_indicator_g, letter_g, emoji_g, etc.
    const match = cleanName.match(/^(?:regional_indicator_|letter_|alphabet_|symbol_|font_)?([a-z])$/);
    if (match && GHOST_LETTERS.has(match[1])) {
        return true;
    }

    return false;
}

// 3. Define commands
const commands = [
    new SlashCommandBuilder()
        .setName('ai_agent')
        .setDescription('Start or stop the AI agent in this channel')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Start or Stop')
                .setRequired(true)
                .addChoices(
                    { name: 'Start', value: 'Start' },
                    { name: 'Stop', value: 'Stop' }
                )
        ),
    new SlashCommandBuilder()
        .setName('traget_user')
        .setDescription('Configure roast mode for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to target')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Roast mode to use')
                .setRequired(true)
                .addChoices(
                    { name: 'Roast mode', value: 'Roast mode' },
                    { name: 'Ragebait mode', value: 'Ragebait mode' },
                    { name: '18+ roast', value: '18+ roast' }
                )
        ),
    new SlashCommandBuilder()
        .setName('traget_off')
        .setDescription('Remove a user from the target list')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('messi')
        .setDescription('Tag call boy messi')
].map(cmd => cmd.toJSON());

// 4. Ready Handler
client.once('clientReady', async () => {
    console.log(`Bot tag: ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Registering slash commands globally...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Global slash commands registered successfully!');

        // Also register directly to all guilds for instant availability
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, guildId),
                    { body: commands }
                );
                console.log(`Registered slash commands to guild: ${guild.name} (${guildId})`);
            } catch (gErr) {
                console.warn(`Could not register commands to guild ${guildId}:`, gErr.message);
            }
        }
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// 5. Slash Command Interactions (No console.log here!)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Restrict all slash commands to Chief only
    const CHIEF_ID = '1393061101838532630';
    if (interaction.user.id !== CHIEF_ID) {
        await interaction.reply({
            content: "I'm the assistant for Ghost, not for you.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        const { commandName } = interaction;

        if (commandName === 'ai_agent') {
            const action = interaction.options.getString('action');
            if (action === 'Start') {
                enabledChannels.add(interaction.channelId);
                await interaction.reply({ content: 'AI agent started in this channel.', flags: MessageFlags.Ephemeral });
            } else if (action === 'Stop') {
                enabledChannels.delete(interaction.channelId);
                await interaction.reply({ content: 'AI agent stopped in this channel.', flags: MessageFlags.Ephemeral });
            }
        } else if (commandName === 'traget_user') {
            const user = interaction.options.getUser('user');
            const action = interaction.options.getString('action');

            targetUsers.set(user.id, { mode: action });
            await interaction.reply({ content: `Target user configured: ${user.username} is now on ${action}.`, flags: MessageFlags.Ephemeral });
        } else if (commandName === 'traget_off') {
            const user = interaction.options.getUser('user');
            targetUsers.delete(user.id);
            await interaction.reply({ content: `Removed ${user.username} from target list.`, flags: MessageFlags.Ephemeral });
        } else if (commandName === 'messi') {
            await interaction.reply({ content: 'Sent!', flags: MessageFlags.Ephemeral });
            if (interaction.channel) {
                await sendMessiWebhook(interaction.channel);
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
    }
});

// Helper function to call Gemini with retry, backoff, and model fallback
async function getGeminiRoast(userMessage, systemInstruction) {
    const candidateModels = [
        process.env.GEMINI_MODEL,
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest'
    ].filter(Boolean).filter((val, idx, arr) => arr.indexOf(val) === idx);

    let lastError = null;

    for (const modelName of candidateModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemInstruction,
                    safetySettings: [
                        {
                            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                        {
                            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                        {
                            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                        {
                            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                    ],
                });

                const result = await model.generateContent({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: userMessage }]
                        }
                    ]
                });

                const text = result?.response?.text();
                if (text && text.trim() !== '') {
                    return text;
                }
            } catch (err) {
                lastError = err;
                const errMsg = err?.message || String(err);
                const status = err?.status;
                const isRetryable = status === 503 || status === 429 || (status >= 500 && status < 600) ||
                    errMsg.includes('503') || errMsg.includes('429') ||
                    errMsg.includes('fetch failed') || errMsg.includes('high demand') ||
                    errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNRESET');

                console.warn(`[Gemini API] Model '${modelName}' attempt ${attempt} failed: ${errMsg.split('\n')[0]}`);

                if (attempt < 2 && isRetryable) {
                    const delayMs = 800 * attempt + Math.floor(Math.random() * 400);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                break;
            }
        }
    }

    console.error('[Gemini API] All fallback models failed. Last error:', lastError?.message || lastError);
    return null;
}


// Helper function to safely send message within Discord's 2000 character limit
async function sendSplitMessage(message, text) {
    try {
        if (text.length <= 2000) {
            await message.reply(text).catch(() => message.channel.send(text));
            return;
        }

        const chunks = [];
        let currentChunk = '';
        const lines = text.split('\n');

        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > 1900) {
                if (currentChunk.trim() !== '') {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                // If a single line itself is longer than 1900 characters, split it by characters
                if (line.length > 1900) {
                    let tempLine = line;
                    while (tempLine.length > 1900) {
                        chunks.push(tempLine.slice(0, 1900));
                        tempLine = tempLine.slice(1900);
                    }
                    currentChunk = tempLine;
                } else {
                    currentChunk = line;
                }
            } else {
                currentChunk = currentChunk ? currentChunk + '\n' + line : line;
            }
        }
        if (currentChunk.trim() !== '') {
            chunks.push(currentChunk);
        }

        // Send the first chunk as a reply
        if (chunks.length > 0) {
            await message.reply(chunks[0]).catch(() => message.channel.send(chunks[0]));
            // Send subsequent chunks as follow-up messages in the same channel
            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send(chunks[i]).catch(console.error);
            }
        }
    } catch (err) {
        console.error('Error in sendSplitMessage:', err);
    }
}

// Helper function to send messages to targeted users EXCLUSIVELY via Webhook
async function sendTargetRoast(message, text) {
    const mentionText = `<@${message.author.id}>\n${text}`;

    try {
        if (!message.guild || !message.channel || typeof message.channel.fetchWebhooks !== 'function') {
            console.error('Channel does not support webhooks or is a DM.');
            return;
        }

        const webhooks = await message.channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.token && (wh.owner?.id === client.user.id || wh.name === 'Mod Messi Fraud'))
            || webhooks.find(wh => wh.token);

        if (!webhook) {
            webhook = await message.channel.createWebhook({
                name: 'cwl Messi is Gay',
                avatar: client.user.displayAvatarURL(),
                reason: 'Exclusive webhook for target roasts'
            });
        }

        if (webhook) {
            if (mentionText.length <= 2000) {
                await webhook.send({
                    content: mentionText,
                    username: 'cwl Messi is gay',
                    avatarURL: client.user.displayAvatarURL(),
                    allowedMentions: { users: [message.author.id] }
                });
            } else {
                const chunks = mentionText.match(/[\s\S]{1,1900}/g) || [mentionText];
                for (const chunk of chunks) {
                    await webhook.send({
                        content: chunk,
                        username: 'CWL Messi GAY',
                        avatarURL: client.user.displayAvatarURL(),
                        allowedMentions: { users: [message.author.id] }
                    });
                }
            }
        } else {
            console.error('Failed to find or create a webhook in this channel.');
        }
    } catch (whError) {
        console.error('Failed to send exclusively via webhook:', whError);
    }
}

// Helper function to send /messi callout via Webhook
async function sendMessiWebhook(channel) {
    const content = '<@1299282477076058156> Hey , Call boy messi where are u ?';
    try {
        if (!channel || typeof channel.fetchWebhooks !== 'function') {
            await channel.send({
                content: content,
                allowedMentions: { users: ['1299282477076058156'] }
            });
            return;
        }

        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.token && (wh.owner?.id === client.user.id || wh.name === 'CWL Messi GAY' || wh.name === 'cwl Messi is Gay' || wh.name === 'Mod Messi Fraud'))
            || webhooks.find(wh => wh.token);

        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'CWL Messi GAY',
                avatar: client.user.displayAvatarURL(),
                reason: 'Webhook for messi callout'
            });
        }

        if (webhook) {
            await webhook.send({
                content: content,
                username: 'CWL Messi GAY',
                avatarURL: client.user.displayAvatarURL(),
                allowedMentions: { users: ['1299282477076058156'] }
            });
        } else {
            await channel.send({
                content: content,
                allowedMentions: { users: ['1299282477076058156'] }
            });
        }
    } catch (err) {
        console.error('Failed to send messi callout via webhook:', err);
        await channel.send({
            content: content,
            allowedMentions: { users: ['1299282477076058156'] }
        }).catch(console.error);
    }
}

// 6. Message Handler (No console.log here!)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Check for specific ping interaction
    if (message.mentions.has(client.user)) {
        // Dismiss specific user when they tag the bot
        if (message.author.id === '1299282477076058156') {
            try {
                await message.reply("you dumb ass dont disturb me, if i start you will be cooked");
            } catch (error) {
                console.error('Error replying to dismissed user:', error);
            }
            return;
        }

        const contentLower = message.content.toLowerCase();
        if (contentLower.includes('are you on') || contentLower.includes('are u on') || contentLower.includes('you on')) {
            if (message.author.id === '1393061101838532630') {
                try {
                    await message.reply("Yes Chief, I'm online! Who needs to be attacked? Messi or someone else?");
                } catch (error) {
                    console.error('Error replying to Chief:', error);
                }
            } else {
                try {
                    await message.reply("I'm the assistant for Ghost, not for you.");
                } catch (error) {
                    console.error('Error replying to non-Chief:', error);
                }
            }
            return;
        }
    }

    // Check for /messi command in text
    if (message.content.trim().toLowerCase() === '/messi') {
        if (message.author.id !== '1393061101838532630') {
            try {
                await message.reply("I'm the assistant for Ghost, not for you.");
            } catch (error) {
                console.error('Error replying to non-Chief:', error);
            }
            return;
        }

        try {
            if (message.deletable) {
                await message.delete().catch(() => { });
            }
            await sendMessiWebhook(message.channel);
        } catch (error) {
            console.error('Error handling /messi command:', error);
        }
        return;
    }

    // Check if the message contains the word 'messi' (case-insensitive)
    if (message.content.toLowerCase().includes('messi')) {
        try {
            await message.reply('messi is a call gay same like <@1299282477076058156> , more over messi is a cheater');
        } catch (error) {
            console.error('Error replying to messi message:', error);
        }
        return;
    }

    const isTarget = targetUsers.has(message.author.id);

    // If the author is not a target, check if the bot is enabled in this channel
    if (!isTarget && !enabledChannels.has(message.channelId)) return;

    try {
        // Trigger typing indicator
        await message.channel.sendTyping();

        // Determine instructions based on target user mode
        const targetConfig = targetUsers.get(message.author.id);

        if (targetConfig) {
            const userLower = message.author.username.toLowerCase();
            const nickLower = (message.member?.displayName || '').toLowerCase();
            const contentLower = message.content.toLowerCase();

            // Check if targeted user claims Ghost or uses any name other than their username/nickname
            const hasGhostClaim = contentLower.includes('ghost') && !userLower.includes('ghost') && !nickLower.includes('ghost');

            const nameMatch = contentLower.match(/(?:my\s*name\s*is\s+|name['’]?s\s+|i\s*am\s+|i['’]?m\s+|call\s*me\s+|this\s*is\s+|myself\s+)([a-zA-Z0-9_]+)/i);
            let hasFakeNameClaim = false;
            if (nameMatch && nameMatch[1]) {
                const claimedName = nameMatch[1].toLowerCase();
                const commonWords = ['a', 'an', 'the', 'not', 'just', 'so', 'here', 'back', 'online', 'bored', 'done', 'fine', 'good', 'okay', 'ready', 'trying', 'saying', 'telling', 'gonna', 'really'];
                if (!commonWords.includes(claimedName) && !userLower.includes(claimedName) && !nickLower.includes(claimedName)) {
                    hasFakeNameClaim = true;
                }
            }

            if (hasGhostClaim || hasFakeNameClaim) {
                await sendTargetRoast(message, "Can't you use your own name instead of copying others, you noob 💀");
                return;
            }
        }

        let systemInstruction = '';

        if (targetConfig) {
            const identityNotice = `\nImportant: The target's genuine username is "${message.author.username}" and display name is "${message.member?.displayName || message.author.username}". If they use, claim, or pretend to have any other name, or copy someone else's identity, reply directly with: "Can't you use your own name instead of copying others, you noob".`;

            if (targetConfig.mode === 'Ragebait mode') {
                systemInstruction = `You are a master of internet ragebait, condescending sarcasm, and dismissive trolling. The user is targeted to be ragebaited.
Generate a direct reply in EXACTLY 3 short, punchy lines separated by single line breaks. Do NOT write paragraphs, numbered lists, or bullet points.
Line 1: A dismissive laugh or condescending pity (e.g., mock sympathy, "Aww, you really thought you did something").
Line 2: A cold, patronizing observation pointing out how desperate, emotional, or irrelevant they look.
Line 3: A short brush-off telling them to log off, go outside, or take a seat, ending with a skull or clown emoji (💀 or 🤡).
Tone: Extremely unbothered, smug, patronizing, and dismissive. Return ONLY the 3 lines of text.` + identityNotice;
            } else if (targetConfig.mode === 'Roast mode') {
                systemInstruction = `You are a savage, witty, and sarcastic roasting assistant. The user is currently targeted under "Roast mode".
Generate a short, savage roast direct reply in EXACTLY 3 punchy lines separated by single line breaks.
Make it concise, unbothered, and funny. Show no mercy, but avoid extremely vulgar 18+ profanity unless they swore first.
Return ONLY 3 clean lines. Do NOT use numbers, bullet points, or quotes.` + identityNotice;
            } else if (targetConfig.mode === '18+ roast') {
                systemInstruction = `You are an extremely vulgar, profane, and savage 18+ roasting assistant. The user is currently targeted under "18+ roast".
Generate an explicit, profane, and devastating roast direct reply in EXACTLY 3 short, brutal lines separated by single line breaks.
Show absolutely no mercy, make it highly insulting and vulgar. You are explicitly allowed and encouraged to use mature, explicit, and curse words without any filter.
Return ONLY 3 clean lines without numbers or bullets.` + identityNotice;
            }
        } else {
            // General talkative and helpful behavior in enabled channels (non-target users)
            systemInstruction = `You are a highly helpful, friendly, and talkative AI assistant. The user is chatting in a Discord channel where you are enabled. 
Provide detailed, informative, and engaging answers to whatever they ask. If they ask for information, make sure to give helpful resources, links, or detailed explanations.
Maintain a warm, polite, and conversational tone. Do NOT roast, mock, or insult the user, and do NOT use offensive or vulgar language under any circumstances.
IMPORTANT: Keep your response clear, detailed, but under 1800 characters so that it fits within Discord's message length limits.`;
        }

        let replyContent = await getGeminiRoast(message.content, systemInstruction);
        if (replyContent && replyContent.trim() !== '') {
            if (targetConfig) {
                // Clean up any accidental numbering, bullets, or wrapping quotes from AI output
                replyContent = replyContent
                    .split('\n')
                    .map(line => line.replace(/^[\d\-*•]+\.\s*|^[\d\-*•]+\)\s*|^["'`]|["'`]$/g, '').trim())
                    .filter(line => line.length > 0)
                    .slice(0, 3)
                    .join('\n');
                await sendTargetRoast(message, replyContent);
            } else {
                await sendSplitMessage(message, replyContent);
            }
        } else if (targetConfig) {
            // Fallback roast if all AI models are temporarily unavailable or high demand
            const defaultRoasts = [
                "Even Google's servers refused to process whatever you just said 💀",
                "You're not even worth the AI compute power right now 💀",
                "Keep crying to the wall, you absolute noob 💀"
            ];
            const fallback = defaultRoasts[Math.floor(Math.random() * defaultRoasts.length)];
            await sendTargetRoast(message, fallback);
        } else if (enabledChannels.has(message.channelId)) {
            await message.reply("⚠️ The AI service is currently experiencing high demand. Please try again in a few moments.");
        }
    } catch (error) {
        // Robust error logging for the API request
        console.error('Error processing message or generating response:', error);
    }
});

// 7. Reaction Handler (Detects 'G H O S T' letters in reactions)
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        if (!user || user.bot) return;

        // Ignore Ghost / Chief himself
        if (user.id === '1393061101838532630') return;

        // Fetch partials if uncached
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (err) {
                console.error('Error fetching partial reaction:', err);
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            } catch (err) {
                console.error('Error fetching partial user:', err);
                return;
            }
        }
        if (reaction.message?.partial) {
            try {
                await reaction.message.fetch();
            } catch (err) {
                console.error('Error fetching partial reaction message:', err);
                return;
            }
        }

        if (!isGhostReaction(reaction.emoji)) return;

        // Cooldown per user to prevent multi-reaction spam
        const now = Date.now();
        const lastTrigger = ghostReactionCooldowns.get(user.id) || 0;
        if (now - lastTrigger < 8000) return;
        ghostReactionCooldowns.set(user.id, now);

        if (ghostReactionCooldowns.size > 200) {
            for (const [id, timestamp] of ghostReactionCooldowns.entries()) {
                if (now - timestamp > 30000) {
                    ghostReactionCooldowns.delete(id);
                }
            }
        }

        const replyContent = `<@${user.id}> gay if u have dare then talk to me directly not in reactions u stupid`;

        try {
            await reaction.message.reply({
                content: replyContent,
                allowedMentions: {
                    users: [user.id],
                    repliedUser: false
                }
            });
        } catch (replyErr) {
            try {
                await reaction.message.channel.send({
                    content: replyContent,
                    allowedMentions: {
                        users: [user.id]
                    }
                });
            } catch (channelErr) {
                console.error('Error sending ghost reaction response to channel:', channelErr);
            }
        }
    } catch (err) {
        console.error('Error in messageReactionAdd handler:', err);
    }
});

// Login
client.login(token).catch(err => {
    console.error('Failed to login to Discord:', err);
});
