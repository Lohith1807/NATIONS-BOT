import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// 1. Startup validation
const token = process.env.DISCORD_BOT_TOKEN;
const apiKey = process.env.GEMINI_API_KEY;

if (!token || token.trim() === '' || token.toLowerCase().startsWith('your_')) {
    console.error('Error: DISCORD_BOT_TOKEN is missing or contains placeholder values.');
    process.exit(1);
}

if (!apiKey || apiKey.trim() === '' || apiKey.toLowerCase().startsWith('your_')) {
    console.error('Error: GEMINI_API_KEY is missing or contains placeholder values.');
    process.exit(1);
}

// 2. Initialize Clients
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const genAI = new GoogleGenerativeAI(apiKey);

// State Management
const enabledChannels = new Set();
const targetUsers = new Map(); // Map: userId -> { mode: string }

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
        )
].map(cmd => cmd.toJSON());

// 4. Ready Handler
client.once('ready', async () => {
    // Print success message displaying the bot tag as requested
    console.log(`Bot tag: ${client.user.tag}`);
    
    // Register commands globally
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
    } catch (error) {
        console.error('Error registering global slash commands:', error);
    }
});

// 5. Slash Command Interactions (No console.log here!)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const { commandName } = interaction;

        if (commandName === 'ai_agent') {
            const action = interaction.options.getString('action');
            if (action === 'Start') {
                enabledChannels.add(interaction.channelId);
                await interaction.reply({ content: 'AI agent started in this channel.', ephemeral: true });
            } else if (action === 'Stop') {
                enabledChannels.delete(interaction.channelId);
                await interaction.reply({ content: 'AI agent stopped in this channel.', ephemeral: true });
            }
        } else if (commandName === 'traget_user') {
            const user = interaction.options.getUser('user');
            const action = interaction.options.getString('action');
            
            targetUsers.set(user.id, { mode: action });
            await interaction.reply({ content: `Target user configured: ${user.username} is now on ${action}.`, ephemeral: true });
        } else if (commandName === 'traget_off') {
            const user = interaction.options.getUser('user');
            targetUsers.delete(user.id);
            await interaction.reply({ content: `Removed ${user.username} from target list.`, ephemeral: true });
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
    }
});

// Helper function to call Gemini
async function getGeminiRoast(userMessage, systemInstruction) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
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

    return result.response.text();
}

// Helper function to safely send message within Discord's 2000 character limit
async function sendSplitMessage(message, text) {
    if (text.length <= 2000) {
        await message.reply(text);
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
        let lastMessage = await message.reply(chunks[0]);
        // Send subsequent chunks as follow-up messages in the same channel
        for (let i = 1; i < chunks.length; i++) {
            lastMessage = await message.channel.send(chunks[i]);
        }
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
                name: 'Mod Messi is Gay',
                avatar: client.user.displayAvatarURL(),
                reason: 'Exclusive webhook for target roasts'
            });
        }

        if (webhook) {
            if (mentionText.length <= 2000) {
                await webhook.send({
                    content: mentionText,
                    username: 'Mod Messi Fraud',
                    avatarURL: client.user.displayAvatarURL(),
                    allowedMentions: { users: [message.author.id] }
                });
            } else {
                const chunks = mentionText.match(/[\s\S]{1,1900}/g) || [mentionText];
                for (const chunk of chunks) {
                    await webhook.send({
                        content: chunk,
                        username: 'Mod Messi Fraud',
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

// 6. Message Handler (No console.log here!)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Check for specific ping interaction
    if (message.mentions.has(client.user)) {
        // Dismiss specific user when they tag the bot
        if (message.author.id === '1299282477076058156') {
            try {
                await message.reply("you dumb ass dont disturb me, if i start you will");
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
        }
    } catch (error) {
        // Robust error logging for the API request
        console.error('Error processing message or generating response:', error);
    }
});

// Login
client.login(token).catch(err => {
    console.error('Failed to login to Discord:', err);
});
