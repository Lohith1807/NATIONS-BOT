const { EmbedBuilder } = require('discord.js');

module.exports = {
    getEmbed: (emojis = {}) => {
        // emojis.chat = question
        const chatStr = emojis.chat?.id ? `<a:question:${emojis.chat.id}>` : '❓';
        const arrowStr = emojis.arrow?.id ? `<a:arrow:${emojis.arrow.id}>` : '»';
        return new EmbedBuilder()
            .setTitle(`${chatStr} Help & Support`)
            .setDescription(
                '**Do you need help or have questions about Nations?**\n\n' +
                'Please describe your issue or question in detail below. Our support team will be with you as soon as possible.\n\n' +
                `${arrowStr} **Common Support Topics:**\n` +
                '• Clan war league doubts\n' +
                '• Nations rules clarification\n' +
                '• General Clash of Clans questions\n\n' +
                `*Please be patient while waiting for a response. We are here to help! ${chatStr}*`
            )
            .setColor(0x3498db);
    }
};
