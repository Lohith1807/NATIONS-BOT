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

const BASE_POST_CHANNEL_ID = process.env.BASE_POST_CHANNEL_ID || '1468223443475501271';

/**
 * Automatically converts a regular Discord chat message into a formatted base post
 * and routes it into the dedicated base channel (1468223443475501271).
 *
 * Triggers when a message contains:
 * 1. A valid Clash of Clans base layout link (with or without an image screenshot)
 *
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} True if converted, false otherwise
 */
async function handleAutoBaseMessage(message) {
    if (!message || !message.guild || message.author.bot) return false;

    // 1. Check for Clash of Clans layout link
    const linkMatch = message.content.match(/https?:\/\/link\.clashofclans\.com\/[^\s>]+/i);
    if (!linkMatch) return false;

    const baseLink = linkMatch[0].replace(/[)\]}>,."';]+$/, '');
    const validation = validateBaseLink(baseLink);
    if (!validation.valid) {
        console.log(`[BaseAutoConverter] ⚠️ Ignored invalid base link from ${message.author.tag} in #${message.channel.name || message.channel.id}: ${validation.reason}`);
        return false;
    }

    console.log(`[BaseAutoConverter] 🔎 Detected valid Clash of Clans base link from ${message.author.tag} in #${message.channel.name || message.channel.id}`);

    try {
        // 2. Parse base link metadata
        const parsed = parseBaseLink(baseLink);
        const { thLevel, layoutType, fullId, isBH } = parsed;
        const layoutHash = hashLayout(fullId);
        const defaultTypeName = getLayoutTypeName(layoutType) || (isBH ? 'Builder Base' : 'War Base');

        // 3. Extract base type / description from remaining text
        let textWithoutLink = message.content.replace(linkMatch[0], '').replace(/[<>]/g, '').trim();
        // Strip common prefixes like "base type:", "type:"
        textWithoutLink = textWithoutLink.replace(/^(?:base\s*type|type)\s*[:=-]\s*/i, '').trim();
        const baseType = textWithoutLink || defaultTypeName;

        // 4. Resolve Town Hall / Builder Hall Emoji (use emoji if available, otherwise just mention name)
        const hallName = isBH ? 'Builder Hall' : 'Town Hall';
        const thEmojiName = `th${thLevel}`;
        const hasEmoji = Boolean(getEmojiObject(thEmojiName));
        const thPrefix = hasEmoji ? `${getEmoji(thEmojiName)} ` : '';

        // 5. Format Post Message Content (shows 'From Blood Alliance Staff' when converted without command)
        const messageContent =
            `## ${thPrefix}${hallName} ${thLevel}\n` +
            `${getEmoji('arrow')} **Base Type :** ${baseType}\n\n` +
            `-# From Blood Alliance Staff`;

        // 6. Look for image attachment if present (optional screenshot)
        let imageAttachment = null;
        if (message.attachments && message.attachments.size > 0) {
            imageAttachment = message.attachments.find(a =>
                a.contentType?.startsWith('image/') ||
                /\.(png|jpe?g|webp|gif)$/i.test(a.name || '') ||
                (a.width && a.height)
            ) || message.attachments.first();
        }

        // 7. Base record object
        const baseRecord = {
            id: layoutHash,
            message_id: null,
            message_url: null,
            discord_user_id: message.author.id,
            discord_username: message.author.tag,
            guild_id: message.guild.id,
            channel_id: null,
            base_link: baseLink,
            base_type: baseType,
            town_hall_level: thLevel,
            layout_hash: layoutHash,
            image_url: imageAttachment ? imageAttachment.url : null,
            image_name: imageAttachment ? (imageAttachment.name || 'base_layout.png') : null,
            downloads: [],
            created_at: new Date().toISOString(),
        };

        // 8. Build buttons ("Open" & "Downloads")
        const buttonRow = buildBaseButtons(baseRecord);

        // 9. Prepare image files if available
        const files = [];
        if (imageAttachment) {
            const fileName = imageAttachment.name || 'base_layout.png';
            const fileAttachment = new AttachmentBuilder(imageAttachment.url, { name: fileName });
            files.push(fileAttachment);
        }

        // 10. Resolve Destination Channel (Dedicated channel 1468223443475501271)
        const targetChannel = message.guild.channels.cache.get(BASE_POST_CHANNEL_ID) ||
            await message.guild.channels.fetch(BASE_POST_CHANNEL_ID).catch(() => null);

        // Fallback to origin channel if dedicated channel cannot be resolved
        const postChannel = targetChannel || message.channel;

        // 11. Post formatted base into the dedicated channel
        let sentMessage;
        try {
            sentMessage = await postChannel.send({
                content: messageContent,
                files: files,
                components: [buttonRow],
            });
        } catch (sendErr) {
            console.error(`❌ [BaseAutoConverter] Failed to send to channel #${postChannel.name || postChannel.id}:`, sendErr.message);
            // If posting to targetChannel failed (e.g. missing permissions), attempt posting to origin channel as safety fallback
            if (postChannel.id !== message.channel.id) {
                sentMessage = await message.channel.send({
                    content: messageContent,
                    files: files,
                    components: [buttonRow],
                });
            } else {
                throw sendErr;
            }
        }

        // 12. Save record to uploadedBases.json
        baseRecord.channel_id = sentMessage.channel.id;
        baseRecord.message_id = sentMessage.id;
        baseRecord.message_url = sentMessage.url;
        try {
            addUpload(baseRecord);
        } catch (dbErr) {
            console.error('❌ [BaseAutoConverter] Failed to save upload record:', dbErr.message);
        }

        // 13. Delete raw user message
        await message.delete().catch(() => {});

        // 14. If converted from another channel, leave a brief confirmation notice with jump link
        if (message.channel.id !== sentMessage.channel.id) {
            try {
                const notice = await message.channel.send({
                    content: `${getEmoji('gtick')} <@${message.author.id}> Your base layout was automatically formatted and posted in <#${sentMessage.channel.id}>! [Jump to base](${sentMessage.url})`,
                });
                setTimeout(() => notice.delete().catch(() => {}), 8000);
            } catch (_) {}
        }

        console.log(`[BaseAutoConverter] ✅ Automatically posted base (TH${thLevel}) by ${message.author.tag} into #${sentMessage.channel.name || sentMessage.channel.id}`);
        return true;
    } catch (err) {
        console.error('❌ [BaseAutoConverter] Error converting base message:', err);
        return false;
    }
}

module.exports = {
    handleAutoBaseMessage,
    BASE_POST_CHANNEL_ID,
};
