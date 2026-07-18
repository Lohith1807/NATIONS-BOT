const { Client, GatewayIntentBits, Collection, REST, Routes, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { getBannerFiles } = require('./utils/data.js');

const BOT1_TOKEN     = process.env.BOT1_TOKEN || process.env.DISCORD_TOKEN;
const BOT1_CLIENT_ID = "1509906435402760202";

const bot1 = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required for reading message content for softban
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers, // Required for tracking role changes
        GatewayIntentBits.GuildInvites, // Required for invite tracking
    ],
    partials: ['CHANNEL'], // Required for receiving DMs
});

bot1.commands = new Collection();
const commandsPath = path.join(__dirname, 'bot1_commands');
const commandsData = [];

function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.endsWith('.js')) {
            const command = require(fullPath);
            bot1.commands.set(command.data.name, command);
            if (command.data.toJSON) {
                commandsData.push(command.data.toJSON());
            } else {
                commandsData.push(command.data);
            }
        }
    }
}

loadCommands(commandsPath);

bot1.once("ready", async () => {
    console.log(`✅ [Bot1] ${bot1.user.tag} is online`);
    
    bot1.user.setPresence({
        status: "dnd",
        activities: [
            {
                name: "Watching Blood Alliance !!",
                type: 3 // 👀 3 = Watching
            }
        ]
    });

    // Cache invites
    const { invitesCache, getInviteConfig, fetchInviteSnapshot } = require('./utils/inviteManager.js');
    for (const guild of bot1.guilds.cache.values()) {
        const config = getInviteConfig(guild.id);
        if (config && config.enabled) {
            try {
                const snapshot = await fetchInviteSnapshot(guild);
                invitesCache.set(guild.id, snapshot);
            } catch (err) {
                console.error(`Failed to fetch invites for guild ${guild.id}:`, err);
            }
        }
    }

    const { checkReminders } = require('./utils/reminderManager.js');
    setInterval(() => checkReminders(bot1), 10000);

    // Scheduled DM for TAU Token Update (8 AM IST, every 6 days)
    try {
        const cron = require('node-cron');
        const { EmbedBuilder } = require('discord.js');
        
        cron.schedule('0 8 */6 * *', async () => {
            const endDate = new Date('2026-06-30T00:00:00+05:30');
            if (new Date() > endDate) return;

            try {
                const targetUserId = '1393061101838532630';
                const targetUser = await bot1.users.fetch(targetUserId);
                if (targetUser) {
                    const embed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('🔔 TAU Token Update Reminder')
                        .setDescription(`<@${targetUserId}> Please update the TAU TOKEN FOR TELEGRAM BOT.\n\n*This is an automated reminder.*`)
                        .setTimestamp();
                    
                    await targetUser.send({ content: `<@${targetUserId}>`, embeds: [embed] });
                    console.log(`✅ [Bot1] Sent scheduled TAU Token reminder to ${targetUser.tag}`);
                }
            } catch (err) {
                console.error("❌ [Bot1] Failed to send scheduled TAU Token reminder:", err);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata"
        });
    } catch (err) {
        console.error("❌ [Bot1] Failed to load node-cron:", err);
    }
});

bot1.on("interactionCreate", async (interaction) => {
    try {
        const { handleReminderInteractions } = require('./utils/reminderInteractions.js');
        if (await handleReminderInteractions(interaction)) return;

        if (interaction.isChatInputCommand()) {
            const command = bot1.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        } else if (interaction.isAutocomplete()) {
            const command = bot1.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                await command.autocomplete(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            const id = interaction.customId;
            if (id.startsWith('make_announcement_modal:')) {
                await interaction.deferReply({ ephemeral: true });
                const parts = id.split(':');
                const channelId = parts[1];
                const isEmbed = parts[2] === 'true';
                const sendImage = parts[3] === 'true';
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) {
                    return interaction.editReply({ content: "❌ Target channel not found." });
                }
                const text = interaction.fields.getTextInputValue('announcement_text');
                
                // Process emojis
                const { getEmoji, processEmojis } = require('./utils/botemoji.js');
                const { EmbedBuilder } = require('discord.js');
                
                const processedText = processEmojis(text);
                
                const announceImagePath = path.join(__dirname, './bot1_commands/utility/baannounce.png');
                const files = [];
                if (sendImage && fs.existsSync(announceImagePath)) {
                    files.push({ attachment: announceImagePath, name: 'baannounce.png' });
                }

                try {
                    let messagePayload;
                    if (isEmbed) {
                        const embed = new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle(`${getEmoji('alaram')} Announcement`)
                            .setDescription(processedText)
                            .setTimestamp()
                            .setFooter({ text: 'Blood Alliance', iconURL: sendImage ? 'attachment://baannounce.png' : undefined });

                        if (sendImage && files.length > 0) {
                            embed.setImage('attachment://baannounce.png');
                        }
                        messagePayload = { embeds: [embed], files: files };
                    } else {
                        messagePayload = { content: processedText, files: files };
                    }

                    const sentMessage = await channel.send(messagePayload);
                    await interaction.editReply({
                        content: `${getEmoji('gtick')} Announcement sent successfully to ${channel}!\n**Message ID:** \`${sentMessage.id}\``
                    });
                } catch (err) {
                    console.error("Failed to send announcement:", err);
                    await interaction.editReply({ content: `❌ Failed to send announcement: ${err.message}` });
                }
                return;
            }

            if (id.startsWith('edit_announcement_modal:')) {
                await interaction.deferReply({ ephemeral: true });
                const parts = id.split(':');
                const channelId = parts[1];
                const messageId = parts[2];
                const isEmbed = parts[3] === 'true';
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) {
                    return interaction.editReply({ content: "❌ Target channel not found." });
                }
                
                try {
                    const targetMessage = await channel.messages.fetch(messageId);
                    if (!targetMessage) {
                        return interaction.editReply({ content: "❌ Announcement message not found." });
                    }
                    if (targetMessage.author.id !== interaction.client.user.id) {
                        return interaction.editReply({ content: "❌ I cannot edit a message not sent by me." });
                    }
                    
                    const text = interaction.fields.getTextInputValue('announcement_text');
                    const { getEmoji, processEmojis } = require('./utils/botemoji.js');
                    const { EmbedBuilder } = require('discord.js');
                    
                    const processedText = processEmojis(text);
                    
                    const announceImagePath = path.join(__dirname, './bot1_commands/utility/baannounce.png');
                    const files = [];
                    if (fs.existsSync(announceImagePath)) {
                        files.push({ attachment: announceImagePath, name: 'baannounce.png' });
                    }

                    let messagePayload;
                    if (isEmbed) {
                        const embed = new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle(`${getEmoji('alaram')} Announcement`)
                            .setDescription(processedText)
                            .setTimestamp()
                            .setFooter({ text: 'Blood Alliance', iconURL: 'attachment://baannounce.png' });

                        if (files.length > 0) {
                            embed.setImage('attachment://baannounce.png');
                        }
                        messagePayload = { content: '', embeds: [embed], files: files, attachments: [] };
                    } else {
                        messagePayload = { content: processedText, embeds: [], files: [], attachments: [] };
                    }

                    await targetMessage.edit(messagePayload);
                    await interaction.editReply({
                        content: `${getEmoji('gtick')} Announcement edited successfully!`
                    });
                } catch (err) {
                    console.error("Failed to edit announcement:", err);
                    await interaction.editReply({ content: `❌ Failed to edit announcement: ${err.message}` });
                }
                return;
            }
        } else if (interaction.isStringSelectMenu()) {
            const id = interaction.customId;

            if (id === 'todo_select') {
                if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "❌ You need administrator permissions to complete tasks.", ephemeral: true });
                }
                const { getTodos, removeTodo, getTodoListEmbed, getTodoComponents } = require('./utils/todoManager.js');
                const { EmbedBuilder } = require('discord.js');
                const { getEmoji } = require('./utils/botemoji.js');
                const selectedId = interaction.values[0];

                // Grab the todo BEFORE removing so we can DM the creator
                const todo = getTodos().find(t => t.id === selectedId);
                removeTodo(selectedId);

                await interaction.update({
                    embeds: [getTodoListEmbed()],
                    components: getTodoComponents(false)
                });

                // DM the creator
                if (todo && todo.userId) {
                    try {
                        const creator = await bot1.users.fetch(todo.userId);
                        const dmEmbed = new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setTitle(`${getEmoji('gtick')} To-Do Completed!`)
                            .setDescription(`${getEmoji('yarrow')} **${todo.task}**`)
                            .addFields({ name: 'Marked complete by', value: `<@${interaction.user.id}>` })
                            .setTimestamp()
                            .setFooter({ text: 'Blood Alliance' });
                        await creator.send({ embeds: [dmEmbed] });
                    } catch (_) {}
                }
                return;
            }

            if (id.startsWith('cmd_info_') || id.startsWith('staff_cmd_') || id.startsWith('admin_cmd_')) {
                const { getDetailEmbed, getBannerFiles } = require('./utils/data.js');
                const selectedCmd = interaction.values[0];
                await interaction.reply({
                    embeds: [getDetailEmbed(selectedCmd)],
                    files: getBannerFiles(),
                    ephemeral: true
                });
                return;
            }

        } else if (interaction.isButton()) {
            const id = interaction.customId;
            if (id === 'todo_update') {
                if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "❌ You need administrator permissions to update the list.", ephemeral: true });
                }
                const { getTodos, getTodoListEmbed, getTodoComponents } = require('./utils/todoManager.js');
                const todos = getTodos();
                if (todos.length === 0) {
                    return interaction.reply({ content: "✨ There are no pending tasks to complete!", ephemeral: true });
                }

                await interaction.update({
                    components: getTodoComponents(true)
                });
            } else if (id.startsWith('help_page_')) {
                const page = id.replace('help_page_', '');
                if (page === 'staff' || page === 'admin') {
                    const { isStaffOrAdmin } = require('./utils/data.js');
                    if (!interaction.member || !isStaffOrAdmin(interaction.member)) {
                        return interaction.reply({ content: "❌ You need Staff or Admin permissions to view this tab.", ephemeral: true });
                    }
                }
                const { getCategoryHelpEmbed, createCategoryButtons } = require('./utils/data.js');
                await interaction.update({
                    embeds: [getCategoryHelpEmbed(page)],
                    components: [createCategoryButtons()]
                });
            }
        }
    } catch (err) {
        console.error("❌ [Bot1] Interaction error:", err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "❌ Something went wrong. Please try again.", ephemeral: true });
            }
        } catch (_) {}
    }
});

bot1.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
        const STAFF_CHANNEL_ID = "1417528968294174740";
        
        // Find newly added roles
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size === 0) return;

        const { getEmoji } = require('./utils/botemoji.js');
        const { EmbedBuilder } = require('discord.js');

        const STAFF_ROLES = {
                "1153997630112792577": {
                name: "Admin",
                emoji: "crown",
                color: "#e74c3c",
                description: `
${getEmoji('yarrow')} **Role Overview:** You are now a primary authority of the server. Your core duty is to **control, watch, and keep the server running smoothly** — handle situations yourself rather than passing everything up to the Owner or Retired Persons.

${getEmoji('parrow')} **Permission Chain:** You operate under the Owner's authority. Do **not** take major or irreversible actions without the **Owner's explicit permission**. For day-to-day management, you have full operational freedom — use it wisely.

${getEmoji('rarroww')} **Server Control & Watchdog:** Monitor all channels, voice rooms, and staff activity. Be the first to notice and act on problems. Ensure every team is functioning correctly and meeting expectations.

${getEmoji('yarrow')} **Staff Oversight:** Supervise, guide, and support the staff team. Promote deserving members and address underperformance. Conduct regular check-ins to keep the team active and on track.

${getEmoji('parrow')} **Ticket & Situation Management:** You may step into any ticket at any time. When doing so, the assigned staff will ask *"Can I continue?"* — reply clearly so they know whether to proceed or hand it over.

${getEmoji('rarroww')} **Key Reminder:** You are here to **run the server**, not redirect every problem to the Owner. Take ownership, act proactively, and keep the Owner informed of major events only.`
            },
            "1420626301328297984": {
                name: "Co-Admin",
                emoji: "bluestar",
                color: "#9b59b6",
                description: `
${getEmoji('yarrow')} **Role Overview:** As Co-Admin, you are a **direct support to the Admin**. Your role is to assist in watching and keeping the server running — not to act independently. Your actions are guided and authorized by the Admin.

${getEmoji('parrow')} **Permission Chain:** You operate **strictly under Admin's authority**. Do **not** take direct or significant actions without the Admin's explicit permission. This includes staff decisions, disciplinary actions, alliance approvals, and any impactful server change. When unsure — **always check with the Admin first**.

${getEmoji('rarroww')} **Day-to-Day Duties:** Monitor channels, voice rooms, and staff activity alongside the Admin. Watch ongoing tickets, flag issues early, and stay present and responsive.

${getEmoji('yarrow')} **Assisting the Admin:** Carry out tasks assigned by the Admin promptly. Relay information between the Admin and staff team. Help the Admin stay informed by surfacing problems before they escalate.

${getEmoji('parrow')} **Situation Handling:** If the Admin is unavailable and something minor needs action, you may act — but inform the Admin as soon as possible. For anything significant, wait for Admin approval. Never make alliance decisions, promotions/demotions, or major bans without prior Admin sign-off.

${getEmoji('rarroww')} **Key Reminder:** Your power comes from the Admin's trust. Think of yourself as the Admin's right hand — **supportive, vigilant, and always in sync** with their decisions. Never exceed your authority.`
            },
            "1513940638909988874": {
                name: "Server Moderator",
                emoji: "crown",
                color: "#ffaa00",
                description: `
${getEmoji('parrow')} **Sync Verification:** Check Sync message; ensure users have chosen options. If not, tag them and ask them to choose.
${getEmoji('rarroww')} **Monitoring:** Monitor text chats and voice channels actively.
${getEmoji('yarrow')} **Discipline:** Warn or mute rule breakers promptly.
${getEmoji('rarroww')} **Enforcement:** Kick or ban users when necessary (requires admin perms).
${getEmoji('parrow')} **Conflict Resolution:** Resolve member disputes peacefully.
${getEmoji('rarroww')} **Escalation:** Report serious issues directly to admins.
${getEmoji('yarrow')} **Leadership:** Supervise the moderator team and handle complex situations.
${getEmoji('rarroww')} **Training:** Train new staff members.
${getEmoji('parrow')} **Assistance:** Assist admins with staff management.`
            },
            "1513942017196167389": {
                name: "Trial Moderator",
                emoji: "crown",
                color: "#ffaa00",
                description: `
${getEmoji('parrow')} **Sync Verification:** Check Sync message; ensure users have chosen options. If not, tag them and ask them to choose.
${getEmoji('rarroww')} **Monitoring:** Monitor text chats and voice channels actively.
${getEmoji('yarrow')} **Discipline:** Warn or mute rule breakers promptly.
${getEmoji('rarroww')} **Enforcement:** Kick or ban users when necessary (requires admin perms).
${getEmoji('parrow')} **Conflict Resolution:** Resolve member disputes peacefully.
${getEmoji('rarroww')} **Escalation:** Report serious issues directly to admins.
${getEmoji('yarrow')} **Leadership:** Supervise the moderator team and handle complex situations.
${getEmoji('rarroww')} **Training:** Train new staff members.
${getEmoji('parrow')} **Assistance:** Assist admins with staff management.`
            },
            "1154276716982833154": {
                name: "Executive Staff",
                emoji: "bluestar",
                color: "#00aaff",
                description: `
${getEmoji('yarrow')} **Ticket Conduct — Before Claiming:** You are NOT supposed to interfere in a ticket you have not claimed. If another staff has taken it, stay out unless they tag you.

${getEmoji('yarrow')} **Ticket Conduct — After Claiming:** Once you claim a ticket, no other staff may interfere unless you tag and assign them. Admins/Owners can step in at any time — if they do, tag them and ask them in staff chat not in that ticket: "Can I continue with this ticket?" and proceed based on their reply.

${getEmoji('parrow')} **Player Tickets:** If a player needs a clan, check clan needs using \`;compo all\` in the staff bot room. Guide them to a suitable clan. Ask them to follow the steps and link their account to Clash King bot using \`/link\`. After review, use \`/approve\` or \`/decline\`.

${getEmoji('rarroww')} **Alliance & Rep Tickets:** For clans wanting to join the alliance or users applying for Rep, ask them to follow the required steps and tag admins.

${getEmoji('yarrow')} **Help & Query Tickets:** Ask about their problem and try to solve it. If unable to help, tag a Server Moderator or Admin.

${getEmoji('rarroww')} **Staff & Rep Applications:** Ensure applicants have filled all details completely, then ping an Admin.`
            },
            "1480823475525517415": {
                name: "Server HR",
                emoji: "mem",
                color: "#ff55ff",
                description: `
${getEmoji('parrow')} **Recruitment:** Actively recruit new players to join our alliance.
${getEmoji('rarroww')} **Promotion:** Keep an eye out for loyal and active members to recommend for staff positions.`
            },
            "1448265928503726161": {
                name: "CWL Staff",
                emoji: "cwl",
                color: "#ff5555",
                description: `
${getEmoji('yarrow')} **Management:** Efficiently manage the CWL (Clan War Leagues) events and rosters.
${getEmoji('rarroww')} **Rotation:** Assist with clan rotation when requested to ensure smooth operations.`
            },
            "1514535148119392377": {
                name: "Welcomer & Assistance Exec",
                emoji: "heart",
                color: "#55ff55",
                description: `
${getEmoji('parrow')} **Welcoming:** Warmly welcome new members in the welcome channel.
${getEmoji('rarroww')} **Assistance:** Provide guidance and help in the assistance channels as soon as new members are added.`
            }
        };

        for (const role of addedRoles.values()) {
            const roleData = STAFF_ROLES[role.id];
            if (roleData) {
                const channel = newMember.guild.channels.cache.get(STAFF_CHANNEL_ID);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor(roleData.color)
                        .setTitle(`${getEmoji(roleData.emoji)} Welcome to the Staff Team!`)
                        .setDescription(`Congratulations <@${newMember.id}>! You have been promoted to **${roleData.name}**.\n\nHere are your responsibilities:\n${roleData.description}\n\n${getEmoji('wow')} We are excited to have you on board. Please review the tasks above carefully!`)
                        .setFooter({ text: 'Blood Alliance Staff Promotion', iconURL: newMember.guild.iconURL() })
                        .setTimestamp();

                    await channel.send({ content: `<@${newMember.id}>`, embeds: [embed] });
                }
            }
        }
    } catch (err) {
        console.error("❌ [Bot1] Error in guildMemberUpdate:", err);
    }
});

bot1.on('inviteCreate', async (invite) => {
    const { invitesCache, getInviteConfig, fetchInviteSnapshot } = require('./utils/inviteManager.js');
    const config = getInviteConfig(invite.guild.id);
    if (!config || !config.enabled) return;
    
    let cache = invitesCache.get(invite.guild.id);
    if (!cache) {
        try {
            cache = await fetchInviteSnapshot(invite.guild);
            invitesCache.set(invite.guild.id, cache);
        } catch (err) {
            return;
        }
    } else {
        cache.set(invite.code, { code: invite.code, uses: invite.uses, inviter: invite.inviter, maxUses: invite.maxUses, expiresAt: invite.expiresAt });
    }
});

bot1.on('inviteDelete', async (invite) => {
    const { invitesCache, getInviteConfig } = require('./utils/inviteManager.js');
    const config = getInviteConfig(invite.guild.id);
    if (!config || !config.enabled) return;

    const cache = invitesCache.get(invite.guild.id);
    if (cache) {
        cache.delete(invite.code);
    }
});

bot1.on('guildMemberAdd', async (member) => {
    const { invitesCache, getInviteConfig, fetchInviteSnapshot } = require('./utils/inviteManager.js');
    const { getEmoji } = require('./utils/botemoji.js');
    const { EmbedBuilder } = require('discord.js');
    
    const config = getInviteConfig(member.guild.id);
    if (!config || !config.enabled || !config.channelId) return;

    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel) return;

    const cachedInvites = invitesCache.get(member.guild.id);
    if (!cachedInvites) return;

    try {
        const newInvites = await fetchInviteSnapshot(member.guild);

        let usedInvite = null;
        
        for (const [code, newInv] of newInvites.entries()) {
            const cachedInv = cachedInvites.get(code);
            if (!cachedInv) {
                if (newInv.uses > 0) {
                    usedInvite = newInv;
                    break;
                }
            } else if (newInv.uses > cachedInv.uses) {
                usedInvite = newInv;
                break;
            }
        }

        // Check for single-use deleted invite
        if (!usedInvite) {
            for (const [code, cachedInv] of cachedInvites.entries()) {
                if (!newInvites.has(code) && cachedInv.maxUses !== 0) {
                    usedInvite = cachedInv;
                    break;
                }
            }
        }

        invitesCache.set(member.guild.id, newInvites);

        let totalInvitesText = 'N/A';
        if (usedInvite && usedInvite.inviter) {
            const totalUses = Array.from(newInvites.values())
                .filter(i => i.inviter && i.inviter.id === usedInvite.inviter.id)
                .reduce((acc, curr) => acc + curr.uses, 0);
            totalInvitesText = `${totalUses}`;
        }

        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle(`${getEmoji('mem')} New Member Joined`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`**${member.user.tag}** has joined the server!`)
            .addFields(
                { name: 'Invited By', value: usedInvite && usedInvite.inviter ? `<@${usedInvite.inviter.id}>` : 'Unknown / Vanity URL', inline: true },
                { name: 'Invite Code', value: usedInvite ? `\`${usedInvite.code}\`` : 'N/A', inline: true },
                { name: 'Total Invites', value: totalInvitesText, inline: true }
            )
            .setTimestamp();

        if (usedInvite && usedInvite.expiresAt) {
            embed.addFields({ name: 'Invite Expires', value: `<t:${Math.floor(usedInvite.expiresAt.getTime() / 1000)}:R>`, inline: true });
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Failed to process guildMemberAdd for invites:', err);
    }
});

bot1.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;


    const { getSoftbanConfig } = require('./utils/softbanManager.js');
    const { getEmoji } = require('./utils/botemoji.js');
    const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

    const config = getSoftbanConfig(message.guild.id);
    if (config && config.enabled && config.honeypotChannelId === message.channel.id) {
        // Ignore administrators so they can bypass the honeypot restrictions
        if (message.member && message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        // Check for links, invites, or attachments
        const hasLinks = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/gi.test(message.content);
        const hasAttachments = message.attachments.size > 0;

        if (hasLinks || hasAttachments) {
            try {
                // Soft ban logic: Ban and delete messages (86400 seconds = 1 day)
                const member = await message.guild.members.fetch(message.author.id);
                if (member) {
                    // Try to DM them BEFORE banning
                    try {
                        const contactIdsStr = process.env.SOFTBAN_CONTACT_IDS 
                            ? process.env.SOFTBAN_CONTACT_IDS.split(',').map(id => `<@${id.trim()}>`).join(' ') 
                            : 'the administrators';

                        const dmEmbed = new EmbedBuilder()
                            .setColor('#E74C3C')
                            .setTitle('⚠️ Soft-Banned from the Server')
                            .setDescription(`Your messages in the honeypot channel triggered our spam protection.\n\nYou have been temporarily removed from the server and your messages were deleted. If this was a mistake and you are a real user, please contact the administrators to rejoin:\n\n${contactIdsStr}`)
                            .setFooter({ text: 'Blood Alliance' });
                        await member.send({ embeds: [dmEmbed] });
                    } catch (e) {
                        console.log(`Could not send DM to ${member.user.tag}`);
                    }

                    // Ban and delete messages
                    await member.ban({ deleteMessageSeconds: 86400, reason: 'Soft-ban: Sent links/images in honeypot channel.' });
                    
                    // Unban after 10 seconds
                    setTimeout(async () => {
                        try {
                            await message.guild.members.unban(member.id, 'Soft-ban 10s duration ended');
                        } catch (e) {
                            if (e.code !== 50013 && e.code !== 10026) console.error('Failed to unban user after soft-ban:', e);
                        }
                    }, 10000);

                    const logChannel = message.guild.channels.cache.get(config.logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor('#E74C3C')
                            .setTitle(`${getEmoji('bluex')} User Soft-Banned`)
                            .setDescription(`**User:** ${message.author.tag} (<@${message.author.id}>)\n**Action:** Banned & messages deleted, unbanned after 10s.\n**Reason:** Sent link/image in honeypot channel <#${config.honeypotChannelId}>.`)
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] });
                    }
                }
            } catch (err) {
                if (err.code !== 50013) console.error('Failed to soft-ban user:', err);
            }
        } else {
            // Delete any other messages to keep the honeypot channel clean
            try {
                await message.delete();
            } catch (err) {
                if (err.code !== 50013 && err.code !== 10008) console.error('Failed to delete honeypot message:', err);
            }
        }
    }
});

bot1.login(BOT1_TOKEN);
