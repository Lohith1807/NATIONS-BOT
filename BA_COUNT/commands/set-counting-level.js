const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServers, saveServers } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-counting-level')
        .setDescription('Set a level to be reached at a specific count')
        .addIntegerOption(option => 
            option.setName('count')
                .setDescription('The count number at which this level is reached')
                .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('level')
                .setDescription('The level number (e.g. 1, 2, 3)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const guildId = interaction.guildId;
        const count = interaction.options.getInteger('count');
        const level = interaction.options.getInteger('level');

        let servers = getServers();
        
        if (!servers[guildId]) {
            return await interaction.reply({ content: `Counting is not setup in this server yet. Use /start_counting first.`, ephemeral: true });
        }
        
        if (!servers[guildId].levels) {
            servers[guildId].levels = {};
        }

        servers[guildId].levels[count] = level;
        saveServers(servers);
        
        await interaction.reply({ content: `Successfully set Level ${level} to trigger at count ${count}!`, ephemeral: false });
    },
};
