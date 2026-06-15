const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getTodoListEmbed, getTodoComponents } = require('../todoManager.js');
const { getBannerFiles } = require('../data.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("todo-list")
        .setDescription("Show the current active todo list (Admin only)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ You need **Administrator** permissions to use this command.",
                ephemeral: true,
            });
        }

        const embed = getTodoListEmbed();
        const components = getTodoComponents(false);
        const files = getBannerFiles();

        return interaction.reply({
            embeds: [embed],
            components: components,
            files: files,
            ephemeral: false
        });
    }
};
