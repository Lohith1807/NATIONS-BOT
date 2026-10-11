const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getEmoji, getEmojiObject } = require('./botemoji.js');
const { getBaseRecord, recordDownload, buildBaseButtons } = require('./baseService.js');

/**
 * Handles persistent button interactions for uploaded bases:
 * - base_open:${layoutHash} : Tracks downloader, updates live count button, delivers ephemeral link
 * - base_stats:${layoutHash} : Displays private ephemeral list of all users who clicked Open
 * 
 * @param {import('discord.js').Interaction} interaction 
 * @returns {Promise<boolean>} True if handled, false otherwise
 */
async function handleBaseInteractions(interaction) {
    if (!interaction.isButton()) return false;

    const { customId } = interaction;
    if (!customId.startsWith('base_open:') && !customId.startsWith('base_stats:')) {
        return false;
    }

    try {
        if (customId.startsWith('base_open:')) {
            const layoutHash = customId.split(':')[1];
            const record = getBaseRecord(layoutHash);

            if (!record) {
                await interaction.reply({
                    content: `${getEmoji('bluex')} **Base layout record not found.**\nThis base may have been removed or updated.`,
                    ephemeral: true,
                });
                return true;
            }

            // Record the download for this user
            const updatedRecord = recordDownload(layoutHash, interaction.user);

            // Update the message buttons in-place with the new count
            const updatedRow = buildBaseButtons(updatedRecord || record);
            try {
                await interaction.update({ components: [updatedRow] });
            } catch (updateErr) {
                console.error('❌ [BaseInteractions] Failed to update message components:', updateErr.message);
            }

            // Build launch link button
            const thEmojiName = `th${record.town_hall_level}`;
            const resolvedEmojiKey = getEmojiObject(thEmojiName) ? thEmojiName : 'clancastle';
            const linkEmojiObj = getEmojiObject(resolvedEmojiKey);

            const launchBtn = new ButtonBuilder()
                .setLabel('Launch Clash of Clans')
                .setStyle(ButtonStyle.Link)
                .setURL(record.base_link);

            if (linkEmojiObj) {
                launchBtn.setEmoji(linkEmojiObj);
            }

            const linkRow = new ActionRowBuilder().addComponents(launchBtn);

            // Send private ephemeral follow-up with the game link
            await interaction.followUp({
                content: `${getEmoji('chain')} **Town Hall ${record.town_hall_level} Base Layout**\n\nClick below to open and copy the base into Clash of Clans:`,
                components: [linkRow],
                ephemeral: true,
            });

            return true;
        }

        if (customId.startsWith('base_stats:')) {
            const layoutHash = customId.split(':')[1];
            const record = getBaseRecord(layoutHash);

            if (!record) {
                await interaction.reply({
                    content: `${getEmoji('bluex')} **Base layout record not found.**`,
                    ephemeral: true,
                });
                return true;
            }

            const downloads = record.downloads || [];
            const graphEmoji = getEmoji('graph');

            if (downloads.length === 0) {
                await interaction.reply({
                    content: `${graphEmoji} **Base Downloads (0)**\n\nNo one has downloaded this base yet. Click **Open** to be the first!`,
                    ephemeral: true,
                });
                return true;
            }

            const listLines = downloads.map((d, index) => {
                const ts = Math.floor(new Date(d.timestamp).getTime() / 1000);
                return `${getEmoji('arrow')} **${index + 1}.** <@${d.user_id}> (${d.display_name || d.username}) • <t:${ts}:R>`;
            });

            const header = `${graphEmoji} **Base Downloads (${downloads.length})**\n\n`;
            let content = header + listLines.slice(0, 30).join('\n');
            if (downloads.length > 30) {
                content += `\n\n*...and ${downloads.length - 30} more.*`;
            }

            await interaction.reply({
                content: content,
                ephemeral: true,
            });

            return true;
        }

    } catch (err) {
        console.error('❌ [BaseInteractions] Error handling interaction:', err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `${getEmoji('bluex')} Something went wrong while processing the button.`,
                    ephemeral: true,
                });
            }
        } catch (_) { }
        return true;
    }

    return false;
}

module.exports = {
    handleBaseInteractions,
};
