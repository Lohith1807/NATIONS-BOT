const { SlashCommandBuilder } = require('discord.js');
const { getCmdInfoPanel, createCmdInfoRows, getBannerFiles } = require('../data.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cmd-info")
        .setDescription("Show all Everyone commands in a dropdown"),
    async execute(interaction) {
        if (!interaction.channel) {
            return interaction.reply({ content: "❌ Cannot post the panel here.", ephemeral: true });
        }
        await interaction.channel.send({
            embeds: [getCmdInfoPanel()],
            components: createCmdInfoRows(),
            files: getBannerFiles(),
        });
        return interaction.reply({ content: "✅ Command panel posted!", ephemeral: true });
    }
};
