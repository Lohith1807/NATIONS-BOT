const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getAdminCmdPanel, createAdminRows, getBannerFiles, isStaffOrAdmin } = require('../../utils/data.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admin-cmd")
        .setDescription("Show the full command list — Staff/Admin only")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!isStaffOrAdmin(interaction.member)) {
            return interaction.reply({
                content: `${getEmoji("bluex")} You need **Staff or Admin** permissions to use this command.`,
                ephemeral: true,
            });
        }
        if (!interaction.channel) {
            return interaction.reply({ content: `${getEmoji("bluex")} Cannot post the panel here.`, ephemeral: true });
        }
        await interaction.channel.send({
            embeds: [getAdminCmdPanel()],
            components: createAdminRows(),
            files: getBannerFiles(),
        });
        return interaction.reply({ content: `${getEmoji("gtick")} Admin command panel posted!`, ephemeral: true });
    }
};
