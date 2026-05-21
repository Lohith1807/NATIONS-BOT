const { EmbedBuilder } = require('discord.js');
const config = require('../../../config/config.js');

module.exports = {
    getEmbed: (emojis = {}) => {
        // emojis.check = coc, emojis.arrow = arrow, emojis.blue_dot = bluestar
        return new EmbedBuilder()
            .setTitle(`${emojis.check?.id ? `<:coc:${emojis.check.id}>` : '🛡️'} FWA Entry Requirements — Read Carefully`)
            .setDescription(
                `${emojis.arrow?.id ? `<a:arrow:${emojis.arrow.id}>` : '»'} **Submit Your Details:**\n\n` +
                '**STEP 1 — Link your player ID**\n' +
                'Use the command:\n' +
                '`;link #YourPlayerTag`\n' +
                '**Example:** `;link #ABC123XYZ`\n\n' +
                '**STEP 2 — Share your FWA base**\n' +
                'Upload a screenshot of your FWA base here.\n' +
                'If you don\'t have a base yet, use: `!bases` or `/th{your_townhall_level}`\n' +
                '**Example:** `/th17` or `!bases`\n\n' +
                '**STEP 3 — Upload your profile**\n' +
                'Upload a screenshot of your Clash of Clans profile (the one that says "My Profile").\n\n' +
                `${emojis.blue_dot?.id ? `<a:bluestar:${emojis.blue_dot.id}>` : '🔵'} **First Time in 💎 FWA 💎?**\n` +
                'Make sure to read the official FWA rules and the rules of the clan you\'re applying to.\n\n' +
                `${emojis.blue_dot?.id ? `<a:bluestar:${emojis.blue_dot.id}>` : '🔵'} **Duration of Stay:**\n` +
                'Let us know how long you intend to stay in the clan.\n\n' +
                `${emojis.blue_dot?.id ? `<a:bluestar:${emojis.blue_dot.id}>` : '🔵'} **Notify Support:**\n` +
                `Once you've completed everything above, please ping <@&${config.STAFF_ROLE_IDS[0]}> to proceed.`
            )
            .setColor(0xff4d4d);
    }
};
