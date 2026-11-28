const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getEmoji } = require('./botemoji.js');

const DATA_PATH = path.join(__dirname, '../data/giveaways.json');

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

/**
 * Generates a sequential giveaway ID like GW-1001, GW-1002, etc.
 */
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

/**
 * Parses duration strings such as 30s, 10m, 2h, 1d, 1w into milliseconds.
 */
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
        channelId,
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

/**
 * Secretly assigns or updates a manual winner for an active giveaway.
 */
function setManualWinner(giveawayId, userId, adminUser) {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.status !== 'active') return { ok: false, reason: 'This giveaway has already ended.' };

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

/**
 * Resets manual winner overrides and restores automatic random selection.
 */
function resetWinnerSelection(giveawayId, adminUser, actionName = 'reset') {
    const giveaways = loadGiveaways();
    const gw = giveaways.find(g => String(g.id).toUpperCase() === String(giveawayId).toUpperCase());
    if (!gw) return { ok: false, reason: 'Giveaway not found.' };
    if (gw.status !== 'active') return { ok: false, reason: 'This giveaway has already ended.' };

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

/**
 * Fisher-Yates shuffle to pick up to `count` random items without mutation.
 */
function pickRandomWinners(pool, count) {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.min(count, arr.length));
}

/**
 * Builds the public giveaway embed (never exposes winner count or admin overrides).
 */
function buildGiveawayEmbed(gw) {
    const isEnded = gw.status === 'ended';
    const timeLabel = isEnded ? 'Ended' : 'Ends';
    const ts = Math.floor((isEnded && gw.endedAt ? gw.endedAt : gw.endsAt) / 1000);

    const embed = new EmbedBuilder()
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

    return embed;
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
 * Builds the attractive winner announcement embed without exposing winnerCount or admin overrides.
 */
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
 * Ends a giveaway, selects winners (manual override or automatic random), disables button, and announces.
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
        const channel = guild
            ? (guild.channels.cache.get(gw.channelId) || await guild.channels.fetch(gw.channelId).catch(() => null))
            : await client.channels.fetch(gw.channelId).catch(() => null);

        // 2. Disable Enter Giveaway button on the original message
        if (channel && gw.messageId) {
            try {
                const origMsg = await channel.messages.fetch(gw.messageId).catch(() => null);
                if (origMsg) {
                    await origMsg.edit({
                        embeds: [buildGiveawayEmbed(gw)],
                        components: [buildEnterButton(gw, true)],
                    }).catch(() => {});
                }
            } catch (_) {}
        }

        // 3. Retrieve eligible participants (filter out users who left the server if guild is available)
        const rawParticipants = Array.from(new Set(gw.participants || []));
        let eligibleParticipants = rawParticipants;
        if (guild && rawParticipants.length > 0) {
            const validList = [];
            for (const uid of rawParticipants) {
                const member = guild.members.cache.get(uid) || await guild.members.fetch(uid).catch(() => null);
                if (member && !member.user.bot) {
                    validList.push(uid);
                }
            }
            eligibleParticipants = validList;
        }

        // 4. Handle zero eligible participants
        if (eligibleParticipants.length === 0) {
            gw.finalWinners = [];
            gw.announced = true;
            saveGiveaways(giveaways);

            if (channel) {
                const noWinnerEmbed = new EmbedBuilder()
                    .setTitle('🎉 GIVEAWAY ENDED')
                    .setColor('#E74C3C')
                    .setDescription(
                        `**Giveaway:** ${gw.prize} (\`${gw.id}\`)\n\n` +
                        `This giveaway has ended, but there were no eligible participants.`
                    )
                    .setTimestamp();
                await channel.send({ embeds: [noWinnerEmbed] }).catch(() => {});
            }

            // Notify administrator
            if (gw.createdBy) {
                try {
                    const creator = await client.users.fetch(gw.createdBy).catch(() => null);
                    if (creator) {
                        await creator.send(
                            `⚠️ Your giveaway **${gw.prize}** (\`${gw.id}\`) ended with **0 eligible participants**, so no winners were selected.`
                        ).catch(() => {});
                    }
                } catch (_) {}
            }

            console.log(`ℹ️ [GiveawayManager] Giveaway ${gw.id} ended with 0 eligible participants.`);
            return true;
        }

        // 5. Select winners (manual override takes priority over automatic random selection)
        let selectedWinners = [];
        if (gw.selectionMode === 'manual' && Array.isArray(gw.manualWinners) && gw.manualWinners.length > 0) {
            selectedWinners = gw.manualWinners.filter(uid => eligibleParticipants.includes(uid));
        }

        // If automatic mode or all manual winners became ineligible, select randomly
        if (selectedWinners.length === 0) {
            selectedWinners = pickRandomWinners(eligibleParticipants, gw.winnerCount || 1);
        }

        // 6. Persist final winners and mark announced BEFORE sending to prevent duplicate announcements
        gw.finalWinners = selectedWinners;
        gw.announced = true;
        saveGiveaways(giveaways);

        // 7. Announce winners in the original giveaway channel
        if (channel && selectedWinners.length > 0) {
            const mentionContent = selectedWinners.map(id => `<@${id}>`).join(' ');
            const announcementEmbed = buildWinnerAnnouncementEmbed(gw, selectedWinners);
            await channel.send({
                content: `🎉 Congratulations ${mentionContent}!`,
                embeds: [announcementEmbed],
            }).catch(err => {
                console.error(`❌ [GiveawayManager] Failed to announce winners for ${gw.id}:`, err.message);
            });
            console.log(`✅ [GiveawayManager] Giveaway ${gw.id} ended. Announced ${selectedWinners.length} winner(s).`);
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
 * Periodic scheduler & startup recovery to end any expired active giveaways.
 */
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
    endGiveaway,
    checkGiveaways,
};
