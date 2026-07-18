const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/softbanConfig.json');

let softbanConfig = {};

function loadConfig() {
    if (fs.existsSync(configPath)) {
        try {
            softbanConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error('Failed to parse softbanConfig.json:', e);
        }
    }
}
loadConfig();

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(softbanConfig, null, 4));
}

function getSoftbanConfig(guildId) {
    return softbanConfig[guildId];
}

function setSoftbanConfig(guildId, honeypotChannelId, logChannelId) {
    softbanConfig[guildId] = {
        enabled: true,
        honeypotChannelId,
        logChannelId
    };
    saveConfig();
}

function disableSoftban(guildId) {
    if (softbanConfig[guildId]) {
        softbanConfig[guildId].enabled = false;
        saveConfig();
    }
}

module.exports = {
    getSoftbanConfig,
    setSoftbanConfig,
    disableSoftban
};
