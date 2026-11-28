const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const {
    ADMIN_CHANNEL_ID,
    getGiveaway,
    getGuildGiveaways,
    rerollPendingWinners,
    setPendingWinnerSpot,
    buildAdminConfirmEmbed,
    buildAdminConfirmButtons,
} = require('../../utils/giveawayManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-reroll')
        .setDescription('Reroll a winner spot randomly or pick a specific participant (Admin Only)')
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
                .setDescription('Winner spot number to change/reroll (e.g. 1 for 1st spot)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('winner')
                .setDescription('Optional: search & pick a specific participant for this spot')
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
        const pickedUser = interaction.options.getUser('winner');

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

        let result;
        let summary;

        if (pickedUser) {
            const spotIdx = spotNumber ? spotNumber - 1 : 0;
            result = setPendingWinnerSpot(gw.id, spotIdx, pickedUser.id, interaction.user);
            if (!result.ok) {
                return interaction.editReply({ content: `${getEmoji('bluex')} ${result.reason}` });
            }
            summary = `${getEmoji('gtick')} Updated **Spot #${result.spotIndex + 1}** for \`${result.giveaway.id}\` to <@${pickedUser.id}>!`;
        } else {
            const spotIdx = spotNumber ? spotNumber - 1 : null;
            result = await rerollPendingWinners(interaction.client, gw.id, interaction.user, spotIdx);
            if (!result.ok) {
                return interaction.editReply({ content: `${getEmoji('bluex')} ${result.reason}` });
            }
            summary = spotIdx !== null
                ? `${getEmoji('refresh')} Rerolled **Spot #${spotNumber}** for \`${result.giveaway.id}\` to <@${result.winners[spotIdx]}>!`
                : `${getEmoji('refresh')} Rerolled all winners for \`${result.giveaway.id}\`: ${result.winners.map((id, i) => `**${i + 1}.** <@${id}>`).join(', ')}`;
        }

        // Update the admin confirmation embed in-place
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

        return interaction.editReply({
            content: `${summary}\n\nConfirm in <#${ADMIN_CHANNEL_ID}> when ready.`,
        });
    },
};
