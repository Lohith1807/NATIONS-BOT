const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType } = require('discord.js');
const { setSoftbanConfig, disableSoftban } = require('../../utils/softbanManager.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soft-ban')
        .setDescription('Manage the soft-ban honeypot for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Turn soft-ban on or off')
                .setRequired(true)
                .addChoices(
                    { name: 'on', value: 'on' },
                    { name: 'off', value: 'off' }
                )
        )
        .addChannelOption(option =>
            option.setName('honeypot_channel')
                .setDescription('The channel to use as the honeypot (Required if action is on)')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('log_channel')
                .setDescription('The channel to send soft-ban logs to (Required if action is on)')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        const action = interaction.options.getString('action');

        const sendHoneypotWarning = async (channelId) => {
            try {
                const channel = interaction.guild.channels.cache.get(channelId);
                if (channel) {
                    const warningEmbed = new EmbedBuilder()
                        .setColor('#000000')
                        .setTitle('DO NOT SEND MESSAGES IN THIS CHANNEL 🍯')
                        .setDescription('This channel is used to catch spam bots. Any messages sent here will result in a **softban**.\n\nNormal community members do not need to interact with this channel in any way.\nIf you do not wish to see this channel, you may right click or long press the channel and select "Hide from Channel List."\n\nIf you pressure or trick people into sending messages here, you will also be muted, kicked or banned.');
                    await channel.send({ embeds: [warningEmbed] });
                }
            } catch (e) {
                console.error("Failed to send honeypot warning embed", e);
            }
        };

        if (action === 'on') {
            const honeypotChannel = interaction.options.getChannel('honeypot_channel');
            const logChannel = interaction.options.getChannel('log_channel');

            if (!honeypotChannel || !logChannel) {
                // Interactive Setup
                const honeypotRow = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('softban_setup_honeypot')
                        .setPlaceholder('Select the Honeypot Channel')
                        .setChannelTypes(ChannelType.GuildText)
                );

                const logRow = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('softban_setup_log')
                        .setPlaceholder('Select the Log Channel')
                        .setChannelTypes(ChannelType.GuildText)
                );

                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🛠️ Soft-Ban Setup')
                    .setDescription('Please select the **Honeypot Channel** and the **Log Channel** from the menus below to enable soft-ban.');

                const response = await interaction.reply({ 
                    embeds: [embed], 
                    components: [honeypotRow, logRow], 
                    ephemeral: true 
                });

                const collector = response.createMessageComponentCollector({ componentType: ComponentType.ChannelSelect, time: 60000 });

                let selectedHoneypot = null;
                let selectedLog = null;

                collector.on('collect', async i => {
                    if (i.customId === 'softban_setup_honeypot') {
                        selectedHoneypot = i.values[0];
                        await i.deferUpdate();
                    } else if (i.customId === 'softban_setup_log') {
                        selectedLog = i.values[0];
                        await i.deferUpdate();
                    }

                    if (selectedHoneypot && selectedLog) {
                        setSoftbanConfig(interaction.guildId, selectedHoneypot, selectedLog);
                        await sendHoneypotWarning(selectedHoneypot);
                        
                        const successEmbed = new EmbedBuilder()
                            .setColor('#2ECC71')
                            .setTitle(`${getEmoji('gtick')} Soft-Ban Enabled`)
                            .setDescription(`Soft-ban honeypot has been **enabled**.`)
                            .addFields(
                                { name: 'Honeypot Channel', value: `<#${selectedHoneypot}>`, inline: true },
                                { name: 'Log Channel', value: `<#${selectedLog}>`, inline: true }
                            )
                            .setTimestamp();
                        
                        await interaction.editReply({ embeds: [successEmbed], components: [] });
                        collector.stop('completed');
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        interaction.editReply({ content: '⏳ Setup timed out. Please run the command again.', embeds: [], components: [] }).catch(() => {});
                    }
                });

                return;
            }

            // If options were provided via command directly
            await interaction.deferReply();

            setSoftbanConfig(interaction.guildId, honeypotChannel.id, logChannel.id);
            await sendHoneypotWarning(honeypotChannel.id);
            
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle(`${getEmoji('gtick')} Soft-Ban Enabled`)
                .setDescription(`Soft-ban honeypot has been **enabled**.`)
                .addFields(
                    { name: 'Honeypot Channel', value: `<#${honeypotChannel.id}>`, inline: true },
                    { name: 'Log Channel', value: `<#${logChannel.id}>`, inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

        } else if (action === 'off') {
            disableSoftban(interaction.guildId);

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${getEmoji('bluex')} Soft-Ban Disabled`)
                .setDescription('Soft-ban honeypot has been **disabled** for this server.')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};
