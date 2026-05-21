const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clanentry")
        .setDescription("Add or update a clan entry with role, channels, leaders, and type")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName("clantag")
                .setDescription("Clan tag (e.g. #CYQVL002)")
                .setRequired(true)
        )

        .addStringOption(option =>
            option.setName("nickname")
                .setDescription("Short nickname for the clan (e.g. BB, TL)")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("clantype")
                .setDescription("Clan type")
                .setRequired(true)
                .addChoices(
                    { name: "FWA", value: "fwa" },
                    { name: "War", value: "war" }
                )
        )
        .addUserOption(option =>
            option.setName("leader")
                .setDescription("Leader of this clan")
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName("coleader1")
                .setDescription("Co-Leader 1")
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName("coleader2")
                .setDescription("Co-Leader 2")
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName("coleader3")
                .setDescription("Co-Leader 3")
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName("coleader4")
                .setDescription("Co-Leader 4")
                .setRequired(false)
        ),

    async execute(interaction, context) {
        try {
            const { data: dataManager, config } = context;
            const ALLOWED_ROLES = [...(config.ADMIN_ROLE_IDS || []), ...(config.STAFF_ROLE_IDS || [])];

            if (!interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id))) {
                return interaction.reply({ content: "❌ You do not have permission (Staff/Admin) to use this command.", ephemeral: true });
            }

            // Defer reply since creating assets takes time
            await interaction.deferReply({ ephemeral: true });

            // Check bot permissions
            const botMember = await interaction.guild.members.fetchMe();
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.editReply({ content: "❌ I do not have sufficient permissions (**Manage Roles** and **Manage Channels**) to complete this setup." });
            }

            var clanTag = interaction.options.getString("clantag").toUpperCase();
            if (!clanTag.startsWith("#")) clanTag = "#" + clanTag;

            var nickName = interaction.options.getString("nickname");
            var clanType = interaction.options.getString("clantype");
            var leader = interaction.options.getUser("leader");
            var co1 = interaction.options.getUser("coleader1");
            var co2 = interaction.options.getUser("coleader2") || null;
            var co3 = interaction.options.getUser("coleader3") || null;
            var co4 = interaction.options.getUser("coleader4") || null;

            // Load existing data
            var clanroles = dataManager.getClanRoles();
            var existing = clanroles[clanTag] || {};

            // Fetch Clan Data from API to get official name
            let officialClanName = nickName; // Fallback to nickname
            try {
                const cocData = await context.coc.getClan(clanTag);
                if (cocData && cocData.name) {
                    officialClanName = cocData.name;
                }
            } catch (err) {
                console.warn(`⚠️ Could not fetch clan data for ${clanTag}:`, err.message);
            }

            // Preserve existing clanType if not provided
            var finalType = clanType || existing.clanType || "fwa";

            // Build leaders array
            var leaders = existing.leaders || [];
            if (leader) {
                leaders = ["<@" + leader.id + ">"];
            }

            // Build co-leaders array
            var coLeaders = existing.coLeaders || [];
            var newCoLeaders = [];
            if (co1) newCoLeaders.push("<@" + co1.id + ">");
            if (co2) newCoLeaders.push("<@" + co2.id + ">");
            if (co3) newCoLeaders.push("<@" + co3.id + ">");
            if (co4) newCoLeaders.push("<@" + co4.id + ">");
            if (newCoLeaders.length > 0) {
                coLeaders = newCoLeaders;
            }

            // Status Embed for live updates
            const statusEmbed = new EmbedBuilder()
                .setTitle("Clan Setup in Progress...")
                .setColor("Blue")
                .setDescription("⏳ **Creating Role...**")
                .setTimestamp();

            await interaction.editReply({ embeds: [statusEmbed] });

            // Automated Role and Channel Creation
            let finalRoleId, finalChannelId, finalMailChannelId;
            let setupWarnings = [];

            // Create Role
            let clanRole = await interaction.guild.roles.create({
                name: `${officialClanName}`,
                color: 0xe99898,
                reason: `Automated setup for ${clanTag}`
            });
            finalRoleId = clanRole.id;

            // Assign the role to specified leaders/co-leaders
            const assignRoles = async (user) => {
                if (!user) return;
                try {
                    const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
                    if (guildMember) {
                        await guildMember.roles.add(clanRole).catch(err => {
                            console.warn(`Could not add role to ${user.id}:`, err.message);
                            setupWarnings.push(`⚠️ Could not add role to <@${user.id}>`);
                        });
                    } else {
                        setupWarnings.push(`⚠️ Could not find user <@${user.id}> in the server.`);
                    }
                } catch (err) {
                    console.warn(`Error fetching member ${user.id}:`, err.message);
                    setupWarnings.push(`⚠️ Error processing <@${user.id}>: ${err.message}`);
                }
            };

            await assignRoles(leader);
            if (co1) await assignRoles(co1);
            if (co2) await assignRoles(co2);
            if (co3) await assignRoles(co3);
            if (co4) await assignRoles(co4);

            // Update status
            let roleMsg = "✅ **Role created successfully.**";
            if (setupWarnings.length > 0) {
                roleMsg += "\n\n**Warnings:**\n" + setupWarnings.join("\n");
            }
            statusEmbed.setDescription(roleMsg + "\n\n⏳ **Creating Category and Channels...**");
            await interaction.editReply({ embeds: [statusEmbed] });

            // Create Category and Channels
            const overwrites = [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                }
            ];

            const category = await interaction.guild.channels.create({
                name: `❝${officialClanName.toUpperCase()}❞`,
                type: ChannelType.GuildCategory,
                permissionOverwrites: overwrites
            });

            // Channel 1: Clan Chat
            const membersChan = await interaction.guild.channels.create({
                name: `💬┃${officialClanName}-chat`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    ...overwrites,
                    {
                        id: clanRole.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.AttachFiles,
                            PermissionsBitField.Flags.MentionEveryone,
                            PermissionsBitField.Flags.AddReactions
                        ]
                    }
                ]
            });
            finalChannelId = membersChan.id;

            // Channel 2: Clan Mails
            const mailChan = await interaction.guild.channels.create({
                name: `📄┃${officialClanName}-activity-logs`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    ...overwrites,
                    {
                        id: clanRole.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.AttachFiles,
                            PermissionsBitField.Flags.MentionEveryone,
                            PermissionsBitField.Flags.AddReactions
                        ]
                    }
                ]
            });
            finalMailChannelId = mailChan.id;

            // Update status
            let chanMsg = "✅ **Channels created successfully.**";
            if (setupWarnings.length > 0) {
                chanMsg += "\n\n**Warnings:**\n" + setupWarnings.join("\n");
            }
            statusEmbed.setDescription(chanMsg + "\n\n⏳ **Finalizing setup and saving data...**");
            await interaction.editReply({ embeds: [statusEmbed] });

            // Save entry
            clanroles[clanTag] = {
                roleId: finalRoleId,
                channelId: finalChannelId,
                mailChannelId: finalMailChannelId,
                clanType: finalType
            };

            if (nickName) clanroles[clanTag].nickName = nickName;
            if (leaders.length > 0) clanroles[clanTag].leaders = leaders;
            if (coLeaders.length > 0) clanroles[clanTag].coLeaders = coLeaders;

            dataManager.saveClanRoles(clanroles);

            // Build confirmation embed
            var desc =
                "✅ Clan **" + clanTag + "** has been registered:\n\n" +
                "• **Clan Role:** <@&" + finalRoleId + ">\n" +
                "• **Channel 1:** <#" + finalChannelId + ">\n" +
                "• **Channel 2:** <#" + finalMailChannelId + ">\n" +
                "• **Clan Type:** " + finalType + "\n";

            if (nickName) desc += "• **Nickname:** " + nickName + "\n";
            if (leaders.length > 0) desc += "• **Leader:** " + leaders.join(", ") + "\n";
            if (coLeaders.length > 0) desc += "• **Co-Leaders:** " + coLeaders.join(", ") + "\n";

            if (setupWarnings.length > 0) {
                desc += "\n⚠️ **Warnings during setup:**\n" + setupWarnings.join("\n") + "\n";
            }

            var embed = new EmbedBuilder()
                .setTitle("Clan Entry Saved")
                .setColor(0x2ecc71)
                .setDescription(desc)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("❌ Error in clanentry command:", error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: "❌ An error occurred.", ephemeral: true });
                } else {
                    await interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
                }
            } catch (e) {}
        }
    }
};
