const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');


function getRandomColor() {
    return Math.floor(Math.random() * 16777215);
}

module.exports = {
    name: "as",
    description: "Check Clash of Clans base and assign clan roles",
    async execute(message, args, context) {
        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, coc, data, config, emoji } = context;
        if (message.deletable) message.delete().catch(() => { });

        const member = message.member;
        const allowedRoles = [
  ...config.ADMIN_ROLE_IDS,
  ...config.STAFF_ROLE_IDS
];


        if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
            return message.channel.send("❌ You do not have permission to use this command.");
        }

        if (!args[0] && !message.mentions.users.first()) {
            return message.channel.send("❌ Please provide a tag or mention a user.");
        }

        let cleanTag, playerName;
        const mentionedUser = message.mentions.users.first();
        const targetUser = mentionedUser || message.author;
        const userdata = data.getUserData();
        const clanroles = data.getClanRoles();

        if (mentionedUser) {
            const linkedAccounts = userdata[mentionedUser.id];
            if (!linkedAccounts || linkedAccounts.length === 0) {
                return message.channel.send(`❌ ${mentionedUser} has no linked accounts.`);
            }

            if (linkedAccounts.length === 1) {
                cleanTag = linkedAccounts[0].tag.replace("#", "").toUpperCase();
                playerName = linkedAccounts[0].name;
            } else {
                const options = linkedAccounts.map(acc => ({
                    label: `${acc.name} (#${acc.tag.replace("#", "").toUpperCase()})`,
                    value: JSON.stringify({ tag: acc.tag.replace("#", "").toUpperCase(), name: acc.name })
                }));

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("select-tag")
                        .setPlaceholder("Choose a Clash account")
                        .addOptions(options)
                );

                const prompt = await message.channel.send({
                    content: `🔎 ${message.author}, please choose which account you want to check:`,
                    components: [row]
                });

                const collector = prompt.createMessageComponentCollector({
                    filter: i => i.user.id === message.author.id,
                    max: 1,
                    time: 30000
                });

                collector.on("collect", async interaction => {
                    const chosen = JSON.parse(interaction.values[0]);
                    cleanTag = chosen.tag;
                    playerName = chosen.name;
                    await interaction.deferUpdate();
                    prompt.delete().catch(() => { });
                    runCheck(cleanTag, playerName, targetUser, message, clanroles, context);
                });

                collector.on("end", collected => {
                    if (collected.size === 0) {
                        prompt.edit({ content: "❌ You didn't choose in time.", components: [] }).catch(() => { });
                    }
                });

                return;
            }
        } else {
            cleanTag = args[0].replace("#", "").toUpperCase();
            for (const userId in userdata) {
                const acc = userdata[userId].find(a => a.tag.replace("#", "").toUpperCase() === cleanTag);
                if (acc) {
                    playerName = acc.name;
                    break;
                }
            }
        }

        runCheck(cleanTag, playerName, targetUser, message, clanroles, context);
    }
};

async function runCheck(cleanTag, playerName, targetUser, message, clanroles, context) {
    const { EmbedBuilder, coc, config, emoji } = context;
    const tickId = emoji.getEmojiObject("gtick")?.id || "✅";
    const tickEmoji = emoji.getEmoji("gtick") || "✅";
    const cocEmoji = emoji.getEmoji("cocfight") || "⚔️";
    const GLOBAL_ROLE_ID = config.GLOBAL_ROLE_ID;
    const allowedRoles = config.ADMIN_ROLE_IDS;

    const cosLink = `https://www.clashofstats.com/players/${cleanTag}/summary`;
    const fwaLink = `https://cc.fwafarm.com/cc_n/member.php?tag=${encodeURIComponent(cleanTag)}`;
    const titleText = playerName ? `${playerName}  #${cleanTag}` : `Player #${cleanTag}`;

    const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(titleText)
        .setDescription(`${cocEmoji} Please confirm base is correct and check CC.`)
        .addFields(
            { name: "Clash of Stats", value: `[View Stats](${cosLink})`, inline: true },
            { name: "FWA Farm Link", value: `[View FWA](${fwaLink})`, inline: true },
            { name: "Actions", value: "⏳ Waiting for confirmation...", inline: false }
        )
        .setFooter({ text: `Please click Approve if you are sure.`, iconURL: message.author.displayAvatarURL() });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("approve_as")
            .setLabel("Approve")
            .setEmoji(tickId)
            .setStyle(ButtonStyle.Success)
    );

    const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

    const collector = sentMessage.createMessageComponentCollector({ time: 300000 });

    collector.on("collect", async (interaction) => {
        if (interaction.customId === "approve_as") {
            const verifier = interaction.user;
            try {
                const verifierMember = await message.guild.members.fetch(verifier.id);

                if (!allowedRoles.some(r => verifierMember.roles.cache.has(r))) {
                    return interaction.reply({ content: "❌ You don't have permission to approve this.", ephemeral: true });
                }

                await interaction.deferUpdate();

            let targetMember;
            try {
                targetMember = await message.guild.members.fetch(targetUser.id);
            } catch (err) {
                if (err.code === 10007) {
                    await message.channel.send("❌ Player is not in the server.");
                    return;
                }
                console.error("Member fetch error:", err);
                await message.channel.send("❌ Unexpected error while fetching the player.");
                return;
            }

            const botMember = await message.guild.members.fetchMe();
            if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
                const errorMsg = "❌ Cannot modify user: they have a higher or equal role than the bot.";
                await message.channel.send(errorMsg);

                const embedError = EmbedBuilder.from(embed)
                    .spliceFields(2, 1, { name: "Actions", value: errorMsg, inline: false })
                    .setColor(0xFF0000)
                    .setTimestamp();

                await sentMessage.edit({ embeds: [embedError], components: [] });
                return;
            }

            const playerData = await coc.getPlayer(`#${cleanTag}`);
            let results = [];
            let clanPrefix = "Nations";
            let assignedClan = null;

            const rolesBefore = targetMember.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.name).join(", ") || "None";

            // Remove Seeker, App, Re roles if present
            const appRoles = [config.SEEKER_ROLE_ID, config.APPROVE_ROLE_ID, config.REJECT_ROLE_ID].filter(Boolean);
            const userAppRoles = targetMember.roles.cache.filter(r => 
                appRoles.includes(r.id) && r.position < botMember.roles.highest.position
            );
            if (userAppRoles.size > 0) {
                const remNames = userAppRoles.map(r => r.name).join(", ");
                await targetMember.roles.remove(userAppRoles)
                    .then(() => results.push(`${tickEmoji} Removed roles: **${remNames}**`))
                    .catch(() => results.push(`⚠️ Could not remove: **${remNames}**`));
            }

            if (!playerData.clan) {
                results.push("⚠ Player is not in any clan.");
            } else {
                const clanTag = playerData.clan.tag;
                const clanInfo = clanroles[clanTag];
                if (clanInfo) {
                    if (clanInfo.nickName) clanPrefix = clanInfo.nickName;
                    const role = message.guild.roles.cache.get(clanInfo.roleId);
                    if (role) {
                        try {
                            await targetMember.roles.add(role);
                            results.push(`${tickEmoji} Added role: **${role.name}**`);
                            assignedClan = { name: playerData.clan.name, channelId: clanInfo.channelId };
                        } catch(err) {
                            results.push(`⚠️ Failed to add role: **${role.name}**`);
                        }
                    } else {
                        results.push("⚠️ Clan role not found.");
                    }
                } else {
                    results.push("⚠️ Clan is not registered.");
                }
            }

            if (targetMember.roles.cache.has(GLOBAL_ROLE_ID)) {
                await targetMember.roles.remove(GLOBAL_ROLE_ID)
                    .then(() => results.push(`${tickEmoji} Removed Global role.`))
                    .catch(() => results.push("⚠️ Could not remove Global role."));
            }

            await targetMember.setNickname(`${clanPrefix} | ${playerName || targetMember.user.username}`)
                .then(() => results.push(`${tickEmoji} Nickname updated.`))
                .catch(err => {
                    if (err.code === 50013) {
                        results.push("⚠️ Missing Permissions to change nickname.");
                    } else {
                        results.push(`⚠️ Could not change nickname: ${err.message}`);
                    }
                    console.error("Nickname error:", err);
                });

            results.push(`${tickEmoji} Verified by ${verifier.tag}`);

            if (assignedClan && assignedClan.channelId) {
                try {
                    const clanChannel = message.guild.channels.cache.get(assignedClan.channelId);
                    if (clanChannel) {
                        const welcomeEmbed = new EmbedBuilder()
                            .setColor(getRandomColor())
                            .setTitle(`Welcome to ${assignedClan.name}!`)
                            .setDescription(`Hey ${targetMember}, welcome to the clan! 🎉`)
                            .setFooter({ text: `Role Assigned by Rep - ${verifierMember.displayName}` })
                            .setTimestamp();

                        const rulesEmbed = new EmbedBuilder()
                            .setColor(getRandomColor())
                            .setAuthor({ name: `🌀 ${assignedClan.name} Clan Rules 🌀` })
                            .setDescription(
                                "**| 📝 GENERAL RULES**\n\n" +
                                "`Respect:` Treat every clanmate with dignity and maturity.\n" +
                                "`Communication:` Stay updated via Clan Mails and Pinned Messages..\n" +
                                "`Activity:` Consistent participation in Wars and Clan Capital is mandatory.\n\n" +
                                "**| ⚔️ WAR & EVENTS**\n\n" +
                                "`💎 FWA:` Do not leave the clan immediately after an FWA war ends.\n" +
                                "`⚔️ CWL:` Rotate to designated CWL clans for attacks, then return home to Storm.\n" +
                                "`🎮 CG:` No minimum score required, provided all Tier Rewards are unlocked.\n\n" +
                                "**| 🏰 CLAN CAPITAL**\n\n" +
                                "`Efficiency:` Use all available attacks every weekend.\n" +
                                "`Strategy:` You must finish your current district before starting a new one."
                            );

                        await clanChannel.send({
                            content: `${targetMember}`,
                            embeds: [welcomeEmbed, rulesEmbed]
                        });
                        results.push(`${tickEmoji} Sent welcome message in <#${assignedClan.channelId}>`);
                    } else {
                        results.push("⚠️ Could not find clan channel to send welcome.");
                    }
                } catch (err) {
                    console.error("Welcome message error:", err);
                    results.push("⚠️ Failed to send welcome message.");
                }
            }

            const rolesAfter = targetMember.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.name).join(", ") || "None";

            const updatedEmbed = EmbedBuilder.from(embed)
                .spliceFields(2, 1, { name: "Actions", value: results.join("\n"), inline: false })
                .addFields(
                    { name: "Roles Before Updation", value: rolesBefore, inline: false },
                    { name: "Roles After Updation", value: rolesAfter, inline: false }
                )
                .setColor(getRandomColor())
                .setTimestamp();

            await sentMessage.edit({ embeds: [updatedEmbed], components: [] });
                collector.stop("approved");
            } catch (err) {
                console.error(err);
            }
        } // end if approve_as
    });

    collector.on("end", (collected, reason) => {
        if (reason !== "approved") {
            const expiredEmbed = EmbedBuilder.from(embed)
                .spliceFields(2, 1, { name: "Actions", value: "⌛ Timed out without confirmation.", inline: false })
                .setColor(getRandomColor())
                .setTimestamp();
            sentMessage.edit({ embeds: [expiredEmbed], components: [] }).catch(() => { });
        }
    });
}