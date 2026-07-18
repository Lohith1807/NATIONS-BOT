import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
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

// 6. Message Handler (No console.log here!)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Check if the message contains the word 'messi' (case-insensitive)
    if (message.content.toLowerCase().includes('messi')) {
        try {
            await message.reply('messi is a call gay same like you , more over messi is a cheater');
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
        let systemInstruction = '';

        if (targetConfig) {
            if (targetConfig.mode === 'Roast mode') {
                systemInstruction = `You are a savage, witty, and sarcastic roasting assistant. The user is currently targeted under "Roast mode". Generate a short, funny, and savage roast direct reply (1-3 sentences) to their message. Show no mercy. Use modern Discord/internet slang if appropriate. Do not use extremely vulgar 18+ profanity unless they swore first.`;
            } else if (targetConfig.mode === '18+ roast') {
                systemInstruction = `You are an extremely vulgar, profane, and savage 18+ roasting assistant. The user is currently targeted under "18+ roast". Generate an extremely profane, vulgar, explicit, and savage 18+ roast direct reply (1-3 sentences) to their message. Show absolutely no mercy, make it highly insulting and vulgar. You are explicitly allowed and encouraged to use mature, explicit, and curse words without any filter.`;
            }
        } else {
            // General talkative and helpful behavior in enabled channels (non-target users)
            systemInstruction = `You are a highly helpful, friendly, and talkative AI assistant. The user is chatting in a Discord channel where you are enabled. 
Provide detailed, informative, and engaging answers to whatever they ask. If they ask for information, make sure to give helpful resources, links, or detailed explanations.
Maintain a warm, polite, and conversational tone. Do NOT roast, mock, or insult the user, and do NOT use offensive or vulgar language under any circumstances.
IMPORTANT: Keep your response clear, detailed, but under 1800 characters so that it fits within Discord's message length limits.`;
        }

        const replyContent = await getGeminiRoast(message.content, systemInstruction);
        if (replyContent && replyContent.trim() !== '') {
            await sendSplitMessage(message, replyContent);
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
