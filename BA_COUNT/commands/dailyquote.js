const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const { getConfig, saveConfig, getHistory, generateQuote } = require('../utils/quoteService.js');
const { generateQuoteImage } = require('../utils/quoteImageGenerator.js');
const { reloadQuoteScheduler, sendDailyQuote } = require('../utils/quoteScheduler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dailyquote')
        .setDescription('Manage the AI Daily Quote system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Instantly generate and send an AI quote image')
                .addStringOption(option =>
                    option.setName('theme')
                        .setDescription('Choose a specific theme (optional)')
                        .setRequired(false)
                        .addChoices(
                            { name: '🔥 Motivational', value: 'motivational' },
                            { name: '🎮 Gaming', value: 'gaming' },
                            { name: '⚡ Funny', value: 'funny' },
                            { name: '🖤 Dark', value: 'dark' },
                            { name: '🥀 Emotional', value: 'emotional' },
                            { name: '🤝 Friendship', value: 'friendship' },
                            { name: '✨ Love', value: 'love' },
                            { name: '🌿 Life', value: 'life' },
                            { name: '🧠 Psychology', value: 'psychology' },
                            { name: '☕ Relatable', value: 'relatable' },
                            { name: '🏛️ Philosophical', value: 'philosophical' },
                            { name: '🦉 Wisdom', value: 'wisdom' },
                            { name: '⚔️ Courage', value: 'courage' },
                            { name: '🌌 Mindfulness', value: 'mindfulness' }
                        )
                )
                .addBooleanOption(option =>
                    option.setName('send_to_channel')
                        .setDescription('Send directly to the configured quote channel? (Default: post here)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configure destination channel and daily post times')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The text channel where quotes will be posted')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('times')
                        .setDescription('Daily post times (comma-separated HH:MM). Default: 07:00, 12:00, 20:00 IST')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View current AI Daily Quote configuration and status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable automatic daily quotes')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable daily quotes')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('View recently generated AI quotes')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'test') {
            await interaction.deferReply({ ephemeral: true });

            const theme = interaction.options.getString('theme');
            const sendToConfiguredChannel = interaction.options.getBoolean('send_to_channel') || false;

            try {
                if (sendToConfiguredChannel) {
                    const config = getConfig();
                    if (!config.channelId) {
                        return interaction.editReply({
                            content: '❌ No quote channel is configured yet. Please use `/dailyquote setup` first, or run `/dailyquote test send_to_channel:False` to test here.'
                        });
                    }

                    const result = await sendDailyQuote(interaction.client, config.channelId, theme);
                    if (result.success) {
                        return interaction.editReply({
                            content: `✅ Successfully generated and sent a **${result.quote.themeName}** quote image to <#${config.channelId}>!`
                        });
                    } else {
                        return interaction.editReply({
                            content: `❌ Failed to send quote: ${result.error || result.reason}`
                        });
                    }
                } else {
                    // Send strictly image-only directly to current channel
                    const quoteData = await generateQuote(theme);
                    const imgBuffer = await generateQuoteImage(quoteData);
                    const attachment = new AttachmentBuilder(imgBuffer, { name: 'daily-quote.png' });

                    // Post image-only into the interaction's channel
                    await interaction.channel.send({
                        files: [attachment]
                    });

                    return interaction.editReply({
                        content: `✅ Generated and posted **${quoteData.themeName}** quote image into this channel!`
                    });
                }
            } catch (err) {
                console.error('Error during /dailyquote test:', err);
                return interaction.editReply({
                    content: `❌ Error generating quote: ${err.message}`
                });
            }
        }

        if (subcommand === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const timesInput = interaction.options.getString('times');
            let timesList = ['07:00', '12:00', '20:00'];

            if (timesInput) {
                const rawList = timesInput.split(',').map(s => s.trim());
                const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
                for (const t of rawList) {
                    if (!timeRegex.test(t)) {
                        return interaction.reply({
                            content: `❌ Invalid time format: \`${t}\`. Please provide times in 24-hour \`HH:MM\` format (e.g. \`07:00, 12:00, 20:00\`).`,
                            ephemeral: true
                        });
                    }
                }
                timesList = rawList;
            }

            const config = getConfig();
            config.channelId = channel.id;
            config.times = timesList;
            config.enabled = true;
            saveConfig(config);

            reloadQuoteScheduler(interaction.client);

            return interaction.reply({
                content: `✅ **AI Daily Quote Configured!**\n\n📢 **Channel:** <#${channel.id}>\n⏰ **Times:** \`${timesList.join(', ')}\` (${config.timezone || 'Asia/Kolkata'}) — *3 slots daily: 7 AM, 12 PM, 8 PM IST*\n🟢 **Status:** Active\n\nQuotes will be generated by AI and posted 3 times a day as standalone images with no embed or message text!`,
                ephemeral: true
            });
        }

        if (subcommand === 'status') {
            const config = getConfig();
            const history = getHistory();
            const lastQuote = history[0];
            const timesList = config.times || (config.time ? [config.time] : ['07:00', '12:00', '20:00']);

            let desc = `**🤖 AI Daily Quote System Status**\n\n`;
            desc += `• **Channel:** ${config.channelId ? `<#${config.channelId}>` : '*Not configured (use /dailyquote setup)*'}\n`;
            desc += `• **Scheduled Times:** \`${timesList.join(', ')}\` (${config.timezone || 'Asia/Kolkata'}) — *7 AM, 12 PM, 8 PM IST*\n`;
            desc += `• **Status:** ${config.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n`;
            desc += `• **Total Quotes Generated:** ${history.length}\n`;

            if (lastQuote) {
                desc += `\n**Last Generated Quote:**\n`;
                desc += `> "${lastQuote.quote}"\n`;
                desc += `*— ${lastQuote.author}* [Theme: \`${lastQuote.themeName || lastQuote.theme}\` on ${lastQuote.date}]\n`;
            }

            return interaction.reply({
                content: desc,
                ephemeral: true
            });
        }

        if (subcommand === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled');
            const config = getConfig();
            config.enabled = enabled;
            saveConfig(config);

            reloadQuoteScheduler(interaction.client);

            return interaction.reply({
                content: `${enabled ? '🟢' : '🔴'} Daily Quote schedule has been **${enabled ? 'Enabled' : 'Disabled'}**.`,
                ephemeral: true
            });
        }

        if (subcommand === 'history') {
            const history = getHistory();
            if (history.length === 0) {
                return interaction.reply({
                    content: '📝 No quotes have been generated yet.',
                    ephemeral: true
                });
            }

            const recent = history.slice(0, 5);
            let response = `**📚 Recent Quotes History (${history.length} total saved):**\n\n`;
            recent.forEach((q, idx) => {
                response += `**${idx + 1}. [${(q.themeName || q.theme).toUpperCase()}]** (${q.date})\n`;
                response += `> "${q.quote}"\n`;
                response += `*— ${q.author}*\n\n`;
            });

            return interaction.reply({
                content: response,
                ephemeral: true
            });
        }
    }
};
