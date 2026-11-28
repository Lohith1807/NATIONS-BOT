const {
    MessageFlags,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    LabelBuilder,
    FileUploadBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
} = require('discord.js');
const transcripts = require('discord-html-transcripts');
const { getEmoji, getEmojiObject } = require('./botemoji.js');
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
    recordClaimTicket,
    removeClaimTicket,
} = require('./giveawayManager.js');

const GIVEAWAY_TICKET_CATEGORY_ID = '1154108820570771616';
const GIVEAWAY_TRANSCRIPT_CHANNEL_ID = '1576167926136840208';
const SERVER_MOD_ROLE_ID = '1513940638909988874';
const TICKET_STAFF_ROLE_IDS = [
    '1513940638909988874', // Server Mod
    '1513942017196167389', // T Mod
    '1420626301328297984', // Admin
    '1153997630112792577', // Co Admin
    '1397128468461916282', // Owner
];

function hasTicketStaffRole(member) {
    if (!member) return false;
    return TICKET_STAFF_ROLE_IDS.some(roleId => member.roles?.cache?.has(roleId));
}

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
 * Handles persistent giveaway button, select-menu, and modal interactions.
 */
async function handleGiveawayInteractions(interaction) {
    const isBtn = interaction.isButton();
    const isStringSelect = interaction.isStringSelectMenu();
    const isUserSelect = interaction.isUserSelectMenu();
    const isModal = interaction.isModalSubmit();
    if (!isBtn && !isStringSelect && !isUserSelect && !isModal) return false;

    const { customId } = interaction;
    const validPrefixes = [
        'giveaway_enter:',
        'giveaway_confirm:',
        'giveaway_reroll:',
        'giveaway_reroll_select:',
        'giveaway_change_btn:',
        'giveaway_pick_spot:',
        'giveaway_pick_user:',
        'giveaway_cmd_auto:',
        'giveaway_cmd_manual:',
        'giveaway_claim:',
        'giveaway_ticket_proof:',
        'giveaway_proof_modal:',
        'giveaway_ticket_delete:',
    ];
    if (!validPrefixes.some(p => customId.startsWith(p))) {
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

        // 2. Winner clicks "Claim Giveaway" button on winner announcement
        if (action === 'giveaway_claim') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const gw = getGiveaway(giveawayId);
            if (!gw || gw.status !== 'ended') {
                await interaction.editReply({ content: `❌ Giveaway \`${giveawayId}\` could not be found.` });
                return true;
            }

            const winners = Array.isArray(gw.finalWinners) ? gw.finalWinners : [];
            if (!winners.includes(interaction.user.id)) {
                await interaction.editReply({
                    content: `❌ You are not a winner of giveaway \`${gw.id}\` and cannot claim this prize.`,
                });
                return true;
            }

            // Prevent duplicate open claim ticket for the same winner
            const existingChannelId = gw.claimTickets?.[interaction.user.id];
            if (existingChannelId) {
                const existingCh = interaction.guild.channels.cache.get(existingChannelId) ||
                    await interaction.guild.channels.fetch(existingChannelId).catch(() => null);
                if (existingCh) {
                    await interaction.editReply({
                        content: `${getEmoji('alaram')} You already have an open claim ticket: <#${existingCh.id}>`,
                    });
                    return true;
                }
            }

            // Build permission overwrites for Winner, Host, Bot, and all 5 Staff Roles
            const permissionOverwrites = [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ManageMessages,
                    ],
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                    ],
                },
            ];

            if (gw.createdBy && gw.createdBy !== interaction.user.id) {
                permissionOverwrites.push({
                    id: gw.createdBy,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                    ],
                });
            }

            for (const roleId of TICKET_STAFF_ROLE_IDS) {
                if (interaction.guild.roles.cache.has(roleId)) {
                    permissionOverwrites.push({
                        id: roleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.ManageMessages,
                        ],
                    });
                }
            }

            const cleanUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'winner';
            const channelName = `claim-${gw.id.toLowerCase()}-${cleanUser}`;

            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: GIVEAWAY_TICKET_CATEGORY_ID,
                topic: `Giveaway Claim | ${gw.id} | Winner: ${interaction.user.id}`,
                permissionOverwrites,
            });

            recordClaimTicket(gw.id, interaction.user.id, ticketChannel.id);

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Giveaway Claim Ticket — ${gw.id}`)
                .setColor('#2ECC71')
                .setDescription(
                    `${getEmoji('gift')} **Congratulations <@${interaction.user.id}>!**\n\n` +
                    `${getEmoji('no1')} **Prize:** ${gw.prize}\n` +
                    `${getEmoji('crown')} **Hosted by:** <@${gw.createdBy}>\n` +
                    `${getEmoji('book')} **Giveaway ID:** \`${gw.id}\`\n\n` +
                    `Please click **Submit Proof** below to upload your proof screenshot, and our staff team will assist you shortly.`
                )
                .setTimestamp();

            const proofBtn = new ButtonBuilder()
                .setCustomId(`giveaway_ticket_proof:${gw.id}:${interaction.user.id}`)
                .setLabel('Submit Proof')
                .setStyle(ButtonStyle.Primary);
            const bookObj = getEmojiObject('book');
            if (bookObj) proofBtn.setEmoji(bookObj);

            const deleteBtn = new ButtonBuilder()
                .setCustomId(`giveaway_ticket_delete:${gw.id}:${interaction.user.id}`)
                .setLabel('Delete Ticket')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger);

            await ticketChannel.send({
                content: `Hey <@${interaction.user.id}> ||<@&${SERVER_MOD_ROLE_ID}>||`,
                allowedMentions: {
                    users: [interaction.user.id],
                    roles: [SERVER_MOD_ROLE_ID],
                },
                embeds: [welcomeEmbed],
                components: [new ActionRowBuilder().addComponents(proofBtn, deleteBtn)],
            });

            await interaction.editReply({
                content: `${getEmoji('gtick')} Your claim ticket has been created: <#${ticketChannel.id}>`,
            });
            return true;
        }

        // 3. Ticket: "Submit Proof" button -> open modal with FileUploadBuilder (image) + optional note
        if (action === 'giveaway_ticket_proof') {
            const winnerId = parts[2];
            const modal = new ModalBuilder()
                .setCustomId(`giveaway_proof_modal:${giveawayId}:${winnerId}`)
                .setTitle(`Submit Proof — ${giveawayId}`);

            const imageLabel = new LabelBuilder()
                .setLabel('Proof Image / Screenshot')
                .setDescription('Upload a screenshot/image to claim your giveaway prize')
                .setFileUploadComponent(
                    new FileUploadBuilder()
                        .setCustomId('proof_image')
                        .setRequired(true)
                        .setMinValues(1)
                        .setMaxValues(1)
                );

            const noteLabel = new LabelBuilder()
                .setLabel('Additional Details (Optional)')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('proof_note')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Enter your in-game tag, Supercell ID, or any extra notes...')
                        .setRequired(false)
                );

            modal.addLabelComponents(imageLabel, noteLabel);
            await interaction.showModal(modal);
            return true;
        }

        // 4. Ticket: Proof modal submitted -> post proof image + embed in ticket channel
        if (action === 'giveaway_proof_modal') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const uploadedFiles = interaction.fields.getUploadedFiles('proof_image');
            const proofFile = uploadedFiles?.first();
            let note = '';
            try {
                note = interaction.fields.getTextInputValue('proof_note')?.trim() || '';
            } catch (_) {}

            const files = [];
            let attachmentName = null;
            if (proofFile) {
                attachmentName = proofFile.name || 'proof.png';
                files.push(new AttachmentBuilder(proofFile.url, { name: attachmentName }));
            }

            const proofEmbed = new EmbedBuilder()
                .setTitle(`Proof Submitted — ${giveawayId}`)
                .setColor('#3498DB')
                .setDescription(
                    `${getEmoji('gtick')} **Submitted by:** <@${interaction.user.id}>\n` +
                    (note ? `\n${getEmoji('book')} **Details:**\n${note}` : '')
                )
                .setTimestamp();

            if (attachmentName) {
                proofEmbed.setImage(`attachment://${attachmentName}`);
            }

            await interaction.channel.send({
                embeds: [proofEmbed],
                files,
            });

            await interaction.editReply({
                content: `${getEmoji('gtick')} Your proof has been submitted in this ticket!`,
            });
            return true;
        }

        // 5. Ticket: "Delete Ticket" button -> ONLY Mod, T-Mod, Admin, Co-Admin, Owner roles -> save transcript to 1576167926136840208
        if (action === 'giveaway_ticket_delete') {
            const winnerId = parts[2];

            if (!hasTicketStaffRole(interaction.member)) {
                await interaction.reply({
                    content: `❌ Only **Server Mod, T-Mod, Admin, Co-Admin, or Owner** can delete this ticket.`,
                    flags: MessageFlags.Ephemeral,
                });
                return true;
            }

            await interaction.reply({
                content: `${getEmoji('alaram')} Saving transcript and deleting this ticket in **5 seconds**...`,
            });

            const gw = getGiveaway(giveawayId);
            const transcriptChannel = interaction.guild.channels.cache.get(GIVEAWAY_TRANSCRIPT_CHANNEL_ID) ||
                await interaction.guild.channels.fetch(GIVEAWAY_TRANSCRIPT_CHANNEL_ID).catch(() => null);

            if (transcriptChannel) {
                try {
                    const attachment = await transcripts.createTranscript(interaction.channel, {
                        limit: -1,
                        filename: `${interaction.channel.name}-transcript.html`,
                        poweredBy: false,
                    });

                    const logEmbed = new EmbedBuilder()
                        .setTitle(`Giveaway Claim Ticket Transcript — ${giveawayId}`)
                        .setColor('#E74C3C')
                        .addFields(
                            { name: 'Ticket', value: `#${interaction.channel.name}`, inline: true },
                            { name: 'Winner', value: winnerId ? `<@${winnerId}>` : 'Unknown', inline: true },
                            { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Prize', value: gw ? gw.prize : 'N/A', inline: true }
                        )
                        .setTimestamp();

                    await transcriptChannel.send({
                        embeds: [logEmbed],
                        files: [attachment],
                    });
                } catch (trErr) {
                    console.error('❌ [GiveawayTicket] Failed to save transcript:', trErr);
                }
            }

            if (winnerId) {
                removeClaimTicket(giveawayId, winnerId);
            }

            setTimeout(async () => {
                await interaction.channel.delete(`Giveaway ticket closed by ${interaction.user.tag}`).catch(() => {});
            }, 5000);
            return true;
        }

        // Admin-only reroll/confirm actions below
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: `❌ Only **Server Administrators** can confirm or change giveaway winners.`,
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        // 6. Admin confirms winner & sends notification in giveaway channel
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

        // 7. Admin rerolls all winners OR a specific spot index randomly
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

        // 8. /giveaway-reroll -> "Auto" button clicked in private ephemeral panel
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

        // 9. "Change Winner (Pick User)" OR /giveaway-reroll -> "Manual" button
        if (action === 'giveaway_change_btn' || action === 'giveaway_cmd_manual') {
            const gw = getGiveaway(giveawayId);
            if (!gw) {
                return interaction.reply({ content: `❌ Giveaway not found.`, flags: MessageFlags.Ephemeral });
            }
            if (gw.status !== 'ended') {
                return interaction.reply({ content: `❌ This giveaway has not ended yet.`, flags: MessageFlags.Ephemeral });
            }

            const spotKey = parts[2] || 'all';
            const currentWinners = Array.isArray(gw.finalWinners) && gw.finalWinners.length > 0
                ? gw.finalWinners
                : (gw.pendingWinners || []);

            if ((spotKey && spotKey !== 'all') || currentWinners.length <= 1) {
                const targetIdx = spotKey && spotKey !== 'all' ? parseInt(spotKey, 10) : 0;
                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId(`giveaway_pick_user:${gw.id}:${targetIdx}:${spotKey}`)
                    .setPlaceholder(`Search and select user for Spot #${targetIdx + 1}...`)
                    .setMinValues(1)
                    .setMaxValues(1);

                const dropdownRow = new ActionRowBuilder().addComponents(userSelect);

                if (action === 'giveaway_cmd_manual') {
                    await interaction.update({
                        embeds: [buildRerollPanelEmbed(gw, spotKey, `${getEmoji('gob')} Search and select a participant for **Spot #${targetIdx + 1}** below:`)],
                        components: [...buildRerollPanelButtons(gw.id, spotKey), dropdownRow],
                    });
                } else {
                    await interaction.reply({
                        content: `${getEmoji('gob')} Search and select the user for **Spot #${targetIdx + 1}** of \`${gw.id}\`:`,
                        components: [dropdownRow],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return true;
            }

            const spotSelect = new StringSelectMenuBuilder()
                .setCustomId(`giveaway_pick_spot:${gw.id}:${spotKey}`)
                .setPlaceholder('Select which winner spot to change...')
                .addOptions(
                    currentWinners.map((uid, i) => ({
                        label: `Spot #${i + 1}`,
                        description: `Currently selected user ID: ${uid}`,
                        value: String(i),
                    }))
                );

            const dropdownRow = new ActionRowBuilder().addComponents(spotSelect);

            if (action === 'giveaway_cmd_manual') {
                await interaction.update({
                    embeds: [buildRerollPanelEmbed(gw, spotKey, `${getEmoji('gob')} First select which winner **spot** to change below:`)],
                    components: [...buildRerollPanelButtons(gw.id, spotKey), dropdownRow],
                });
            } else {
                await interaction.reply({
                    content: `${getEmoji('gob')} Select which winner **spot** you want to change for \`${gw.id}\`:`,
                    components: [dropdownRow],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return true;
        }

        // 10. Admin picked a spot -> keep main embed open and show searchable UserSelectMenu below
        if (action === 'giveaway_pick_spot') {
            const spotKey = parts[2] || 'all';
            const spotIndex = parseInt(interaction.values[0], 10);
            const gw = getGiveaway(giveawayId);
            if (!gw || gw.status !== 'ended') {
                return interaction.update({
                    content: `❌ Giveaway is not in ended state.`,
                    components: [],
                });
            }

            const userSelect = new UserSelectMenuBuilder()
                .setCustomId(`giveaway_pick_user:${gw.id}:${spotIndex}:${spotKey}`)
                .setPlaceholder(`Search and select user for Spot #${spotIndex + 1}...`)
                .setMinValues(1)
                .setMaxValues(1);

            await interaction.update({
                embeds: [buildRerollPanelEmbed(gw, spotKey, `${getEmoji('gob')} Search and select a participant for **Spot #${spotIndex + 1}** below:`)],
                components: [...buildRerollPanelButtons(gw.id, spotKey), new ActionRowBuilder().addComponents(userSelect)],
            });
            return true;
        }

        // 11. Admin searched & selected a user -> validate entry & duplicate slot, announce, and keep main embed updated
        if (action === 'giveaway_pick_user') {
            const spotIndex = parseInt(parts[2] || '0', 10);
            const spotKey = parts[3] || 'all';
            const selectedUserId = interaction.values[0];

            await interaction.deferUpdate();

            const result = setPendingWinnerSpot(giveawayId, spotIndex, selectedUserId, interaction.user);
            if (!result.ok) {
                const gw = getGiveaway(giveawayId);
                await interaction.editReply({
                    embeds: gw ? [buildRerollPanelEmbed(gw, spotKey, `❌ ${result.reason}`)] : [],
                });
                return true;
            }

            await announceRerolledWinners(interaction.client, result.giveaway, result.winners, result.spotIndex);

            await interaction.editReply({
                embeds: [buildRerollPanelEmbed(
                    result.giveaway,
                    spotKey,
                    `${getEmoji('gtick')} **Spot #${result.spotIndex + 1}** updated to <@${selectedUserId}> and announced in <#${result.giveaway.channelId}>!`
                )],
                components: buildRerollPanelButtons(result.giveaway.id, spotKey),
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
