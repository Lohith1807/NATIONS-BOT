const { getServers, saveServers, getUsers, saveUsers } = require('../utils/dataManager');
const { EmbedBuilder } = require('discord.js');

const COUNTING_ROLES = [
    { threshold: 200, name: 'Region master' },
    { threshold: 150, name: 'master' },
    { threshold: 100, name: 'counting expert' },
    { threshold: 50, name: 'noobie' }
];

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        const guildId = message.guildId;
        if (!guildId) return;

        const servers = getServers();
        const serverConfig = servers[guildId];

        if (!serverConfig) return;
        if (message.channel.id !== serverConfig.channelId) return;

        // Ensure the message is actually a number
        const numberRegex = /^\d+$/;
        if (!numberRegex.test(message.content.trim())) {
            // If they type regular text, just ignore it and don't delete it
            return;
        }

        const inputNumber = parseInt(message.content.trim(), 10);
        const expectedNumber = serverConfig.currentCount + 1;
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
            await message.delete().catch(() => {});
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setDescription(`Noob The present count is **${serverConfig.currentCount}** next is **${expectedNumber}** you cant even see this , go get an eye operation`);
                
            const reply = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [errorEmbed] });
            setTimeout(() => reply.delete().catch(() => {}), 10000);
            
            // Handle strikes
            userData.strikes += 1;
            
            if (userData.strikes >= 5) {
                try {
                    // Mute for 2 minutes (120,000 ms)
                    const member = await message.guild.members.fetch(message.author.id);
                    await member.timeout(120000, '5 mistakes in counting channel');
                    const muteMsg = await message.channel.send(`<@${message.author.id}> has been muted for 2 minutes for failing to count 5 times.`);
                    setTimeout(() => muteMsg.delete().catch(() => {}), 10000);
                    userData.strikes = 0; // Reset after muting
                } catch (error) {
                    console.error('Failed to timeout member:', error);
                    const errorMsg = await message.channel.send(`Tried to mute <@${message.author.id}> but I lack permissions.`);
                    setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                }
            }
            
            saveUsers(users);
            return;
        }

        // 3. Number is correct!
        // Update server config
        serverConfig.currentCount = expectedNumber;
        serverConfig.lastUserId = message.author.id;
        saveServers(servers);
        
        // Update user score
        userData.score += 1;
        saveUsers(users);
        
        // Add tick reaction
        await message.react('✅').catch(() => {});

        // 4. Role Management
        await manageRoles(message.guild, message.member, userData.score, message.channel);
    }
};

async function manageRoles(guild, member, score, channel) {
    if (!member) return;

    // Determine target role based on score
    let targetRoleName = null;
    for (const roleDef of COUNTING_ROLES) {
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
        const allCountingRoleNames = COUNTING_ROLES.map(r => r.name);
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
