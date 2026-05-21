const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
                            { name: 'Staff/Admin', value: 'Staff/Admin' }
                        )
                        .setRequired(true)
                )
        ),

    async autocomplete(interaction, context) {
        const { data: dataManager } = context;
        const helpData = dataManager.getHelpData();
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        const choices = [
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

    async execute(interaction, context) {
        const { data: dataManager, config } = context;
        const helpData = dataManager.getHelpData();
        const subcommand = interaction.options.getSubcommand();

        // --- SUBCOMMAND: INFO ---
        if (subcommand === 'info') {
            const commandName = interaction.options.getString('command').toLowerCase();
            const embed = new EmbedBuilder().setColor(0x3498DB);

            if (commandName === 'strike') {
                const data = helpData.strike;
                if (!data) return interaction.reply({ content: "❌ Strike help data missing.", ephemeral: true });
                
                const sections = data.sections.map(s => ({
                    name: s.name,
                    value: `${s.value}\n${s.permission || "👤 Mixed"}`
                }));

                embed.setTitle(data.title)
                    .setDescription(data.description)
                    .addFields(sections)
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Strike System' });
                return interaction.reply({ embeds: [embed] });
            }

            const cmd = helpData.commands ? helpData.commands[commandName] : null;
            if (cmd) {
                embed.setTitle(`📖 Help: ${commandName}`)
                    .addFields(
                        { name: '🔹 Command Name', value: `\`${commandName}\``, inline: true },
                        { name: '🟫 Syntax', value: `\`${cmd.syntax}\``, inline: true },
                        { name: '👤 Permission', value: cmd.permission || "Everyone", inline: true },
                        { name: '⚪ Use', value: cmd.use }
                    );
                return interaction.reply({ embeds: [embed] });
            }

            return interaction.reply({ content: `❌ Command \`${commandName}\` not found.`, ephemeral: true });
        }

        // --- SUBCOMMAND: ADD ---
        if (subcommand === 'add') {
            const ALLOWED_ROLES = [...config.ADMIN_ROLE_IDS, ...config.STAFF_ROLE_IDS].filter(id => id.trim() !== "");
            if (!interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id))) {
                return interaction.reply({ content: "❌ You do not have permission to manage help records.", ephemeral: true });
            }

            const commandName = interaction.options.getString('command').toLowerCase();
            const syntax = interaction.options.getString('syntax');
            const use = interaction.options.getString('use');
            const permission = interaction.options.getString('permission');

            if (!helpData.commands) helpData.commands = {};
            helpData.commands[commandName] = { syntax, use, permission };

            try {
                dataManager.saveHelpData(helpData);
                const embed = new EmbedBuilder()
                    .setTitle("✅ Help Record Updated")
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: "🔹 Command", value: `\`${commandName}\``, inline: true },
                        { name: "🟫 Syntax", value: `\`${syntax}\``, inline: true },
                        { name: "👤 Permission", value: permission, inline: true },
                        { name: "⚪ Use", value: use }
                    )
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            } catch (err) {
                return interaction.reply({ content: "❌ Failed to save help data.", ephemeral: true });
            }
        }
    }
};
