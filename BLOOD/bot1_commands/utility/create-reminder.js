const { SlashCommandBuilder } = require('discord.js');
const { addReminder, parseTime } = require('../../utils/reminderManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-reminder')
        .setDescription('Set a reminder that will DM you at the specified time')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('What do you want to be reminded about?')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('When? e.g. 10s, 5m, 2h, 1d')
                .setRequired(true)),

    async execute(interaction) {
        const message = interaction.options.getString('message');
        const timeStr = interaction.options.getString('time');

        const duration = parseTime(timeStr);
        if (!duration) {
            return interaction.reply({
                content: '❌ Invalid time format. Use examples like `10s`, `5m`, `2h`, `1d`.',
                ephemeral: true
            });
        }

        const timestamp = Date.now() + duration;
        addReminder(interaction.user.id, interaction.channelId, message, timestamp);

        await interaction.reply({
            content: `✅ Reminder set! I'll DM you <t:${Math.floor(timestamp / 1000)}:R>\n> **${message}**`,
            ephemeral: true
        });
    }
};
