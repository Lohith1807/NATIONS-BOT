const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const fs = require("fs");
const path = require("path");

function getCwlClans() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, "../../../data/cwlfuture.json"), "utf8");
        const data = JSON.parse(raw);
        let cwl = {};
        for(let tag in data) {
            if(data[tag].type === 'cwl') cwl[tag] = data[tag];
        }
        return cwl;
    } catch (e) {
        return {};
    }
}

function getFutureFwa() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, "../../../data/cwlfuture.json"), "utf8");
        const data = JSON.parse(raw);
        let ffwa = {};
        for(let tag in data) {
            if(data[tag].type === 'futurefwa') ffwa[tag] = data[tag];
        }
        return ffwa;
    } catch (e) {
        return {};
    }
}

function calculateEmbedSize(embed) {
  let size = 0;
  if (embed.data.title) size += embed.data.title.length;
  if (embed.data.description) size += embed.data.description.length;
  if (embed.data.footer?.text) size += embed.data.footer.text.length;
  if (embed.data.author?.name) size += embed.data.author.name.length;
  if (embed.data.fields) {
    for (const field of embed.data.fields) {
      size += field.name.length + field.value.length;
    }
  }
  return size;
}

async function buildClanEmbed(clanTag, data, clanData, { EmbedBuilder, emoji }) {
  if (!clanData) return null;

  const stored = data[clanTag] || { leaders: [], coLeaders: [] };
  const tagNoHash = clanTag.replace("#", "");
  const tagWithHash = encodeURIComponent("#" + tagNoHash);

  const diamondEmoji = emoji.getEmoji("whitefwa");
  const leaderEmoji = emoji.getEmoji("fwalead");
  const th18Emoji = emoji.getEmoji("th18");
  const th17Emoji = emoji.getEmoji("th17");
  const th16Emoji = emoji.getEmoji("th16");
  const th15Emoji = emoji.getEmoji("th15");
  const th14Emoji = emoji.getEmoji("th14");
  const capitalEmoji = emoji.getEmoji("ccw");
  const castleEmoji = emoji.getEmoji("clancastle");
  const leagueEmoji = emoji.getEmoji("cwl");
  const arrowEmoji = emoji.getEmoji("arrow");
  const clashEmoji = emoji.getEmoji("coc");
  const crownEmoji = emoji.getEmoji("crown");

  var description =
    diamondEmoji + " **FWA** " + diamondEmoji + "\n" +
    leaderEmoji + " **Accepting:** " + th18Emoji + " " + th17Emoji + " " + th16Emoji + " " + th15Emoji + " " + th14Emoji + "\n" +
    capitalEmoji + " **Clan Capital:** " + (clanData.clanCapital ? clanData.clanCapital.capitalHallLevel : "?") + "\n" +
    castleEmoji + " **Clan Level:** " + clanData.clanLevel + "\n" +
    leagueEmoji + " **CWL:** Lazy Cwl\n\n" +
    arrowEmoji + " **Open in Game:** [Click Here](https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + tagNoHash + ")\n" +
    clashEmoji + " **Clash of Stats:** [Click Here](https://www.clashofstats.com/clans/" + tagNoHash + ")\n" +
    arrowEmoji + " **CC Link:** [Click Here](https://cc.fwafarm.com/cc_n/clan.php?tag=" + tagWithHash + ")\n\n" +
    crownEmoji + " **Leaders**:\n" + ((stored.leaders && stored.leaders.length > 0) ? stored.leaders.join("\n") : "None") + "\n" +
    crownEmoji + " **Co-Leaders**:\n" + ((stored.coLeaders && stored.coLeaders.length > 0) ? stored.coLeaders.join("\n") : "None") + "\n\n";

  if (description.length > 4096) {
    description = description.slice(0, 4093) + "...";
  }

  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(clanData.name + " (" + clanTag + ")")
    .setThumbnail(clanData.badgeUrls ? clanData.badgeUrls.large : null)
    .setDescription(description);
}

async function buildWarClanEmbed(clanTag, context) {
  var coc = context.coc;
  var EmbedBuilder = context.EmbedBuilder;
  var getEmoji = context.emoji.getEmoji;

  var clan = await coc.getClan(clanTag);

  var totalWars = clan.warWins + (clan.warLosses || 0);
  var winRatio = totalWars > 0 ? (clan.warWins / totalWars).toFixed(2) : "0.00";
  var link = "https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + clan.tag.replace("#", "");
  var locationStr = clan.location && clan.location.name ? "🌐 " + clan.location.name : "N/A";
  var leaderMember = clan.memberList.find(function (m) { return m.role === "leader"; });
  var leaderName = leaderMember ? leaderMember.name : "Unknown";

  var embed = new EmbedBuilder()
    .setTitle(clan.name)
    .setThumbnail(clan.badgeUrls ? clan.badgeUrls.medium : null)
    .setColor(Math.floor(Math.random() * 0xffffff))
    .setDescription(
      "Tag: [" + clan.tag + "](" + link + ")\n" +
      "Trophies: " + getEmoji("throphy") + " " + clan.clanPoints + " | " + getEmoji("clancastle") + " " + (clan.clanCapitalPoints || 0) + "\n" +
      "Required Trophies: " + getEmoji("throphy") + " " + clan.requiredTrophies + "\n" +
      "Location: " + locationStr + "\n\n" +
      "Leader: " + leaderName + "\n" +
      "Level: " + clan.clanLevel + "\n" +
      "Members: " + getEmoji("mem") + " " + clan.members + "/50\n\n" +
      "CWL: " + (clan.warLeague ? clan.warLeague.name : "N/A") + "\n" +
      "Wars Won: " + getEmoji("uparrow") + " " + clan.warWins + "\n" +
      "Wars Lost: " + getEmoji("downarrow") + " " + (clan.warLosses || 0) + "\n" +
      "War Streak: " + getEmoji("graph") + " " + clan.warWinStreak + "\n" +
      "Win Ratio: " + getEmoji("graph") + " " + winRatio + "\n\n" +
      "Description: " + (clan.description || "No description provided.")
    )
    .setTimestamp();

  return embed;
}

async function buildCwlClanEmbed(clanTag, cwlData, clanData, { EmbedBuilder, emoji }) {
  if (!clanData) return null;

  const stored = cwlData[clanTag] || {}; 
  const style = stored.style || "lazy";

  const tagNoHash = clanTag.replace("#", "");

  const leagueEmoji = emoji.getEmoji("cwl") || "🏆";
  const castleEmoji = emoji.getEmoji("clancastle") || "🏰";
  const arrowEmoji = emoji.getEmoji("arrow") || "➡️";
  const clashEmoji = emoji.getEmoji("coc") || "⚔️";
  const memEmoji = emoji.getEmoji("mem") || "👥";

  var description =
    leagueEmoji + " **" + (style.charAt(0).toUpperCase() + style.slice(1)) + " CWL** " + leagueEmoji + "\n" +
    castleEmoji + " **Clan Level:** " + clanData.clanLevel + "\n" +
    memEmoji + " **Members:** " + clanData.members + "/50\n" +
    leagueEmoji + " **League:** " + (clanData.warLeague ? clanData.warLeague.name : "Unranked") + "\n\n" +
    arrowEmoji + " **Open in Game:** [Click Here](https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + tagNoHash + ")\n" +
    clashEmoji + " **Clash of Stats:** [Click Here](https://www.clashofstats.com/clans/" + tagNoHash + ")\n";

  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(clanData.name + " (" + clanTag + ")")
    .setThumbnail(clanData.badgeUrls ? clanData.badgeUrls.large : null)
    .setDescription(description)
    .setTimestamp();
}

async function buildAvailabilityEmbed(tags, title, context) {
  var coc = context.coc;
  var EmbedBuilder = context.EmbedBuilder;

  var text = "";
  for(let tag of tags) {
    try {
      var clan = await coc.getClan(tag);
      if(clan.members < 50) {
        text += "**" + clan.name + "** (`" + clan.tag + "`) - **" + (50 - clan.members) + "** spots left\n";
      }
    } catch(err) {}
  }
  
  if(!text) text = "No clans have available spots right now.";

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(text)
    .setColor(0x3498DB);
}

module.exports = {
  name: "clan",
  buildClanEmbed,
  buildWarClanEmbed,
  buildCwlClanEmbed,
  buildAvailabilityEmbed,
  async execute(message, args, context) {
    const { coc, data: dataManager, emoji: emojiUtils, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = context;
    var getEmoji = emojiUtils.getEmoji;
    var getEmojiObject = emojiUtils.getEmojiObject;

    if (message.deletable) message.delete().catch(function () { });

    // ;clan @user
    if (message.mentions.users.size > 0) {
      const userId = message.mentions.users.first().id;
      const data = dataManager.getClanRoles();
      const entries = Object.entries(data).filter(function ([clanTag, info]) {
        return (info.leaders && info.leaders.includes("<@" + userId + ">")) ||
          (info.coLeaders && info.coLeaders.includes("<@" + userId + ">"));
      });

      if (entries.length === 0) return message.channel.send("That user is not linked to any clan.");

      for (const [clanTag, clanConfig] of entries) {
        // War clan → show war detail view
        if (clanConfig && clanConfig.clanType === "war") {
          await showWarClanDetail(message, clanTag, context);
          continue;
        }

        // FWA clan → show FWA embed
        try {
          const clanData = await coc.getClan(clanTag);
          const embed = await buildClanEmbed(clanTag, data, clanData, context);
          if (embed) await message.channel.send({ embeds: [embed] });
        } catch (err) {
          console.error("Error fetching clan info for @user:", err);
        }
      }
      return;
    }

    // ;clan <nickname or #tag>
    if (args[0]) {
      const arg = args[0].toUpperCase();
      let clanTag = null;
      const clanRoles = dataManager.getClanRoles();

      // Check if nickname exists in clanrole.json
      for (const [tag, info] of Object.entries(clanRoles)) {
        if (info.nickName && info.nickName.toUpperCase() === arg) {
          clanTag = tag;
          break;
        }
      }

      // If not found by nickname, check if it's a clan tag
      if (!clanTag) {
        clanTag = arg.startsWith("#") ? arg : "#" + arg;
      }

      var clanConfig2 = clanRoles[clanTag];

      // War clan → show war detail view
      if (clanConfig2 && clanConfig2.clanType === "war") {
        return showWarClanDetail(message, clanTag, context);
      }

      // FWA clan → show FWA embed
      try {
        const clanData = await coc.getClan(clanTag);
        const data = dataManager.getClanRoles();
        const embed = await buildClanEmbed(clanTag, data, clanData, context);
        if (!embed) return message.channel.send("Could not generate clan info.");
        return message.channel.send({ embeds: [embed] });
      } catch (err) {
        if (err.response) {
          const status = err.response.status;
          if (status === 404) {
            // If it started with #, it's a tag lookup
            if (arg.startsWith("#")) {
              return message.channel.send("❌ Clan tag not found, re-check once.");
            }

            // Otherwise, it was a nickname lookup. Show available nicknames.
            const clanRoles = dataManager.getClanRoles();
            const tags = Object.keys(clanRoles);
            
            // Fetch names in parallel to show "Clan Name - Nickname"
            const clansData = await Promise.all(tags.map(t => coc.getClan(t).catch(() => ({ name: "Unknown" }))));
            let nickList = [];
            for (let i = 0; i < tags.length; i++) {
              const info = clanRoles[tags[i]];
              if (info.nickName) nickList.push(`**${clansData[i].name}** - \`${info.nickName}\``);
            }

            const helpEmbed = new EmbedBuilder()
              .setTitle("❌ Nickname Not Found")
              .setDescription(`The nickname \`${arg}\` is not recognized.\n\n**Available Nicknames:**\n${nickList.join("\n") || "No nicknames found."}`)
              .setColor(0xFF0000)
              .setFooter({ text: "Tip: Use the nicknames above or a full clan tag (#TAG)" });

            return message.channel.send({ embeds: [helpEmbed] });
          }
          if (status === 503) return message.channel.send("❌ API is in maintenance.");
          if (status === 403) return message.channel.send("❌ Can't access API, contact server admins.");
        }
        return message.channel.send("❌ Error fetching clan info from COC API. Re-check once.");
      }
    }

    if (args.length > 0) {
      return message.channel.send(`⚠️ **Incorrect Format!** Use \`;clan ${args[0]}\` to view a specific clan, or just \`;clans\` for the dashboard.`);
    }

    var loadingMsg = await message.channel.send("⏳ Fetching clan data...");

    const clanRoles = dataManager.getClanRoles();
    const fwaTags = [];
    const warTags = [];
    for (const cTag in clanRoles) {
      if (clanRoles[cTag].clanType === "war") warTags.push(cTag);
      else fwaTags.push(cTag);
    }

    let description = "";
    const selectOptions = [];

    description += getEmoji("cocfight") + " A powerful family of united clans built for wars, farming, CWL, and nonstop growth. From casual players to hardcore warriors — we have a home for everyone.\n\n";

    // FWA CLANS
    if (fwaTags.length > 0) {
      description += getEmoji("arrow") + " " + getEmoji("whitefwa") + " **FWA** " + getEmoji("whitefwa") + " - **" + fwaTags.length + "**\n";
      for (let i = 0; i < fwaTags.length; i++) {
        try {
          const clan = await coc.getClan(fwaTags[i]);
          description += (i + 1) + ". **" + clan.name + "** `" + clan.tag + "`\n";
          selectOptions.push({ label: clan.name, description: "FWA | " + clan.tag, value: "fwa_" + clan.tag.replace("#", ""), emoji: getEmojiObject("whitefwa") });
        } catch (e) {
          description += (i + 1) + ". ❌ " + fwaTags[i] + " - Error\n";
        }
      }
    }

    // WAR CLANS
    if (warTags.length > 0) {
      description += "\n" + getEmoji("cocfight") + " **War Clans — " + warTags.length + "**\n";
      for (let j = 0; j < warTags.length; j++) {
        try {
          const wClan = await coc.getClan(warTags[j]);
          description += (j + 1) + ". **" + wClan.name + "** `" + wClan.tag + "`\n";
          selectOptions.push({ label: wClan.name, description: "War | " + wClan.tag, value: "war_" + wClan.tag.replace("#", ""), emoji: getEmojiObject("cocfight") });
        } catch (e) {
          description += (j + 1) + ". ❌ " + warTags[j] + " - Error\n";
        }
      }
    }

    if (description.length > 4000) description = description.substring(0, 4000) + "...";

    const bannerPath = "./assets/images/nations_storm_footer.png";
    const files = [];
    if (fs.existsSync(bannerPath)) files.push(new AttachmentBuilder(bannerPath, { name: "nations_storm_footer.png" }));

    const embed = new EmbedBuilder()
      .setTitle(getEmoji("coc") + " The Nations - Family Clans " + getEmoji("coc"))
      .setColor(Math.floor(Math.random() * 0xffffff))
      .setDescription(description)
      .setTimestamp();

    if (files.length > 0) embed.setImage("attachment://nations_storm_footer.png");

    if (selectOptions.length > 0) {
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("clans_dashboard_select")
          .setPlaceholder("Select a clan to view details...")
          .addOptions(selectOptions)
      );

      const buttonRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("clans_info_fwa").setLabel("What is FWA?").setStyle(ButtonStyle.Primary).setEmoji(getEmojiObject("question") || "ℹ️"),
        new ButtonBuilder().setCustomId("clans_info_cwl").setLabel("CWL Conduct").setStyle(ButtonStyle.Primary).setEmoji(getEmojiObject("cwl") || "🏆")
      );

      const buttonRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("clans_info_stats").setLabel("Clan Statistics").setStyle(ButtonStyle.Success).setEmoji(getEmojiObject("graph") || "📊")
      );

      await loadingMsg.edit({ content: null, embeds: [embed], components: [row, buttonRow1, buttonRow2], files });
    } else {
      await loadingMsg.edit({ content: null, embeds: [embed], files });
    }
  },
};

// War clan detail view with dropdown + refresh button
async function showWarClanDetail(message, clanTag, context) {
  var coc = context.coc;
  var EmbedBuilder = context.EmbedBuilder;
  var ActionRowBuilder = context.ActionRowBuilder;
  var StringSelectMenuBuilder = context.StringSelectMenuBuilder;
  var ButtonBuilder = context.ButtonBuilder;
  var ButtonStyle = context.ButtonStyle;
  var getEmoji = context.emoji.getEmoji;
  var getEmojiObject = context.emoji.getEmojiObject;

  try {
    var clan = await coc.getClan(clanTag);

    var totalWars = clan.warWins + (clan.warLosses || 0);
    var winRatio = totalWars > 0 ? (clan.warWins / totalWars).toFixed(2) : "0.00";
    var link = "https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + clan.tag.replace("#", "");
    var locationStr = clan.location && clan.location.name ? "🌐 " + clan.location.name : "N/A";
    var leaderMember = clan.memberList.find(function (m) { return m.role === "leader"; });
    var leaderName = leaderMember ? leaderMember.name : "Unknown";

    var embed = new EmbedBuilder()
      .setTitle(clan.name)
      .setThumbnail(clan.badgeUrls ? clan.badgeUrls.medium : null)
      .setColor(Math.floor(Math.random() * 0xffffff))
      .setDescription(
        "Tag: [" + clan.tag + "](" + link + ")\n" +
        "Trophies: " + getEmoji("throphy") + " " + clan.clanPoints + " | " + getEmoji("clancastle") + " " + (clan.clanCapitalPoints || 0) + "\n" +
        "Required Trophies: " + getEmoji("throphy") + " " + clan.requiredTrophies + "\n" +
        "Location: " + locationStr + "\n\n" +
        "Leader: " + leaderName + "\n" +
        "Level: " + clan.clanLevel + "\n" +
        "Members: " + getEmoji("mem") + " " + clan.members + "/50\n\n" +
        "CWL: " + (clan.warLeague ? clan.warLeague.name : "N/A") + "\n" +
        "Wars Won: " + getEmoji("uparrow") + " " + clan.warWins + "\n" +
        "Wars Lost: " + getEmoji("downarrow") + " " + (clan.warLosses || 0) + "\n" +
        "War Streak: " + getEmoji("graph") + " " + clan.warWinStreak + "\n" +
        "Win Ratio: " + getEmoji("graph") + " " + winRatio + "\n\n" +
        "Description: " + (clan.description || "No description provided.")
      )
      .setTimestamp();

    // Dropdown Menu
    var selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("wclans_select_" + clan.tag.replace("#", ""))
        .setPlaceholder("Select to see more details...")
        .addOptions([
          { label: "Player Tags & Roles", description: "View player tags and clan roles", value: "tags_roles", emoji: getEmojiObject("mem") },
          { label: "Trophies & League", description: "View current trophies and leagues", value: "trophies_league", emoji: getEmojiObject("throphy") },
          { label: "Last Joining Date", description: "View when members joined the clan", value: "joining", emoji: getEmojiObject("alaram") },
          { label: "Player Progress", description: "View player levels and progress", value: "progress", emoji: getEmojiObject("graph") },
          { label: "Attacks & Defenses", description: "View combat statistics", value: "attacks_defenses", emoji: getEmojiObject("cocfight") },
          { label: "War History", description: "View recent clan war logs", value: "warlog", emoji: getEmojiObject("cwl") }
        ])
    );

    // Refresh button with null-safe emoji
    var refreshEmoji = getEmojiObject("refresh");
    var btn = new ButtonBuilder()
      .setCustomId("wclans_refresh_" + clan.tag.replace("#", ""))
      .setLabel("Refresh Data")
      .setStyle(ButtonStyle.Secondary);

    if (refreshEmoji) {
      btn.setEmoji(refreshEmoji);
    } else {
      btn.setEmoji("🔄");
    }

    var buttonRow = new ActionRowBuilder().addComponents(btn);

    await message.channel.send({ embeds: [embed], components: [selectRow, buttonRow] });
  } catch (err) {
    console.error(err);
    if (err.response) {
      if (err.response.status === 404) return message.channel.send("❌ Clan tag not found, re-check once.");
      if (err.response.status === 503) return message.channel.send("❌ API is in maintenance.");
      if (err.response.status === 403) return message.channel.send("❌ Can't access API, contact server admins.");
    }
    message.channel.send("❌ Error fetching detailed clan data. Re-check once.");
  }
}
