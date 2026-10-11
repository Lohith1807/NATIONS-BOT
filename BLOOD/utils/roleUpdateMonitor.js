const { EmbedBuilder, AuditLogEvent } = require('discord.js');

function setupRoleUpdateMonitor(bot) {
    bot.on('roleUpdate', async (oldRole, newRole) => {
        // Only care if permissions changed
        if (oldRole.permissions.bitfield === newRole.permissions.bitfield) return;

        try {
            const oldPerms = oldRole.permissions.toArray();
            const newPerms = newRole.permissions.toArray();

            const addedPerms = newPerms.filter(p => !oldPerms.includes(p));
            const removedPerms = oldPerms.filter(p => !newPerms.includes(p));

            if (addedPerms.length === 0 && removedPerms.length === 0) return;

            // Fetch audit logs to find who did it
            let executor = "Unknown";
            try {
                const auditLogs = await newRole.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.RoleUpdate
                });
                const roleLog = auditLogs.entries.first();
                
                // Check if the log is recent and matches our role
                if (roleLog && roleLog.target.id === newRole.id && roleLog.createdTimestamp > (Date.now() - 5000)) {
                    executor = `<@${roleLog.executor.id}> (${roleLog.executor.tag})`;
                }
            } catch (err) {
                console.error("Failed to fetch audit logs for roleUpdate:", err);
            }

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('⚠️ Role Permissions Changed')
                .setDescription(`**Role:** <@&${newRole.id}> (${newRole.name})\n**Changed By:** ${executor}`)
                .setTimestamp();

            if (addedPerms.length > 0) {
                embed.addFields({ name: '✅ Added Permissions', value: `\`\`\`\n${addedPerms.join(', ')}\n\`\`\``, inline: false });
            }
            if (removedPerms.length > 0) {
                embed.addFields({ name: '❌ Removed Permissions', value: `\`\`\`\n${removedPerms.join(', ')}\n\`\`\``, inline: false });
            }

            // Send to specific user
            const targetUserId = '1393061101838532630';
            try {
                const user = await bot.users.fetch(targetUserId);
                if (user) {
                    await user.send({ content: `<@${targetUserId}>`, embeds: [embed] });
                }
            } catch (err) {
                console.error(`Failed to DM user ${targetUserId}:`, err);
            }

        } catch (err) {
            console.error("Error in roleUpdate event:", err);
        }
    });
}

module.exports = { setupRoleUpdateMonitor };
