const { SlashCommandBuilder } = require('discord.js');
const { getAdminCmdPanel, createAdminRows, getBannerFiles, isStaffOrAdmin } = require('../data.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admin-cmd")
        .setDescription("Show the full command list — Staff/Admin only"),
    async execute(interaction) {
        if (!isStaffOrAdmin(interaction.member)) {
            return interaction.reply({
                content: "❌ You need **Staff or Admin** permissions to use this command.",
                ephemeral: true,
            });
        }
        if (!interaction.channel) {
            return interaction.reply({ content: "❌ Cannot post the panel here.", ephemeral: true });
        }
        await interaction.channel.send({
            embeds: [getAdminCmdPanel()],
            components: createAdminRows(),
            files: getBannerFiles(),
        });
        return interaction.reply({ content: "✅ Admin command panel posted!", ephemeral: true });
    }
};
