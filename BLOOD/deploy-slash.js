const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BOT1_TOKEN     = process.env.BOT1_TOKEN || process.env.DISCORD_TOKEN;
const BOT1_CLIENT_ID = "1509906435402760202";

const commandsData = [];
const commandsPath = path.join(__dirname, 'bot1_commands');

function loadCommands(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.endsWith('.js')) {
            try {
                const command = require(fullPath);
                if (command.data) {
                    if (command.data.toJSON) {
                        commandsData.push(command.data.toJSON());
                    } else {
                        commandsData.push(command.data);
                    }
                }
            } catch (err) {
                console.error(`❌ Failed to load command at ${fullPath}:`, err);
            }
        }
    }
}

console.log("🔍 Loading commands from bot1_commands...");
loadCommands(commandsPath);
console.log(`✅ Loaded ${commandsData.length} commands.`);

if (!BOT1_TOKEN) {
    console.error("❌ Error: BOT1_TOKEN is not set in environment variables!");
    process.exit(1);
}

const BOT1_GUILD_ID = "1153720899715993681";
const rest = new REST({ version: '10' }).setToken(BOT1_TOKEN);

(async () => {
    try {
        console.log("🧹 Clearing all global slash commands to prevent duplication...");
        await rest.put(
            Routes.applicationCommands(BOT1_CLIENT_ID),
            { body: [] },
        );
        console.log("✅ Cleared all global slash commands.");

        console.log(`🔄 Refreshing guild commands for Guild ${BOT1_GUILD_ID}...`);
        await rest.put(
            Routes.applicationGuildCommands(BOT1_CLIENT_ID, BOT1_GUILD_ID),
            { body: commandsData },
        );
        console.log('✅ Successfully deployed guild-only commands for Bot 1!');
    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
    }
})();
