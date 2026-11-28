const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const {
    GIVEAWAY_CHANNEL_ID,
    parseDuration,
    createGiveaway,
    updateGiveawayMessageId,
    buildGiveawayEmbed,
    buildEnterButton,
} = require('../../utils/giveawayManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-create')
        .setDescription('Start a new giveaway in a channel (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('prize')
                .setDescription('Name / prize of the giveaway (e.g. Gold Pass)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Duration (e.g. 30m, 2h, 1d, 1w)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('winners')
                .setDescription('Number of winners (hidden from public, default 1)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to post the giveaway in (defaults to current channel)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Optional extra details for the giveaway')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: `${getEmoji('bluex')} Only **Server Administrators** can create giveaways.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const prize = interaction.options.getString('prize').trim();
        const durationStr = interaction.options.getString('duration').trim();
        const winnerCount = interaction.options.getInteger('winners') || 1;
        const selectedChannel = interaction.options.getChannel('channel');
        const targetChannel = selectedChannel ||
            interaction.guild.channels.cache.get(GIVEAWAY_CHANNEL_ID) ||
            await interaction.guild.channels.fetch(GIVEAWAY_CHANNEL_ID).catch(() => null) ||
            interaction.channel;
        const description = interaction.options.getString('description')?.trim() || null;

        const durationMs = parseDuration(durationStr);
        if (!durationMs) {
            return interaction.reply({
                content: `${getEmoji('bluex')} Invalid duration format. Examples: \`30s\`, \`10m\`, \`2h\`, \`1d\`, \`1w\`.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const endsAt = Date.now() + durationMs;
        const gw = createGiveaway({
            guildId: interaction.guild.id,
            channelId: targetChannel.id,
            messageId: null,
            prize,
            description,
            winnerCount,
            endsAt,
            createdBy: interaction.user.id,
        });

        try {
            const sentMsg = await targetChannel.send({
                embeds: [buildGiveawayEmbed(gw)],
                components: [buildEnterButton(gw, false)],
            });

            updateGiveawayMessageId(gw.id, sentMsg.id);

            await interaction.editReply({
                content:
                    `${getEmoji('gtick')} **Giveaway Created!**\n` +
                    `${getEmoji('arrow')} **Giveaway ID:** \`${gw.id}\`\n` +
                    `${getEmoji('arrow')} **Prize:** ${gw.prize}\n` +
                    `${getEmoji('arrow')} **Channel:** <#${targetChannel.id}>\n` +
                    `${getEmoji('arrow')} **Internal Winner Count:** ${gw.winnerCount} *(kept private)*\n` +
                    `${getEmoji('arrow')} **Ends:** <t:${Math.floor(endsAt / 1000)}:R>`,
            });
        } catch (err) {
            console.error('❌ [giveaway-create] Failed to send giveaway message:', err);
            await interaction.editReply({
                content: `${getEmoji('bluex')} Failed to post giveaway in <#${targetChannel.id}>: ${err.message}`,
            });
        }
    },
};

