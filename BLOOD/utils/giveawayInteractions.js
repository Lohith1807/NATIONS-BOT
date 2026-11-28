const { MessageFlags, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
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
    announceRerolledWinners,
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

function buildRerollPanelEmbed(gw, spotKey, statusNote = null) {
    const winners = Array.isArray(gw.finalWinners) && gw.finalWinners.length > 0
        ? gw.finalWinners
        : (gw.pendingWinners || []);
    const winnerLines = winners.length > 0
        ? winners.map((id, i) => `**${i + 1}.** ${getEmoji('pinkdot')} <@${id}> (\`${id}\`)`).join('\n')
        : '*No winners*';
    const scopeText = spotKey === 'all' ? 'All Spots' : `Spot #${parseInt(spotKey, 10) + 1}`;

    return new EmbedBuilder()
        .setTitle(`Giveaway Reroll — ${gw.id}`)
        .setColor('#F39C12')
        .setDescription(
            (statusNote ? `${statusNote}\n\n` : '') +
            `${getEmoji('gift')} **Giveaway:** ${gw.prize}\n` +
            `${getEmoji('book')} **Target:** ${scopeText}\n` +
            `${getEmoji('gob')} **Total Entries:** ${(gw.participants || []).length}\n\n` +
            `${getEmoji('no1')} **Current Winner List:**\n${winnerLines}\n\n` +
            `Choose **Auto** to randomly reroll, or **Manual** to search & pick a specific participant.`
        )
        .setFooter({ text: `Giveaway ID: ${gw.id}` })
        .setTimestamp();
}

function buildRerollPanelButtons(giveawayId, spotKey) {
    const autoBtn = new ButtonBuilder()
        .setCustomId(`giveaway_cmd_auto:${giveawayId}:${spotKey}`)
        .setLabel('Auto')
        .setStyle(ButtonStyle.Primary);

    const manualBtn = new ButtonBuilder()
        .setCustomId(`giveaway_cmd_manual:${giveawayId}:${spotKey}`)
        .setLabel('Manual')
        .setStyle(ButtonStyle.Secondary);

    return [new ActionRowBuilder().addComponents(autoBtn, manualBtn)];
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
 * - giveaway_cmd_auto:<id>:<spotKey>
 * - giveaway_cmd_manual:<id>:<spotKey>
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
        !customId.startsWith('giveaway_pick_user:') &&
        !customId.startsWith('giveaway_cmd_auto:') &&
        !customId.startsWith('giveaway_cmd_manual:')
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
                await interaction.editReply({ content: `❌ ${result.reason}` });
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
                content: `❌ Only **Server Administrators** can confirm or change giveaway winners.`,
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
                    content: `❌ ${result.reason}`,
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

        // 3. Admin rerolls all winners OR a specific spot index randomly from Admin Confirmation embed
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
                    content: `❌ ${result.reason}`,
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

        // 4. /giveaway-reroll -> "Auto" button clicked in private ephemeral panel
        if (action === 'giveaway_cmd_auto') {
            const spotKey = parts[2] || 'all';
            const spotIndex = spotKey === 'all' ? null : parseInt(spotKey, 10);

            await interaction.deferUpdate();

            const result = await rerollPendingWinners(interaction.client, giveawayId, interaction.user, spotIndex);
            if (!result.ok) {
                await interaction.followUp({
                    content: `❌ ${result.reason}`,
                    flags: MessageFlags.Ephemeral,
                });
                return true;
            }

            await announceRerolledWinners(interaction.client, result.giveaway, result.winners, spotIndex);

            const statusNote = spotIndex !== null
                ? `${getEmoji('gtick')} **Auto-rerolled Spot #${spotIndex + 1}** to <@${result.winners[spotIndex]}> & announced in <#${result.giveaway.channelId}>!`
                : `${getEmoji('gtick')} **Auto-rerolled all winner spots** & announced in <#${result.giveaway.channelId}>!`;

            await interaction.editReply({
                embeds: [buildRerollPanelEmbed(result.giveaway, spotKey, statusNote)],
                components: buildRerollPanelButtons(result.giveaway.id, spotKey),
            });
            return true;
        }

        // 5. "Change Winner (Pick User)" OR /giveaway-reroll -> "Manual" button
        if (action === 'giveaway_change_btn' || action === 'giveaway_cmd_manual') {
            const gw = getGiveaway(giveawayId);
            if (!gw) {
                return interaction.reply({ content: `❌ Giveaway not found.`, flags: MessageFlags.Ephemeral });
            }
            if (gw.status !== 'ended') {
                return interaction.reply({ content: `❌ This giveaway has not ended yet.`, flags: MessageFlags.Ephemeral });
            }

            const spotKey = parts[2];
            const currentWinners = Array.isArray(gw.finalWinners) && gw.finalWinners.length > 0
                ? gw.finalWinners
                : (gw.pendingWinners || []);

            // If a specific spot was passed (e.g. /giveaway-reroll spot:1 -> Manual), or only 1 winner exists
            if ((spotKey && spotKey !== 'all') || currentWinners.length <= 1) {
                const targetIdx = spotKey && spotKey !== 'all' ? parseInt(spotKey, 10) : 0;
                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId(`giveaway_pick_user:${gw.id}:${targetIdx}`)
                    .setPlaceholder(`Search and select user for Spot #${targetIdx + 1}...`)
                    .setMinValues(1)
                    .setMaxValues(1);

                const payload = {
                    content: `${getEmoji('gob')} Search and select the user for **Spot #${targetIdx + 1}** of \`${gw.id}\`:`,
                    embeds: [],
                    components: [new ActionRowBuilder().addComponents(userSelect)],
                };

                if (action === 'giveaway_cmd_manual') {
                    await interaction.update(payload);
                } else {
                    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
                }
                return true;
            }

            // Multiple winner spots and no specific spot pre-selected -> ask which spot first
            const spotSelect = new StringSelectMenuBuilder()
                .setCustomId(`giveaway_pick_spot:${gw.id}`)
                .setPlaceholder('First select which winner spot to change...')
                .addOptions(
                    currentWinners.map((uid, i) => ({
                        label: `Spot #${i + 1}`,
                        description: `Currently selected user ID: ${uid}`,
                        value: String(i),
                    }))
                );

            const payload = {
                content: `${getEmoji('gob')} Select which winner **spot** you want to change for \`${gw.id}\`:`,
                embeds: [],
                components: [new ActionRowBuilder().addComponents(spotSelect)],
            };

            if (action === 'giveaway_cmd_manual') {
                await interaction.update(payload);
            } else {
                await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
            }
            return true;
        }

        // 6. Admin picked a spot -> show searchable UserSelectMenu for that spot
        if (action === 'giveaway_pick_spot') {
            const spotIndex = parseInt(interaction.values[0], 10);
            const gw = getGiveaway(giveawayId);
            if (!gw || gw.status !== 'ended') {
                return interaction.update({
                    content: `❌ Giveaway is not in ended state.`,
                    components: [],
                });
            }

            const userSelect = new UserSelectMenuBuilder()
                .setCustomId(`giveaway_pick_user:${gw.id}:${spotIndex}`)
                .setPlaceholder(`Search and select user for Spot #${spotIndex + 1}...`)
                .setMinValues(1)
                .setMaxValues(1);

            await interaction.update({
                content: `${getEmoji('gob')} Search and select the user for **Spot #${spotIndex + 1}** of \`${gw.id}\`:`,
                components: [new ActionRowBuilder().addComponents(userSelect)],
            });
            return true;
        }

        // 7. Admin searched & selected a user -> validate entry & duplicate slot, then update confirmation embed
        if (action === 'giveaway_pick_user') {
            const spotIndex = parseInt(parts[2] || '0', 10);
            const selectedUserId = interaction.values[0];

            await interaction.deferUpdate();

            const result = setPendingWinnerSpot(giveawayId, spotIndex, selectedUserId, interaction.user);
            if (!result.ok) {
                await interaction.editReply({
                    content: `❌ ${result.reason}\n\nPlease search and select a different participant below:`,
                });
                return true;
            }

            await announceRerolledWinners(interaction.client, result.giveaway, result.winners, result.spotIndex);

            await interaction.editReply({
                content: `${getEmoji('gtick')} **Spot #${result.spotIndex + 1}** updated to <@${selectedUserId}> and announced in <#${result.giveaway.channelId}>!`,
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
