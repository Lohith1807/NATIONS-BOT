const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setInviteLogChannel, disableInviteLog, invitesCache } = require('../../utils/inviteManager.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite-tracker')
        .setDescription('Manage the invite tracker for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Start or stop tracking invites')
                .setRequired(true)
                .addChoices(
                    { name: 'start', value: 'start' },
                    { name: 'stop', value: 'stop' }
                )
        ),
    
    async execute(interaction) {
        const action = interaction.options.getString('action');

        if (action === 'start') {
            await interaction.deferReply({ ephemeral: true });

            const channelId = interaction.channelId;
            setInviteLogChannel(interaction.guildId, channelId);

            // Pre-cache the invites for this guild since tracking was just started
            try {
                const { fetchInviteSnapshot } = require('../../utils/inviteManager.js');
                const snapshot = await fetchInviteSnapshot(interaction.guild);
                invitesCache.set(interaction.guildId, snapshot);
                
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle(`${getEmoji('gtick')} Invite Tracker Enabled`)
                    .setDescription(`Invite tracker has been **started**. Logs will be sent to <#${channelId}>.`)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                console.error('Failed to fetch invites:', err);
                await interaction.editReply({ content: `${getEmoji('bluex')} Failed to enable invite tracker. Please ensure the bot has the "Manage Server" permission and the Server Invites Intent is enabled in the Developer Portal.` });
            }
        } else if (action === 'stop') {
            disableInviteLog(interaction.guildId);
            invitesCache.delete(interaction.guildId);

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${getEmoji('bluex')} Invite Tracker Disabled`)
                .setDescription('Invite tracker has been **stopped** for this server.')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
