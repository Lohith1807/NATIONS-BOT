const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServers, saveServers } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start_counting')
        .setDescription('Sets the channel for the counting game')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to count in')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;
        
        let servers = getServers();
        
        servers[guildId] = {
            channelId: channel.id,
            currentCount: 0,
            lastUserId: null
        };
        
        saveServers(servers);
        
        await interaction.reply({ content: `Counting channel has been set to ${channel}. The count starts fresh at 0!`, ephemeral: true });
    },
};
