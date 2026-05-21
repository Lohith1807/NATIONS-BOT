// handler.js
const ticketHandler = require("./tickets/ticketHandler");
const fs = require("fs");
const path = require("path");



async function handleInteraction(interaction, context) {
    // Check if it's a ticket interaction first
    const handled = await ticketHandler(interaction, context);
    if (handled) return;

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, data: dataManager, coc, config, emoji } = context;
    const { getEmoji, getEmojiObject } = emoji;

    // BUTTONS
    if (interaction.isButton()) {
        const id = interaction.customId;


        // WAR CLANS REFRESH BUTTON
        if (id.startsWith("wclans_refresh_")) {
            if (interaction.replied || interaction.deferred) return;
            const clanTag = "#" + id.replace("wclans_refresh_", "");

            try { await interaction.deferUpdate(); } catch(e) { return; }

            try {
                const clan = await coc.getClan(clanTag);
                const totalWars = clan.warWins + (clan.warLosses || 0);
                const winRatio = totalWars > 0 ? (clan.warWins / totalWars).toFixed(2) : "0.00";
                const link = "https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + clan.tag.replace("#", "");

                const locationStr = clan.location && clan.location.name ? "🌐 " + clan.location.name : "N/A";

                const embed = new EmbedBuilder()
                    .setTitle(clan.name)
                    .setThumbnail(clan.badgeUrls.medium)
                    .setColor(Math.floor(Math.random() * 0xffffff))
                    .setDescription(
                        "Tag: [" + clan.tag + "](" + link + ")\n" +
                        "Trophies: " + getEmoji("throphy") + " " + clan.clanPoints + " | " + getEmoji("clancastle") + " " + (clan.clanCapitalPoints || 0) + "\n" +
                        "Required Trophies: " + getEmoji("throphy") + " " + clan.requiredTrophies + "\n" +
                        "Location: " + locationStr + "\n\n" +
                        "Leader: " + (clan.memberList.find(function(m) { return m.role === "leader"; }) || {}).name || "Unknown" + "\n" +
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

                const selectRow = buildClanSelectRow(clan, getEmojiObject, StringSelectMenuBuilder, ActionRowBuilder);
                const buttonRow = buildRefreshButton(clan, getEmojiObject, ButtonBuilder, ButtonStyle, ActionRowBuilder);

                await interaction.editReply({ embeds: [embed], components: [selectRow, buttonRow] });
            } catch (err) {
                console.error(err);
                await interaction.followUp({ content: "❌ Error refreshing clan data.", ephemeral: true }).catch(function() {});
            }
            return;
        }

        // PLAYER ACCOUNTS REFRESH BUTTON
        if (id.startsWith("refresh_accounts:")) {
            const targetId = id.split(":")[1];
            try { await interaction.deferUpdate(); } catch(e) { return; }
            try {
                const targetUser = await interaction.client.users.fetch(targetId);
                const playeraccountsFile = require("../commands/coc/profile/playeraccounts.js");
                const accounts = dataManager.getUserData()[targetId] || [];
                
                if (accounts.length === 0) {
                    return await interaction.followUp({ content: "❌ This user has no linked accounts.", ephemeral: true });
                }
                
                const embed = await playeraccountsFile.buildAccountEmbed(targetUser, accounts, coc, emoji);
                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                console.error(err);
                await interaction.followUp({ content: "❌ Error refreshing accounts.", ephemeral: true }).catch(() => {});
            }
            return;
        }

        // CLANS INFO: WHAT IS FWA?
        if (id === "clans_info_fwa") {
            const fwaEmbed = new EmbedBuilder()
                .setTitle(getEmoji("question") + " What is FWA?")
                .setColor(0x3498DB)
                .setDescription(
                    "The **Farming War Alliance (FWA)** is a group of over 600+ clans that participate in 'lazy wars' to maximize loot and XP with minimal effort.\n\n" +
                    getEmoji("whitefwa") + " **How it works:** All clans use a standardized 'easy-to-three-star' base design. Winners are determined based on a match system, ensuring everyone gets high loot and clan XP without using expensive armies or heroes.\n\n" +
                    "✅ **Benefits:** Fast progression, easy loot, and hero upgrades are always available since you don't need them for war!"
                )
                .setTimestamp();
            return interaction.reply({ embeds: [fwaEmbed], ephemeral: true });
        }

        // CLANS INFO: CWL CONDUCT
        if (id === "clans_info_cwl") {
            const cwlEmbed = new EmbedBuilder()
                .setTitle(getEmoji("cwl") + " How we conduct CWL")
                .setColor(0xF1C40F)
                .setDescription(
                    "**Nations CWL Approach:**\n\n" +
                    "🔹 **FWA Clans:** We conduct **Lazy CWL**. This means we don't worry about winning; we just focus on getting the 8-star minimum for max medals. No stress, just rewards!\n\n" +
                    "🔹 **War Clans:** We conduct **Serious CWL**. These clans push for promotion and require full hero availability and strategic attacks.\n\n" +
                    "🎫 Check your clan's specific pins for sign-up details!"
                )
                .setTimestamp();
            return interaction.reply({ embeds: [cwlEmbed], ephemeral: true });
        }

        // CLANS INFO: CLAN STATISTICS
        if (id === "clans_info_stats") {
            try {
                await interaction.deferReply({ ephemeral: true });
                const clanRoles = dataManager.getClanRoles();
                
                let statsEmbed = new EmbedBuilder()
                    .setTitle(getEmoji("graph") + " Nations Statistics")
                    .setColor(0x2ECC71)
                    .setTimestamp();

                let statsDesc = "";
                const clanTags = Object.keys(clanRoles);
                
                // Fetch all clan data in parallel
                const clansData = await Promise.all(
                    clanTags.map(async (tag) => {
                        try {
                            const clan = await coc.getClan(tag);
                            const warLog = await coc.getWarLog(tag).catch(() => ({ items: [] }));
                            const currentWar = await coc.getCurrentWar(tag).catch(() => ({ state: "notInWar" }));
                            return { clan, warLog, currentWar, tag };
                        } catch (e) {
                            return null;
                        }
                    })
                );

                clansData.forEach((dataObj) => {
                    if (!dataObj) return;
                    const { clan, warLog, currentWar, tag } = dataObj;
                    const roleInfo = clanRoles[tag];
                    const clanType = roleInfo.clanType || "fwa";
                    
                    // 1. Donations Logic
                    const totalDonations = clan.memberList.reduce((s, m) => s + m.donations, 0);
                    const isDonationActive = totalDonations > 5000;
                    const donationStatus = isDonationActive ? getEmoji("gtick") : getEmoji("bluex");

                    // 2. War Logic
                    // Check recent wars in log (last 7 days)
                    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                    const recentWars = (warLog.items || []).filter(w => {
                        // Handle CoC weird timestamp format if necessary
                        const endTime = w.endTime.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6");
                        return new Date(endTime).getTime() > sevenDaysAgo;
                    }).length;

                    // If currently in war OR has recent wars in log
                    const isWarActive = (currentWar && currentWar.state !== "notInWar") || recentWars >= 1;
                    const warStatus = isWarActive ? getEmoji("gtick") : getEmoji("bluex");

                    // 3. People Logic
                    const activeMembers = clan.memberList.filter(m => m.donations > 0 || m.donationsReceived > 0).length;
                    const inactiveMembers = clan.members - activeMembers;

                    // 4. Spots Logic
                    let spotStatus = "";
                    if (clan.members >= 50) {
                        spotStatus = "🔴 **FULL**";
                    } else if (clan.members >= 48) {
                        spotStatus = "🟡 **LIMITED**";
                    } else {
                        spotStatus = "🟢 **OPEN**";
                    }

                    statsDesc += `${clanType === 'fwa' ? getEmoji("whitefwa") : getEmoji("cocfight")} **${clan.name}** — ${spotStatus}\n` +
                                 `${donationStatus} **Donations:** ${totalDonations.toLocaleString()}\n` +
                                 `${warStatus} **Wars:** ${isWarActive ? "Active" : "Inactive"}\n` +
                                 `${getEmoji("mem")} **People:** ${activeMembers} Active | ${inactiveMembers} Inactive\n\n`;
                });

                if (statsDesc.length > 4096) {
                    statsDesc = statsDesc.substring(0, 4093) + "...";
                }
                
                statsEmbed.setDescription(statsDesc || "No data available.");
                await interaction.editReply({ embeds: [statsEmbed] });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "❌ Error fetching alliance statistics." });
            }
            return;
        }

        // CLAN AVAILABILITY BUTTON
        if (id.startsWith("clan_availability_")) {
            if (interaction.replied || interaction.deferred) return;
            const clanTag = "#" + id.replace("clan_availability_", "");

            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }

            try {
                const clan = await coc.getClan(clanTag);
                const members = clan.members;
                const maxMembers = 50;
                const spotsLeft = maxMembers - members;

                let responseEmbed = new EmbedBuilder().setTimestamp();

                const clanRoles = dataManager.getClanRoles();
                const roleInfo = clanRoles[clanTag] || {};
                const isFwa = roleInfo.clanType === "fwa";

                if (spotsLeft > 0) {
                    let clanDescription = 
                        getEmoji("mem") + " **Members:** " + members + "/" + maxMembers + "\n" +
                        getEmoji("gtick") + " **Availability:** " + spotsLeft + " Spot" + (spotsLeft > 1 ? "s" : "") + " Left\n\n";
                    
                    if (isFwa) {
                        clanDescription += 
                            getEmoji("whitefwa") + " **Fwa Clan**\n" +
                            getEmoji("cwl") + " **Lazy cwl**\n";
                    } else {
                        clanDescription += 
                            getEmoji("cocfight") + " **War Clan**\n" +
                            getEmoji("cwl") + " **Serious cwl**\n";
                    }

                    clanDescription += getEmoji("alaram") + " **Very Active**";

                    responseEmbed.setTitle(getEmoji("sheild") + " " + clan.name)
                        .setColor(0x2ECC71) // Green
                        .setDescription(clanDescription);
                } else {
                    responseEmbed.setTitle(getEmoji("sheild") + " " + clan.name)
                        .setColor(0xE74C3C) // Red
                        .setDescription(
                            getEmoji("mem") + " **Members:** " + members + "/" + maxMembers + "\n" +
                            getEmoji("bluex") + " **Clan Full**\n\n" +
                            "**Try:**"
                        );

                    // Find other clans with space
                    const clanRoles = dataManager.getClanRoles();
                    const otherTags = Object.keys(clanRoles).filter(tag => tag !== clanTag);
                    
                    const otherClansData = await Promise.all(
                        otherTags.map(tag => coc.getClan(tag).catch(() => null))
                    );

                    const availableClans = otherClansData.filter(c => c && c.members < 50);

                    if (availableClans.length > 0) {
                        let suggestions = "";
                        availableClans.forEach(c => {
                            const left = 50 - c.members;
                            suggestions += getEmoji("arrow") + " **" + c.name + "** (" + left + " spot" + (left > 1 ? "s" : "") + ")\n";
                        });
                        responseEmbed.addFields({ name: "Clans with Space", value: suggestions });
                    } else {
                        responseEmbed.addFields({ name: "Note", value: "All alliance clans are currently full!" });
                    }
                }

                await interaction.editReply({ embeds: [responseEmbed] });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "❌ Error checking clan availability." });
            }
            return;
        }

        // COMPO REFRESH BUTTON
        if (id.startsWith("compo_refresh_")) {
            if (interaction.replied || interaction.deferred) return;
            var compoTag = "#" + id.replace("compo_refresh_", "");

            try { await interaction.deferUpdate(); } catch(e) { return; }

            try {
                var clan = await coc.getClan(compoTag);

                var thEmojis = {
                    18: getEmoji("th18"), 17: getEmoji("th17"), 16: getEmoji("th16"),
                    15: getEmoji("th15"), 14: getEmoji("th14"), 13: getEmoji("th13"),
                    12: getEmoji("th12"), 11: getEmoji("th11")
                };
                var thCounts = {};
                var totalTH = 0;
                var totalMembers = 0;

                clan.memberList.forEach(function(m) {
                    thCounts[m.townHallLevel] = (thCounts[m.townHallLevel] || 0) + 1;
                    totalTH += m.townHallLevel;
                    totalMembers++;
                });

                var sortedTH = Object.entries(thCounts).sort(function(a, b) { return b[0] - a[0]; });
                var desc = "";
                sortedTH.forEach(function(entry) {
                    var emojiStr = thEmojis[entry[0]] || "🏰";
                    desc += "**TH" + entry[0] + "** " + emojiStr + " **" + entry[1] + "**\n";
                });

                var avgTH = totalMembers > 0 ? (totalTH / totalMembers).toFixed(2) : "N/A";

                var now = new Date();
                var options = { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
                var timestamp = now.toLocaleString('en-GB', options).replace(',', '');

                var compoEmbed = new EmbedBuilder()
                    .setTitle(clan.name + " Townhalls")
                    .setDescription(desc || "No data")
                    .setColor(0xFF0000)
                    .setThumbnail(clan.badgeUrls.medium)
                    .setFooter({ text: "Accounts: " + totalMembers + " | Avg TH: " + avgTH + " | Updated: " + timestamp });

                var refreshEmoji = getEmojiObject("refresh");
                var compoBtn = new ButtonBuilder()
                    .setCustomId("compo_refresh_" + compoTag.replace("#", ""))
                    .setLabel("Refresh Data")
                    .setStyle(ButtonStyle.Secondary);

                if (refreshEmoji) { compoBtn.setEmoji(refreshEmoji); }
                else { compoBtn.setEmoji("🔄"); }

                var compoBtnRow = new ActionRowBuilder().addComponents(compoBtn);
                await interaction.editReply({ embeds: [compoEmbed], components: [compoBtnRow] });
            } catch (err) {
                console.error(err);
                try { await interaction.followUp({ content: "❌ Error refreshing compo data.", ephemeral: true }); } catch(e) {}
            }
            return;
        }

        // WAR WEIGHT CALCULATE BUTTON
        if (id === "calc_war_weight_btn") {
            const modal = new ModalBuilder()
                .setCustomId('war_weight_modal')
                .setTitle('Calculate War Weight');

            const weightInput = new TextInputBuilder()
                .setCustomId('weight_input')
                .setLabel('Enter gold or elixir capacity')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., 31800')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(weightInput);
            modal.addComponents(firstActionRow);

            return interaction.showModal(modal);
        }
    }

    // SELECT MENUS
    if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;

        // CLANS DASHBOARD SELECT MENUS (Moved to top for instant response)
        if (id === "clans10_sel_fwa" || id === "clans10_sel_war" || id === "clans10_sel_cwl" || id === "clans10_sel_futurefwa") {
            if (interaction.replied || interaction.deferred) return;
            const clans1 = require("../commands/coc/clan/clan.js");
            var selectedTag = "#" + interaction.values[0];

            try { 
                await interaction.deferReply({ ephemeral: true }); 
            } catch(e) { 
                if (e.code === 10062) return;
                console.error("Error deferring select menu:", e);
                return; 
            }

            try {
                var clanRoles = dataManager.getClanRoles();
                var clanData = await coc.getClan(selectedTag);
                var clanEmbed;

                var availBtnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("clan_availability_" + selectedTag.replace("#", ""))
                        .setLabel("Availability")
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(getEmojiObject("sheild") || "🛡️")
                );

                if (id === "clans10_sel_fwa") {
                    clanEmbed = await clans1.buildClanEmbed(selectedTag, clanRoles, clanData, context);
                    await interaction.editReply({ embeds: [clanEmbed], components: [availBtnRow] });
                }

                else if (id === "clans10_sel_war") {
                    clanEmbed = await clans1.buildWarClanEmbed(selectedTag, context);
                    
                    var warSelectRow = buildClanSelectRow(clanData, getEmojiObject, StringSelectMenuBuilder, ActionRowBuilder);
                    var warButtonRow = buildRefreshButton(clanData, getEmojiObject, ButtonBuilder, ButtonStyle, ActionRowBuilder);
                    
                    warButtonRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId("clan_availability_" + selectedTag.replace("#", ""))
                            .setLabel("Availability")
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji(getEmojiObject("sheild") || "🛡️")
                    );

                    await interaction.editReply({ embeds: [clanEmbed], components: [warSelectRow, warButtonRow] });
                }

                else if (id === "clans10_sel_cwl") {
                    const cwlData = getCwlClans();
                    clanEmbed = await clans1.buildCwlClanEmbed(selectedTag, cwlData, clanData, context);
                    await interaction.editReply({ embeds: [clanEmbed], components: [availBtnRow] });
                }

                else if (id === "clans10_sel_futurefwa") {
                    clanEmbed = await clans1.buildClanEmbed(selectedTag, clanRoles, clanData, context);
                    await interaction.editReply({ embeds: [clanEmbed], components: [availBtnRow] });
                }
            } catch(err) {
                console.error("Error in clans10 select menu:", err);
                try { await interaction.editReply({ content: "❌ Error fetching clan data.", embeds: [], components: [] }); } catch(e) {}
            }
            return;
        }

        // STRIKE ADD
        if (id.startsWith("strikeadd_select_")) {
            const pendingId = id.replace("strikeadd_select_", "");
            const strikeaddFile = require("../commands/coc/strike/strikeadd.js");
            const pendingData = strikeaddFile.pendingStrikes.get(pendingId);

            if (!pendingData) return interaction.update({ content: "❌ Pending strike data expired or not found. Please try again.", components: [] });

            const { targetUserId, reason, weight, addedBy } = pendingData;
            const playerTag = interaction.values[0];
            const userData = dataManager.getUserData();

            if (!userData[targetUserId]) return interaction.update({ content: "❌ User data not found.", components: [] });

            const account = userData[targetUserId].find(function(acc) { return acc.tag === playerTag; });
            if (!account) return interaction.update({ content: "❌ Account not found.", components: [] });

            if (account.totalStrikes === undefined) account.totalStrikes = account.strikes || 0;
            if (!account.strikeHistory) account.strikeHistory = [];
            
            let clanName = "Unknown Clan";
            let clanTag = null;
            let role = "Member";
            try {
                const cocData = await coc.getPlayer(playerTag);
                clanName = cocData.clan ? cocData.clan.name : "No Clan";
                clanTag = cocData.clan ? cocData.clan.tag : null;
                role = cocData.role ? (cocData.role.charAt(0).toUpperCase() + cocData.role.slice(1)) : "Member";
            } catch (err) {
                console.error("Error fetching player data:", err);
            }

            const strikeId = Math.random().toString(36).substring(2, 7).toUpperCase();
            const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

            account.totalStrikes = (account.totalStrikes || account.strikes || 0) + weight;

            const strikeEntry = {
                id: strikeId,
                reason: reason,
                weight: weight,
                strikeCountAdded: weight,
                totalAtTime: account.totalStrikes,
                addedBy: addedBy,
                clan: clanName,
                date: dateStr
            };

            account.strikes = account.totalStrikes;
            account.strikeHistory.push(strikeEntry);

            dataManager.saveUserData(userData);
            strikeaddFile.pendingStrikes.delete(pendingId);

            await interaction.update({ content: "✅ Added **" + weight + "** strike(s) to **" + account.name + "** (" + account.tag + "). Total strikes: **" + account.totalStrikes + "**", components: [] });

            const targetUser = await interaction.client.users.fetch(targetUserId).catch(function() { return null; });
            if (targetUser) {
                const dmEmbed = new EmbedBuilder()
                    .setTitle("⚠️ You received a strike")
                    .setColor(0xFF0000)
                    .setDescription(
                        "**Reason:** " + reason + "\n" +
                        "**Weight:** " + weight + "\n" +
                        "**Strikes Added:** " + weight + "\n" +
                        "**Total Strikes:** " + account.totalStrikes + "\n" +
                        "**Date:** " + dateStr
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] }).catch(function() { return null; });
            }

            if (account.totalStrikes >= 6 && !account.sixStrikeAlertSent) {
                account.sixStrikeAlertSent = true;
                dataManager.saveUserData(userData);

                const clanRoles = dataManager.getClanRoles();
                const clanConfig = clanRoles[clanTag];
                
                if (clanConfig && clanConfig.mailChannelId) {
                    const mailChannel = await interaction.client.channels.fetch(clanConfig.mailChannelId).catch(function() { return null; });
                    if (mailChannel) {
                        const guild = interaction.guild;
                        const leaderRole = guild.roles.cache.find(function(r) { return r.name.toLowerCase() === "leader"; }) || 
                                           guild.roles.cache.find(function(r) { return r.name.toLowerCase().includes("leader"); });
                        
                        const mention = leaderRole ? "<@&" + leaderRole.id + ">" : "@Leader";
                        
                        const alertEmbed = new EmbedBuilder()
                            .setTitle("⚠️ Player reached 6 strikes")
                            .setColor(0xFF0000)
                            .setDescription(
                                mention + "\n\n" +
                                "**Player:** " + account.name + "\n" +
                                "**Clan:** " + clanName + "\n" +
                                "**Current Strikes:** " + account.totalStrikes
                            )
                            .setTimestamp();

                        await mailChannel.send({ content: mention, embeds: [alertEmbed] }).catch(function() { return null; });
                    }
                }
            }
            return;
        }

        // STRIKE REMOVE
        if (id.startsWith("strikeremove_select_")) {
            const parts = id.split("_");
            const targetUserId = parts[2];
            const removeCount = parseInt(parts[3]);
            const playerTag = interaction.values[0];
            const userData = dataManager.getUserData();

            if (!userData[targetUserId]) return interaction.update({ content: "❌ User data not found.", components: [] });

            const account = userData[targetUserId].find(function(acc) { return acc.tag === playerTag; });
            if (!account) return interaction.update({ content: "❌ Account not found.", components: [] });

            if (account.totalStrikes === undefined) account.totalStrikes = account.strikes || 0;

            if (account.totalStrikes <= 0) {
                return interaction.update({ content: "⚠️ **" + account.name + "** has 0 strikes.", components: [] });
            }

            const actualRemove = Math.min(removeCount, account.totalStrikes);
            let remainingToRemove = actualRemove;

            if (account.strikeHistory && account.strikeHistory.length > 0) {
                while (remainingToRemove > 0 && account.strikeHistory.length > 0) {
                    const lastStrike = account.strikeHistory[account.strikeHistory.length - 1];
                    if (lastStrike.weight <= remainingToRemove) {
                        remainingToRemove -= lastStrike.weight;
                        account.strikeHistory.pop();
                    } else {
                        lastStrike.weight -= remainingToRemove;
                        lastStrike.strikeCountAdded = lastStrike.weight;
                        remainingToRemove = 0;
                    }
                }
            }
            
            account.totalStrikes -= actualRemove;
            account.strikes = account.totalStrikes;
            if (account.totalStrikes < 6) account.sixStrikeAlertSent = false;

            dataManager.saveUserData(userData);
            await interaction.update({ content: "✅ Removed **" + actualRemove + "** strike(s) from **" + account.name + "** (" + account.tag + "). Current strikes: **" + account.totalStrikes + "**", components: [] });
            return;
        }

        // UNIFIED CLANS DASHBOARD SELECT (;clans command)
        if (id === "clans_dashboard_select") {
            if (interaction.replied || interaction.deferred) return;

            var selectedValue = interaction.values[0];
            var isFwa = selectedValue.startsWith("fwa_");
            var isWar = selectedValue.startsWith("war_");
            var clanTag = "#" + selectedValue.replace("fwa_", "").replace("war_", "");

            try {
                await interaction.deferReply({ ephemeral: true });
            } catch (e) {
                console.error("Failed to defer clans_dashboard_select:", e.message);
                return;
            }

            try {
                var clan = await coc.getClan(clanTag);

                if (isFwa) {
                    // FWA Clan Detail - same style as ;clan command
                    var clanDataFile = dataManager.getClanRoles();
                    var stored = clanDataFile[clanTag] || { leaders: [], coLeaders: [] };
                    var tagNoHash = clanTag.replace("#", "");
                    var tagWithHash = encodeURIComponent("#" + tagNoHash);

                    var fwaDesc =
                        getEmoji("whitefwa") + " **FWA** " + getEmoji("whitefwa") + "\n" +
                        getEmoji("fwalead") + " **Accepting:** " + getEmoji("th18") + " " + getEmoji("th17") + " " + getEmoji("th16") + " " + getEmoji("th15") + " " + getEmoji("th14") + "\n" +
                        getEmoji("ccw") + " **Clan Capital:** " + (clan.clanCapital ? clan.clanCapital.capitalHallLevel : "?") + "\n" +
                        getEmoji("clancastle") + " **Clan Level:** " + clan.clanLevel + "\n" +
                        getEmoji("cwl") + " **CWL:** Lazy Cwl\n\n" +
                        getEmoji("arrow") + " **Open in Game:** [Click Here](https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + tagNoHash + ")\n" +
                        getEmoji("coc") + " **Clash of Stats:** [Click Here](https://www.clashofstats.com/clans/" + tagNoHash + ")\n" +
                        getEmoji("arrow") + " **CC Link:** [Click Here](https://cc.fwafarm.com/cc_n/clan.php?tag=" + tagWithHash + ")\n\n" +
                        getEmoji("crown") + " **Leaders**:\n" + (stored.leaders.join("\n") || "None") + "\n" +
                        getEmoji("crown") + " **Co-Leaders**:\n" + (stored.coLeaders.join("\n") || "None") + "\n\n";

                    if (fwaDesc.length > 4096) {
                        fwaDesc = fwaDesc.slice(0, 4093) + "...";
                    }

                    var fwaEmbed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle(clan.name + " (" + clanTag + ")")
                        .setThumbnail(clan.badgeUrls.large)
                        .setDescription(fwaDesc)
                        .setTimestamp();

                    var fwaBtnRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("clan_availability_" + clanTag.replace("#", ""))
                            .setLabel("Availability")
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji(getEmojiObject("sheild"))
                    );

                    await interaction.editReply({ embeds: [fwaEmbed], components: [fwaBtnRow] });

                } else if (isWar) {
                    // War Clan Detail - same style as ;wclan command
                    var totalWars = clan.warWins + (clan.warLosses || 0);
                    var winRatio = totalWars > 0 ? (clan.warWins / totalWars).toFixed(2) : "0.00";
                    var link = "https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + clan.tag.replace("#", "");
                    var locationStr = clan.location && clan.location.name ? "🌐 " + clan.location.name : "N/A";
                    var leaderMember = clan.memberList.find(function(m) { return m.role === "leader"; });
                    var leaderName = leaderMember ? leaderMember.name : "Unknown";

                    var warEmbed = new EmbedBuilder()
                        .setTitle(clan.name)
                        .setThumbnail(clan.badgeUrls.medium)
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

                    var warSelectRow = buildClanSelectRow(clan, getEmojiObject, StringSelectMenuBuilder, ActionRowBuilder);
                    var warButtonRow = buildRefreshButton(clan, getEmojiObject, ButtonBuilder, ButtonStyle, ActionRowBuilder);
                    
                    // Add availability button to the row
                    warButtonRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId("clan_availability_" + clanTag.replace("#", ""))
                            .setLabel("Availability")
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji(getEmojiObject("sheild"))
                    );

                    await interaction.editReply({ embeds: [warEmbed], components: [warSelectRow, warButtonRow] });
                }
            } catch (err) {
                console.error(err);
                try { await interaction.editReply({ content: "❌ Error fetching clan details." }); } catch(e) {}
            }
            return;
        }

        // WAR CLANS DASHBOARD SELECT (Main List)
        if (id === "wclans_list_select") {
            if (interaction.replied || interaction.deferred) return;
            const clanTag = "#" + interaction.values[0];
            
            try { await interaction.deferUpdate(); } catch(e) { return; }

            try {
                const clan = await coc.getClan(clanTag);
                
                const totalWars = clan.warWins + (clan.warLosses || 0);
                const winRatio = totalWars > 0 ? (clan.warWins / totalWars).toFixed(2) : "0.00";
                const link = "https://link.clashofclans.com/en?action=OpenClanProfile&tag=" + clan.tag.replace("#", "");
                const locationStr = clan.location && clan.location.name ? "🌐 " + clan.location.name : "N/A";
                const leaderMember = clan.memberList.find(function(m) { return m.role === "leader"; });
                const leaderName = leaderMember ? leaderMember.name : "Unknown";

                const embed = new EmbedBuilder()
                    .setTitle(clan.name)
                    .setThumbnail(clan.badgeUrls.medium)
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

                const selectRow = buildClanSelectRow(clan, getEmojiObject, StringSelectMenuBuilder, ActionRowBuilder);
                const buttonRow = buildRefreshButton(clan, getEmojiObject, ButtonBuilder, ButtonStyle, ActionRowBuilder);

                await interaction.editReply({ embeds: [embed], components: [selectRow, buttonRow] });
            } catch (err) {
                console.error(err);
                await interaction.followUp({ content: "❌ Error fetching details for this clan.", ephemeral: true }).catch(function() {});
            }
            return;
        }

        // WAR CLANS DETAIL SELECT (Secondary Menu)
        if (id.startsWith("wclans_select_")) {
            if (interaction.replied || interaction.deferred) return;
            const clanTag = "#" + id.replace("wclans_select_", "");
            const selection = interaction.values[0];

            try { await interaction.deferReply({ ephemeral: true }); } catch(e) { return; }

            try {
                const clan = await coc.getClan(clanTag);
                const embed = new EmbedBuilder().setColor(Math.floor(Math.random() * 0xffffff)).setTimestamp();

                if (selection === "tags_roles") {
                    var lines = [];
                    clan.memberList.forEach(function(m, i) {
                        var roleName = m.role.replace("admin", "Elder").replace("coLeader", "Co-Leader");
                        lines.push("`" + (i + 1) + ".` **" + m.name + "**\n╰ `" + m.tag + "` | " + roleName);
                    });
                    var membersStr = lines.join("\n");
                    var desc = membersStr.length > 4000 ? membersStr.substring(0, 4000) + "..." : membersStr;
                    embed.setTitle(getEmoji("mem") + " " + clan.name + " - Player Tags & Roles")
                         .setDescription(desc || "No members found.");
                } 
                else if (selection === "trophies_league") {
                    var lines = [];
                    clan.memberList.forEach(function(m, i) {
                        var leagueName = m.league ? m.league.name : "No League";
                        lines.push("`" + (i + 1) + ".` **" + m.name + "**\n╰ " + getEmoji("throphy") + " " + m.trophies + " | " + leagueName);
                    });
                    var membersStr = lines.join("\n");
                    var desc = membersStr.length > 4000 ? membersStr.substring(0, 4000) + "..." : membersStr;
                    embed.setTitle(getEmoji("throphy") + " " + clan.name + " - Trophies & League")
                         .setDescription(desc || "No members found.");
                }
                else if (selection === "joining") {
                    var sortedMembers = clan.memberList.slice().sort(function(a, b) {
                        var aNew = (a.donations === 0 && a.donationsReceived === 0);
                        var bNew = (b.donations === 0 && b.donationsReceived === 0);
                        if (aNew && !bNew) return -1;
                        if (!aNew && bNew) return 1;
                        return 0;
                    });

                    var lines = [];
                    sortedMembers.forEach(function(m, i) {
                        var isNew = (m.donations === 0 && m.donationsReceived === 0);
                        var status = isNew ? "🆕 New Joined" : "✅ Active Member";
                        lines.push("`" + (i + 1) + ".` **" + m.name + "**\n╰ " + status + " | Tags: `" + m.tag + "`");
                    });
                    var membersStr = lines.join("\n");
                    var desc = membersStr.length > 4000 ? membersStr.substring(0, 4000) + "..." : membersStr;
                    embed.setTitle(getEmoji("alaram") + " " + clan.name + " - Last Joining Date")
                         .setDescription(desc || "No members found.");
                }
                else if (selection === "progress") {
                    var lines = [];
                    clan.memberList.forEach(function(m, i) {
                        lines.push("`" + (i + 1) + ".` **" + m.name + "**\n╰ Level: " + m.expLevel + " | TH: " + m.townHallLevel + " | " + getEmoji("drop") + " " + m.donations);
                    });
                    var membersStr = lines.join("\n");
                    var desc = membersStr.length > 4000 ? membersStr.substring(0, 4000) + "..." : membersStr;
                    embed.setTitle(getEmoji("graph") + " " + clan.name + " - Player Progress")
                         .setDescription(desc || "No members found.");
                }
                else if (selection === "attacks_defenses") {
                    var lines = [];
                    clan.memberList.forEach(function(m, i) {
                        lines.push("`" + (i + 1) + ".` **" + m.name + "**\n╰ Attacks Won: `" + (m.attacks || 0) + "` | Defenses Won: `" + (m.defenses || 0) + "`");
                    });
                    var membersStr = lines.join("\n");
                    var desc = membersStr.length > 4000 ? membersStr.substring(0, 4000) + "..." : membersStr;
                    embed.setTitle(getEmoji("cocfight") + " " + clan.name + " - Attacks & Defenses")
                         .setDescription(desc || "No members found.");
                }
                else if (selection === "warlog") {
                    try {
                        const data = await coc.getWarLog(clanTag);
                        const logs = data.items || [];
                        var logText = "";
                        logs.slice(0, 10).forEach(function(log) {
                            var result;
                            if (log.result === "win") {
                                result = getEmoji("gtick") + " Win";
                            } else if (log.result === "lose") {
                                result = getEmoji("bluex") + " Loss";
                            } else {
                                result = "⚖️ Tie";
                            }
                            var opponentName = log.opponent ? log.opponent.name : "Unknown Opponent";
                            var opponentTag = log.opponent ? log.opponent.tag : "";
                            logText += "**" + result + "** vs " + opponentName + " (" + opponentTag + ")\n" +
                                       getEmoji("bluestar") + " " + log.clan.stars + " - " + log.opponent.stars + " | " + getEmoji("sheild") + " " + log.clan.destructionPercentage.toFixed(1) + "% - " + log.opponent.destructionPercentage.toFixed(1) + "%\n\n";
                        });
                        embed.setTitle(getEmoji("cwl") + " " + clan.name + " - War History").setDescription(logText || "War log is private or empty.");
                    } catch (e) {
                        embed.setTitle(getEmoji("cwl") + " " + clan.name + " - War History").setDescription("❌ Could not fetch war log. It might be private.");
                    }
                }

                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: "❌ Error fetching details for this clan." });
            }
            return;
        }
    }

    // MODAL SUBMISSIONS
    if (interaction.isModalSubmit()) {
        const id = interaction.customId;

        if (id === "war_weight_modal") {
            const weightStr = interaction.fields.getTextInputValue('weight_input');
            const weight = parseInt(weightStr.replace(/,/g, '').trim(), 10);

            if (isNaN(weight)) {
                return interaction.reply({ content: "⚠️ Invalid number entered. Please enter a valid number.", ephemeral: true });
            }

            const total = weight * 5;
            const resEmbed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle("War Weight Calculation")
                .setDescription(`**Entered Weight:** ${weightStr}\n**Total War Weight:** ${total.toLocaleString()}`);

            return interaction.reply({ embeds: [resEmbed], ephemeral: true });
        }
    }

    return false;
}

// Helper: Build the clan detail select row
function buildClanSelectRow(clan, getEmojiObject, StringSelectMenuBuilder, ActionRowBuilder) {
    return new ActionRowBuilder().addComponents(
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
}

// Helper: Build the refresh button row
function buildRefreshButton(clan, getEmojiObject, ButtonBuilder, ButtonStyle, ActionRowBuilder) {
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

    return new ActionRowBuilder().addComponents(btn);
}

module.exports = { handleInteraction };
