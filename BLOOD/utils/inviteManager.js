const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

const CONFIG_FILE = path.join(__dirname, '../data/inviteConfig.json');

// Memory cache for invites
// GuildID -> Collection(InviteCode -> InviteData)
const invitesCache = new Collection();

function getConfigs() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            // Ensure data directory exists
            const dataDir = path.dirname(CONFIG_FILE);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            return {};
        }
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading inviteConfig.json:', err);
        return {};
    }
}

function saveConfigs(configs) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing inviteConfig.json:', err);
    }
}

function setInviteLogChannel(guildId, channelId) {
    const configs = getConfigs();
    configs[guildId] = {
        enabled: true,
        channelId: channelId
    };
    saveConfigs(configs);
}

function disableInviteLog(guildId) {
    const configs = getConfigs();
    if (configs[guildId]) {
        configs[guildId].enabled = false;
        saveConfigs(configs);
    }
}

function getInviteConfig(guildId) {
    return getConfigs()[guildId];
}

async function fetchInviteSnapshot(guild) {
    const snapshot = new Map();
    try {
        const invites = await guild.invites.fetch();
        invites.forEach(inv => {
            snapshot.set(inv.code, {
                code: inv.code,
                uses: inv.uses,
                inviter: inv.inviter,
                maxUses: inv.maxUses,
                expiresAt: inv.expiresAt
            });
        });
        
        if (guild.features.includes('VANITY_URL')) {
            const vanity = await guild.fetchVanityData().catch(() => null);
            if (vanity) {
                snapshot.set(vanity.code, {
                    code: vanity.code,
                    uses: vanity.uses,
                    inviter: null,
                    isVanity: true,
                    expiresAt: null
                });
            }
        }
    } catch (err) {}
    return snapshot;
}

module.exports = {
    invitesCache,
    setInviteLogChannel,
    disableInviteLog,
    getInviteConfig,
    fetchInviteSnapshot
};
