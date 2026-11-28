const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getEmoji } = require('./botemoji.js');

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
        .setTitle(`🎉 ${gw.prize}`)
        .setColor(isEnded ? '#95A5A6' : '#F1C40F')
        .setDescription(
            (gw.description ? `${gw.description}\n\n` : '') +
            `${getEmoji('arrow')} **${timeLabel}:** <t:${ts}:R> (<t:${ts}:f>)\n` +
            `${getEmoji('mem')} **Entries:** ${(gw.participants || []).length}\n` +
            `${getEmoji('crown')} **Hosted by:** <@${gw.createdBy}>`
        )
        .setFooter({ text: `Giveaway ID: ${gw.id}` })
        .setTimestamp(gw.endsAt);
}

function buildEnterButton(gw, disabled = false) {
    const btn = new ButtonBuilder()
        .setCustomId(`giveaway_enter:${gw.id}`)
        .setLabel(disabled ? 'Giveaway Ended' : `Enter Giveaway (${(gw.participants || []).length})`)
        .setEmoji('🎉')
        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(disabled);

    return new ActionRowBuilder().addComponents(btn);
}

/**
 * Builds the Admin Confirmation Embed sent to the admin channel (1393858242337050664).
 */
function buildAdminConfirmEmbed(gw, winners, confirmedById = null) {
    const winnerList = winners.length > 0
        ? winners.map(id => `- <@${id}> (\`${id}\`)`).join('\n')
        : '*No eligible participants*';

    const statusLine = confirmedById
        ? `✅ **Status:** Confirmed & Announced by <@${confirmedById}>`
        : `⏳ **Status:** Awaiting Admin Confirmation\n\nClick **Confirm Winner & Send Notification** to ping the winner(s) in <#${gw.channelId}>, or click **Change Winner** to randomly pick someone else.`;

    return new EmbedBuilder()
        .setTitle(`🛡️ Giveaway Winner Confirmation — ${gw.id}`)
        .setColor(confirmedById ? '#2ECC71' : '#F39C12')
        .setDescription(
            `🎁 **Giveaway:** ${gw.prize}\n` +
            `📍 **Giveaway Channel:** <#${gw.channelId}>\n` +
            `👥 **Total Entries:** ${(gw.participants || []).length}\n\n` +
            `🏆 **Selected Winner(s):**\n${winnerList}\n\n` +
            statusLine
        )
        .setFooter({ text: `Giveaway ID: ${gw.id}` })
        .setTimestamp();
}

function buildAdminConfirmButtons(giveawayId, disabled = false) {
    const confirmBtn = new ButtonBuilder()
        .setCustomId(`giveaway_confirm:${giveawayId}`)
        .setLabel('Confirm Winner & Send Notification')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled);

    const changeBtn = new ButtonBuilder()
        .setCustomId(`giveaway_reroll:${giveawayId}`)
        .setLabel('Change Winner')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);

    return new ActionRowBuilder().addComponents(confirmBtn, changeBtn);
}

function buildWinnerAnnouncementEmbed(gw, winners) {
    const isSingle = winners.length === 1;

    if (isSingle) {
        return new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY WINNER ANNOUNCEMENT!')
            .setColor('#2ECC71')
            .setDescription(
                `Congratulations to our winner!\n\n` +
                `🏆 **Winner:** <@${winners[0]}>\n\n` +
                `🎁 **Giveaway:** ${gw.prize}\n\n` +
                `Congratulations! You are the winner of this giveaway!\n\n` +
                `To claim your gift, please open a **Help / Assistance Ticket** and our team will assist you with the claiming process.\n\n` +
                `Please make sure to contact our team to proceed with your reward.\n\n` +
                `Thank you to everyone who participated!\n\n` +
                `**Giveaway:** \`${gw.id}\``
            )
            .setTimestamp();
    }

    const winnerLines = winners.map(id => `- <@${id}>`).join('\n');
    return new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY WINNERS ANNOUNCED!')
        .setColor('#2ECC71')
        .setDescription(
            `Congratulations to our winners!\n\n` +
            `🏆 **Winners:**\n${winnerLines}\n\n` +
            `🎁 **Prize:** ${gw.prize}\n\n` +
            `You are officially the winner of this giveaway!\n\n` +
            `To claim your gift, please open a **Help / Assistance Ticket**. Our team will verify your win and guide you through the claiming process.\n\n` +
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
                    .setTitle('🎉 GIVEAWAY ENDED')
                    .setColor('#E74C3C')
                    .setDescription(
                        `**Giveaway:** ${gw.prize} (\`${gw.id}\`)\n\n` +
                        `This giveaway has ended, but there were no eligible participants.`
                    )
                    .setTimestamp();
                await giveawayChannel.send({ embeds: [noWinnerEmbed] }).catch(() => {});
            }

            const adminChannel = guild
                ? (guild.channels.cache.get(ADMIN_CHANNEL_ID) || await guild.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null))
                : await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);

            if (adminChannel) {
                await adminChannel.send({
                    content: `⚠️ Giveaway **${gw.prize}** (\`${gw.id}\`) ended with **0 eligible participants**.`,
                }).catch(() => {});
            }

            console.log(`ℹ️ [GiveawayManager] Giveaway ${gw.id} ended with 0 eligible participants.`);
            return true;
        }

        // 5. Select winners (random by default; uses manual override if admin set one)
        let selectedWinners = [];
        if (gw.selectionMode === 'manual' && Array.isArray(gw.manualWinners) && gw.manualWinners.length > 0) {
            selectedWinners = gw.manualWinners.filter(uid => eligibleParticipants.includes(uid));
        }
        if (selectedWinners.length === 0) {
            selectedWinners = pickRandomWinners(eligibleParticipants, gw.winnerCount || 1);
        }

        gw.pendingWinners = selectedWinners;
        saveGiveaways(giveaways);

        // 6. Send confirmation embed to Admin Channel (1393858242337050664)
        const adminChannel = guild
            ? (guild.channels.cache.get(ADMIN_CHANNEL_ID) || await guild.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null))
            : await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);

        if (adminChannel) {
            const confirmMsg = await adminChannel.send({
                embeds: [buildAdminConfirmEmbed(gw, selectedWinners)],
                components: [buildAdminConfirmButtons(gw.id, false)],
            }).catch(err => {
                console.error(`❌ [GiveawayManager] Failed to send admin confirmation for ${gw.id}:`, err.message);
                return null;
            });

            if (confirmMsg) {
                gw.adminConfirmMessageId = confirmMsg.id;
                saveGiveaways(giveaways);
            }
            console.log(`✅ [GiveawayManager] Giveaway ${gw.id} ended. Sent winner confirmation to admin channel ${ADMIN_CHANNEL_ID}.`);
        } else {
            console.error(`❌ [GiveawayManager] Admin channel ${ADMIN_CHANNEL_ID} not found for giveaway ${gw.id}!`);
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
            content: `🎉 Congratulations ${mentionContent}!`,
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
 * Randomly selects a new set of pending winner(s), excluding current pending winners when possible.
 */
async function rerollPendingWinners(client, giveawayId, adminUser) {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.announced) return { ok: false, reason: 'Winners have already been confirmed and announced.' };

    const eligibleParticipants = await getEligibleParticipants(client, gw);
    if (eligibleParticipants.length === 0) {
        return { ok: false, reason: 'No eligible participants left in the server.' };
    }

    const currentPending = Array.isArray(gw.pendingWinners) ? gw.pendingWinners : [];
    const count = gw.winnerCount || 1;

    // Prefer participants who are NOT currently selected
    const others = eligibleParticipants.filter(uid => !currentPending.includes(uid));
    let newWinners = [];

    if (others.length >= count) {
        newWinners = pickRandomWinners(others, count);
    } else if (others.length > 0) {
        // Take all other eligible users first, then fill remaining slots from previous if needed
        newWinners = [...others, ...pickRandomWinners(currentPending, count - others.length)];
    } else {
        return { ok: false, reason: 'No other eligible participants are available to switch to.' };
    }

    gw.pendingWinners = newWinners;
    gw.selectionMode = 'auto';
    if (!Array.isArray(gw.overrideHistory)) gw.overrideHistory = [];
    gw.overrideHistory.push({
        adminId: adminUser.id,
        adminTag: adminUser.tag || adminUser.username,
        action: 'reroll',
        winners: [...newWinners],
        timestamp: Date.now(),
    });

    saveGiveaways(giveaways);
    return { ok: true, giveaway: gw, winners: newWinners };
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
    rerollPendingWinners,
    checkGiveaways,
};
