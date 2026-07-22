const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServers, saveServers, getUsers, saveUsers } = require('../utils/dataManager');
const { removeAllCountingRoles } = require('../events/messageCreate');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset_counting')
        .setDescription('Resets the counting game to 0')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const guildId = interaction.guildId;
        let servers = getServers();
        
        if (servers[guildId]) {
            const serverConfig = servers[guildId];

            // Reset count and last user
            serverConfig.currentCount = 0;
            serverConfig.lastUserId = null;
            serverConfig.lastMessages = {};
            saveServers(servers);

            // Wipe all user scores
            let users = getUsers();
            if (users[guildId]) {
                delete users[guildId];
                saveUsers(users);
            }A

            // Remove all counting roles from every member
            removeAllCountingRoles(interaction.guild, serverConfig).catch(err =>
                console.error('Error removing counting roles on manual reset:', err)
            );

            await interaction.reply({ content: `✅ The count, leaderboard, and all counting roles have been reset! Let's start fresh.`, ephemeral: false });
        } else {
            await interaction.reply({ content: `Counting is not currently active in this server. Use /start_counting first.`, ephemeral: true });
        }
    },
};
