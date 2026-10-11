const { AttachmentBuilder } = require('discord.js');
const { getEmoji, getEmojiObject } = require('./botemoji.js');
const {
    validateBaseLink,
    parseBaseLink,
    hashLayout,
    getLayoutTypeName,
    addUpload,
    buildBaseButtons,
} = require('./baseService.js');

/**
 * Automatically converts a regular Discord chat message into a formatted base post
 * if the message contains both:
 * 1. A valid Clash of Clans base layout link
 * 2. An attached image (screenshot of the base)
 *
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} True if converted, false otherwise
 */
async function handleAutoBaseMessage(message) {
    if (!message || !message.guild || message.author.bot) return false;

    // 1. Must contain an image attachment
    if (!message.attachments || message.attachments.size === 0) return false;
    const imageAttachment = message.attachments.find(a =>
        a.contentType?.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif)$/i.test(a.name || '')
    );
    if (!imageAttachment) return false;

    // 2. Must contain a Clash of Clans layout link
    const linkMatch = message.content.match(/https?:\/\/link\.clashofclans\.com\/[^\s>]+/i);
    if (!linkMatch) return false;

    const baseLink = linkMatch[0];
    const validation = validateBaseLink(baseLink);
    if (!validation.valid) return false;

    try {
        // 3. Parse base link metadata
        const parsed = parseBaseLink(baseLink);
        const { thLevel, layoutType, fullId } = parsed;
        const layoutHash = hashLayout(fullId);
        const defaultTypeName = getLayoutTypeName(layoutType) || 'War Base';

        // 4. Extract base type / description from remaining text
        let textWithoutLink = message.content.replace(baseLink, '').replace(/[<>]/g, '').trim();
        // Strip common prefixes like "base type:", "type:"
        textWithoutLink = textWithoutLink.replace(/^(?:base\s*type|type)\s*[:=-]\s*/i, '').trim();
        const baseType = textWithoutLink || defaultTypeName;

        // 5. Resolve TH Emoji (default to clancastle if not available)
        const thEmojiName = `th${thLevel}`;
        const resolvedEmojiKey = getEmojiObject(thEmojiName) ? thEmojiName : 'clancastle';
        const thEmoji = getEmoji(resolvedEmojiKey);

        // 6. Format Non-Embed Message
        const messageContent =
            `## ${thEmoji} Town Hall ${thLevel}\n` +
            `${getEmoji('arrow')} **Base Type :** ${baseType}\n\n` +
            `-# Uploaded by Someone You Admire from Blood Alliance`;

        // 7. Base record object
        const baseRecord = {
            id: layoutHash,
            message_id: null,
            message_url: null,
            discord_user_id: message.author.id,
            discord_username: message.author.tag,
            guild_id: message.guild.id,
            channel_id: message.channel.id,
            base_link: baseLink,
            base_type: baseType,
            town_hall_level: thLevel,
            layout_hash: layoutHash,
            image_url: imageAttachment.url,
            image_name: imageAttachment.name || 'base_layout.png',
            downloads: [],
            created_at: new Date().toISOString(),
        };

        // 8. Build buttons ("Open" & "Downloads")
        const buttonRow = buildBaseButtons(baseRecord);

        // 9. Prepare image attachment
        const fileName = imageAttachment.name || 'base_layout.png';
        const fileAttachment = new AttachmentBuilder(imageAttachment.url, { name: fileName });

        // 10. Send the converted message to the channel
        const sentMessage = await message.channel.send({
            content: messageContent,
            files: [fileAttachment],
            components: [buttonRow],
        });

        // 11. Delete the raw user message so only the clean converted post remains
        await message.delete().catch(() => {});

        // 12. Save record to uploadedBases.json
        baseRecord.message_id = sentMessage.id;
        baseRecord.message_url = sentMessage.url;
        try {
            addUpload(baseRecord);
        } catch (dbErr) {
            console.error('❌ [BaseAutoConverter] Failed to save upload record:', dbErr.message);
        }

        return true;
    } catch (err) {
        console.error('❌ [BaseAutoConverter] Error converting base message:', err);
        return false;
    }
}

module.exports = {
    handleAutoBaseMessage,
};
