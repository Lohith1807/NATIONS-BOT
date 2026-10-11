const {
    SlashCommandBuilder,
    AttachmentBuilder,
} = require('discord.js');
const { getEmoji, getEmojiObject } = require('../../utils/botemoji.js');
const {
    validateBaseLink,
    validateBaseImage,
    parseBaseLink,
    hashLayout,
    addUpload,
    buildBaseButtons,
} = require('../../utils/baseService.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upload-base')
        .setDescription('Upload a Clash of Clans base layout with screenshot')
        .addStringOption(option =>
            option
                .setName('link')
                .setDescription('Clash of Clans base link')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('basetype')
                .setDescription('Base type (e.g. War, Trophy, Farming, Hybrid)')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('Base layout image / screenshot')
                .setRequired(true)
        ),

    async execute(interaction) {
        const link = interaction.options.getString('link');
        const baseType = interaction.options.getString('basetype');
        const imageAttachment = interaction.options.getAttachment('image');

        // ─── Validate Link ──────────────────────────────────────────────
        const linkValidation = validateBaseLink(link);
        if (!linkValidation.valid) {
            return interaction.reply({
                content: `${getEmoji('bluex')} **Invalid Clash of Clans base link.**\n\n${getEmoji('arrow')} ${linkValidation.reason}\n${getEmoji('parrow')} Please provide a valid Clash of Clans layout link.`,
                ephemeral: true,
            });
        }

        // ─── Validate Image ─────────────────────────────────────────────
        const imageValidation = validateBaseImage(imageAttachment);
        if (!imageValidation.valid) {
            return interaction.reply({
                content: `${getEmoji('bluex')} **Invalid base image.**\n\n${getEmoji('arrow')} ${imageValidation.reason}\n${getEmoji('parrow')} Please upload a valid image file (PNG, JPG, WEBP).`,
                ephemeral: true,
            });
        }

        // ─── Defer Ephemerally (slash command won't post publicly) ───────
        await interaction.deferReply({ ephemeral: true });

        try {
            // ─── Parse Link ─────────────────────────────────────────────
            const parsed = parseBaseLink(link);
            const { thLevel, layoutType, fullId } = parsed;
            const layoutHash = hashLayout(fullId);

            // ─── Resolve TH Emoji (default to clancastle if not available) ─
            const thEmojiName = `th${thLevel}`;
            const resolvedEmojiKey = getEmojiObject(thEmojiName) ? thEmojiName : 'clancastle';
            const thEmoji = getEmoji(resolvedEmojiKey);

            // ─── Format Non-Embed Message (No Link in Text) ──────────────
            const messageContent =
                `## ${thEmoji} Town Hall ${thLevel}\n` +
                `${getEmoji('arrow')} **Base Type :** ${baseType}\n\n` +
                `-# Uploaded by <@${interaction.user.id}>`;

            // ─── Create Base Record Object ──────────────────────────────
            const baseRecord = {
                id: layoutHash,
                message_id: null,
                message_url: null,
                discord_user_id: interaction.user.id,
                discord_username: interaction.user.tag,
                guild_id: interaction.guild?.id || null,
                channel_id: interaction.channel?.id || null,
                base_link: link,
                base_type: baseType,
                town_hall_level: thLevel,
                layout_hash: layoutHash,
                image_url: imageAttachment?.url || null,
                image_name: imageAttachment?.name || null,
                downloads: [],
                created_at: new Date().toISOString(),
            };

            // ─── Build Buttons ("Open" & "Downloads") ───────────────────
            const buttonRow = buildBaseButtons(baseRecord);

            // ─── Prepare Attachment ─────────────────────────────────────
            const files = [];
            if (imageAttachment) {
                const fileName = imageAttachment.name || 'base_layout.png';
                const attachment = new AttachmentBuilder(imageAttachment.url, { name: fileName });
                files.push(attachment);
            }

            // ─── Send Separately to Channel ─────────────────────────────
            const sentMessage = await interaction.channel.send({
                content: messageContent,
                files: files,
                components: [buttonRow],
            });

            // ─── Update Message Info and Save Record ────────────────────
            baseRecord.message_id = sentMessage.id;
            baseRecord.message_url = sentMessage.url;
            try {
                addUpload(baseRecord);
            } catch (dbErr) {
                console.error('❌ [upload-base] Failed to save upload record:', dbErr.message);
            }

            // ─── Ephemeral Confirmation to Uploader ─────────────────────
            await interaction.editReply({
                content: `${getEmoji('gtick')} **Base layout uploaded and posted successfully!** [Jump to message](${sentMessage.url})`,
            });


        } catch (err) {
            console.error('❌ [upload-base] Unexpected error:', err);

            // Log internal details
            const logData = {
                timestamp: new Date().toISOString(),
                guild_id: interaction.guild?.id,
                channel_id: interaction.channel?.id,
                user_id: interaction.user.id,
                command: 'upload-base',
                base_link: link?.substring(0, 100),
                error_type: err.constructor?.name,
                error_message: err.message,
            };
            console.error('❌ [upload-base] Error details:', JSON.stringify(logData));

            // User-facing error
            const errorMessage = `${getEmoji('bluex')} **Unable to post the base.**\n\n${getEmoji('arrow')} Something went wrong while sending to this channel.\n${getEmoji('parrow')} Please check bot permissions and try again.`;

            try {
                await interaction.editReply({ content: errorMessage });
            } catch (_) { }
        }
    },
};


