const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.COUNTING_BOT_TOKEN);

(async () => {
    try {
        console.log(`Started deleting all application (/) commands for Counting Bot.`);

        await rest.put(
            Routes.applicationCommands(process.env.COUNTING_CLIENT_ID),
            { body: [] },
        );

        console.log(`✅ Successfully deleted all application (/) commands for Counting Bot.`);
    } catch (error) {
        console.error("❌ Failed to delete application commands:", error);
    }
})();
