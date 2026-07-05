const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getServers } = require('../utils/dataManager');
const { DEFAULT_ROLES } = require('../events/messageCreate');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('counting_role')
        .setDescription('Manage custom counting roles for this server')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'show', value: 'show' },
                    { name: 'create', value: 'create' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const action = interaction.options.getString('action');
        const guildId = interaction.guildId;
        const servers = getServers();
        
        if (action === 'show') {
            const serverConfig = servers[guildId];
            let activeRoles = [];
            let isDefault = false;
            
            if (serverConfig && serverConfig.roles && serverConfig.roles.length > 0) {
                activeRoles = serverConfig.roles;
            } else {
                activeRoles = DEFAULT_ROLES;
                isDefault = true;
            }
            
            let description = '';
            for (const role of activeRoles) {
                description += `**Count ${role.threshold}:** ${role.name}\n`;
            }
            
            const embed = new EmbedBuilder()
                .setTitle(isDefault ? 'Default Counting Roles' : 'Custom Counting Roles')
                .setColor('#0099ff')
                .setDescription(description)
                .setFooter(isDefault ? { text: 'You can use /counting_role action:create to set custom roles.' } : null);
                
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (action === 'create') {
            const modal = new ModalBuilder()
                .setCustomId('createCountingRoleModal')
                .setTitle('Create Counting Role');
                
            const roleNameInput = new TextInputBuilder()
                .setCustomId('roleNameInput')
                .setLabel('Role Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
                
            const countInput = new TextInputBuilder()
                .setCustomId('countInput')
                .setLabel('Count Threshold')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
                
            const firstActionRow = new ActionRowBuilder().addComponents(roleNameInput);
            const secondActionRow = new ActionRowBuilder().addComponents(countInput);
            
            modal.addComponents(firstActionRow, secondActionRow);
            
            await interaction.showModal(modal);
        }
    },
};
