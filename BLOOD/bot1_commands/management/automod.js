const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ChannelType, 
    ComponentType 
} = require('discord.js');
const { 
    getAutomodConfig, 
    setAutomodLogChannel, 
    setAutomodEnabled, 
    setMuteDuration, 
    addBlockedWord, 
    removeBlockedWord, 
    getBlockedWords 
} = require('../../utils/automodManager.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Server-wide word automod and anti-evasion protection')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a forbidden word to the filter (e.g. dalal)')
                .addStringOption(opt =>
                    opt.setName('word')
                        .setDescription('The word to block')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a forbidden word from the filter')
                .addStringOption(opt =>
                    opt.setName('word')
                        .setDescription('The word to unblock')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all currently blocked words')
        )
        .addSubcommand(sub =>
            sub.setName('configure')
                .setDescription('Configure automod settings (log channel, mute duration, status)')
                .addChannelOption(opt =>
                    opt.setName('log_channel')
                        .setDescription('The channel where automod violation logs will be sent')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addIntegerOption(opt =>
                    opt.setName('duration')
                        .setDescription('Mute duration in minutes (default is 15 minutes)')
                        .setMinValue(1)
                        .setMaxValue(40320)
                        .setRequired(false)
                )
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Enable or disable automod server-wide')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // 1. ADD
        if (subcommand === 'add') {
            const word = interaction.options.getString('word');
            const added = addBlockedWord(guildId, word);

            const embed = new EmbedBuilder()
                .setColor(added ? '#2ECC71' : '#F39C12')
                .setTitle(added ? `${getEmoji('gtick') || '✅'} Word Added` : '⚠️ Word Already Blocked')
                .setDescription(added 
                    ? `\`${word.toLowerCase()}\` has been added to the automod filter.\n\nAll variations, leetspeak (e.g. \`d@l@l\`, \`d4l4l\`), multiline formats, symbol separators (\`d.a.l.a.l\`), and split multi-message attempts will be blocked and punished with a **15-minute mute** across **all channels**.`
                    : `\`${word.toLowerCase()}\` is already in the blocked words list.`
                )
                .setFooter({ text: 'Blood Alliance Automod' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // 2. REMOVE
        if (subcommand === 'remove') {
            const word = interaction.options.getString('word');
            const removed = removeBlockedWord(guildId, word);

            const embed = new EmbedBuilder()
                .setColor(removed ? '#2ECC71' : '#E74C3C')
                .setTitle(removed ? `${getEmoji('gtick') || '✅'} Word Removed` : `${getEmoji('bluex') || '❌'} Word Not Found`)
                .setDescription(removed 
                    ? `\`${word.toLowerCase()}\` has been removed from the blocked words list.`
                    : `\`${word.toLowerCase()}\` was not found in the blocked words list.`
                )
                .setFooter({ text: 'Blood Alliance Automod' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // 3. LIST
        if (subcommand === 'list') {
            const blockedWords = getBlockedWords(guildId);

            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`📋 Prohibited Words (${blockedWords.length})`)
                .setDescription(blockedWords.length > 0 
                    ? blockedWords.map((w, idx) => `**${idx + 1}.** \`${w}\``).join('\n')
                    : '*No words are currently blocked.*'
                )
                .addFields({
                    name: '🛡️ Scope & Features',
                    value: '• **Scope:** Active on **all channels** in the server\n• **Anti-Bypass:** Catches leetspeak (`d@l@l`, `d4l4l`), multiline (`d\\na\\nl\\na\\nl`), symbols (`d.a.l.a.l`, `d_a_l_a_l`), and multi-message split attempts\n• **Action:** Deletes messages & mutes user for 15 minutes'
                })
                .setFooter({ text: 'Blood Alliance Automod' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // 4. CONFIGURE
        if (subcommand === 'configure') {
            const logChannel = interaction.options.getChannel('log_channel');
            const duration = interaction.options.getInteger('duration');
            const enabled = interaction.options.getBoolean('enabled');

            let changed = false;
            const changes = [];

            if (logChannel !== null) {
                setAutomodLogChannel(guildId, logChannel.id);
                changes.push(`• **Log Channel:** <#${logChannel.id}>`);
                changed = true;
            }

            if (duration !== null) {
                setMuteDuration(guildId, duration);
                changes.push(`• **Mute Duration:** **${duration}** minutes`);
                changed = true;
            }

            if (enabled !== null) {
                setAutomodEnabled(guildId, enabled);
                changes.push(`• **Status:** ${enabled ? '**Enabled**' : '**Disabled**'}`);
                changed = true;
            }

            const currentConfig = getAutomodConfig(guildId);
            const blockedWords = getBlockedWords(guildId);

            // If user did not pass any options, show interactive menu to pick channel
            if (!changed && !currentConfig.logChannelId) {
                const channelRow = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('automod_configure_channel')
                        .setPlaceholder('Select the Automod Log Channel')
                        .setChannelTypes(ChannelType.GuildText)
                );

                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🛠️ Configure Automod')
                    .setDescription('Please select the **Log Channel** from the dropdown below where automod reports and mute notices will be sent.')
                    .addFields(
                        { name: 'Scope', value: 'Active on **All Channels**', inline: true },
                        { name: 'Mute Duration', value: `**${currentConfig.muteDurationMinutes || 15}** minutes`, inline: true },
                        { name: 'Blocked Words', value: `**${blockedWords.length}** words`, inline: true }
                    );

                const response = await interaction.reply({
                    embeds: [embed],
                    components: [channelRow],
                    ephemeral: true
                });

                const collector = response.createMessageComponentCollector({
                    componentType: ComponentType.ChannelSelect,
                    time: 60000
                });

                collector.on('collect', async i => {
                    if (i.customId === 'automod_configure_channel') {
                        const selectedChannelId = i.values[0];
                        setAutomodLogChannel(interaction.guildId, selectedChannelId);

                        const successEmbed = new EmbedBuilder()
                            .setColor('#2ECC71')
                            .setTitle(`${getEmoji('gtick') || '✅'} Automod Configured`)
                            .setDescription(`Automod log channel set to <#${selectedChannelId}>.\n\nAutomod is **active server-wide across all channels**. Any user sending blocked words or evasive patterns will be muted for **${currentConfig.muteDurationMinutes || 15} minutes** and logs will be posted to <#${selectedChannelId}>.`)
                            .setTimestamp();

                        await i.update({ embeds: [successEmbed], components: [] });
                    }
                });
                return;
            }

            // Display configuration summary
            const embed = new EmbedBuilder()
                .setColor(currentConfig.enabled ? '#2ECC71' : '#E74C3C')
                .setTitle(`🛠️ Automod Settings`)
                .setDescription(changed 
                    ? `**Settings updated successfully:**\n${changes.join('\n')}` 
                    : `Current automod configuration for **${interaction.guild.name}**:`
                )
                .addFields(
                    { 
                        name: 'Status', 
                        value: currentConfig.enabled ? `${getEmoji('gtick') || '✅'} **Enabled**` : `${getEmoji('bluex') || '❌'} **Disabled**`, 
                        inline: true 
                    },
                    { 
                        name: 'Log Channel', 
                        value: currentConfig.logChannelId ? `<#${currentConfig.logChannelId}> (\`${currentConfig.logChannelId}\`)` : '*Not Set (logs disabled)*', 
                        inline: true 
                    },
                    { 
                        name: 'Mute Duration', 
                        value: `**${currentConfig.muteDurationMinutes || 15}** minutes`, 
                        inline: true 
                    },
                    {
                        name: 'Monitored Channels',
                        value: '🌐 **All Channels Server-Wide**',
                        inline: true
                    },
                    { 
                        name: `Blocked Words (${blockedWords.length})`, 
                        value: blockedWords.length > 0 ? blockedWords.map(w => `\`${w}\``).join(', ') : '*None*', 
                        inline: false 
                    }
                )
                .setFooter({ text: 'Blood Alliance Automod' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
