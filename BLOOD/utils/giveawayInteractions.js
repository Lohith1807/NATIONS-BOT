const { MessageFlags, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
const { getEmoji } = require('./botemoji.js');
const {
    ADMIN_CHANNEL_ID,
    getGiveaway,
    addParticipant,
    buildGiveawayEmbed,
    buildEnterButton,
    buildAdminConfirmEmbed,
    buildAdminConfirmButtons,
    confirmGiveawayWinners,
    rerollPendingWinners,
    setPendingWinnerSpot,
} = require('./giveawayManager.js');

/**
 * Helper to update the admin confirmation embed in-place (works from both direct message & ephemeral sub-menus).
 */
async function refreshAdminConfirmMessage(interaction, gw) {
    if (!gw.adminConfirmMessageId) return;
    const adminCh = interaction.guild?.channels.cache.get(ADMIN_CHANNEL_ID) ||
        await interaction.guild?.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
    if (!adminCh) return;
    const confirmMsg = await adminCh.messages.fetch(gw.adminConfirmMessageId).catch(() => null);
    if (confirmMsg) {
        await confirmMsg.edit({
            embeds: [buildAdminConfirmEmbed(gw, gw.pendingWinners, null)],
            components: buildAdminConfirmButtons(gw.id, false, gw.pendingWinners.length),
        }).catch(() => {});
    }
}

/**
 * Handles persistent giveaway button & select-menu interactions:
 * - giveaway_enter:<id>
 * - giveaway_confirm:<id>
 * - giveaway_reroll:<id>:all | giveaway_reroll:<id>:<spotIndex>
 * - giveaway_reroll_select:<id>
 * - giveaway_change_btn:<id>
 * - giveaway_pick_spot:<id>
 * - giveaway_pick_user:<id>:<spotIndex>
 */
async function handleGiveawayInteractions(interaction) {
    const isBtn = interaction.isButton();
    const isStringSelect = interaction.isStringSelectMenu();
    const isUserSelect = interaction.isUserSelectMenu();
    if (!isBtn && !isStringSelect && !isUserSelect) return false;

    const { customId } = interaction;
    if (
        !customId.startsWith('giveaway_enter:') &&
        !customId.startsWith('giveaway_confirm:') &&
        !customId.startsWith('giveaway_reroll:') &&
        !customId.startsWith('giveaway_reroll_select:') &&
        !customId.startsWith('giveaway_change_btn:') &&
        !customId.startsWith('giveaway_pick_spot:') &&
        !customId.startsWith('giveaway_pick_user:')
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
                components: buildAdminConfirmButtons(result.giveaway.id, true, result.winners.length),
            });

            await interaction.followUp({
                content: `${getEmoji('gtick')} Winners confirmed and announced in <#${result.giveaway.channelId}>!`,
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        // 3. Admin rerolls all winners OR a specific spot index randomly
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

        // 4. Admin clicks "Change Winner (Pick User)" -> show searchable UserSelectMenu (or Spot picker first if >1 winner)
        if (action === 'giveaway_change_btn') {
            const gw = getGiveaway(giveawayId);
            if (!gw) {
                return interaction.reply({ content: `${getEmoji('bluex')} Giveaway not found.`, flags: MessageFlags.Ephemeral });
            }
            if (gw.announced) {
                return interaction.reply({ content: `${getEmoji('bluex')} Winners have already been confirmed and announced.`, flags: MessageFlags.Ephemeral });
            }

            const pending = gw.pendingWinners || [];
            if (pending.length <= 1) {
                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId(`giveaway_pick_user:${gw.id}:0`)
                    .setPlaceholder('Search and select a new winner...')
                    .setMinValues(1)
                    .setMaxValues(1);

                await interaction.reply({
                    content: `${getEmoji('mem')} Search and select the user you want to set as the winner for \`${gw.id}\`:`,
                    components: [new ActionRowBuilder().addComponents(userSelect)],
                    flags: MessageFlags.Ephemeral,
                });
                return true;
            }

            const spotSelect = new StringSelectMenuBuilder()
                .setCustomId(`giveaway_pick_spot:${gw.id}`)
                .setPlaceholder('First select which winner spot to change...')
                .addOptions(
                    pending.map((uid, i) => ({
                        label: `Spot #${i + 1}`,
                        description: `Currently selected user ID: ${uid}`,
                        value: String(i),
                    }))
                );

            await interaction.reply({
                content: `${getEmoji('mem')} Select which winner **spot** you want to change for \`${gw.id}\`:`,
                components: [new ActionRowBuilder().addComponents(spotSelect)],
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        // 5. Admin picked a spot -> show searchable UserSelectMenu for that spot
        if (action === 'giveaway_pick_spot') {
            const spotIndex = parseInt(interaction.values[0], 10);
            const gw = getGiveaway(giveawayId);
            if (!gw || gw.announced) {
                return interaction.update({
                    content: `${getEmoji('bluex')} Giveaway is no longer awaiting confirmation.`,
                    components: [],
                });
            }

            const userSelect = new UserSelectMenuBuilder()
                .setCustomId(`giveaway_pick_user:${gw.id}:${spotIndex}`)
                .setPlaceholder(`Search and select user for Spot #${spotIndex + 1}...`)
                .setMinValues(1)
                .setMaxValues(1);

            await interaction.update({
                content: `${getEmoji('mem')} Search and select the user for **Spot #${spotIndex + 1}** of \`${gw.id}\`:`,
                components: [new ActionRowBuilder().addComponents(userSelect)],
            });
            return true;
        }

        // 6. Admin searched & selected a user -> validate entry & duplicate slot, then update confirmation embed
        if (action === 'giveaway_pick_user') {
            const spotIndex = parseInt(parts[2] || '0', 10);
            const selectedUserId = interaction.values[0];

            await interaction.deferUpdate();

            const result = setPendingWinnerSpot(giveawayId, spotIndex, selectedUserId, interaction.user);
            if (!result.ok) {
                await interaction.editReply({
                    content: `${getEmoji('bluex')} ${result.reason}\n\nPlease search and select a different participant below:`,
                });
                return true;
            }

            await refreshAdminConfirmMessage(interaction, result.giveaway);

            await interaction.editReply({
                content: `${getEmoji('gtick')} **Spot #${result.spotIndex + 1}** updated to <@${selectedUserId}>! Confirm in <#${ADMIN_CHANNEL_ID}> when ready.`,
                components: [],
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
