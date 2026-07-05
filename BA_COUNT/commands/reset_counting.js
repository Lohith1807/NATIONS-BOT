const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServers, saveServers, getUsers, saveUsers } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset_counting')
        .setDescription('Resets the counting game to 0')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const guildId = interaction.guildId;
        let servers = getServers();
        
        if (servers[guildId]) {
            servers[guildId].currentCount = 0;
            servers[guildId].lastUserId = null;
            saveServers(servers);

            let users = getUsers();
            if (users[guildId]) {
                delete users[guildId];
                saveUsers(users);
            }

            await interaction.reply({ content: `The count and leaderboard have been reset! Let's start fresh.`, ephemeral: false });
        } else {
            await interaction.reply({ content: `Counting is not currently active in this server. Use /start_counting first.`, ephemeral: true });
        }
    },
};
