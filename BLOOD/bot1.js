const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { getBannerFiles } = require('./utils/data.js');

const BOT1_TOKEN     = process.env.BOT1_TOKEN || process.env.DISCORD_TOKEN;
const BOT1_CLIENT_ID = "1509906435402760202";

const bot1 = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
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

let bot1CommandsRegistered = false;

bot1.once("ready", async () => {
    console.log(`✅ [Bot1] ${bot1.user.tag} is online`);
    if (bot1CommandsRegistered) return;
    bot1CommandsRegistered = true;

    const rest = new REST({ version: "10" }).setToken(BOT1_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(BOT1_CLIENT_ID), { body: commandsData });
        console.log("✅ [Bot1] Slash commands registered.");
    } catch (err) {
        console.error("❌ [Bot1] Failed to register commands:", err);
    }
});

bot1.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = bot1.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        } else if (interaction.isStringSelectMenu()) {
            const id = interaction.customId;

            if (id === 'todo_select') {
                if (!interaction.member.permissions.has("Administrator")) {
                    return interaction.reply({ content: "❌ You need administrator permissions to complete tasks.", ephemeral: true });
                }
                const { removeTodo, getTodoListEmbed, getTodoComponents } = require('./utils/todoManager.js');
                const selectedId = interaction.values[0];
                removeTodo(selectedId);

                await interaction.update({
                    embeds: [getTodoListEmbed()],
                    components: getTodoComponents(false)
                });
                return;
            }


        } else if (interaction.isButton()) {
            const id = interaction.customId;
            if (id === 'todo_update') {
                if (!interaction.member.permissions.has("Administrator")) {
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
                    if (!isStaffOrAdmin(interaction.member)) {
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
