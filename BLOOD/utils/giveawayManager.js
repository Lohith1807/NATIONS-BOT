const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getEmoji, getEmojiObject } = require('./botemoji.js');

const DATA_PATH = path.join(__dirname, '../data/giveaways.json');
const ADMIN_CHANNEL_ID = process.env.GIVEAWAY_ADMIN_CHANNEL_ID || '1393858242337050664';
const GIVEAWAY_CHANNEL_ID = process.env.GIVEAWAY_CHANNEL_ID || '1385474418771492924';

// In-memory lock to prevent concurrent/duplicate giveaway ending
const endingLocks = new Set();

function loadGiveaways() {
    try {
        const dir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(DATA_PATH)) {
            fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2), 'utf8');
            return [];
        }
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('❌ [GiveawayManager] Failed to load giveaways.json:', err.message);
        return [];
    }
}

function saveGiveaways(giveaways) {
    try {
        const dir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_PATH, JSON.stringify(giveaways, null, 2), 'utf8');
    } catch (err) {
        console.error('❌ [GiveawayManager] Failed to save giveaways.json:', err.message);
    }
}

function generateGiveawayId(giveaways) {
    let maxNum = 1000;
    for (const gw of giveaways) {
        const match = String(gw.id || '').match(/^GW-(\d+)$/i);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    }
    return `GW-${maxNum + 1}`;
}

function parseDuration(str) {
    if (!str || typeof str !== 'string') return null;
    const match = str.trim().match(/^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks)$/i);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    if (val <= 0) return null;
    const unit = match[2].toLowerCase()[0];
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
    };
    return val * (multipliers[unit] || 0) || null;
}

function getGiveaway(giveawayId) {
    if (!giveawayId) return null;
    const target = String(giveawayId).trim().toUpperCase();
    const giveaways = loadGiveaways();
    return giveaways.find(g => String(g.id).toUpperCase() === target) || null;
}

function getGuildGiveaways(guildId) {
    return loadGiveaways().filter(g => g.guildId === guildId);
}

function createGiveaway({ guildId, channelId, messageId, prize, description, winnerCount, endsAt, createdBy }) {
    const giveaways = loadGiveaways();
    const id = generateGiveawayId(giveaways);
    const record = {
        id,
        guildId,
        channelId: channelId || GIVEAWAY_CHANNEL_ID,
        messageId,
        prize,
        description: description || null,
        winnerCount: Math.max(1, parseInt(winnerCount, 10) || 1),
        endsAt,
        createdAt: Date.now(),
        createdBy,
        status: 'active',
        announced: false,
        endedAt: null,
        participants: [],
        selectionMode: 'auto',
        manualWinners: [],
        overrideHistory: [],
        pendingWinners: [],
        adminConfirmMessageId: null,
        confirmedBy: null,
        confirmedAt: null,
        finalWinners: [],
    };
    giveaways.push(record);
    saveGiveaways(giveaways);
    return record;
}

function updateGiveawayMessageId(giveawayId, messageId) {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => g.id === giveawayId);
    if (gw) {
        gw.messageId = messageId;
        saveGiveaways(giveaways);
    }
}

function addParticipant(giveawayId, userId) {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.status !== 'active' || Date.now() >= gw.endsAt) {
        return { ok: false, reason: 'This giveaway has already ended.' };
    }
    if (!Array.isArray(gw.participants)) gw.participants = [];
    if (gw.participants.includes(userId)) {
        return { ok: false, reason: 'already_entered', count: gw.participants.length };
    }
    gw.participants.push(userId);
    saveGiveaways(giveaways);
    return { ok: true, count: gw.participants.length, giveaway: gw };
}

function setManualWinner(giveawayId, userId, adminUser) {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.announced) return { ok: false, reason: 'This giveaway has already been confirmed and announced.' };

    if (!Array.isArray(gw.participants) || !gw.participants.includes(userId)) {
        return { ok: false, reason: `<@${userId}> has not entered this giveaway yet. Only participants who entered can be selected.` };
    }

    if (!Array.isArray(gw.manualWinners)) gw.manualWinners = [];
    if (gw.manualWinners.includes(userId)) {
        return { ok: false, reason: `<@${userId}> is already in the manual winner list for \`${gw.id}\`.` };
    }

    const maxWinners = gw.winnerCount || 1;
    let replacedUserId = null;
    if (gw.manualWinners.length >= maxWinners) {
        replacedUserId = gw.manualWinners.shift();
    }
    gw.manualWinners.push(userId);
    gw.selectionMode = 'manual';

    if (gw.status === 'ended' && !gw.announced) {
        gw.pendingWinners = [...gw.manualWinners];
    }

    if (!Array.isArray(gw.overrideHistory)) gw.overrideHistory = [];
    gw.overrideHistory.push({
        adminId: adminUser.id,
        adminTag: adminUser.tag || adminUser.username,
        action: 'manual',
        winners: [...gw.manualWinners],
        timestamp: Date.now(),
    });

    saveGiveaways(giveaways);
    return { ok: true, giveaway: gw, replacedUserId };
}

function resetWinnerSelection(giveawayId, adminUser, actionName = 'reset') {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.announced) return { ok: false, reason: 'This giveaway has already been confirmed and announced.' };

    gw.manualWinners = [];
    gw.selectionMode = 'auto';

    if (!Array.isArray(gw.overrideHistory)) gw.overrideHistory = [];
    gw.overrideHistory.push({
        adminId: adminUser.id,
        adminTag: adminUser.tag || adminUser.username,
        action: actionName,
        winners: [],
        timestamp: Date.now(),
    });

    saveGiveaways(giveaways);
    return { ok: true, giveaway: gw };
}

function pickRandomWinners(pool, count) {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.min(count, arr.length));
}

async function getEligibleParticipants(client, gw) {
    const rawParticipants = Array.from(new Set(gw.participants || []));
    const guild = client.guilds.cache.get(gw.guildId) || await client.guilds.fetch(gw.guildId).catch(() => null);
    if (!guild || rawParticipants.length === 0) return rawParticipants;

    const validList = [];
    for (const uid of rawParticipants) {
        const member = guild.members.cache.get(uid) || await guild.members.fetch(uid).catch(() => null);
        if (member && !member.user.bot) {
            validList.push(uid);
        }
    }
    return validList;
}

function buildGiveawayEmbed(gw) {
    const isEnded = gw.status === 'ended';
    const timeLabel = isEnded ? 'Ended' : 'Ends';
    const ts = Math.floor((isEnded && gw.endedAt ? gw.endedAt : gw.endsAt) / 1000);

    return new EmbedBuilder()
        .setTitle(gw.prize)
        .setColor(isEnded ? '#95A5A6' : '#F1C40F')
        .setDescription(
            `${getEmoji('gift')} **Giveaway:** ${gw.prize}\n` +
            (gw.description ? `${gw.description}\n\n` : '\n') +
            `${getEmoji('book')} **${timeLabel}:** <t:${ts}:R> (<t:${ts}:f>)\n` +
            `${getEmoji('gob')} **Entries:** ${(gw.participants || []).length}\n` +
            `${getEmoji('crown')} **Hosted by:** <@${gw.createdBy}>`
        )
        .setFooter({ text: `Giveaway ID: ${gw.id}` })
        .setTimestamp(gw.endsAt);
}

function buildEnterButton(gw, disabled = false) {
    const btn = new ButtonBuilder()
        .setCustomId(`giveaway_enter:${gw.id}`)
        .setLabel(disabled ? 'Giveaway Ended' : `Enter Giveaway (${(gw.participants || []).length})`)
        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(disabled);

    const giftEmoji = getEmojiObject('gift');
    if (giftEmoji) btn.setEmoji(giftEmoji);

    return new ActionRowBuilder().addComponents(btn);
}

/**
 * Builds the Admin Confirmation Embed sent to the admin channel (1393858242337050664).
 */
function buildAdminConfirmEmbed(gw, winners, confirmedById = null) {
    const winnerList = winners.length > 0
        ? winners.map((id, idx) => `**${idx + 1}.** ${getEmoji('pinkdot')} <@${id}> (\`${id}\`)`).join('\n')
        : '*No eligible participants*';

    const statusLine = confirmedById
        ? `${getEmoji('gtick')} **Status:** Confirmed & Announced by <@${confirmedById}>`
        : `${getEmoji('alaram')} **Status:** Awaiting Admin Confirmation\n\nClick **Confirm Winner & Send Notification** to ping the winner(s) in <#${gw.channelId}>, or reroll a specific spot below.`;

    return new EmbedBuilder()
        .setTitle(`Giveaway Winner Confirmation — ${gw.id}`)
        .setColor(confirmedById ? '#2ECC71' : '#F39C12')
        .setDescription(
            `${getEmoji('sheild')} **Admin Confirmation Required**\n\n` +
            `${getEmoji('gift')} **Giveaway:** ${gw.prize}\n` +
            `${getEmoji('book')} **Giveaway Channel:** <#${gw.channelId}>\n` +
            `${getEmoji('gob')} **Total Entries:** ${(gw.participants || []).length}\n\n` +
            `${getEmoji('no1')} **Selected Winner(s):**\n${winnerList}\n\n` +
            statusLine
        )
        .setFooter({ text: `Giveaway ID: ${gw.id}` })
        .setTimestamp();
}

function buildAdminConfirmButtons(giveawayId, disabled = false, winnerCount = 1) {
    const confirmBtn = new ButtonBuilder()
        .setCustomId(`giveaway_confirm:${giveawayId}`)
        .setLabel('Confirm Winner & Send Notification')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled);

    const tickEmoji = getEmojiObject('gtick');
    if (tickEmoji) confirmBtn.setEmoji(tickEmoji);

    const rerollAllBtn = new ButtonBuilder()
        .setCustomId(`giveaway_reroll:${giveawayId}:all`)
        .setLabel(winnerCount > 1 ? 'Reroll All' : 'Reroll Winner')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    const refreshEmoji = getEmojiObject('refresh');
    if (refreshEmoji) rerollAllBtn.setEmoji(refreshEmoji);

    const changeUserBtn = new ButtonBuilder()
        .setCustomId(`giveaway_change_btn:${giveawayId}`)
        .setLabel('Change Winner (Pick User)')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);

    const rows = [new ActionRowBuilder().addComponents(confirmBtn, rerollAllBtn, changeUserBtn)];

    // Add per-spot reroll controls when there are multiple winner spots
    if (winnerCount > 1) {
        if (winnerCount <= 5) {
            const spotRow = new ActionRowBuilder();
            for (let i = 0; i < winnerCount; i++) {
                const spotBtn = new ButtonBuilder()
                    .setCustomId(`giveaway_reroll:${giveawayId}:${i}`)
                    .setLabel(`Reroll #${i + 1}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled);
                if (refreshEmoji) spotBtn.setEmoji(refreshEmoji);
                spotRow.addComponents(spotBtn);
            }
            rows.push(spotRow);
        } else {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`giveaway_reroll_select:${giveawayId}`)
                .setPlaceholder('Select a winner spot to reroll...')
                .setDisabled(disabled)
                .addOptions(
                    Array.from({ length: Math.min(winnerCount, 25) }, (_, i) => ({
                        label: `Reroll Spot #${i + 1}`,
                        description: `Pick a new random winner for spot #${i + 1}`,
                        value: String(i),
                    }))
                );
            rows.push(new ActionRowBuilder().addComponents(select));
        }
    }

    return rows;
}

function buildWinnerAnnouncementEmbed(gw, winners) {
    const isSingle = winners.length === 1;

    if (isSingle) {
        return new EmbedBuilder()
            .setTitle('GIVEAWAY WINNER ANNOUNCEMENT!')
            .setColor('#2ECC71')
            .setDescription(
                `${getEmoji('gift')} **GIVEAWAY WINNER ANNOUNCEMENT!**\n\n` +
                `Congratulations to our winner!\n\n` +
                `${getEmoji('no1')} **Winner:** <@${winners[0]}>\n\n` +
                `${getEmoji('gift')} **Giveaway:** ${gw.prize}\n\n` +
                `Congratulations! You are the winner of this giveaway!\n\n` +
                `${getEmoji('book')} To claim your gift, please open a **Help / Assistance Ticket** and our team will assist you with the claiming process.\n\n` +
                `Please make sure to contact our team to proceed with your reward.\n\n` +
                `Thank you to everyone who participated!\n\n` +
                `**Giveaway:** \`${gw.id}\``
            )
            .setTimestamp();
    }

    const winnerLines = winners.map(id => `- <@${id}>`).join('\n');
    return new EmbedBuilder()
        .setTitle('GIVEAWAY WINNERS ANNOUNCED!')
        .setColor('#2ECC71')
        .setDescription(
            `${getEmoji('gift')} **GIVEAWAY WINNERS ANNOUNCED!**\n\n` +
            `Congratulations to our winners!\n\n` +
            `${getEmoji('no1')} **Winners:**\n${winnerLines}\n\n` +
            `${getEmoji('gift')} **Prize:** ${gw.prize}\n\n` +
            `You are officially the winner of this giveaway!\n\n` +
            `${getEmoji('book')} To claim your gift, please open a **Help / Assistance Ticket**. Our team will verify your win and guide you through the claiming process.\n\n` +
            `Thank you to everyone who participated!\n\n` +
            `**Giveaway:** \`${gw.id}\``
        )
        .setTimestamp();
}

/**
 * Ends a giveaway: closes entries, disables button, picks random (or manual) winners,
 * and sends a confirmation embed to ADMIN_CHANNEL_ID (1393858242337050664).
 */
async function endGiveaway(client, giveawayId) {
    if (endingLocks.has(giveawayId)) return false;
    endingLocks.add(giveawayId);

    try {
        const giveaways = loadGiveaways();
        const gw = giveaways.find(g => g.id === giveawayId);
        if (!gw || gw.status === 'ended' || gw.announced) {
            return false;
        }

        // 1. Stop accepting entries immediately
        gw.status = 'ended';
        gw.endedAt = Date.now();
        saveGiveaways(giveaways);

        const guild = client.guilds.cache.get(gw.guildId) || await client.guilds.fetch(gw.guildId).catch(() => null);
        const giveawayChannelId = gw.channelId || GIVEAWAY_CHANNEL_ID;
        const giveawayChannel = guild
            ? (guild.channels.cache.get(giveawayChannelId) || await guild.channels.fetch(giveawayChannelId).catch(() => null))
            : await client.channels.fetch(giveawayChannelId).catch(() => null);

        // 2. Disable Enter Giveaway button on the original message
        if (giveawayChannel && gw.messageId) {
            try {
                const origMsg = await giveawayChannel.messages.fetch(gw.messageId).catch(() => null);
                if (origMsg) {
                    await origMsg.edit({
                        embeds: [buildGiveawayEmbed(gw)],
                        components: [buildEnterButton(gw, true)],
                    }).catch(() => {});
                }
            } catch (_) {}
        }

        // 3. Retrieve eligible participants
        const eligibleParticipants = await getEligibleParticipants(client, gw);

        // 4. Handle zero eligible participants
        if (eligibleParticipants.length === 0) {
            gw.pendingWinners = [];
            gw.finalWinners = [];
            gw.announced = true;
            saveGiveaways(giveaways);

            if (giveawayChannel) {
                const noWinnerEmbed = new EmbedBuilder()
                    .setTitle('GIVEAWAY ENDED')
                    .setColor('#E74C3C')
                    .setDescription(
                        `${getEmoji('gift')} **Giveaway:** ${gw.prize} (\`${gw.id}\`)\n\n` +
                        `${getEmoji('alaram')} This giveaway has ended, but there were no eligible participants.`
                    )
                    .setTimestamp();
                await giveawayChannel.send({ embeds: [noWinnerEmbed] }).catch(() => {});
            }

            const adminChannel = guild
                ? (guild.channels.cache.get(ADMIN_CHANNEL_ID) || await guild.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null))
                : await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);

            if (adminChannel) {
                await adminChannel.send({
                    content: `${getEmoji('alaram')} Giveaway **${gw.prize}** (\`${gw.id}\`) ended with **0 eligible participants**.`,
                }).catch(() => {});
            }

            console.log(`ℹ️ [GiveawayManager] Giveaway ${gw.id} ended with 0 eligible participants.`);
            return true;
        }

        // 5. Select winners (random by default, never duplicate)
        let selectedWinners = [];
        if (gw.selectionMode === 'manual' && Array.isArray(gw.manualWinners) && gw.manualWinners.length > 0) {
            selectedWinners = Array.from(new Set(gw.manualWinners.filter(uid => eligibleParticipants.includes(uid))));
        }
        if (selectedWinners.length === 0) {
            selectedWinners = pickRandomWinners(eligibleParticipants, gw.winnerCount || 1);
        }

        // 6. Save final winners & mark announced BEFORE sending to prevent duplicate announcements
        gw.finalWinners = selectedWinners;
        gw.pendingWinners = selectedWinners;
        gw.announced = true;
        saveGiveaways(giveaways);

        // 7. Directly announce winners in the channel where the giveaway embed was posted
        if (giveawayChannel) {
            const mentionContent = selectedWinners.map(id => `<@${id}>`).join(' ');
            const announcementEmbed = buildWinnerAnnouncementEmbed(gw, selectedWinners);
            const annMsg = await giveawayChannel.send({
                content: `${getEmoji('gift')} Congratulations ${mentionContent}!`,
                embeds: [announcementEmbed],
            }).catch(err => {
                console.error(`❌ [GiveawayManager] Failed to announce winners for ${gw.id}:`, err.message);
                return null;
            });

            if (annMsg) {
                gw.announcementMessageId = annMsg.id;
                saveGiveaways(giveaways);
            }
            console.log(`✅ [GiveawayManager] Giveaway ${gw.id} ended. Directly announced ${selectedWinners.length} winner(s) in #${giveawayChannel.name || giveawayChannelId}.`);
        }

        return true;
    } catch (err) {
        console.error(`❌ [GiveawayManager] Error ending giveaway ${giveawayId}:`, err);
        return false;
    } finally {
        endingLocks.delete(giveawayId);
    }
}

/**
 * Announces rerolled winner(s) in the giveaway channel so the new winner gets pinged.
 */
async function announceRerolledWinners(client, gw, winners, spotIndex = null) {
    const guild = client.guilds.cache.get(gw.guildId) || await client.guilds.fetch(gw.guildId).catch(() => null);
    const targetChannelId = gw.channelId || GIVEAWAY_CHANNEL_ID;
    const channel = guild
        ? (guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null))
        : await client.channels.fetch(targetChannelId).catch(() => null);

    if (!channel || !winners || winners.length === 0) return;

    const pingUsers = spotIndex !== null && spotIndex !== undefined && winners[spotIndex]
        ? [winners[spotIndex]]
        : winners;
    const mentionContent = pingUsers.map(id => `<@${id}>`).join(' ');
    const announcementEmbed = buildWinnerAnnouncementEmbed(gw, winners);

    await channel.send({
        content: `${getEmoji('refresh')} **Giveaway Rerolled!** ${getEmoji('gift')} Congratulations ${mentionContent}!`,
        embeds: [announcementEmbed],
    }).catch(err => {
        console.error(`❌ [GiveawayManager] Failed to send reroll announcement for ${gw.id}:`, err.message);
    });
}

/**
 * Confirms pending winners and sends the public announcement in the giveaway channel.
 */
async function confirmGiveawayWinners(client, giveawayId, adminUser) {
    if (endingLocks.has(`confirm:${giveawayId}`)) {
        return { ok: false, reason: 'Confirmation is already in progress.' };
    }
    endingLocks.add(`confirm:${giveawayId}`);

    try {
        const giveaways = loadGiveaways();
        const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
        if (!gw) return { ok: false, reason: 'Giveaway not found.' };
        if (gw.announced) return { ok: false, reason: 'Winners have already been confirmed and announced.' };

        const winners = Array.isArray(gw.pendingWinners) && gw.pendingWinners.length > 0
            ? gw.pendingWinners
            : (gw.manualWinners || []);

        if (winners.length === 0) {
            return { ok: false, reason: 'No pending winners found to confirm.' };
        }

        gw.finalWinners = winners;
        gw.announced = true;
        gw.confirmedBy = adminUser.id;
        gw.confirmedAt = Date.now();
        saveGiveaways(giveaways);

        const guild = client.guilds.cache.get(gw.guildId) || await client.guilds.fetch(gw.guildId).catch(() => null);
        const targetChannelId = gw.channelId || GIVEAWAY_CHANNEL_ID;
        const channel = guild
            ? (guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null))
            : await client.channels.fetch(targetChannelId).catch(() => null);

        if (!channel) {
            return { ok: false, reason: `Giveaway channel <#${targetChannelId}> could not be found.` };
        }

        const mentionContent = winners.map(id => `<@${id}>`).join(' ');
        const announcementEmbed = buildWinnerAnnouncementEmbed(gw, winners);
        await channel.send({
            content: `${getEmoji('gift')} Congratulations ${mentionContent}!`,
            embeds: [announcementEmbed],
        });

        console.log(`✅ [GiveawayManager] Admin ${adminUser.tag} confirmed & announced winners for ${gw.id} in #${channel.name || targetChannelId}.`);
        return { ok: true, giveaway: gw, winners };
    } catch (err) {
        console.error(`❌ [GiveawayManager] Error confirming winners for ${giveawayId}:`, err);
        return { ok: false, reason: err.message };
    } finally {
        endingLocks.delete(`confirm:${giveawayId}`);
    }
}

/**
 * Randomly rerolls either all pending winners or a single specific spot index (0-based),
 * guaranteeing no duplicate winners across spots.
 */
async function rerollPendingWinners(client, giveawayId, adminUser, spotIndex = null) {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.status !== 'ended') return { ok: false, reason: 'This giveaway has not ended yet.' };

    const eligibleParticipants = await getEligibleParticipants(client, gw);
    if (eligibleParticipants.length === 0) {
        return { ok: false, reason: 'No eligible participants left in the server.' };
    }

    const currentWinners = Array.isArray(gw.finalWinners) && gw.finalWinners.length > 0
        ? [...gw.finalWinners]
        : (Array.isArray(gw.pendingWinners) ? [...gw.pendingWinners] : []);
    const count = currentWinners.length || gw.winnerCount || 1;

    // Exclude ALL currently selected winners so we never pick a duplicate player
    const availablePool = eligibleParticipants.filter(uid => !currentWinners.includes(uid));

    let newWinners;
    if (spotIndex !== null && spotIndex !== undefined && !isNaN(spotIndex)) {
        const idx = parseInt(spotIndex, 10);
        if (idx < 0 || idx >= currentWinners.length) {
            return { ok: false, reason: `Invalid winner spot #${idx + 1}.` };
        }
        if (availablePool.length === 0) {
            return { ok: false, reason: 'No other eligible participants are available to replace this spot without duplicating an existing winner.' };
        }
        const [replacement] = pickRandomWinners(availablePool, 1);
        newWinners = [...currentWinners];
        newWinners[idx] = replacement;
    } else {
        if (availablePool.length >= count) {
            newWinners = pickRandomWinners(availablePool, count);
        } else if (availablePool.length > 0) {
            const needed = Math.min(count, eligibleParticipants.length) - availablePool.length;
            newWinners = [...availablePool, ...pickRandomWinners(currentWinners, needed)];
        } else {
            return { ok: false, reason: 'No other eligible participants are available to reroll to.' };
        }
    }

    const uniqueWinners = Array.from(new Set(newWinners));
    gw.finalWinners = uniqueWinners;
    gw.pendingWinners = uniqueWinners;
    gw.selectionMode = 'auto';
    if (!Array.isArray(gw.overrideHistory)) gw.overrideHistory = [];
    gw.overrideHistory.push({
        adminId: adminUser.id,
        adminTag: adminUser.tag || adminUser.username,
        action: spotIndex !== null && spotIndex !== undefined ? `reroll_spot_${Number(spotIndex) + 1}` : 'reroll_all',
        winners: [...uniqueWinners],
        timestamp: Date.now(),
    });

    saveGiveaways(giveaways);
    return { ok: true, giveaway: gw, winners: uniqueWinners, rerolledSpot: spotIndex };
}

/**
 * Replaces a specific winner spot with a chosen user, validating that:
 * 1. The user entered the giveaway.
 * 2. The user is not already in a winner slot (if so, reports their existing slot).
 */
function setPendingWinnerSpot(giveawayId, spotIndex, targetUserId, adminUser) {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.status !== 'ended') return { ok: false, reason: 'This giveaway has not ended yet.' };

    if (!Array.isArray(gw.participants) || !gw.participants.includes(targetUserId)) {
        return {
            ok: false,
            code: 'NOT_ENTERED',
            reason: `<@${targetUserId}> has **not entered** giveaway \`${gw.id}\`! Only participants who entered can be selected as a winner.`,
        };
    }

    const currentWinners = Array.isArray(gw.finalWinners) && gw.finalWinners.length > 0
        ? [...gw.finalWinners]
        : (Array.isArray(gw.pendingWinners) ? [...gw.pendingWinners] : []);

    const existingSlot = currentWinners.indexOf(targetUserId);
    if (existingSlot !== -1) {
        return {
            ok: false,
            code: 'ALREADY_WINNER',
            slot: existingSlot + 1,
            reason: `<@${targetUserId}> is already a winner in **Spot #${existingSlot + 1}**!`,
        };
    }

    const idx = Math.max(0, Math.min(parseInt(spotIndex, 10) || 0, Math.max(0, currentWinners.length - 1)));
    const previousWinnerId = currentWinners[idx] || null;
    currentWinners[idx] = targetUserId;
    gw.finalWinners = currentWinners;
    gw.pendingWinners = currentWinners;

    if (!Array.isArray(gw.overrideHistory)) gw.overrideHistory = [];
    gw.overrideHistory.push({
        adminId: adminUser.id,
        adminTag: adminUser.tag || adminUser.username,
        action: `change_spot_${idx + 1}`,
        winners: [...currentWinners],
        timestamp: Date.now(),
    });

    saveGiveaways(giveaways);
    return { ok: true, giveaway: gw, winners: currentWinners, spotIndex: idx, previousWinnerId };
}

async function checkGiveaways(client) {
    const giveaways = loadGiveaways();
    const now = Date.now();
    for (const gw of giveaways) {
        if (gw.status === 'active' && !gw.announced && now >= Number(gw.endsAt)) {
            await endGiveaway(client, gw.id);
        }
    }
}

module.exports = {
    ADMIN_CHANNEL_ID,
    GIVEAWAY_CHANNEL_ID,
    loadGiveaways,
    saveGiveaways,
    parseDuration,
    getGiveaway,
    getGuildGiveaways,
    createGiveaway,
    updateGiveawayMessageId,
    addParticipant,
    setManualWinner,
    resetWinnerSelection,
    buildGiveawayEmbed,
    buildEnterButton,
    buildAdminConfirmEmbed,
    buildAdminConfirmButtons,
    endGiveaway,
    confirmGiveawayWinners,
    announceRerolledWinners,
    rerollPendingWinners,
    setPendingWinnerSpot,
    checkGiveaways,
};
