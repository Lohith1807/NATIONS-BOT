const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-works')
        .setDescription('View the responsibilities and guidelines for various staff roles')
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Select the staff role to view')
                .setRequired(true)
                .addChoices(
                    { name: 'Server Moderator', value: 'mod' },
                    { name: 'Executive Staff', value: 'exec' },
                    { name: 'Server HR', value: 'hr' },
                    { name: 'CWL Staff', value: 'cwl' },
                    { name: 'Welcomer & Assistance Executive', value: 'welcomer' }
                )
        ),

    async execute(interaction) {
        const role = interaction.options.getString('role');
        let title = '';
        let description = '';
        let color = '#2b2d31'; 

        switch (role) {
            case 'mod':
                title = `${getEmoji('crown')} Server Moderator Responsibilities`;
                color = '#ffaa00'; 
                description = `
${getEmoji('parrow')} **Sync Verification:** Check Sync message; ensure users have chosen options. If not, tag them and ask them to choose.
${getEmoji('rarroww')} **Monitoring:** Monitor text chats and voice channels actively.
${getEmoji('yarrow')} **Discipline:** Warn or mute rule breakers promptly.
${getEmoji('rarrow')} **Enforcement:** Kick or ban users when necessary (requires admin perms).
${getEmoji('parrow')} **Conflict Resolution:** Resolve member disputes peacefully.
${getEmoji('rarroww')} **Escalation:** Report serious issues directly to admins.
${getEmoji('yarrow')} **Leadership:** Supervise the moderator team and handle complex situations.
${getEmoji('rarroww')} **Training:** Train new staff members.
${getEmoji('parrow')} **Assistance:** Assist admins with staff management.`;
                break;
            case 'exec':
                title = `${getEmoji('bluestar')} Executive Staff Responsibilities`;
                color = '#00aaff'; 
                description = `
${getEmoji('parrow')} **Player Tickets:** If a player needs a clan, check clan needs using \`;compo all\` in the staff bot room. Guide them to a suitable clan. Ask them to follow the steps and link their account to Clash King bot using \`/link\`. After review, use \`/approve\` or \`/decline\`.

${getEmoji('rarroww')} **Alliance & Rep Tickets:** For clans wanting to join the alliance or users applying for Rep, ask them to follow the required steps and tag admins.

${getEmoji('yarrow')} **Help & Query Tickets:** Ask about their problem and try to solve it. If unable to help, tag a Server Moderator or Admin.

${getEmoji('rarroww')} **Staff & Rep Applications:** Ensure applicants have filled all details completely, then ping an Admin.`;
                break;
            case 'hr':
                title = `${getEmoji('mem')} Server HR Responsibilities`;
                color = '#ff55ff'; 
                description = `
${getEmoji('parrow')} **Recruitment:** Actively recruit new players to join our alliance.
${getEmoji('rarroww')} **Promotion:** Keep an eye out for loyal and active members to recommend for staff positions.`;
                break;
            case 'cwl':
                title = `${getEmoji('cwl')} CWL Staff Responsibilities`;
                color = '#ff5555'; 
                description = `
${getEmoji('yarrow')} **Management:** Efficiently manage the CWL (Clan War Leagues) events and rosters.
${getEmoji('rarroww')} **Rotation:** Assist with clan rotation when requested to ensure smooth operations.`;
                break;
            case 'welcomer':
                title = `${getEmoji('heart')} Welcomer & Assistance Exec Responsibilities`;
                color = '#55ff55'; 
                description = `
${getEmoji('parrow')} **Welcoming:** Warmly welcome new members in the welcome channel.
${getEmoji('rarroww')} **Assistance:** Provide guidance and help in the assistance channels as soon as new members are added.`;
                break;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: 'Nations Alliance Staff Guidelines', iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
