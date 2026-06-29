const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${file} is missing a required "data" property.`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.COUNTING_BOT_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands for Counting Bot.`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.COUNTING_CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands for Counting Bot.`);
    } catch (error) {
        console.error("❌ Failed to reload application commands:", error);
    }
})();
