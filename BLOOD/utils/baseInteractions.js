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
        // Acknowledge immediately to prevent 3-second Discord interaction timeout (Unknown interaction 10062)
        await interaction.deferReply({ ephemeral: true });

        if (customId.startsWith('base_open:')) {
            const layoutHash = customId.split(':')[1];
            const record = getBaseRecord(layoutHash);

            if (!record) {
                await interaction.editReply({
                    content: `${getEmoji('bluex')} **Base layout record not found.**\nThis base may have been removed or updated.`,
                });
                return true;
            }

            // Record the download for this user
            const updatedRecord = recordDownload(layoutHash, interaction.user);

            // Update the message buttons in-place with the new count directly via message.edit
            const updatedRow = buildBaseButtons(updatedRecord || record);
            if (interaction.message && typeof interaction.message.edit === 'function') {
                try {
                    await interaction.message.edit({ components: [updatedRow] });
                } catch (updateErr) {
                    // Ignore message edit failures (e.g. message deleted or missing permissions)
                    if (updateErr.code !== 10008) {
                        console.warn('⚠️ [BaseInteractions] Could not update message components:', updateErr.message);
                    }
                }
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

            // Send private ephemeral reply with the game link
            await interaction.editReply({
                content: `${getEmoji('chain')} **Town Hall ${record.town_hall_level} Base Layout**\n\nClick below to open and copy the base into Clash of Clans:`,
                components: [linkRow],
            });

            return true;
        }

        if (customId.startsWith('base_stats:')) {
            const layoutHash = customId.split(':')[1];
            const record = getBaseRecord(layoutHash);

            if (!record) {
                await interaction.editReply({
                    content: `${getEmoji('bluex')} **Base layout record not found.**`,
                });
                return true;
            }

            const downloads = record.downloads || [];
            const graphEmoji = getEmoji('graph');

            if (downloads.length === 0) {
                await interaction.editReply({
                    content: `${graphEmoji} **Base Downloads (0)**\n\nNo one has downloaded this base yet. Click **Open** to be the first!`,
                });
                return true;
            }

            const listLines = downloads.map((d, index) => {
                const ts = Math.floor(new Date(d.timestamp).getTime() / 1000);
                return `${getEmoji('arrow')} **${index + 1}.** <@${d.user_id}> (${d.display_name || d.username}) • <t:${ts}:R>`;
            });

            const header = `${graphEmoji} **Base Downloads (${downloads.length})**\n\n`;
            let content = header;
            let includedCount = 0;

            for (let i = 0; i < listLines.length; i++) {
                const line = listLines[i];
                const remaining = downloads.length - (i + 1);
                const suffix = remaining > 0 ? `\n\n*...and ${remaining} more.*` : '';

                // Discord interaction content has a hard limit of 2000 characters
                if ((content + (includedCount > 0 ? '\n' : '') + line + suffix).length > 1950) {
                    content += `\n\n*...and ${downloads.length - includedCount} more.*`;
                    break;
                }

                content += (includedCount > 0 ? '\n' : '') + line;
                includedCount++;
            }

            if (content.length > 2000) {
                content = content.slice(0, 1990) + '...';
            }

            await interaction.editReply({
                content: content,
            });

            return true;
        }

    } catch (err) {
        // Handle expired interaction tokens cleanly (10062 Unknown interaction or 40060 Already replied)
        if (err.code === 10062 || err.code === 40060) {
            console.warn(`⚠️ [BaseInteractions] Interaction timed out or was already acknowledged (code: ${err.code})`);
            return true;
        }

        console.error('❌ [BaseInteractions] Error handling interaction:', err);
        try {
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: `${getEmoji('bluex')} Something went wrong while processing the button.`,
                }).catch(() => {});
            } else if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `${getEmoji('bluex')} Something went wrong while processing the button.`,
                    ephemeral: true,
                }).catch(() => {});
            }
        } catch (_) { }
        return true;
    }

    return false;
}

module.exports = {
    handleBaseInteractions,
};
