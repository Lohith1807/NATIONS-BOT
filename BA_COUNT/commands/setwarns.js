const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getServers, saveServers } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwarns')
        .setDescription('Set the maximum number of warnings before the count resets')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of warnings allowed')
                .setRequired(true)
                .setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guildId;
        
        let servers = getServers();
        
        if (!servers[guildId]) {
            return interaction.reply({ content: 'Counting has not been set up in this server yet!', ephemeral: true });
        }
        
        servers[guildId].maxWarns = amount;
        saveServers(servers);
        
        await interaction.reply({ content: `✅ The maximum number of warnings before a count reset is now set to **${amount}**!`, ephemeral: true });
    },
};
