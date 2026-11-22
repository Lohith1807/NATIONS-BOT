const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client, GatewayIntentBits, Collection, Events, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
});

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// ─── Quiz Manager Loader (Safe & Self-Healing) ─────────────────────────────
function getQuizManager() {
    const canonicalPath = path.join(__dirname, 'utils', 'quizManager.js');
    if (fs.existsSync(canonicalPath)) {
        try {
            return require(canonicalPath);
        } catch (_) {}
    }

    try {
        return require('./utils/quizManager');
    } catch (_) {}

    // Dynamic case lookup on Linux without conflicting static string imports
    try {
        const utilsDir = path.join(__dirname, 'utils');
        if (fs.existsSync(utilsDir)) {
            const files = fs.readdirSync(utilsDir);
            const match = files.find(f => f.toLowerCase() === 'quizmanager.js');
            if (match) {
                return require(path.join(utilsDir, match));
            }
        }
    } catch (_) {}

    // Self-healing fallback: If the file is missing on the remote server, recreate it automatically!
    try {
        const utilsDir = path.join(__dirname, 'utils');
        if (!fs.existsSync(utilsDir)) fs.mkdirSync(utilsDir, { recursive: true });
        const targetPath = path.join(utilsDir, 'quizManager.js');
        const code = `const fs = require('fs');
const path = require('path');
const dataFilePath = path.join(__dirname, '..', 'data', 'quizzes.json');

function init() {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(dataFilePath)) fs.writeFileSync(dataFilePath, JSON.stringify({ answeredUsers: {}, activeQuizzes: {} }, null, 2));
}

function getQuizData() {
    init();
    try {
        const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        data.answeredUsers = data.answeredUsers || {};
        data.activeQuizzes = data.activeQuizzes || {};
        return data;
    } catch (err) {
        return { answeredUsers: {}, activeQuizzes: {} };
    }
}

function saveQuizData(data) {
    init();
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

function hasUserAnswered(quizId, userId) {
    const data = getQuizData();
    return !!(data.answeredUsers[quizId] && data.answeredUsers[quizId].includes(userId));
}

function markUserAnswered(quizId, userId) {
    const data = getQuizData();
    if (!data.answeredUsers[quizId]) data.answeredUsers[quizId] = [];
    if (!data.answeredUsers[quizId].includes(userId)) {
        data.answeredUsers[quizId].push(userId);
        saveQuizData(data);
    }
}

function saveActiveQuiz(quizId, quizInfo) {
    const data = getQuizData();
    data.activeQuizzes[quizId] = quizInfo;
    saveQuizData(data);
}

function getActiveQuiz(quizId) {
    const data = getQuizData();
    return data.activeQuizzes[quizId];
}

module.exports = { hasUserAnswered, markUserAnswered, saveActiveQuiz, getActiveQuiz };
`;
        fs.writeFileSync(targetPath, code, 'utf8');
        return require(targetPath);
    } catch (err) {
        console.error('❌ [BA_COUNT] Failed to auto-create quizManager.js:', err);
    }

    // In-memory fallback if disk write failed
    const inMemoryQuizzes = { answeredUsers: {}, activeQuizzes: {} };
    return {
        hasUserAnswered: (quizId, userId) => !!(inMemoryQuizzes.answeredUsers[quizId] && inMemoryQuizzes.answeredUsers[quizId].includes(userId)),
        markUserAnswered: (quizId, userId) => {
            if (!inMemoryQuizzes.answeredUsers[quizId]) inMemoryQuizzes.answeredUsers[quizId] = [];
            inMemoryQuizzes.answeredUsers[quizId].push(userId);
        },
        saveActiveQuiz: (quizId, quizInfo) => { inMemoryQuizzes.activeQuizzes[quizId] = quizInfo; },
        getActiveQuiz: (quizId) => inMemoryQuizzes.activeQuizzes[quizId]
    };
}

// Pass messages to our counting logic file
client.on(Events.MessageCreate, async (message) => {
    const messageCreateEvent = require('./events/messageCreate');
    await messageCreateEvent.execute(message, client);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    const messageUpdateEvent = require('./events/messageUpdate');
    await messageUpdateEvent.execute(oldMessage, newMessage, client);
});

client.on(Events.MessageDelete, async (message) => {
    const messageDeleteEvent = require('./events/messageDelete');
    await messageDeleteEvent.execute(message, client);
});

// Handle Interactions
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => {});
            }
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'createCountingRoleModal') {
            const roleName = interaction.fields.getTextInputValue('roleNameInput');
            const countStr = interaction.fields.getTextInputValue('countInput');
            const count = parseInt(countStr, 10);
            
            if (isNaN(count)) {
                return interaction.reply({ content: 'Count must be a valid number.', ephemeral: true });
            }
            
            const guildId = interaction.guildId;
            const { getServers, saveServers } = require('./utils/dataManager');
            let servers = getServers();
            
            if (!servers[guildId]) {
                return interaction.reply({ content: 'Counting has not been set up yet!', ephemeral: true });
            }
            if (!servers[guildId].roles) {
                const { DEFAULT_ROLES } = require('./events/messageCreate');
                servers[guildId].roles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
            }
            
            const existingIndex = servers[guildId].roles.findIndex(r => r.threshold === count);
            if (existingIndex !== -1) {
                servers[guildId].roles[existingIndex].name = roleName;
            } else {
                servers[guildId].roles.push({ threshold: count, name: roleName });
            }
            
            servers[guildId].roles.sort((a, b) => b.threshold - a.threshold);
            saveServers(servers);
            
            await interaction.reply({ content: `Successfully added counting role **${roleName}** for reaching count **${count}**!`, ephemeral: true });
        } else if (interaction.customId.startsWith('quizCreateModal_')) {
            const parts = interaction.customId.split('_');
            const roleId = parts[1];
            const noOfQuestions = parseInt(parts[2], 10);
            const { saveActiveQuiz } = getQuizManager();
            
            const questions = [];
            for (let i = 1; i <= noOfQuestions; i++) {
                questions.push(interaction.fields.getTextInputValue(`question_${i}`));
            }

            const quizId = Date.now().toString();
            saveActiveQuiz(quizId, { questions, roleId, creatorId: interaction.user.id });

            const embed = new EmbedBuilder()
                .setTitle('New Quiz!')
                .setDescription('Click the button below to answer the quiz. You can only answer once!')
                .setColor('Blurple')
                .setTimestamp();
            
            questions.forEach((q, index) => {
                embed.addFields({ name: `Question ${index + 1}`, value: q });
            });

            const answerButton = new ButtonBuilder()
                .setCustomId(`quizAnswerBtn_${quizId}`)
                .setLabel('Answer')
                .setStyle(ButtonStyle.Primary);
            
            const actionRow = new ActionRowBuilder().addComponents(answerButton);

            await interaction.reply({ 
                content: `<@&${roleId}>`,
                embeds: [embed],
                components: [actionRow]
            });
        } else if (interaction.customId.startsWith('quizSubmitModal_')) {
            const quizId = interaction.customId.split('_')[1];
            const { getActiveQuiz, markUserAnswered } = getQuizManager();
            
            const quizInfo = getActiveQuiz(quizId);
            if (!quizInfo) {
                return interaction.reply({ content: 'This quiz is no longer active.', flags: MessageFlags.Ephemeral });
            }

            markUserAnswered(quizId, interaction.user.id);
            
            const answers = [];
            for (let i = 1; i <= quizInfo.questions.length; i++) {
                try {
                    const ans = interaction.fields.getTextInputValue(`answer_${i}`);
                    answers.push(ans || 'No answer provided');
                } catch (_) {
                    answers.push('No answer provided');
                }
            }

            await interaction.reply({ content: 'Your answers have been submitted!', flags: MessageFlags.Ephemeral });

            // ─── Log to Dedicated Quiz Log Channel ─────────────────────────
            const logChannelId = process.env.QUIZ_LOG_CHANNEL || '1533120195739123762';
            console.log(`[Quiz] 📝 User ${interaction.user.tag} (${interaction.user.id}) submitted answers for quiz ${quizId}. Logging to channel ${logChannelId}...`);

            let logChannel = null;
            try {
                logChannel = interaction.guild?.channels.cache.get(logChannelId) ||
                    interaction.client.channels.cache.get(logChannelId) ||
                    await interaction.client.channels.fetch(logChannelId).catch(err => {
                        console.error(`❌ [Quiz] Error fetching log channel ${logChannelId}:`, err.message);
                        return null;
                    });
            } catch (chanErr) {
                console.error(`❌ [Quiz] Unexpected error getting log channel:`, chanErr.message);
            }

            if (!logChannel) {
                console.error(`❌ [Quiz] Could not access quiz log channel <#${logChannelId}> (${logChannelId}). Check bot permissions in this channel!`);
                return;
            }

            const username = interaction.user.displayName || interaction.user.username || interaction.user.tag;
            const logEmbed = new EmbedBuilder()
                .setTitle('📝 Quiz Answers Submitted')
                .setAuthor({ 
                    name: `${username} (${interaction.user.tag})`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setColor('#F1C40F')
                .addFields({ name: '👤 Submitter', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: false })
                .setTimestamp();
            
            quizInfo.questions.forEach((q, index) => {
                const questionText = (q && q.length > 250) ? q.substring(0, 247) + '...' : (q || `Question ${index + 1}`);
                const answerRaw = answers[index] || 'No answer provided';
                const answerText = answerRaw.length > 1020 ? answerRaw.substring(0, 1017) + '...' : answerRaw;
                logEmbed.addFields({ 
                    name: `❓ ${questionText}`, 
                    value: `💬 ${answerText}` 
                });
            });

            const tickBtn = new ButtonBuilder()
                .setCustomId(`quizTickBtn_${interaction.user.id}`)
                .setLabel('Correct')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success);
            
            const wrongBtn = new ButtonBuilder()
                .setCustomId(`quizWrongBtn_${interaction.user.id}`)
                .setLabel('Incorrect')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger);
            
            const actionRow = new ActionRowBuilder().addComponents(tickBtn, wrongBtn);

            try {
                await logChannel.send({ 
                    content: `🔔 **New Quiz Submission** from <@${interaction.user.id}>:`,
                    embeds: [logEmbed], 
                    components: [actionRow] 
                });
                console.log(`✅ [Quiz] Successfully logged quiz answers for ${interaction.user.tag} in #${logChannel.name || logChannelId}`);
            } catch (sendErr) {
                console.error(`❌ [Quiz] Failed to send log to channel #${logChannel.name || logChannelId}:`, sendErr.message);
            }
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('quizAnswerBtn_')) {
            const quizId = interaction.customId.split('_')[1];
            const { getActiveQuiz, hasUserAnswered } = getQuizManager();
            
            const quizInfo = getActiveQuiz(quizId);
            if (!quizInfo) {
                return interaction.reply({ content: 'This quiz is no longer active.', flags: MessageFlags.Ephemeral });
            }

            if (quizInfo.roleId && interaction.member && !interaction.member.roles.cache.has(quizInfo.roleId)) {
                return interaction.reply({ content: `Only users with the <@&${quizInfo.roleId}> role can answer this quiz!`, flags: MessageFlags.Ephemeral });
            }

            if (hasUserAnswered(quizId, interaction.user.id)) {
                return interaction.reply({ content: 'You have already answered this quiz!', flags: MessageFlags.Ephemeral });
            }

            const modal = new ModalBuilder()
                .setCustomId(`quizSubmitModal_${quizId}`)
                .setTitle('Submit Your Answers');

            quizInfo.questions.forEach((q, index) => {
                const label = q.length > 45 ? q.substring(0, 42) + '...' : q;
                const answerInput = new TextInputBuilder()
                    .setCustomId(`answer_${index + 1}`)
                    .setLabel(label || `Question ${index + 1}`)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
            });

            await interaction.showModal(modal);
        } else if (interaction.customId.startsWith('quizTickBtn_') || interaction.customId.startsWith('quizWrongBtn_')) {
            const isTick = interaction.customId.startsWith('quizTickBtn_');
            const targetUserId = interaction.customId.split('_')[1];

            const adminRoles = (process.env.ADMIN_ROLES_ID || process.env.ADMIN_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
            const modRoles = (process.env.MOD_ROLES_IDS || process.env.STAFF_ROLE || '').split(',').map(s => s.trim()).filter(Boolean);
            const allowedRoles = [...adminRoles, ...modRoles];

            const isAdmin = interaction.member && interaction.member.permissions?.has(PermissionFlagsBits.Administrator);
            const hasPermission = isAdmin || (allowedRoles.length > 0 && interaction.member.roles.cache.some(role => allowedRoles.includes(role.id)));
            if (!hasPermission) {
                return interaction.reply({ content: 'You do not have permission to use this button.', flags: MessageFlags.Ephemeral });
            }

            const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);

            if (isTick) {
                if (targetUser) {
                    const embed = new EmbedBuilder()
                        .setTitle('Quiz Result')
                        .setDescription('Your quiz answer is correct!')
                        .setColor('Green');

                    if (interaction.message.embeds[0] && interaction.message.embeds[0].fields) {
                        embed.addFields(interaction.message.embeds[0].fields);
                    }

                    await targetUser.send({ embeds: [embed] }).catch(() => {});
                }
                await interaction.reply({ content: 'User has been notified that their answer is correct.', flags: MessageFlags.Ephemeral });
            } else {
                const staffChannelId = process.env.QUIZ_STAFF_CHANNEL || '1417528968294174740';
                const staffChannel = interaction.guild?.channels.cache.get(staffChannelId) ||
                    interaction.client.channels.cache.get(staffChannelId) ||
                    await interaction.client.channels.fetch(staffChannelId).catch(() => null);

                if (staffChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('Incorrect Quiz Answer')
                        .setDescription(`<@${targetUserId}>, you have answered wrong answer!`)
                        .setColor('Red');

                    if (interaction.message.embeds[0] && interaction.message.embeds[0].fields) {
                        embed.addFields(interaction.message.embeds[0].fields);
                    }

                    await staffChannel.send({ content: `<@${targetUserId}>`, embeds: [embed] }).catch(() => {});
                }
                await interaction.reply({ content: 'Wrong answer logged to staff channel.', flags: MessageFlags.Ephemeral });
            }

            // Disable buttons after action
            const components = interaction.message.components;
            if (components.length > 0) {
                const newComponents = components.map(row => {
                    return new ActionRowBuilder().addComponents(
                        row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                    );
                });
                await interaction.message.edit({ components: newComponents }).catch(() => {});
            }
        }
    }
});

client.once('ready', async () => {
    console.log(`✅ [Bot2] Counting Bot (${client.user.tag}) is online`);
});

client.login(process.env.COUNTING_BOT_TOKEN);
