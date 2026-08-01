const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const { getWorkflow, listWorkflows } = require('../../utils/workflowManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-workflow')
        .setDescription('Manage staff workflows')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Show', value: 'show' },
                    { name: 'Add', value: 'add' },
                    { name: 'Update/delete', value: 'update_delete' }
                )
        ),
    async execute(interaction) {
        const action = interaction.options.getString('action');

        if (action !== 'show') {
            const adminRoles = process.env.ADMIN_ROLES_ID ? process.env.ADMIN_ROLES_ID.split(',') : [];
            const staffRoles = process.env.STAFF_ROLES_ID ? process.env.STAFF_ROLES_ID.split(',') : [];
            const allowedStaffRoles = staffRoles.slice(0, 2);
            
            const allowedRoles = [...adminRoles, ...allowedStaffRoles];
            
            const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
            if (!hasPermission) {
                return interaction.reply({ content: 'You do not have permission to use this action. Only Admins and specific Mod/Staff roles can add, edit, or delete.', ephemeral: true });
            }
        }

        if (action === 'add') {
            const modal = new ModalBuilder()
                .setCustomId(`workflow_modal:add`)
                .setTitle('Add Workflow');

            const roleInput = new TextInputBuilder()
                .setCustomId('role_name')
                .setLabel('Role Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., Trial Moderator')
                .setRequired(true);

            const workflowInput1 = new TextInputBuilder()
                .setCustomId('workflow_content_1')
                .setLabel('Workflow Part 1')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Point 1\nPoint 2\nPoint 3')
                .setRequired(true);

            const workflowInput2 = new TextInputBuilder()
                .setCustomId('workflow_content_2')
                .setLabel('Workflow Part 2 (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('If you need to expand different workflow in this role you can separate the texts here')
                .setRequired(false);

            const workflowInput3 = new TextInputBuilder()
                .setCustomId('workflow_content_3')
                .setLabel('Workflow Part 3 (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('If you need to expand different workflow in this role you can separate the texts here')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(roleInput),
                new ActionRowBuilder().addComponents(workflowInput1),
                new ActionRowBuilder().addComponents(workflowInput2),
                new ActionRowBuilder().addComponents(workflowInput3)
            );

            await interaction.showModal(modal);
        } else {
            // edit, show, delete use dropdowns
            const workflows = listWorkflows();
            if (workflows.length === 0) {
                return interaction.reply({ content: 'No workflows found. Please add one first.', ephemeral: true });
            }

            const options = workflows.map(w => ({
                label: w.length > 100 ? w.substring(0, 97) + '...' : w,
                value: w.length > 100 ? w.substring(0, 100) : w
            }));

            // Slice to 25 just in case (Discord limit for select menu options)
            const slicedOptions = options.slice(0, 25);

            const displayAction = action === 'update_delete' ? 'Update / Delete' : (action.charAt(0).toUpperCase() + action.slice(1));
            
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`workflow_${action}_select`)
                .setPlaceholder(`Select a workflow to ${displayAction.toLowerCase()}`)
                .addOptions(slicedOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`Select Workflow to ${displayAction}`)
                .setDescription(`Please select a workflow from the dropdown below to proceed with the **${displayAction}** action.`);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    }
};
