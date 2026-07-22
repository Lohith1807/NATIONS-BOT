const { getServers, saveServers, getUsers, saveUsers } = require('../utils/dataManager');
const { EmbedBuilder } = require('discord.js');

const COUNTING_ROLES = [
    { threshold: 300, name: 'Region Expert' },
    { threshold: 200, name: 'Region master' },
    { threshold: 150, name: 'master' },
    { threshold: 100, name: 'counting expert' },
    { threshold: 50, name: 'noobie' }
];

module.exports = {
    name: 'messageCreate',
    DEFAULT_ROLES: COUNTING_ROLES,
    removeAllCountingRoles,
    async execute(message, client) {
        if (message.author.bot) return;

        const guildId = message.guildId;
        if (!guildId) return;

        const servers = getServers();
        const serverConfig = servers[guildId];

        if (!serverConfig) return;
        if (message.channel.id !== serverConfig.channelId) return;

        // Allow digits, hex/bin/oct characters, basic operators, and spaces for math expressions
        const mathRegex = /^[\da-fA-FxXbBoO+\-*/. ()]+$/;
        const content = message.content.trim();
        
        if (!mathRegex.test(content) || content === '') {
            // If they type regular text or invalid math, ignore it
            return;
        }

        const expectedNumber = serverConfig.currentCount + 1;
        let inputNumber = null;
        
        try {
            // Safe evaluation of the math expression
            const evalResult = Function(`'use strict'; return (${content})`)();
            if (typeof evalResult === 'number' && !isNaN(evalResult) && isFinite(evalResult)) {
                inputNumber = evalResult;
            }
        } catch (error) {
            // If evaluation fails (e.g. pure hex like "A"), we'll handle it below
        }

        // Magic base detection! If it didn't match decimal, check binary, and hex
        if (inputNumber !== expectedNumber && /^[a-fA-F0-9]+$/.test(content)) {
            if (parseInt(content, 2) === expectedNumber) {
                inputNumber = expectedNumber;
            } else if (parseInt(content, 16) === expectedNumber) {
                inputNumber = expectedNumber;
            } else if (inputNumber === null) {
                // If it failed eval (like "A" or "BAD") but is valid hex, set it so it triggers a penalty
                inputNumber = parseInt(content, 16);
            }
        }

        // If we still don't have a valid number, it's just garbage text (like "60+"), ignore it
        if (inputNumber === null) {
            return;
        }
        const users = getUsers();
        
        if (!users[guildId]) users[guildId] = {};
        if (!users[guildId][message.author.id]) {
            users[guildId][message.author.id] = { score: 0, strikes: 0 };
        }
        
        const userData = users[guildId][message.author.id];

        // 1. Check if same user is counting back-to-back
        if (serverConfig.lastUserId === message.author.id) {
            await message.delete().catch(() => {});
            const reply = await message.channel.send(`<@${message.author.id}> I Think You Have Diabaties Please Wait For Some time upto some one interacts with next number , Noob`);
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        // 2. Check if the number is correct
        if (inputNumber !== expectedNumber) {
            // Keep the user's message and send the embed permanently
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setDescription(`Hey mates because of this guy the count is reseted this guy typed **${content}** instead of **${expectedNumber}**\n\n**Counting has been reset to 0!**`);
                
            await message.channel.send({ content: `<@${message.author.id}>`, embeds: [errorEmbed] });
            
            // Reset Server Count
            serverConfig.currentCount = 0;
            serverConfig.lastUserId = null;
            serverConfig.lastMessages = {};
            saveServers(servers);
            
            // Handle strikes
            userData.strikes += 1;
            
            if (userData.strikes >= 5) {
                try {
                    // Mute for 2 minutes (120,000 ms)
                    const member = await message.guild.members.fetch(message.author.id);
                    await member.timeout(120000, '5 mistakes in channel');
                    const muteMsg = await message.channel.send(`<@${message.author.id}> has been muted for 2 minutes for failing to count 5 times.`);
                    setTimeout(() => muteMsg.delete().catch(() => {}), 10000);
                    userData.strikes = 0; // Reset after muting
                } catch (error) {
                    const errorMsg = await message.channel.send(`That Noob <@${message.author.id}> failed to count 5 times, but their role is too high for me to mute them! 🙄`);
                    setTimeout(() => errorMsg.delete().catch(() => {}), 10000);
                    userData.strikes = 0; // Still reset their strikes so it doesn't spam
                }
            }
            
            // Reset scores for all users in the server
            if (users[guildId]) {
                for (const uid in users[guildId]) {
                    users[guildId][uid].score = 0;
                }
            }
            
            saveUsers(users);

            // Remove all counting roles from every member
            removeAllCountingRoles(message.guild, servers[guildId]).catch(err =>
                console.error('Error removing counting roles on reset:', err)
            );

            return;
        }

        // 3. Number is correct!
        // Update server config
        serverConfig.currentCount = expectedNumber;
        serverConfig.lastUserId = message.author.id;
        
        if (!serverConfig.lastMessages) {
            serverConfig.lastMessages = {};
        }
        serverConfig.lastMessages[message.id] = expectedNumber;

        // Keep lastMessages size bounded (e.g., max 100 entries)
        const keys = Object.keys(serverConfig.lastMessages);
        if (keys.length > 100) {
            delete serverConfig.lastMessages[keys[0]];
        }

        saveServers(servers);
        
        // Update user score
        userData.score += 1;
        saveUsers(users);
        
        // Add tick reaction
        await message.react('✅').catch(() => {});

        // 4. Server Levels Check
        if (serverConfig.levels && serverConfig.levels[expectedNumber]) {
            const levelReached = serverConfig.levels[expectedNumber];
            const levelEmbed = new EmbedBuilder()
                .setTitle('🎉 Server Level Up! 🎉')
                .setColor('#ffd700') // Gold color
                .setDescription(`Woah! **${message.guild.name}** reached **Level ${levelReached}** by hitting ${expectedNumber} counts! Keep it up! 🚀`);
            
            await message.channel.send({ embeds: [levelEmbed] });
        }

        // 5. Role Management
        await manageRoles(message.guild, message.member, userData.score, message.channel, serverConfig.roles);
    }
};

async function manageRoles(guild, member, score, channel, serverRoles) {
    if (!member) return;

    const activeRoles = (serverRoles && serverRoles.length > 0) ? serverRoles : COUNTING_ROLES;

    // Determine target role based on score
    let targetRoleName = null;
    for (const roleDef of activeRoles) {
        if (score >= roleDef.threshold) {
            targetRoleName = roleDef.name;
            break; // Since array is sorted descending, first match is highest
        }
    }

    if (!targetRoleName) return;

    try {
        // Find the target role in the server, or create it if it doesn't exist
        let targetRole = guild.roles.cache.find(r => r.name === targetRoleName);
        if (!targetRole) {
            targetRole = await guild.roles.create({
                name: targetRoleName,
                reason: 'Auto-created for counting bot'
            });
        }

        // If the user already has this role, no need to do anything
        if (member.roles.cache.has(targetRole.id)) return;

        // User deserves the new role, but we need to remove older counting roles first
        const allCountingRoleNames = activeRoles.map(r => r.name);
        const rolesToRemove = member.roles.cache.filter(r => allCountingRoleNames.includes(r.name) && r.name !== targetRoleName);
        
        if (rolesToRemove.size > 0) {
            await member.roles.remove(rolesToRemove, 'Upgraded counting role');
        }

        await member.roles.add(targetRole, 'Reached new counting milestone');
        const grats = await channel.send(`🎉 <@${member.id}> has reached **${score}** counts and earned the **${targetRoleName}** role!`);
        // We can let the congratulation message stay or delete it after some time.
        // Let's keep it to celebrate.

    } catch (error) {
        console.error('Error managing roles:', error);
        // We could notify the channel, but it might get spammy.
    }
}

async function removeAllCountingRoles(guild, serverConfig) {
    const activeRoles = (serverConfig && serverConfig.roles && serverConfig.roles.length > 0)
        ? serverConfig.roles
        : COUNTING_ROLES;

    const countingRoleNames = activeRoles.map(r => r.name);
    const countingRoles = guild.roles.cache.filter(r => countingRoleNames.includes(r.name));
    if (countingRoles.size === 0) return;

    const users = getUsers();
    const serverUsers = users[guild.id] || {};
    const userIds = Object.keys(serverUsers);

    for (const userId of userIds) {
        try {
            let member = guild.members.cache.get(userId);
            if (!member) {
                member = await guild.members.fetch(userId);
            }
            if (member) {
                const rolesToRemove = member.roles.cache.filter(r => countingRoles.has(r.id));
                if (rolesToRemove.size > 0) {
                    await member.roles.remove(rolesToRemove, 'Counting reset — roles cleared').catch(err => {
                        console.error(`Failed to remove role from ${member.user.tag}:`, err.message);
                    });
                }
            }
        } catch (err) {
            if (err.code !== 10007) {
                console.error(`Failed to fetch member ${userId} for role removal:`, err.message);
            }
        }
        await new Promise(r => setTimeout(r, 50));
    }
}
