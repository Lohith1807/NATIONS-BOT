const { SlashCommandBuilder } = require('discord.js');
const { getStaffCmdPanel, createStaffRows, getBannerFiles } = require('../data.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("staff-cmd")
        .setDescription("Show all Staff commands in a dropdown"),
    async execute(interaction) {
        if (!interaction.channel) {
            return interaction.reply({ content: "❌ Cannot post the panel here.", ephemeral: true });
        }
        await interaction.channel.send({
            embeds: [getStaffCmdPanel()],
            components: createStaffRows(),
            files: getBannerFiles(),
        });
        return interaction.reply({ content: "✅ Staff command panel posted!", ephemeral: true });
    }
};
