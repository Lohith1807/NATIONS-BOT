const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getEmoji } = require('./botemoji.js');
const {
    addParticipant,
    buildGiveawayEmbed,
    buildEnterButton,
    buildAdminConfirmEmbed,
    buildAdminConfirmButtons,
    confirmGiveawayWinners,
    rerollPendingWinners,
} = require('./giveawayManager.js');

/**
 * Handles persistent giveaway button & select-menu interactions:
 * - giveaway_enter:<id>
 * - giveaway_confirm:<id>
 * - giveaway_reroll:<id>:all | giveaway_reroll:<id>:<spotIndex>
 * - giveaway_reroll_select:<id>
 */
async function handleGiveawayInteractions(interaction) {
    const isBtn = interaction.isButton();
    const isSelect = interaction.isStringSelectMenu();
    if (!isBtn && !isSelect) return false;

    const { customId } = interaction;
    if (
        !customId.startsWith('giveaway_enter:') &&
        !customId.startsWith('giveaway_confirm:') &&
        !customId.startsWith('giveaway_reroll:') &&
        !customId.startsWith('giveaway_reroll_select:')
    ) {
        return false;
    }

    const parts = customId.split(':');
    const action = parts[0];
    const giveawayId = parts[1];

    try {
        // 1. User enters giveaway
        if (action === 'giveaway_enter') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const result = addParticipant(giveawayId, interaction.user.id);
            if (!result.ok) {
                if (result.reason === 'already_entered') {
                    await interaction.editReply({
                        content: `${getEmoji('alaram')} You have already entered giveaway \`${giveawayId}\`!`,
                    });
                    return true;
                }
                await interaction.editReply({ content: `${getEmoji('bluex')} ${result.reason}` });
                return true;
            }

            if (interaction.message && typeof interaction.message.edit === 'function' && result.giveaway) {
                await interaction.message.edit({
                    embeds: [buildGiveawayEmbed(result.giveaway)],
                    components: [buildEnterButton(result.giveaway, false)],
                }).catch(() => {});
            }

            await interaction.editReply({
                content: `${getEmoji('gtick')} You have entered giveaway \`${result.giveaway.id}\` (**${result.giveaway.prize}**)! Good luck! ${getEmoji('gift')}`,
            });
            return true;
        }

        // Admin-only actions below
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `${getEmoji('bluex')} Only **Server Administrators** can confirm or reroll giveaway winners.`,
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        // 2. Admin confirms winner & sends notification in giveaway channel
        if (action === 'giveaway_confirm') {
            await interaction.deferUpdate();

            const result = await confirmGiveawayWinners(interaction.client, giveawayId, interaction.user);
            if (!result.ok) {
                await interaction.followUp({
                    content: `${getEmoji('bluex')} ${result.reason}`,
                    flags: MessageFlags.Ephemeral,
                });
                return true;
            }

            await interaction.editReply({
                embeds: [buildAdminConfirmEmbed(result.giveaway, result.winners, interaction.user.id)],
                components: buildAdminConfirmButtons(result.giveaway.id, true, result.winners.length),
            });

            await interaction.followUp({
                content: `${getEmoji('gtick')} Winners confirmed and announced in <#${result.giveaway.channelId}>!`,
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        // 3. Admin rerolls all winners OR a specific spot index
        if (action === 'giveaway_reroll' || action === 'giveaway_reroll_select') {
            await interaction.deferUpdate();

            let spotIndex = null;
            if (action === 'giveaway_reroll_select') {
                spotIndex = parseInt(interaction.values[0], 10);
            } else if (parts[2] && parts[2] !== 'all') {
                spotIndex = parseInt(parts[2], 10);
            }

            const result = await rerollPendingWinners(interaction.client, giveawayId, interaction.user, spotIndex);
            if (!result.ok) {
                await interaction.followUp({
                    content: `${getEmoji('bluex')} ${result.reason}`,
                    flags: MessageFlags.Ephemeral,
                });
                return true;
            }

            await interaction.editReply({
                embeds: [buildAdminConfirmEmbed(result.giveaway, result.winners, null)],
                components: buildAdminConfirmButtons(result.giveaway.id, false, result.winners.length),
            });

            const msg = spotIndex !== null
                ? `${getEmoji('refresh')} Rerolled **Spot #${spotIndex + 1}** to <@${result.winners[spotIndex]}>! Confirm when ready or reroll another spot.`
                : `${getEmoji('refresh')} Rerolled all winners: ${result.winners.map(id => `<@${id}>`).join(', ')}. Confirm when ready or reroll again.`;

            await interaction.followUp({
                content: msg,
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        return false;
    } catch (err) {
        console.error('❌ [GiveawayInteractions] Error handling interaction:', err);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({
                    content: '❌ Something went wrong while processing that giveaway action.',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: '❌ Something went wrong while processing that giveaway action.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (_) {}
        return true;
    }
}

module.exports = {
    handleGiveawayInteractions,
};
