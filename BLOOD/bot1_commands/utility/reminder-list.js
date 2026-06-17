const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { getUserReminders } = require('../../utils/reminderManager.js');
const { getEmoji, getEmojiObject } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reminder-list')
        .setDescription('View, edit or delete your active reminders'),

    async execute(interaction) {
        const reminders = getUserReminders(interaction.user.id);

        if (reminders.length === 0) {
            return interaction.reply({
                content: `${getEmoji('alaram')} You have no active reminders. Use \`/create-reminder\` to set one!`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${getEmoji('alaram')} Your Reminders`)
            .setColor(0x5865F2)
            .setDescription(
                reminders.map((r, i) =>
                    `${getEmoji('arrow')} **${i + 1}.** <t:${Math.floor(Number(r.timestamp) / 1000)}:R>\n${getEmoji('rarrow')} ${r.message}`
                ).join('\n\n')
            )
            .setFooter({ text: 'Use the buttons below to edit or delete reminders' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rem_edit_btn')
                .setLabel('Edit')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(getEmojiObject('refresh')),
            new ButtonBuilder()
                .setCustomId('rem_delete_btn')
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji(getEmojiObject('delete'))
        );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }
};
