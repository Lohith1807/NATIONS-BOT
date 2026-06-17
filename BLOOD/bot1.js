const { Client, GatewayIntentBits, Collection, REST, Routes, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { getBannerFiles } = require('./utils/data.js');

const BOT1_TOKEN     = process.env.BOT1_TOKEN || process.env.DISCORD_TOKEN;
const BOT1_CLIENT_ID = "1509906435402760202";

const bot1 = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
    ],
    partials: ['CHANNEL'], // Required for receiving DMs
});

bot1.commands = new Collection();
const commandsPath = path.join(__dirname, 'bot1_commands');
const commandsData = [];

function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.endsWith('.js')) {
            const command = require(fullPath);
            bot1.commands.set(command.data.name, command);
            if (command.data.toJSON) {
                commandsData.push(command.data.toJSON());
            } else {
                commandsData.push(command.data);
            }
        }
    }
}

loadCommands(commandsPath);

bot1.once("ready", async () => {
    console.log(`✅ [Bot1] ${bot1.user.tag} is online`);
    
    const { checkReminders } = require('./utils/reminderManager.js');
    setInterval(() => checkReminders(bot1), 10000);
});

bot1.on("interactionCreate", async (interaction) => {
    try {
        const { handleReminderInteractions } = require('./utils/reminderInteractions.js');
        if (await handleReminderInteractions(interaction)) return;

        if (interaction.isChatInputCommand()) {
            const command = bot1.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        } else if (interaction.isAutocomplete()) {
            const command = bot1.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                await command.autocomplete(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            const id = interaction.customId;

            if (id === 'todo_select') {
                if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "❌ You need administrator permissions to complete tasks.", ephemeral: true });
                }
                const { getTodos, removeTodo, getTodoListEmbed, getTodoComponents } = require('./utils/todoManager.js');
                const { EmbedBuilder } = require('discord.js');
                const { getEmoji } = require('./utils/botemoji.js');
                const selectedId = interaction.values[0];

                // Grab the todo BEFORE removing so we can DM the creator
                const todo = getTodos().find(t => t.id === selectedId);
                removeTodo(selectedId);

                await interaction.update({
                    embeds: [getTodoListEmbed()],
                    components: getTodoComponents(false)
                });

                // DM the creator
                if (todo && todo.userId) {
                    try {
                        const creator = await bot1.users.fetch(todo.userId);
                        const dmEmbed = new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setTitle(`${getEmoji('gtick')} To-Do Completed!`)
                            .setDescription(`${getEmoji('yarrow')} **${todo.task}**`)
                            .addFields({ name: 'Marked complete by', value: `<@${interaction.user.id}>` })
                            .setTimestamp()
                            .setFooter({ text: 'Blood Alliance' });
                        await creator.send({ embeds: [dmEmbed] });
                    } catch (_) {}
                }
                return;
            }

            if (id.startsWith('cmd_info_') || id.startsWith('staff_cmd_') || id.startsWith('admin_cmd_')) {
                const { getDetailEmbed, getBannerFiles } = require('./utils/data.js');
                const selectedCmd = interaction.values[0];
                await interaction.reply({
                    embeds: [getDetailEmbed(selectedCmd)],
                    files: getBannerFiles(),
                    ephemeral: true
                });
                return;
            }

        } else if (interaction.isButton()) {
            const id = interaction.customId;
            if (id === 'todo_update') {
                if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "❌ You need administrator permissions to update the list.", ephemeral: true });
                }
                const { getTodos, getTodoListEmbed, getTodoComponents } = require('./utils/todoManager.js');
                const todos = getTodos();
                if (todos.length === 0) {
                    return interaction.reply({ content: "✨ There are no pending tasks to complete!", ephemeral: true });
                }

                await interaction.update({
                    components: getTodoComponents(true)
                });
            } else if (id.startsWith('help_page_')) {
                const page = id.replace('help_page_', '');
                if (page === 'staff' || page === 'admin') {
                    const { isStaffOrAdmin } = require('./utils/data.js');
                    if (!interaction.member || !isStaffOrAdmin(interaction.member)) {
                        return interaction.reply({ content: "❌ You need Staff or Admin permissions to view this tab.", ephemeral: true });
                    }
                }
                const { getCategoryHelpEmbed, createCategoryButtons } = require('./utils/data.js');
                await interaction.update({
                    embeds: [getCategoryHelpEmbed(page)],
                    components: [createCategoryButtons()]
                });
            }
        }
    } catch (err) {
        console.error("❌ [Bot1] Interaction error:", err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "❌ Something went wrong. Please try again.", ephemeral: true });
            }
        } catch (_) {}
    }
});

bot1.login(BOT1_TOKEN);
