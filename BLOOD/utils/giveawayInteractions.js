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
 * Handles persistent giveaway button interactions:
 * - giveaway_enter:<id>
 * - giveaway_confirm:<id>
 * - giveaway_reroll:<id>
 */
async function handleGiveawayInteractions(interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (
        !customId.startsWith('giveaway_enter:') &&
        !customId.startsWith('giveaway_confirm:') &&
        !customId.startsWith('giveaway_reroll:')
    ) {
        return false;
    }

    const [action, giveawayId] = customId.split(':');

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
                content: `${getEmoji('bluex')} Only **Server Administrators** can confirm or change giveaway winners.`,
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
                components: [buildAdminConfirmButtons(result.giveaway.id, true)],
            });

            await interaction.followUp({
                content: `${getEmoji('gtick')} Winners confirmed and announced in <#${result.giveaway.channelId}>!`,
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        // 3. Admin changes winner -> picks new random winner & updates confirmation embed
        if (action === 'giveaway_reroll') {
            await interaction.deferUpdate();

            const result = await rerollPendingWinners(interaction.client, giveawayId, interaction.user);
            if (!result.ok) {
                await interaction.followUp({
                    content: `${getEmoji('bluex')} ${result.reason}`,
                    flags: MessageFlags.Ephemeral,
                });
                return true;
            }

            await interaction.editReply({
                embeds: [buildAdminConfirmEmbed(result.giveaway, result.winners, null)],
                components: [buildAdminConfirmButtons(result.giveaway.id, false)],
            });

            const winnerMentions = result.winners.map(id => `<@${id}>`).join(', ');
            await interaction.followUp({
                content: `${getEmoji('refresh')} Winner changed to ${winnerMentions}. Please **Confirm Winner & Send Notification** or click **Change Winner** again.`,
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        return false;
    } catch (err) {
        console.error('❌ [GiveawayInteractions] Error handling button:', err);
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
