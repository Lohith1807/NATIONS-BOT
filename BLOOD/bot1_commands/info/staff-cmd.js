const { SlashCommandBuilder } = require('discord.js');
const { getStaffCmdPanel, createStaffRows, getBannerFiles } = require('../../utils/data.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("staff-cmd")
        .setDescription("Show all Staff commands in a dropdown"),
    async execute(interaction) {
        if (!interaction.channel) {
            return interaction.reply({ content: `${getEmoji("bluex")} Cannot post the panel here.`, ephemeral: true });
        }
        await interaction.channel.send({
            embeds: [getStaffCmdPanel()],
            components: createStaffRows(),
            files: getBannerFiles(),
        });
        return interaction.reply({ content: `${getEmoji("gtick")} Staff command panel posted!`, ephemeral: true });
    }
};
