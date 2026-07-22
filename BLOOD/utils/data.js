const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require("discord.js");
const fs = require('fs');
const path = require('path');
const { getEmoji, getEmojiObject } = require("./botemoji.js");

function formatHelpText(text) {
    if (!text) return "";
    return text
        .replace(/🔹|⚪|•/g, getEmoji("pinkdot"))
        .replace(/arrow|->|=>|➡️|👉|▶️/g, getEmoji("arrow"))
        .replace(/✅|🟢/g, getEmoji("gtick"))
        .replace(/❌|🚫|👢|🗑️/g, getEmoji("bluex"))
        .replace(/⚠️|⚙️|🔇|🔔|📣|📢/g, getEmoji("alaram"))
        .replace(/🛡️|🔒/g, getEmoji("sheild"))
        .replace(/🏆/g, getEmoji("cwl"))
        .replace(/🏯/g, getEmoji("clancastle"))
        .replace(/⚔️/g, getEmoji("cocfight"))
        .replace(/👤|🧑/g, getEmoji("mem"))
        .replace(/🩸/g, getEmoji("blood"))
        .replace(/❤️/g, getEmoji("heart"))
        .replace(/📖|📚|📋|🗂️|🔍|📄|🏷️|🔢|🎫|🟫/g, getEmoji("book"))
        .replace(/🔗/g, getEmoji("chain"))
        .replace(/🔄|♻️/g, getEmoji("refresh"))
        .replace(/⚖️|🏋️|📊/g, getEmoji("graph"));
}

const PATHS = {
    helpData: path.join(__dirname, '../data/helpData.json')
};

const BANNER_FILE       = path.join(__dirname, "../../assets/images/ba-banner.png");
const BANNER_ATTACHMENT = "ba-banner.png";
const FOOTER_TEXT = "🩸 Blood Alliance";

function footer() {
    return { text: FOOTER_TEXT, iconURL: `attachment://${BANNER_ATTACHMENT}` };
}

function getBannerFiles() {
    return fs.existsSync(BANNER_FILE) ? [{ attachment: BANNER_FILE, name: BANNER_ATTACHMENT }] : [];
}



function isStaffOrAdmin(member) {
    if (!member) return false;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;
    return false;
}

function saveHelpData(data) {
    try {
        fs.writeFileSync(PATHS.helpData, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing helpData.json:", err.message);
        throw err;
    }
}

function getHelpData() {
    try {
        if (!fs.existsSync(PATHS.helpData)) return {};
        const raw = fs.readFileSync(PATHS.helpData, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error("Error reading helpData.json:", err.message);
        return {};
    }
}

module.exports = {
    BANNER_FILE,
    BANNER_ATTACHMENT,
    getBannerFiles,
    isStaffOrAdmin,
    saveHelpData,
    getHelpData
};
