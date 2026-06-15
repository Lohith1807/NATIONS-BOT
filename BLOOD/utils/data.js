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
const FOOTER_TEXT = "🩸 Blood Alliance — Use /cmd-info for bot commands";

function footer() {
    return { text: FOOTER_TEXT, iconURL: `attachment://${BANNER_ATTACHMENT}` };
}

function getBannerFiles() {
    return fs.existsSync(BANNER_FILE) ? [{ attachment: BANNER_FILE, name: BANNER_ATTACHMENT }] : [];
}

const COMMAND_EMOJIS = {
    ahelp: "book",
    autopost: "alaram",
    autorolerefresh: "refresh",
    bases: "book",
    cc: "gtick",
    check: "graph",
    clan: "clancastle",
    clanentry: "book",
    claninfo: "book",
    clanrevoke: "bluex",
    updateclanentry: "book",
    compo: "cocfight",
    crinfo: "book",
    cwl: "cwl",
    delc: "book",
    delete: "bluex",
    "delete-ticket": "bluex",
    fwa: "book",
    link: "chain",
    kick: "bluex",
    linkcheck: "book",
    lockchannel: "sheild",
    "discord-links": "chain",
    mute: "alaram",
    nickall: "book",
    ping: "book",
    player: "mem",
    playeraccounts: "book",
    playercount: "book",
    playerlookup: "book",
    postrecruitment: "alaram",
    profile: "mem",
    "setcwl-futurefwa": "cwl",
    "setup-autorole": "alaram",
    "setup-tickets": "book",
    sync: "refresh",
    ticketadd: "book",
    unban: "sheild",
    unlink: "sheild",
    unlockchannel: "sheild",
    unmute: "alaram",
    warweight: "graph",
    ww: "graph"
};

function getCommandEmoji(cmdName) {
    const key = COMMAND_EMOJIS[cmdName] || "book";
    return getEmoji(key);
}

function loadDynamicCommands() {
    const helpData = getHelpData();
    const everyone = [];
    const staff = [];

    if (helpData.commands) {
        for (const [name, cmd] of Object.entries(helpData.commands)) {
            const perm = cmd.permission || "Everyone";
            const emojiStr = getCommandEmoji(name);
            const cmdObj = {
                value: name,
                label: name,
                description: cmd.use.length > 100 ? cmd.use.substring(0, 97) + "..." : cmd.use,
                detail: {
                    title: `${emojiStr} ${name} — Info`,
                    syntax: cmd.syntax,
                    info: cmd.use,
                    permission: perm === "Admin" ? "🔒 Admin Only" : (perm === "Staff" ? "🛡️ Staff" : "👤 Everyone")
                }
            };
            if (perm === "Everyone") {
                everyone.push(cmdObj);
            } else {
                staff.push(cmdObj);
            }
        }
    }
    return { everyone, staff };
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function buildMenuRows(cmdList, customIdPrefix, maxRows = 5) {
    const chunks = chunk(cmdList, 25);
    return chunks.slice(0, maxRows).map((grp, idx) => {
        const listNum = idx + 1;
        const totalLists = Math.min(chunks.length, maxRows);
        const placeholder = totalLists > 1
            ? `📋 List ${listNum} of ${totalLists} — pick a command`
            : `📋 Pick a command to learn more…`;

        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`${customIdPrefix}_${idx}`)
                .setPlaceholder(placeholder)
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(grp.map(c => {
                    const opt = {
                        label: c.label,
                        description: c.description,
                        value: c.value,
                    };
                    const emojiKey = COMMAND_EMOJIS[c.value] || "book";
                    const emoObj = getEmojiObject(emojiKey);
                    if (emoObj) {
                        opt.emoji = emoObj;
                    }
                    return opt;
                }))
        );
    });
}

function createCmdInfoRows() {
    const { everyone } = loadDynamicCommands();
    return buildMenuRows(everyone, "cmd_info");
}

function createStaffRows() {
    const { staff } = loadDynamicCommands();
    return buildMenuRows(staff, "staff_cmd");
}

function createAdminRows() {
    const { everyone, staff } = loadDynamicCommands();
    const all = [...everyone, ...staff];
    return buildMenuRows(all, "admin_cmd");
}

function getCmdInfoPanel() {
    const { everyone } = loadDynamicCommands();
    return new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle(`${getEmoji("whited")} Blood Alliance — Everyone Commands`)
        .setDescription(formatHelpText(`**TOTAL COMMANDS : ${everyone.length}**\n\nUse the dropdown below to learn about any command.`))
        .setImage(`attachment://${BANNER_ATTACHMENT}`)
        .setFooter(footer())
        .setTimestamp();
}

function getStaffCmdPanel() {
    const { staff } = loadDynamicCommands();
    return new EmbedBuilder()
        .setColor("#2ecc71")
        .setTitle(`${getEmoji("whited")} Blood Alliance — Staff Commands`)
        .setDescription(formatHelpText(`**TOTAL COMMANDS : ${staff.length}**\n\nUse the dropdowns below to learn about any command.`))
        .setImage(`attachment://${BANNER_ATTACHMENT}`)
        .setFooter(footer())
        .setTimestamp();
}

function getAdminCmdPanel() {
    const { everyone, staff } = loadDynamicCommands();
    const totalAll = everyone.length + staff.length;
    return new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle(`${getEmoji("whited")} Blood Alliance — Full Command Reference`)
        .setDescription(
            formatHelpText(
                `**TOTAL COMMANDS : ${totalAll}**\n\n` +
                `👤 Everyone: **${everyone.length}** · 🛡️ Staff: **${staff.length}**\n\n` +
                "Use the dropdowns below to learn about any command."
            )
        )
        .setImage(`attachment://${BANNER_ATTACHMENT}`)
        .setFooter(footer())
        .setTimestamp();
}

function getDetailEmbed(cmdValue) {
    const { everyone, staff } = loadDynamicCommands();
    const all = [...everyone, ...staff];
    const cmd = all.find(c => c.value === cmdValue);
    if (!cmd) {
        return new EmbedBuilder()
            .setColor("Red")
            .setDescription("❌ Unknown command selected. Please try again.");
    }
    const d = cmd.detail;
    return new EmbedBuilder()
        .setColor("#3498db")
        .setTitle(formatHelpText(d.title))
        .addFields(
            { name: `${getEmoji("arrow")} Syntax`,      value: formatHelpText(d.syntax),      inline: false },
            { name: `${getEmoji("whited")} Info`,        value: formatHelpText(d.info),        inline: false },
            { name: `${getEmoji("whited")} Permission`,  value: formatHelpText(d.permission),  inline: false },
        )
        .setImage(`attachment://${BANNER_ATTACHMENT}`)
        .setFooter(footer())
        .setTimestamp();
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
    createCmdInfoRows,
    createStaffRows,
    createAdminRows,
    getCmdInfoPanel,
    getStaffCmdPanel,
    getAdminCmdPanel,
    getDetailEmbed,
    isStaffOrAdmin,
    saveHelpData,
    getHelpData
};
