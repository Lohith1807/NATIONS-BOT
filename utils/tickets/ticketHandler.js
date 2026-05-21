const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const transcripts = require('discord-html-transcripts');

// Import Embeds (3 only)
const clanEntry      = require('./embeds/clanEntry');
const repApply       = require('./embeds/repApply');
const helpAssistance = require('./embeds/helpAssistance');

// Only emojis that exist in emoji.js
// Available: th11-th18, arrow, cocfight, clancastle, whited, whitefwa, fwalead,
//            throphy, cwl, crown, coc, ccw, heart, alaram, bluex, question,
//            gtick, bluestar, bh, mem, tag, xp, uparrow, downarrow,
//            capitalgold, graph, larrow, rarrow, clangames, sheild, refresh
const EMOJI_NAMES = {
    check:    'coc',
    arrow:    'arrow',
    book:     'ccw',      // closest available for book-style
    chat:     'question',
    approve:  'gtick',
    decline:  'bluex',
    mem:      'mem',
    blue_dot: 'bluestar',
};

// Ticket options
const TICKET_OPTIONS = {
    apply_clan:      { type: 'Clan-Entry',      embed: clanEntry,      label: 'Clan Apply' },
    rep_apply:       { type: 'Rep-Apply',        embed: repApply,       label: 'Rep Apply' },
    help_assistance: { type: 'Help-Assistance',  embed: helpAssistance, label: 'Help Assistance' }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendLog(guild, embed, config, file = null) {
    const logChannelId = config.TICKET_LOG_CHANNEL_ID || config.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    const payload = { embeds: [embed] };
    if (file) payload.files = [file];
    await logChannel.send(payload).catch(err => console.error('Log Error:', err));
}

// Resolve emoji safely from emoji.js only (no app emoji fetch)
function getEmojiFromUtils(emojiUtils, name) {
    return emojiUtils.getEmojiObject(name) || null;
}

// Build emoji param for ButtonBuilder — falls back to unicode if not in emoji.js
function buttonEmoji(emojiUtils, name, fallback) {
    const obj = emojiUtils.getEmojiObject(name);
    if (obj) return { id: obj.id, name: obj.name, animated: obj.animated };
    return fallback; // plain unicode string e.g. '⏳'
}

// ─── Main Export ─────────────────────────────────────────────────────────────

module.exports = async (interaction, context) => {
    const { customId, guild, user, member } = interaction;
    const { client, config, emoji: emojiUtils } = context;
    const { getEmoji } = emojiUtils;

    const STAFF_ROLE_ID = config.STAFF_ROLE_IDS ? config.STAFF_ROLE_IDS[0] : null;
    const CATEGORY_ID   = config.TICKET_CATEGORY_ID || config.ADMIN_CATEGORY_ID;

    // ── Set Timer button ──────────────────────────────────────────────────────
    if (customId === 'set_ticket_timer') {
        const isStaff = config.STAFF_ROLE_IDS && config.STAFF_ROLE_IDS.some(id => member.roles.cache.has(id));
        const isAdmin = config.ADMIN_ROLE_IDS  && config.ADMIN_ROLE_IDS.some(id  => member.roles.cache.has(id));

        if (!isStaff && !isAdmin) {
            await interaction.reply({ content: '❌ Only Staff or Admins can use this button.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const modal = new ModalBuilder()
            .setCustomId('ticket_timer_modal')
            .setTitle('Set Ticket Auto-Close Timer');

        const durationInput = new TextInputBuilder()
            .setCustomId('timer_duration_input')
            .setLabel('Enter Duration (e.g. 5m, 1h, 1d)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 10m, 1h, 2d')
            .setMinLength(2)
            .setMaxLength(10)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(durationInput));
        await interaction.showModal(modal);
        return true;
    }

    // ── Timer modal submit ────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && customId === 'ticket_timer_modal') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const isStaff = config.STAFF_ROLE_IDS && config.STAFF_ROLE_IDS.some(id => member.roles.cache.has(id));
        const isAdmin = config.ADMIN_ROLE_IDS  && config.ADMIN_ROLE_IDS.some(id  => member.roles.cache.has(id));

        if (!isStaff && !isAdmin) {
            await interaction.editReply({ content: '❌ Only Staff or Admins can set timers.' });
            return true;
        }

        const durationStr = interaction.fields.getTextInputValue('timer_duration_input').trim().toLowerCase();
        const match = durationStr.match(/^(\d+)\s*(m|min|h|hr|d|day)s?$/);
        if (!match) {
            await interaction.editReply({ content: '❌ Invalid format. Use e.g. `5m`, `1h`, or `1d`.' });
            return true;
        }

        const value = parseInt(match[1], 10);
        const unit  = match[2];
        let ms = 0;
        if (unit.startsWith('m')) ms = value * 60 * 1000;
        else if (unit.startsWith('h')) ms = value * 60 * 60 * 1000;
        else if (unit.startsWith('d')) ms = value * 24 * 60 * 60 * 1000;

        const channel = interaction.channel;
        const ticketOwnerId      = channel.topic;
        const ticketOwnerMention = ticketOwnerId ? `<@${ticketOwnerId}>` : 'the creator';

        // Clear any existing timer
        if (client.activeTicketTimers && client.activeTicketTimers.has(channel.id)) {
            clearTimeout(client.activeTicketTimers.get(channel.id).timeout);
            client.activeTicketTimers.delete(channel.id);
        }

        const autoCloseTimestamp = Math.floor((Date.now() + ms) / 1000);
        const reminderTimestamp  = Math.floor((Date.now() + Math.floor(ms / 2)) / 1000);

        const timerEmbed = new EmbedBuilder()
            .setTitle(`${getEmoji('alaram')} Waiting on ticket creator`)
            .setDescription(
                `Waiting for a reply from ${ticketOwnerMention}.\n` +
                `**Reminder:** <t:${reminderTimestamp}:t>\n` +
                `**Auto-close:** <t:${autoCloseTimestamp}:t>\n\n` +
                `*Any reply from the creator will cancel this timer.*`
            )
            .setColor(0x2f3136);

        const timerMessage = await channel.send({ content: ticketOwnerMention, embeds: [timerEmbed] });

        const timeout = setTimeout(async () => {
            if (client.activeTicketTimers) client.activeTicketTimers.delete(channel.id);

            let attachment = null;
            try {
                attachment = await transcripts.createTranscript(channel, {
                    limit: -1,
                    fileName: `transcript-${channel.name}.html`,
                    returnBuffer: false,
                    saveImages: false
                });
            } catch (err) { console.error('Transcript Error:', err); }

            const closeEmbed = new EmbedBuilder()
                .setTitle('Ticket Auto-Closed')
                .setDescription(
                    `• **Reason:** No reply from ticket creator\n` +
                    `• **Ticket:** ${channel.name}\n` +
                    `• **Closed:** <t:${Math.floor(Date.now() / 1000)}:f>`
                )
                .setColor(0xff0000);

            await sendLog(guild, closeEmbed, config, attachment).catch(e => console.error('Log Error:', e));
            await channel.delete().catch(() => {});
        }, ms);

        if (!client.activeTicketTimers) client.activeTicketTimers = new Map();
        client.activeTicketTimers.set(channel.id, { timeout, timerMessageId: timerMessage.id });

        await interaction.editReply({ content: `${getEmoji('alaram')} Timer set for **${durationStr}**!` });
        return true;
    }

    // ── Close ticket ──────────────────────────────────────────────────────────
    if (customId === 'close_ticket') {
        const isStaff = config.STAFF_ROLE_IDS && config.STAFF_ROLE_IDS.some(id => member.roles.cache.has(id));
        const isAdmin = config.ADMIN_ROLE_IDS  && config.ADMIN_ROLE_IDS.some(id  => member.roles.cache.has(id));

        if (!isStaff && !isAdmin) {
            await interaction.reply({ content: '❌ Only Staff or Admins can delete this ticket.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        await interaction.deferReply();
        const channel = interaction.channel;

        let attachment = null;
        try {
            attachment = await transcripts.createTranscript(channel, {
                limit: -1,
                fileName: `transcript-${channel.name}.html`,
                returnBuffer: false,
                saveImages: false
            });
        } catch (err) { console.error('Transcript Error:', err); }

        const closeEmbed = new EmbedBuilder()
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
            .setTitle('Ticket Closed')
            .setDescription(
                `• **By:** ${user} (${user.username})\n` +
                `• **Ticket:** ${channel.name}\n` +
                `• **Created:** <t:${Math.floor(channel.createdAt.getTime() / 1000)}:R>\n` +
                `• **Closed:** <t:${Math.floor(Date.now() / 1000)}:f>`
            )
            .setColor(0x2b2d31);

        await sendLog(guild, closeEmbed, config, attachment).catch(e => console.error('Log Error:', e));

        if (channel.deleting) return true;
        channel.deleting = true;

        await interaction.editReply({ content: `${getEmoji('gtick')} Transcript saved! Deleting in **5 seconds**...` });
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return true;
    }

    // ── Rep Apply: membership check ───────────────────────────────────────────
    if (customId === 'rep_apply') {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - member.joinedTimestamp < thirtyDaysMs) {
            await interaction.reply({
                content: `${getEmoji('bluex')} You must be a member of this server for at least **30 days** to apply for Rep.`,
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }

        const clanRoles  = context.data.getClanRoles();
        const clanRoleIds = Object.values(clanRoles).map(c => c.roleId).filter(Boolean);
        const hasClanRole = clanRoleIds.some(id => member.roles.cache.has(id));
        if (!hasClanRole) {
            await interaction.reply({
                content: `${getEmoji('bluex')} You must be an active member of one of our clans to apply for Rep.`,
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }
    }

    // ── Clan Apply: must have linked account ──────────────────────────────────
    if (customId === 'apply_clan') {
        const userData = context.data.getUserData();
        if (!userData[user.id]) {
            await interaction.reply({
                content: `${getEmoji('bluex')} Please link your account first! Use \`;link #YourPlayerTag\` in any channel.`,
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }
    }

    // ── Open ticket ───────────────────────────────────────────────────────────
    const currentOption = TICKET_OPTIONS[customId];
    if (!currentOption) return false;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // Log the button click
    const openEmbed = new EmbedBuilder()
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setTitle('Button Clicked')
        .setDescription(
            `• **User:** ${user} (${user.username})\n` +
            `• **Button:** ${currentOption.label}\n` +
            `• **Time:** <t:${Math.floor(Date.now() / 1000)}:f>`
        )
        .setColor(0x2b2d31);
    await sendLog(guild, openEmbed, config);

    // Build emojis for embed — only use keys that exist in emoji.js
    const emojis = {};
    for (const [key, name] of Object.entries(EMOJI_NAMES)) {
        emojis[key] = emojiUtils.getEmojiObject(name) || { id: null, name };
    }

    const { type, embed } = currentOption;
    const welcomeEmbed = embed.getEmbed(emojis);

    // Duplicate ticket check
    const existingChannel = guild.channels.cache.find(
        c => c.name === `${type.toLowerCase()}-${user.username.toLowerCase()}`
    );
    if (existingChannel) {
        await interaction.editReply({ content: `You already have an open ticket: ${existingChannel}` });
        return true;
    }

    // Permission overwrites
    const overwrites = [
        { id: guild.id, deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }
    ];
    if (STAFF_ROLE_ID) {
        overwrites.push({
            id: STAFF_ROLE_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]
        });
    }

    try {
        const channel = await guild.channels.create({
            name: `${type}-${user.username}`,
            type: ChannelType.GuildText,
            topic: user.id,
            parent: CATEGORY_ID,
            permissionOverwrites: overwrites
        });

        welcomeEmbed
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Nations Management', iconURL: guild.iconURL() })
            .setColor('Random')
            .setTimestamp();

        // ── Ticket action row: ONLY Timer + Delete ────────────────────────────
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('set_ticket_timer')
                .setLabel('Timer')
                .setEmoji('⏳')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Delete Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        const mentions = [user.toString()];
        if (STAFF_ROLE_ID) mentions.push(`<@&${STAFF_ROLE_ID}>`);

        await channel.send({
            content: Array.from(new Set(mentions)).join(' | '),
            embeds: [welcomeEmbed],
            components: [actionRow]
        });

        await interaction.editReply({ content: `${getEmoji('gtick')} Ticket created: ${channel}` });
        return true;

    } catch (error) {
        console.error('Ticket creation error:', error);
        await interaction.editReply({ content: '❌ Error creating ticket. Check bot permissions and category ID.' });
        return true;
    }
};
