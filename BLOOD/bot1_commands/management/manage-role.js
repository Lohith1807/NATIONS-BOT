const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const { isStaffOrAdmin } = require('../../utils/data.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Add or remove multiple roles from a user (Staff/Admin only)')
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add',    value: 'add'    },
                    { name: 'Remove', value: 'remove' }
                )
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to add/remove the roles from')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role1')
                .setDescription('The first role to add or remove')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role2')
                .setDescription('An additional role to add or remove')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName('role3')
                .setDescription('An additional role to add or remove')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName('role4')
                .setDescription('An additional role to add or remove')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName('role5')
                .setDescription('An additional role to add or remove')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // ─── Emoji shortcuts (from botemoji.js) ───────────────────────
            const tick   = getEmoji('gtick');
            const star   = getEmoji('bluestar');
            const shield = getEmoji('sheild');
            const crown  = getEmoji('crown');
            const arrowE = getEmoji('arrow');
            const heartE = getEmoji('heart');
            const bluex  = getEmoji('bluex');
            const blood  = getEmoji('blood');
            const yarrow = getEmoji('yarrow');

            // ── Permission Check: Staff or Admin only ──────────────────────
            if (!isStaffOrAdmin(interaction.member)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription(
                                `${bluex} **You don't have permission to use this command.**\n` +
                                `${yarrow} Only **Staff** and **Admin** members can use \`/role\`.`
                            )
                    ],
                    ephemeral: true
                });
            }

            // ── Fetch inputs ───────────────────────────────────────────────
            const action     = interaction.options.getString('action');   // 'add' | 'remove'
            const targetUser = interaction.options.getUser('user');
            
            // Gather all roles provided
            const roles = [];
            for (let i = 1; i <= 5; i++) {
                const r = interaction.options.getRole(`role${i}`);
                if (r) roles.push(r);
            }

            // Remove duplicates if any
            const uniqueRoles = [...new Map(roles.map(item => [item.id, item])).values()];

            // ── Fetch the guild member ─────────────────────────────────────
            const targetMember = await interaction.guild.members
                .fetch(targetUser.id)
                .catch(() => null);

            if (!targetMember) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription(`${bluex} Could not find **${targetUser.tag}** in this server.`)
                    ],
                    ephemeral: true
                });
            }

            const botMember = await interaction.guild.members.fetchMe();
            
            let successfulRoles = [];
            let failedRoles = [];

            // ── Process each role ──────────────────────────────────────────
            for (const targetRole of uniqueRoles) {
                // ── Bot role hierarchy check ───────────────────────────────
                if (targetRole.position >= botMember.roles.highest.position) {
                    failedRoles.push(`${targetRole} (Higher than bot's role)`);
                    continue;
                }

                if (action === 'add') {
                    if (targetMember.roles.cache.has(targetRole.id)) {
                        failedRoles.push(`${targetRole} (Already has role)`);
                    } else {
                        try {
                            await targetMember.roles.add(targetRole, `Role added by ${interaction.user.tag}`);
                            successfulRoles.push(targetRole);
                        } catch (e) {
                            failedRoles.push(`${targetRole} (API Error)`);
                        }
                    }
                } else if (action === 'remove') {
                    if (!targetMember.roles.cache.has(targetRole.id)) {
                        failedRoles.push(`${targetRole} (Does not have role)`);
                    } else {
                        try {
                            await targetMember.roles.remove(targetRole, `Role removed by ${interaction.user.tag}`);
                            successfulRoles.push(targetRole);
                        } catch (e) {
                            failedRoles.push(`${targetRole} (API Error)`);
                        }
                    }
                }
            }

            // ── Build Response ─────────────────────────────────────────────
            
            // If completely failed (no roles succeeded)
            if (successfulRoles.length === 0) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf39c12)
                            .setDescription(
                                `${star} No roles were modified for ${targetUser}.\n\n` +
                                `**Reasons:**\n${failedRoles.map(f => `${arrowE} ${f}`).join('\n')}`
                            )
                    ],
                    ephemeral: true
                });
            }
            
            // Helper to clean current name
            const getCleanName = (member) => {
                const currentNickname = member.nickname || member.user.username;
                if (currentNickname.includes("BLOOD |")) {
                    const parts = currentNickname.split("BLOOD |");
                    return parts[parts.length - 1].trim();
                }
                return currentNickname.trim();
            };

            const staffPrefixMap = {
                "1153997630112792577": "Admn",
                "1420626301328297984": "Co-Admn",
                "1513940638909988874": "Mod",
                "1513942017196167389": "T-Mod",
                "1154276716982833154": "Exe",
                "1480823475525517415": "HR",
                "1448265928503726161": "CWL",
                "1514535148119392377": "W-Exe"
            };

            const oldNickname = targetMember.nickname || targetMember.user.username;

            // Fetch the updated member to get their new roles list
            const updatedMember = await interaction.guild.members.fetch(targetUser.id).catch(() => targetMember);
            const cleanName = getCleanName(updatedMember);

            const targetMemberRoles = updatedMember.roles.cache.filter(role => staffPrefixMap[role.id]);
            let highestStaffRole = null;
            if (targetMemberRoles.size > 0) {
                highestStaffRole = targetMemberRoles.reduce((highest, current) => 
                    current.position > (highest?.position || 0) ? current : highest
                );
            }
            const staffPrefix = highestStaffRole ? staffPrefixMap[highestStaffRole.id] : null;

            // T-Mod gets NICKNAME in all-caps: T-Mod • BLOOD | NICKNAME
            const formattedName = highestStaffRole?.id === "1513942017196167389"
                ? cleanName.toUpperCase()
                : cleanName;

            const newNickname = staffPrefix 
                ? `${staffPrefix} • BLOOD | ${formattedName}` 
                : `BLOOD | ${formattedName}`;

            let nicknameUpdated = false;
            if (oldNickname !== newNickname) {
                try {
                    await updatedMember.setNickname(newNickname);
                    nicknameUpdated = true;
                } catch (err) {
                    console.error("Failed to update nickname in role command:", err.message);
                }
            }

            const nickChangeStr = oldNickname !== newNickname && nicknameUpdated
                ? `\`${oldNickname}\` ➔ \`${newNickname}\``
                : `\`${newNickname}\``;

            const rolesListStr = successfulRoles.map(r => r.toString()).join(', ');
            
            if (action === 'add') {
                const addEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle(`${tick} Roles Added Successfully`)
                    .setDescription(
                        `${star} **${targetMember.displayName}** has been granted new roles!\n` +
                        `${arrowE} ${heartE} Welcome to **${rolesListStr}** ${shield}`
                    )
                    .addFields(
                        { name: `${crown} Member`,      value: `${targetUser}`,       inline: true },
                        { name: `${shield} Roles`,      value: `${rolesListStr}`,       inline: true },
                        { name: `${star} Assigned by`,  value: `${interaction.user}`, inline: true },
                        { name: `📝 Nickname`,          value: nickChangeStr,           inline: false }
                    )
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({
                        text: `🩸 Blood Alliance • Role Management`,
                        iconURL: interaction.guild.iconURL({ dynamic: true })
                    })
                    .setTimestamp();
                    
                if (failedRoles.length > 0) {
                    addEmbed.addFields({ 
                        name: `${bluex} Failed to add`, 
                        value: failedRoles.map(f => `${arrowE} ${f}`).join('\n'), 
                        inline: false 
                    });
                }

                return interaction.reply({
                    embeds: [addEmbed]
                });
                
            } else if (action === 'remove') {
                const removeEmbed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle(`${bluex} Roles Removed`)
                    .setDescription(
                        `${arrowE} The following roles have been removed from **${targetMember.displayName}**: **${rolesListStr}**.`
                    )
                    .addFields(
                        { name: `${crown} Member`,     value: `${targetUser}`,       inline: true },
                        { name: `${shield} Roles`,     value: `${rolesListStr}`,       inline: true },
                        { name: `${star} Removed by`,  value: `${interaction.user}`, inline: true },
                        { name: `📝 Nickname`,         value: nickChangeStr,           inline: false }
                    )
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({
                        text: `🩸 Blood Alliance • Role Management`,
                        iconURL: interaction.guild.iconURL({ dynamic: true })
                    })
                    .setTimestamp();
                    
                if (failedRoles.length > 0) {
                    removeEmbed.addFields({ 
                        name: `⚠️ Failed to remove`, 
                        value: failedRoles.map(f => `${arrowE} ${f}`).join('\n'), 
                        inline: false 
                    });
                }

                return interaction.reply({
                    embeds: [removeEmbed]
                });
            }

        } catch (error) {
            console.error('❌ [Bot1] Error in /role command:', error);
            try {
                const errReply = {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription('❌ An unexpected error occurred while executing this command.')
                    ],
                    ephemeral: true
                };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errReply);
                } else {
                    await interaction.reply(errReply);
                }
            } catch (e) {}
        }
    }
};
