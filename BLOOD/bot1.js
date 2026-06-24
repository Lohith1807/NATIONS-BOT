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
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers, // Required for tracking role changes
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
    
    const { checkReminders } = require('./utils/reminderManager.js');
    setInterval(() => checkReminders(bot1), 10000);

    // Scheduled DM for TAU Token Update (8 AM IST, next 6 days)
    try {
        const cron = require('node-cron');
        const { EmbedBuilder } = require('discord.js');
        
        cron.schedule('0 8 * * *', async () => {
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
                const parts = id.split(':');
                const channelId = parts[1];
                const isEmbed = parts[2] === 'true';
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) {
                    return interaction.reply({ content: "❌ Target channel not found.", ephemeral: true });
                }
                const text = interaction.fields.getTextInputValue('announcement_text');
                
                // Process emojis
                const { getEmoji, processEmojis } = require('./utils/botemoji.js');
                const { EmbedBuilder } = require('discord.js');
                
                const processedText = processEmojis(text);
                
                const announceImagePath = path.join(__dirname, './bot1_commands/utility/baannounce.png');
                const files = [];
                if (fs.existsSync(announceImagePath)) {
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
                            .setFooter({ text: 'Blood Alliance', iconURL: 'attachment://baannounce.png' });

                        if (files.length > 0) {
                            embed.setImage('attachment://baannounce.png');
                        }
                        messagePayload = { embeds: [embed], files: files };
                    } else {
                        messagePayload = { content: processedText, files: files };
                    }

                    const sentMessage = await channel.send(messagePayload);
                    await interaction.reply({
                        content: `${getEmoji('gtick')} Announcement sent successfully to ${channel}!\n**Message ID:** \`${sentMessage.id}\``,
                        ephemeral: true
                    });
                } catch (err) {
                    console.error("Failed to send announcement:", err);
                    await interaction.reply({ content: `❌ Failed to send announcement: ${err.message}`, ephemeral: true });
                }
                return;
            }

            if (id.startsWith('edit_announcement_modal:')) {
                const parts = id.split(':');
                const channelId = parts[1];
                const messageId = parts[2];
                const isEmbed = parts[3] === 'true';
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) {
                    return interaction.reply({ content: "❌ Target channel not found.", ephemeral: true });
                }
                
                try {
                    const targetMessage = await channel.messages.fetch(messageId);
                    if (!targetMessage) {
                        return interaction.reply({ content: "❌ Announcement message not found.", ephemeral: true });
                    }
                    if (targetMessage.author.id !== interaction.client.user.id) {
                        return interaction.reply({ content: "❌ I cannot edit a message not sent by me.", ephemeral: true });
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
                    await interaction.reply({
                        content: `${getEmoji('gtick')} Announcement edited successfully!`,
                        ephemeral: true
                    });
                } catch (err) {
                    console.error("Failed to edit announcement:", err);
                    await interaction.reply({ content: `❌ Failed to edit announcement: ${err.message}`, ephemeral: true });
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

bot1.login(BOT1_TOKEN);
