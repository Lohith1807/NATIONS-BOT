const { EmbedBuilder } = require('discord.js');

module.exports = {
    getEmbed: (emojis = {}) => {
        // emojis.book = ccw, emojis.arrow = arrow
        const arrowStr = emojis.arrow?.id ? `<a:arrow:${emojis.arrow.id}>` : '»';
        return new EmbedBuilder()
            .setTitle(`${emojis.book?.id ? `<:ccw:${emojis.book.id}>` : '📖'} Rep Application Requirements`)
            .setDescription(
                '**If you\'re applying to become a Rep in our alliance, please answer the following:**\n\n' +
                `${arrowStr} **1. Share Your FWA CC Profile link**\n` +
                '[FWA ChocolateClash](https://chocolateclash.com/)\n\n' +
                `${arrowStr} **2. Share 💎 FWA 💎 Base**\n` +
                'Share a screenshot of your current FWA base.\n\n' +
                `${arrowStr} **3. FWA Clan Experience**\n` +
                'Are you currently in any FWA clan, or have you been in one before?\n\n' +
                `${arrowStr} **4. FWA Rep Experience**\n` +
                'Have you been a Rep in any clan before? If yes, mention the clan(s).\n\n' +
                `${arrowStr} **5. Motivation**\n` +
                'Why do you want to be a Rep in our alliance?\n\n' +
                '*Please provide detailed answers so we can properly review your application.*'
            )
            .setColor(0x5865f2);
    }
};
