
// Helper functions
function formatRole(role) {
  if (!role) return "None";
  switch (role.toLowerCase()) {
    case "leader": return "Leader";
    case "coleader": return "Co-Leader";
    case "admin": return "Elder";
    case "member": return "Member";
    default: return role;
  }
}

// Main export
module.exports = {
  name: "profile",
  description: "Show linked Clash of Clans accounts or fetch by tag",
  async execute(message, args, context) {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, emoji: emojiUtils, coc, data: dataManager } = context;

    // Emoji constants
    const cocwarEmoji = emojiUtils.getEmoji("cocfight");
    const arrowEmoji = emojiUtils.getEmoji("arrow");
    const throphyEmoji = emojiUtils.getEmoji("throphy");
    const leftEmoji = emojiUtils.getEmojiObject("larrow");
    const rightEmoji = emojiUtils.getEmojiObject("rarrow");
    const uparrowEmoji = emojiUtils.getEmoji("uparrow");
    const downarrowEmoji = emojiUtils.getEmoji("downarrow");
    const graphEmoji = emojiUtils.getEmoji("graph");
    const cgEmoji = emojiUtils.getEmoji("clangames");
    const capitalgoldEmoji = emojiUtils.getEmoji("capitalgold");
    const ccEmoji = emojiUtils.getEmoji("clancastle");
    const crownEmoji = emojiUtils.getEmoji("crown");
    const xpEmoji = emojiUtils.getEmoji("xp");
    const sheildEmoji = emojiUtils.getEmoji("sheild");
    const whitefwaEmoji = emojiUtils.getEmoji("whitefwa");
    const cocEmoji = emojiUtils.getEmoji("coc");

    let targetUser = null;
    let tagArg = null;
    await message.delete().catch(() => { });

    if (args.length === 0) {
      targetUser = message.author;
    } else if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
    } else if (args[0].startsWith("#")) {
      tagArg = args[0];
    } else {
      targetUser = message.author;
    }

    const userData = dataManager.getUserData();

    // Direct lookup by tag
    if (tagArg) {
      try {
        const data = await coc.getPlayer(tagArg);
        const thEmoji = emojiUtils.getEmoji(`th${data.townHallLevel}`) || emojiUtils.getEmoji("th11");
        const openInGame = `[Open in Game](https://link.clashofclans.com/en/?action=OpenPlayerProfile&tag=${encodeURIComponent(data.tag)})`;
        const fwaLink = `[Chocolate Clash](https://cc.fwafarm.com/cc_n/member.php?tag=${encodeURIComponent(data.tag)})`;

        // Town Hall image URLs (11–17)
        const thImages = {
          11: "https://images-ext-1.discordapp.net/external/s4kOlzYIsU1oiUcyMxsjlrilmed2yhcJo1GzmLr9NBc/https/assets.clashk.ing/home-base/town-hall-pics/town-hall-11.png?format=webp&quality=lossless&width=236&height=263",
          12: "https://images-ext-1.discordapp.net/external/PJBaOL8V_NLzuWrr3EQK54KO-l9iCVMm2AyDJcOvFps/https/assets.clashk.ing/home-base/town-hall-pics/town-hall-12.png?format=webp&quality=lossless&width=229&height=254",
          13: "https://images-ext-1.discordapp.net/external/cnrNFhgjVfVCCYxYCInKziyJs4xqfShmw1rvQKP0gpI/https/assets.clashk.ing/home-base/town-hall-pics/town-hall-13.png?format=webp&quality=lossless&width=255&height=263",
          14: "https://images-ext-1.discordapp.net/external/bekXanAALUUMv_M_tKV8TtRCh682CqWcxPMY4sHxeBE/https/assets.clashk.ing/home-base/town-hall-pics/town-hall-14.png?format=webp&quality=lossless&width=255&height=271",
          15: "https://images-ext-1.discordapp.net/external/7n_mhahmF5iXGgrv7Ps2itUZQIDva-WeUTO2cGydh7Y/https/assets.clashk.ing/home-base/town-hall-pics/town-hall-15.png?format=webp&quality=lossless&width=250&height=275",
          16: "https://images-ext-1.discordapp.net/external/3KA43gX30pOW3X8wugaS8eP5RswjPeNX07yqa12dh8s/https/assets.clashk.ing/home-base/town-hall-pics/town-hall-16.png?format=webp&quality=lossless&width=690&height=864",
          17: "https://images-ext-1.discordapp.net/external/MILVrSQyhUmOWrxNJKMtcXTKmZcv37Yp3US-OmQ1lqI/https/assets.clashk.ing/home-base/town-hall-pics/town-hall-17.png?format=webp&quality=lossless&width=1030&height=1030",
          18: "https://cdn.discordapp.com/emojis/1440691198024224920.png"
        };

        const defaultThumbnail = "https://static.wikia.nocookie.net/clashofclans/images/6/6d/Town_Hall1.png";
        const townHallLevel = data.townHallLevel;
        const thumbnailUrl = thImages[townHallLevel] || defaultThumbnail;

        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(`Clash of Clans - ${data.name}™`)
          .setThumbnail(thumbnailUrl)
          .setDescription(
            `**════ Profile Info ════**\n` +
            `**Tag:** \`${data.tag}\`\n` +
            `**Clan:** ${data.clan?.name || "None"} ${data.clan?.tag ? `(\`${data.clan.tag}\`)` : ""}\n` +
            `**Role:** ${formatRole(data.role)}\n` +
            `${thEmoji}:${data.townHallLevel}\t\t ${xpEmoji}:${data.expLevel}\t\t\n\n` +

            `**— Battles & Trophies —**\n` +
            `${throphyEmoji} **Trophies:** ${data.builderBaseTrophies || 0} / ${data.trophies || 0}\n` +
            `${cocwarEmoji} **Attack Wins:** ${data.attackWins || 0}\n` +
            `${sheildEmoji} **Defense Wins:** ${data.defenseWins || 0}\n` +
            `${cocEmoji} **War Stars:** ${data.warStars || 0}\n\n` +

            `**— Donations —**\n` +
            `${uparrowEmoji} **Donated:** ${data.donations}\n` +
            `${downarrowEmoji} **Received:** ${data.donationsReceived}\n` +
            `${graphEmoji} **Ratio:** ${(data.donations / (data.donationsReceived || 1)).toFixed(2)}\n\n` +

            `**— Key Achievements —**\n` +
            `${ccEmoji} **Total Donations:** ${data.achievements?.find(a => a.name === "Friend in Need")?.value || 0}\n` +
            `${throphyEmoji} **Best Trophies:** ${data.bestTrophies || 0}\n` +
            `${cgEmoji} **Clan Games:** ${data.achievements?.find(a => a.name === "Games Champion")?.value || 0}\n` +
            `${cocwarEmoji} **Capital Gold Raided:** ${data.achievements?.find(a => a.name === "Most Valuable Clanmate")?.value || 0}\n` +
            `${capitalgoldEmoji} **Capital Gold Donated:** ${data.achievements?.find(a => a.name === "Clan Capital Contributions")?.value || 0}\n\n` +

            `${arrowEmoji} ${openInGame}\n` +
            `${whitefwaEmoji} ${fwaLink}`
          )
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      } catch (err) {
        return message.channel.send(`❌ Could not fetch tag ${tagArg}: ${err.message}`);
      }
    }

    const userId = targetUser.id;
    if (!userData[userId] || userData[userId].length === 0) {
      return message.channel.send(
        `⚠️ ${targetUser.username} has not linked any Clash of Clans accounts yet.`
      );
    }

    const accounts = [];
    for (const account of userData[userId]) {
      try {
        const data = await coc.getPlayer(account.tag);
        const openInGame = `[Open in Game](https://link.clashofclans.com/en/?action=OpenPlayerProfile&tag=${encodeURIComponent(data.tag)})`;
        const thEmoji = emojiUtils.getEmoji(`th${data.townHallLevel}`) || emojiUtils.getEmoji("th11");

        accounts.push({
          name: `${thEmoji} ${data.name} • ${data.tag}`,
          value:
            `• **Clan:** ${data.clan?.name || "None"}\n` +
            `• **Role:** ${formatRole(data.role)}\n` +
            `• **Trophies:** ${throphyEmoji} ${data.trophies || 0}\n` +
            `• **Attack:** ${data.attackWins || 0} | **War Stars:** ${data.warStars || 0}\n` +
            `${arrowEmoji} ${openInGame}`,
          townHallLevel: data.townHallLevel,
        });
      } catch (err) {
        accounts.push({
          name: `❌ Account ${account.tag}`,
          value: `Error fetching data.`,
          townHallLevel: 0,
        });
      }
    }

    accounts.sort((a, b) => b.townHallLevel - a.townHallLevel);

    let page = 0;
    const perPage = 5;
    const totalPages = Math.ceil(accounts.length / perPage);

    const { ComponentType } = require("discord.js");

    const getEmbed = (pg) => {
      const start = pg * perPage;
      const currentAccounts = accounts.slice(start, start + perPage);

      return new EmbedBuilder()
        .setTitle(`Profile of ${targetUser.tag} (Page ${pg + 1}/${totalPages})`)
        .setColor(0x5865F2)
        .addFields(currentAccounts)
        .addFields([{ name: "👤 Linked Discord", value: `<@${targetUser.id}>` }])
        .setFooter({ text: "Use the buttons below to change pages." })
        .setTimestamp();
    };

    const getRow = (pg) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setEmoji(leftEmoji.id)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(totalPages <= 1),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setEmoji(rightEmoji.id)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(totalPages <= 1)
        );
    };

    const msg = await message.channel.send({ embeds: [getEmbed(page)], components: [getRow(page)] });

    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on("collect", async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({
                content: "❌ You don't have permission to use these buttons.",
                ephemeral: true
            });
        }

        if (interaction.customId === 'prev_page') {
          page = page > 0 ? page - 1 : totalPages - 1;
        } else if (interaction.customId === 'next_page') {
          page = (page + 1) % totalPages;
        }

        await interaction.update({ embeds: [getEmbed(page)], components: [getRow(page)] });
      } catch (err) {
        console.error("Collector error:", err.message);
      }
    });

    collector.on("end", async () => {
      try {
        await msg.edit({ components: [] }).catch(() => {});
      } catch (err) {
        // Ignore errors
      }
    });
  },
};
