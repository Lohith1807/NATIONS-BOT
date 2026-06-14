const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require("discord.js");
const fs = require('fs');
const path = require('path');

const PATHS = {
    helpData: path.join(__dirname, 'helpData.json')
};

const BANNER_FILE       = path.join(__dirname, "../assets/images/ba-banner.png");
const BANNER_ATTACHMENT = "ba-banner.png";
const FOOTER_TEXT = "🩸 Blood Alliance — Use /cmd-info for bot commands";

function footer() {
    return { text: FOOTER_TEXT, iconURL: `attachment://${BANNER_ATTACHMENT}` };
}

function getBannerFiles() {
    return fs.existsSync(BANNER_FILE) ? [{ attachment: BANNER_FILE, name: BANNER_ATTACHMENT }] : [];
}

const EVERYONE_COMMANDS = [
    {
        value: "bases",
        label: "📚 bases",
        description: "Alliance base layout library",
        detail: {
            title: "📚 bases — Base Layout Library",
            syntax: "`;bases`  or  `!bases`",
            info: "Opens the alliance base layout library for sharing and downloading town hall designs.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "clan",
        label: "🏯 clan",
        description: "Detailed clan info & war statistics",
        detail: {
            title: "🏯 clan — Clan Info",
            syntax: "`;clan #TAG`\n`;clan Nickname`\n`;clan clanname`\n`;clan @user`",
            info: "Shows detailed clan info and war statistics. Adapts the view for FWA vs WAR clans.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "claninfo",
        label: "📋 claninfo",
        description: "Clan details + FWA verification",
        detail: {
            title: "📋 claninfo — Clan Details",
            syntax: "`;claninfo #TAG`\n`;claninfo clanname`\n`/claninfo #TAG`",
            info: "Lists clan details and runs an FWA verification check on the clan.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "compo",
        label: "⚔️ compo",
        description: "Clan composition & war weight breakdown",
        detail: {
            title: "⚔️ compo — Composition",
            syntax: "`;compo #TAG`\n`;compo all`\n`;compo nickname`",
            info: "Shows the composition and war weight distribution of a clan.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "cwl",
        label: "🏆 cwl",
        description: "Clan War League overview & stats",
        detail: {
            title: "🏆 cwl — Clan War League",
            syntax: "`;cwl`  or  `!cwl`",
            info: "Provides a detailed overview and statistics for the current Clan War League season.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "fwa",
        label: "🌾 fwa",
        description: "About the Farm War Alliance",
        detail: {
            title: "🌾 fwa — Farm War Alliance Info",
            syntax: "`;fwa`  or  `!fwa`",
            info: "Provides an educational overview and information about the Farm War Alliance.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "link",
        label: "🔗 link",
        description: "Link your Clash of Clans account to Discord",
        detail: {
            title: "🔗 link — Link CoC Account",
            syntax: "`;link #TAG`\n`/link #TAG`\n\n**Link for another user (Admin):**\n`;link @user #TAG`\n`/link @user #TAG`",
            info: "Links a Clash of Clans account to your Discord profile. Run again with a different tag to add multiple accounts.\n\nFind your tag in Clash of Clans → tap your profile icon → tag starts with `#`.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "ping",
        label: "📡 ping",
        description: "Check the bot's connection speed",
        detail: {
            title: "📡 ping — Bot Latency",
            syntax: "`;ping`  or  `/ping`",
            info: "Shows the bot's current connection latency to Discord.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "player",
        label: "🧑 player",
        description: "Full player stats (troops, heroes, spells)",
        detail: {
            title: "🧑 player — Player Statistics",
            syntax: "`;player #TAG`",
            info: "Shows detailed player statistics including troops, heroes, and spells.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "playeraccounts",
        label: "🗂️ playeraccounts",
        description: "See all linked CoC accounts for a user",
        detail: {
            title: "🗂️ playeraccounts — Linked Accounts",
            syntax: "`/playeraccounts @user`",
            info: "Shows all Clash of Clans accounts linked to a Discord user.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "playerlookup",
        label: "🔍 playerlookup",
        description: "Look up a player by tag or Discord user",
        detail: {
            title: "🔍 playerlookup — Player Lookup",
            syntax: "`/playerlookup tag:#TAG`\n`/playerlookup member:@User`",
            info: "Look up a player by tag or Discord user. Shows a dropdown if multiple accounts are linked.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "profile",
        label: "👤 profile",
        description: "View your or someone else's Clash profile",
        detail: {
            title: "👤 profile — Clash Profile",
            syntax: "`;profile #TAG`\n`;p @user`\n`/profile #TAG`\n`/p @user`",
            info: "Shows a clean overview of a player's profile and general progress.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "strikelist",
        label: "📄 strikelist",
        description: "See who has strikes (linked & unlinked)",
        detail: {
            title: "📄 strikelist — View Strikes",
            syntax: "`/strikelist linked clan:Selection` — Linked members (all or one clan)\n`/strikelist unlinked` — All unlinked players\n`/strikelist unlinked tag:#TAG` — Search by tag",
            info: "View all strike records. Linked: filter by clan or view all. Unlinked: browse all or search by tag.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "unlink",
        label: "🔓 unlink",
        description: "Remove a linked Clash of Clans account",
        detail: {
            title: "🔓 unlink — Remove Linked Account",
            syntax: "`;unlink #TAG`\n`/unlink #TAG`\n\n**Remove for another user (Admin):**\n`;unlink @user #TAG`\n`/unlink @user #TAG`",
            info: "Removes a linked Clash of Clans account from a Discord user profile.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "warweight",
        label: "⚖️ warweight",
        description: "How to calculate CoC war weight",
        detail: {
            title: "⚖️ warweight — War Weight Guide",
            syntax: "`/warweight`",
            info: "Shows instructions and tips on how to calculate your Clash of Clans war weight correctly.",
            permission: "👤 Everyone",
        },
    },
    {
        value: "ww",
        label: "🏋️ ww",
        description: "War weights for every member in a clan",
        detail: {
            title: "🏋️ ww — Clan War Weights",
            syntax: "`;ww #TAG`",
            info: "Displays war weights for every member in the specified clan.",
            permission: "👤 Everyone",
        },
    },
];

const STAFF_COMMANDS = [
    // Moderation
    {
        value: "kick",
        label: "👢 kick",
        description: "Kick a member with DM notification",
        detail: {
            title: "👢 kick — Kick Member",
            syntax: "`/kick target:@User [reason:Text]`",
            info: "Kicks a member from the server with a confirmation prompt and sends them a DM notification.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "mute",
        label: "🔇 mute",
        description: "Timeout a member for a set duration",
        detail: {
            title: "🔇 mute — Timeout Member",
            syntax: "`/mute target:@User duration:10m [reason:Text]`",
            info: "Applies a Discord timeout. Duration examples: `10s`, `5m`, `2h`, `1d`. Max 28 days.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "unmute",
        label: "🔔 unmute",
        description: "Remove an active timeout from a member",
        detail: {
            title: "🔔 unmute — Remove Timeout",
            syntax: "`/unmute target:@User [reason:Text]`",
            info: "Removes an active timeout (mute) from a member immediately.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "unban",
        label: "🔓 unban",
        description: "Unban a user by Discord ID",
        detail: {
            title: "🔓 unban — Unban User",
            syntax: "`/unban userid:123456789 [reason:Text]`",
            info: "Unbans a user from the server using their Discord User ID.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "delete_msg",
        label: "🗑️ delete",
        description: "Bulk-delete messages from a channel",
        detail: {
            title: "🗑️ delete — Bulk Delete Messages",
            syntax: "`;delete [count]`",
            info: "Bulk-deletes a specified number of messages from the current channel.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "lockchannel",
        label: "🔒 lockchannel",
        description: "Lock a channel to prevent @everyone messages",
        detail: {
            title: "🔒 lockchannel — Lock Channel",
            syntax: "`/lockchannel [channel:#Channel] [reason:Text]`",
            info: "Locks a channel to prevent @everyone from sending messages.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "unlockchannel",
        label: "🔓 unlockchannel",
        description: "Restore messaging in a locked channel",
        detail: {
            title: "🔓 unlockchannel — Unlock Channel",
            syntax: "`/unlockchannel [channel:#Channel] [reason:Text]`",
            info: "Restores messaging in a previously locked channel for @everyone.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "ahelp",
        label: "📖 ahelp",
        description: "Show list of admin commands",
        detail: {
            title: "📖 ahelp — Admin Help",
            syntax: "`;ahelp`",
            info: "Shows a list of admin commands and all available commands.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "clanentry",
        label: "➕ clanentry",
        description: "Register or update a clan (creates roles/channels)",
        detail: {
            title: "➕ clanentry — Register Clan",
            syntax: "`/clanentry clantag:#TAG nickname:NICK clantype:Choice autopost:Boolean leader:@User [coleader1-4:@User]`",
            info: "Registers or updates a clan. Automatically creates roles, category, and channels if not already provided.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "updateclanentry",
        label: "✏️ updateclanentry",
        description: "Update leaders/co-leaders for a clan",
        detail: {
            title: "✏️ updateclanentry — Update Clan Leaders",
            syntax: "`/updateclanentry clan:#TAG`",
            info: "Opens an interactive menu to update or add leaders and co-leaders for a clan.",
            permission: "🔒 Admin Only",
        },
    },
    {
        value: "clanrevoke",
        label: "🚫 clanrevoke",
        description: "Remove a clan from the alliance registry",
        detail: {
            title: "🚫 clanrevoke — Remove Clan",
            syntax: "`/clanrevoke clan:Selection`",
            info: "Removes a clan and all its associated data from the alliance registry.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "crinfo",
        label: "🗂️ crinfo",
        description: "Registry info for all registered clans",
        detail: {
            title: "🗂️ crinfo — Clan Registry Info",
            syntax: "`;crinfo`",
            info: "Displays detailed registry information for all alliance-registered clans.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "cc",
        label: "✅ cc",
        description: "FWA eligibility check & assign clan roles",
        detail: {
            title: "✅ cc — FWA Check",
            syntax: "`;cc #TAG`\n`;check #TAG`",
            info: "Validates a player's FWA eligibility and automatically assigns the correct clan roles.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "setcwl",
        label: "🏆 setcwl-futurefwa",
        description: "Mark a clan as CWL or Future FWA",
        detail: {
            title: "🏆 setcwl-futurefwa — Set Clan Type",
            syntax: "`/setcwl-futurefwa #TAG [type]`",
            info: "Sets a clan as CWL or Future FWA in the database.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "autopost",
        label: "📣 autopost",
        description: "Toggle auto recruitment posting for a clan",
        detail: {
            title: "📣 autopost — Auto Recruitment Post",
            syntax: "`/autopost clan:Selection toggle:True/False`",
            info: "Toggles automatic recruitment posting on or off for a specific clan.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "postrecruitment",
        label: "📢 postrecruitment",
        description: "Manually post a recruitment ad for a clan",
        detail: {
            title: "📢 postrecruitment — Post Recruitment",
            syntax: "`/postrecruitment clan:Selection`",
            info: "Manually posts a recruitment advertisement for a specific clan.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "check_wars",
        label: "🗺️ check all wars",
        description: "Send war status reports to all clan channels",
        detail: {
            title: "🗺️ check all wars — War Reports",
            syntax: "`/check all wars`",
            info: "Manually distributes current war status reports to all clan mail channels.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "sync",
        label: "🔄 sync",
        description: "Sync roster data & verify FWA starters",
        detail: {
            title: "🔄 sync — Sync Roster",
            syntax: "`;sync`",
            info: "Automatically synchronizes roster data and verifies FWA starters.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "autorolerefresh",
        label: "♻️ autorolerefresh",
        description: "Refresh alliance roles & nickname for a user",
        detail: {
            title: "♻️ autorolerefresh — Refresh Roles",
            syntax: "`/autorolerefresh @user`",
            info: "Refreshes alliance roles and nickname for a user or yourself.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "setup_autorole",
        label: "⚙️ setup-autorole",
        description: "Enable/disable auto clan role assignment",
        detail: {
            title: "⚙️ setup-autorole — Auto Role",
            syntax: "`/setup-autorole clan:Selection toggle:True/False`",
            info: "Enables or disables automatic clan role assignment for a specific clan.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "nickall",
        label: "🏷️ nickall",
        description: "Mass-update all member nicknames",
        detail: {
            title: "🏷️ nickall — Mass Nickname Update",
            syntax: "`;nickall`",
            info: "Mass-updates nicknames for all server members to follow the alliance format.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "linkcheck",
        label: "🔎 linkcheck",
        description: "See linked vs unlinked members in the server",
        detail: {
            title: "🔎 linkcheck — Link Status",
            syntax: "`;linkcheck`  or  `;ls`",
            info: "Lists all members in the server and identifies who is linked vs unlinked.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "discord_links",
        label: "🔗 discord-links",
        description: "Compare clan roster vs Discord members",
        detail: {
            title: "🔗 discord-links — Roster vs Discord",
            syntax: "`/discord-links #TAG`\n`!discord-links #TAG`",
            info: "Compares a clan's in-game roster with server members to see who is on Discord.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "playercount",
        label: "🔢 playercount",
        description: "List users and how many accounts they have",
        detail: {
            title: "🔢 playercount — Account Counts",
            syntax: "`/playercount`",
            info: "Lists all users and the number of Clash of Clans accounts they have linked.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "reportsummary",
        label: "📊 reportsummary",
        description: "This week's alliance report up to today",
        detail: {
            title: "📊 reportsummary — Weekly Report",
            syntax: "`;reportsummary`",
            info: "Shows the alliance report from the start of the week up to today.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "delc",
        label: "🗂️ delc",
        description: "Delete a category and all its channels",
        detail: {
            title: "🗂️ delc — Delete Category",
            syntax: "`;delc CATEGORY_ID`",
            info: "Deletes a specific category and all channels contained within it.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "setup_tickets",
        label: "🎫 setup-tickets",
        description: "Send the ticket setup panel",
        detail: {
            title: "🎫 setup-tickets — Ticket Panel",
            syntax: "`/setup-tickets`",
            info: "Sends the ticket setup panel to the current channel.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "ticketadd",
        label: "➕ ticketadd",
        description: "Add a user to a ticket",
        detail: {
            title: "➕ ticketadd — Add to Ticket",
            syntax: "`/ticketadd user:@User`",
            info: "Adds a user or role to the current ticket channel.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "delete_ticket",
        label: "🗑️ delete-ticket",
        description: "Delete the current ticket channel",
        detail: {
            title: "🗑️ delete-ticket — Close Ticket",
            syntax: "`/delete-ticket`",
            info: "Deletes the existing ticket channel where the command is used.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "addclantoweb",
        label: "🌐 addclantoweb",
        description: "Sync a clan's data to the webpage",
        detail: {
            title: "🌐 addclantoweb — Add Clan to Web",
            syntax: "`/addclantoweb clantag:#TAG`",
            info: "Fetches full clan data and syncs it to the alliance webpage.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "removeclanweb",
        label: "❌ removeclanweb",
        description: "Remove a clan and its history from webpage",
        detail: {
            title: "❌ removeclanweb — Remove Clan from Web",
            syntax: "`/removeclanweb clantag:#TAG`",
            info: "Removes a clan and its history from the alliance webpage.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "lsweb",
        label: "📋 lsweb",
        description: "List all clans monitored on the webpage",
        detail: {
            title: "📋 lsweb — List Webpage Clans",
            syntax: "`/lsweb`",
            info: "Lists all clans currently being monitored on the webpage.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "refresh_web",
        label: "🔄 refresh",
        description: "Force a data refresh for all webpage clans",
        detail: {
            title: "🔄 refresh — Force Web Refresh",
            syntax: "`/refresh`",
            info: "Forces an immediate API refresh for all clans stored on the webpage.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "strikeadd_member",
        label: "⚠️ strikeadd (member)",
        description: "Add a weighted strike to a linked member",
        detail: {
            title: "⚠️ strikeadd — Strike a Member",
            syntax: "`/strikeadd reason:Reason weight:1-3 member:@User`",
            info: "Issues a strike to a linked Discord member. If the user has multiple accounts, a dropdown will appear to pick the correct one. The player receives a DM notification.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "strikeadd_tag",
        label: "⚠️ strikeadd (unlinked)",
        description: "Add a strike to an unlinked player by tag",
        detail: {
            title: "⚠️ strikeadd — Strike Unlinked Player",
            syntax: "`/strikeadd reason:Reason weight:1-3 tag:#PLAYERTAG`",
            info: "Issues a strike to a player not on Discord. An alert is automatically sent to **#clan-mail**, tagging the Clan Leader.",
            permission: "🛡️ Staff",
        },
    },
    {
        value: "strikeremove",
        label: "🟢 strikeremove",
        description: "Remove a set number of strikes from a player",
        detail: {
            title: "🟢 strikeremove — Remove Strikes",
            syntax: "`/strikeremove count:Number [member:@User] [tag:#PLAYERTAG]`",
            info: "Removes strikes by **count**. The bot subtracts exactly the specified number of points and cleans up old history entries. Use either `member` OR `tag`.",
            permission: "🛡️ Staff",
        },
    },
];

const TOTAL_EVERYONE = EVERYONE_COMMANDS.length;
const TOTAL_STAFF    = STAFF_COMMANDS.length;
const TOTAL_ALL      = TOTAL_EVERYONE + TOTAL_STAFF;

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
                .addOptions(grp.map(c => ({
                    label: c.label,
                    description: c.description,
                    value: c.value,
                })))
        );
    });
}

function createCmdInfoRows() { return buildMenuRows(EVERYONE_COMMANDS, "cmd_info"); }
function createStaffRows() { return buildMenuRows(STAFF_COMMANDS, "staff_cmd"); }
function createAdminRows() { const all = [...EVERYONE_COMMANDS, ...STAFF_COMMANDS]; return buildMenuRows(all, "admin_cmd"); }

function getCmdInfoPanel() {
    return new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle("🩸 Blood Alliance — Everyone Commands")
        .setDescription(`**TOTAL COMMANDS : ${TOTAL_EVERYONE}**\n\nUse the dropdown below to learn about any command.`)
        .setImage(`attachment://${BANNER_ATTACHMENT}`)
        .setFooter(footer())
        .setTimestamp();
}

function getStaffCmdPanel() {
    return new EmbedBuilder()
        .setColor("#2ecc71")
        .setTitle("🛡️ Blood Alliance — Staff Commands")
        .setDescription(`**TOTAL COMMANDS : ${TOTAL_STAFF}**\n\nUse the dropdowns below to learn about any command.`)
        .setImage(`attachment://${BANNER_ATTACHMENT}`)
        .setFooter(footer())
        .setTimestamp();
}

function getAdminCmdPanel() {
    return new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle("🛡️ Blood Alliance — Full Command Reference")
        .setDescription(
            `**TOTAL COMMANDS : ${TOTAL_ALL}**\n\n` +
            `👤 Everyone: **${TOTAL_EVERYONE}** · 🛡️ Staff: **${TOTAL_STAFF}**\n\n` +
            "Use the dropdowns below to learn about any command."
        )
        .setImage(`attachment://${BANNER_ATTACHMENT}`)
        .setFooter(footer())
        .setTimestamp();
}

function getDetailEmbed(cmdValue) {
    const all = [...EVERYONE_COMMANDS, ...STAFF_COMMANDS];
    const cmd = all.find(c => c.value === cmdValue);
    if (!cmd) {
        return new EmbedBuilder()
            .setColor("Red")
            .setDescription("❌ Unknown command selected. Please try again.");
    }
    const d = cmd.detail;
    return new EmbedBuilder()
        .setColor("#3498db")
        .setTitle(d.title)
        .addFields(
            { name: "📝 Syntax",      value: d.syntax,      inline: false },
            { name: "📖 Info",        value: d.info,        inline: false },
            { name: "🔑 Permission",  value: d.permission,  inline: false },
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
