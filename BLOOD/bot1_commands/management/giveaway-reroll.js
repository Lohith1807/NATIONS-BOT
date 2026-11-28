const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const {
    ADMIN_CHANNEL_ID,
    getGiveaway,
    getGuildGiveaways,
    rerollPendingWinners,
    buildAdminConfirmEmbed,
    buildAdminConfirmButtons,
} = require('../../utils/giveawayManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-reroll')
        .setDescription('Reroll a giveaway winner spot or all winners randomly (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('giveaway-id')
                .setDescription('Giveaway ID (e.g. GW-1001)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option
                .setName('spot')
                .setDescription('Winner spot number to reroll (e.g. 1 for 1st spot). Leave empty to reroll all.')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused().toLowerCase();
            const giveaways = getGuildGiveaways(interaction.guildId)
                .filter(g => g.status === 'ended' && !g.announced)
                .filter(g =>
                    g.id.toLowerCase().includes(focused) ||
                    (g.prize || '').toLowerCase().includes(focused)
                )
                .slice(-25)
                .reverse();

            await interaction.respond(
                giveaways.map(g => ({
                    name: `${g.id} — ${g.prize}`.slice(0, 100),
                    value: g.id,
                }))
            );
        } catch (_) {
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: `${getEmoji('bluex')} Only **Server Administrators** can reroll giveaway winners.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const giveawayId = interaction.options.getString('giveaway-id').trim();
        const spotNumber = interaction.options.getInteger('spot');
        const spotIndex = spotNumber ? spotNumber - 1 : null;

        const gw = getGiveaway(giveawayId);
        if (!gw || gw.guildId !== interaction.guild.id) {
            return interaction.reply({
                content: `${getEmoji('bluex')} Giveaway \`${giveawayId}\` not found in this server.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (gw.status === 'active') {
            return interaction.reply({
                content: `${getEmoji('alaram')} Giveaway \`${gw.id}\` has not ended yet.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (gw.announced) {
            return interaction.reply({
                content: `${getEmoji('bluex')} Giveaway \`${gw.id}\` has already been confirmed and announced.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await rerollPendingWinners(interaction.client, gw.id, interaction.user, spotIndex);
        if (!result.ok) {
            return interaction.editReply({
                content: `${getEmoji('bluex')} ${result.reason}`,
            });
        }

        // Update the admin confirmation embed in-place if it exists
        if (result.giveaway.adminConfirmMessageId) {
            const adminCh = interaction.guild.channels.cache.get(ADMIN_CHANNEL_ID) ||
                await interaction.guild.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
            if (adminCh) {
                const confirmMsg = await adminCh.messages.fetch(result.giveaway.adminConfirmMessageId).catch(() => null);
                if (confirmMsg) {
                    await confirmMsg.edit({
                        embeds: [buildAdminConfirmEmbed(result.giveaway, result.winners, null)],
                        components: buildAdminConfirmButtons(result.giveaway.id, false, result.winners.length),
                    }).catch(() => {});
                }
            }
        }

        const summary = spotIndex !== null
            ? `${getEmoji('refresh')} Rerolled **Spot #${spotNumber}** for \`${result.giveaway.id}\` to <@${result.winners[spotIndex]}>!`
            : `${getEmoji('refresh')} Rerolled all winners for \`${result.giveaway.id}\`: ${result.winners.map((id, i) => `**${i + 1}.** <@${id}>`).join(', ')}`;

        return interaction.editReply({
            content: `${summary}\n\nConfirm in <#${ADMIN_CHANNEL_ID}> when ready.`,
        });
    },
};
