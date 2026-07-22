const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client, GatewayIntentBits, Collection, Events, Partials } = require('discord.js');
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
        }
    }
});

client.once('ready', async () => {
    console.log(`✅ [Bot2] Counting Bot (${client.user.tag}) is online`);
});

client.login(process.env.COUNTING_BOT_TOKEN);
