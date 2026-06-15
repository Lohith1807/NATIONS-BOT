const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getHelpData, saveHelpData, isStaffOrAdmin } = require('../../utils/data.js');
const { getEmoji } = require('../../utils/botemoji.js');

function formatHelpText(text) {
    if (!text) return "";
    return text
        .replace(/🔹|⚪|•/g, getEmoji("pinkdot"))
        .replace(/arrow|->|=>|➡️|👉|▶️/g, getEmoji("arrow"))
        .replace(/✅|🟢/g, getEmoji("gtick"))
        .replace(/❌|🚫|👢/g, getEmoji("bluex"))
        .replace(/⚠️|⚙️|🔇|🔔|📣|📢/g, getEmoji("alaram"))
        .replace(/🛡️|🔒/g, getEmoji("sheild"))
        .replace(/🏆/g, getEmoji("cwl"))
        .replace(/🏯/g, getEmoji("clancastle"))
        .replace(/⚔️/g, getEmoji("cocfight"))
        .replace(/👤|🧑/g, getEmoji("mem"))
        .replace(/🩸/g, getEmoji("blood"))
        .replace(/❤️/g, getEmoji("heart"))
        .replace(/📖|📚|📋|🗂️|🔍|📄|🏷️|🔢|🎫|🟫/g, getEmoji("book"))
        .replace(/🔗/g, getEmoji("chain"))
        .replace(/🔄|♻️/g, getEmoji("refresh"))
        .replace(/⚖️|🏋️|📊/g, getEmoji("graph"));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get information or add help records')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get information about bot commands')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The command name to get help for')
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add or update a command in the help records (Staff Only)')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The command name to add/update')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('syntax')
                        .setDescription('The syntax of the command (e.g. ;link #TAG)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('use')
                        .setDescription('A brief explanation of what the command does')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('permission')
                        .setDescription('Who can use this command (e.g. Staff/Admin or Everyone)')
                        .addChoices(
                            { name: 'Everyone', value: 'Everyone' },
                            { name: 'Staff', value: 'Staff' },
                            { name: 'Admin', value: 'Admin' }
                        )
                        .setRequired(true)
                )
        ),

    async autocomplete(interaction) {
        const helpData = getHelpData();
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        const choices = [
            'webpage',
            'strike',
            ...Object.keys(helpData.commands || {})
        ];

        const filtered = choices
            .filter(choice => choice.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(interaction) {
        const helpData = getHelpData();
        const subcommand = interaction.options.getSubcommand();

        // --- SUBCOMMAND: INFO ---
        if (subcommand === 'info') {
            const commandName = interaction.options.getString('command').toLowerCase();
            const embed = new EmbedBuilder().setColor(0x3498DB);

            if (commandName === 'webpage') {
                const data = helpData.webpage;
                if (!data) return interaction.reply({ content: `${getEmoji("bluex")} Webpage help data missing.`, ephemeral: true });
                
                const dotEmoji = getEmoji("pinkdot");
                
                const commandsList = data.fields.map(f => {
                    const cleanName = f.name.replace(/🔹|⚪|•/g, '').trim();
                    const cleanVal = f.value.replace(/🔹|⚪|•|🟫/g, '').replace(/arrow|->|=>/g, '→').trim();
                    return `${dotEmoji} **\`/${cleanName}\`**\n└ ${cleanVal} (\`${f.permission || "Staff"}\`)`;
                }).join('\n\n');

                embed.setTitle(formatHelpText(data.title))
                    .setDescription(`${formatHelpText(data.description)}\n\n${commandsList}`)
                    .setFooter({ text: 'Webpage Management' });
                return interaction.reply({ embeds: [embed] });
            }

            if (commandName === 'strike') {
                const data = helpData.strike;
                if (!data) return interaction.reply({ content: `${getEmoji("bluex")} Strike help data missing.`, ephemeral: true });
                
                const dotEmoji = getEmoji("pinkdot");

                const sectionsList = data.sections.map(s => {
                    const cleanName = s.name.replace(/🔹|⚪|•/g, '').trim();
                    const cleanVal = s.value.replace(/🔹|⚪|•|🟫/g, '').replace(/arrow|->|=>/g, '→').trim();
                    return `${dotEmoji} **${cleanName}**\n└ ${cleanVal} (\`${s.permission || "Mixed"}\`)`;
                }).join('\n\n');

                embed.setTitle(formatHelpText(data.title))
                    .setDescription(`${formatHelpText(data.description)}\n\n${sectionsList}`)
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Strike System' });
                return interaction.reply({ embeds: [embed] });
            }

            const cmd = helpData.commands ? helpData.commands[commandName] : null;
            if (cmd) {
                const titleEmoji = getEmoji("book");
                const dotEmoji = getEmoji("pinkdot");

                embed.setTitle(`${titleEmoji} Command: \`/${commandName}\``)
                    .setDescription(
                        `${dotEmoji} **Description:** ${formatHelpText(cmd.use)}\n` +
                        `${dotEmoji} **Syntax:** \`${cmd.syntax}\`\n` +
                        `${dotEmoji} **Permission:** \`${cmd.permission || "Everyone"}\``
                    );
                return interaction.reply({ embeds: [embed] });
            }

            return interaction.reply({ content: `${getEmoji("bluex")} Command \`${commandName}\` not found.`, ephemeral: true });
        }

        // --- SUBCOMMAND: ADD ---
        if (subcommand === 'add') {
            if (!isStaffOrAdmin(interaction.member)) {
                return interaction.reply({ content: `${getEmoji("bluex")} You do not have permission to manage help records.`, ephemeral: true });
            }

            const commandName = interaction.options.getString('command').toLowerCase();
            const syntax = interaction.options.getString('syntax');
            const use = interaction.options.getString('use');
            const permission = interaction.options.getString('permission');

            if (!helpData.commands) helpData.commands = {};
            helpData.commands[commandName] = { syntax, use, permission };

            try {
                saveHelpData(helpData);
                const embed = new EmbedBuilder()
                    .setTitle(`${getEmoji("gtick")} Help Record Updated`)
                    .setColor(0x2ECC71)
                    .setDescription(
                        `${getEmoji("pinkdot")} **Command:** \`${commandName}\`\n` +
                        `${getEmoji("pinkdot")} **Syntax:** \`${syntax}\`\n` +
                        `${getEmoji("pinkdot")} **Permission:** \`${permission}\`\n` +
                        `${getEmoji("pinkdot")} **Description:** ${use}`
                    )
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            } catch (err) {
                return interaction.reply({ content: `${getEmoji("bluex")} Failed to save help data.`, ephemeral: true });
            }
        }
    }
};
