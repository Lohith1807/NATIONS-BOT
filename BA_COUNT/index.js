const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client, GatewayIntentBits, Collection, Events, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
            const { saveActiveQuiz } = require('./utils/quizManager');
            
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
            const { getActiveQuiz, markUserAnswered } = require('./utils/quizManager');
            
            const quizInfo = getActiveQuiz(quizId);
            if (!quizInfo) {
                return interaction.reply({ content: 'This quiz is no longer active.', ephemeral: true });
            }

            markUserAnswered(quizId, interaction.user.id);
            
            const answers = [];
            for (let i = 1; i <= quizInfo.questions.length; i++) {
                answers.push(interaction.fields.getTextInputValue(`answer_${i}`));
            }

            await interaction.reply({ content: 'Your answers have been submitted!', ephemeral: true });

            const logChannelId = process.env.QUIZ_LOG_CHANNEL;
            if (!logChannelId) return;

            const logChannel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
            if (!logChannel) return;

            const logEmbed = new EmbedBuilder()
                .setTitle('Quiz Answers Submitted')
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setColor('Yellow')
                .setTimestamp();
            
            quizInfo.questions.forEach((q, index) => {
                logEmbed.addFields({ name: `Q: ${q}`, value: `A: ${answers[index]}` });
            });

            const tickBtn = new ButtonBuilder()
                .setCustomId(`quizTickBtn_${interaction.user.id}`)
                .setLabel('✔️')
                .setStyle(ButtonStyle.Success);
            
            const wrongBtn = new ButtonBuilder()
                .setCustomId(`quizWrongBtn_${interaction.user.id}`)
                .setLabel('❌')
                .setStyle(ButtonStyle.Danger);
            
            const actionRow = new ActionRowBuilder().addComponents(tickBtn, wrongBtn);

            await logChannel.send({ embeds: [logEmbed], components: [actionRow] });
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('quizAnswerBtn_')) {
            const quizId = interaction.customId.split('_')[1];
            const { getActiveQuiz, hasUserAnswered } = require('./utils/quizManager');
            
            const quizInfo = getActiveQuiz(quizId);
            if (!quizInfo) {
                return interaction.reply({ content: 'This quiz is no longer active.', ephemeral: true });
            }

            if (!interaction.member.roles.cache.has(quizInfo.roleId)) {
                return interaction.reply({ content: `Only users with the <@&${quizInfo.roleId}> role can answer this quiz!`, ephemeral: true });
            }

            if (hasUserAnswered(quizId, interaction.user.id)) {
                return interaction.reply({ content: 'You have already answered this quiz!', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`quizSubmitModal_${quizId}`)
                .setTitle('Submit Your Answers');

            quizInfo.questions.forEach((q, index) => {
                const answerInput = new TextInputBuilder()
                    .setCustomId(`answer_${index + 1}`)
                    .setLabel(q.length > 45 ? q.substring(0, 42) + '...' : q)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
            });

            await interaction.showModal(modal);
        } else if (interaction.customId.startsWith('quizTickBtn_') || interaction.customId.startsWith('quizWrongBtn_')) {
            const isTick = interaction.customId.startsWith('quizTickBtn_');
            const targetUserId = interaction.customId.split('_')[1];

            const adminRoles = process.env.ADMIN_ROLES_ID ? process.env.ADMIN_ROLES_ID.split(',') : [];
            const modRoles = process.env.MOD_ROLES_IDS ? process.env.MOD_ROLES_IDS.split(',') : [];
            const allowedRoles = [...adminRoles, ...modRoles];

            const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
            if (!hasPermission) {
                return interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
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
                await interaction.reply({ content: 'User has been notified that their answer is correct.', ephemeral: true });
            } else {
                const staffChannelId = process.env.QUIZ_STAFF_CHANNEL;
                if (staffChannelId) {
                    const staffChannel = await interaction.client.channels.fetch(staffChannelId).catch(() => null);
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
                }
                await interaction.reply({ content: 'Wrong answer logged to staff channel.', ephemeral: true });
            }

            // Disable buttons after action
            const components = interaction.message.components;
            if (components.length > 0) {
                const newComponents = components.map(row => {
                    return new ActionRowBuilder().addComponents(
                        row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                    );
                });
                await interaction.message.edit({ components: newComponents });
            }
        }
    }
});

client.once('ready', async () => {
    console.log(`✅ [Bot2] Counting Bot (${client.user.tag}) is online`);
});

client.login(process.env.COUNTING_BOT_TOKEN);
