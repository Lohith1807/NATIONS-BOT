const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServers, saveServers } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop_counting')
        .setDescription('Stops the counting game in this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const guildId = interaction.guildId;
        let servers = getServers();
        
        if (servers[guildId]) {
            delete servers[guildId];
            saveServers(servers);
            await interaction.reply({ content: `Counting has been stopped in this server.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `Counting is not currently active in this server.`, ephemeral: true });
        }
    },
};
