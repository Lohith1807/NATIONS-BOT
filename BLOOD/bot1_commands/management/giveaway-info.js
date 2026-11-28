const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const { getGiveaway, getGuildGiveaways } = require('../../utils/giveawayManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-info')
        .setDescription('View public details of a giveaway')
        .addStringOption(option =>
            option
                .setName('giveaway-id')
                .setDescription('Giveaway ID (e.g. GW-1001)')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused().toLowerCase();
            const giveaways = getGuildGiveaways(interaction.guildId)
                .filter(g =>
                    g.id.toLowerCase().includes(focused) ||
                    (g.prize || '').toLowerCase().includes(focused)
                )
                .slice(-25)
                .reverse();

            await interaction.respond(
                giveaways.map(g => ({
                    name: `${g.id} — ${g.prize} (${g.status})`.slice(0, 100),
                    value: g.id,
                }))
            );
        } catch (_) {
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        const giveawayId = interaction.options.getString('giveaway-id').trim();
        const gw = getGiveaway(giveawayId);

        if (!gw || gw.guildId !== interaction.guild.id) {
            return interaction.reply({
                content: `❌ Giveaway \`${giveawayId}\` was not found in this server.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const isEnded = gw.status === 'ended';
        const ts = Math.floor((isEnded && gw.endedAt ? gw.endedAt : gw.endsAt) / 1000);

        // Strictly never display winners, winnerCount, or admin override info
        const embed = new EmbedBuilder()
            .setTitle(`Giveaway Info: ${gw.id}`)
            .setColor(isEnded ? '#95A5A6' : '#F1C40F')
            .addFields(
                { name: 'Prize', value: `${getEmoji('gift')} ${gw.prize}`, inline: true },
                { name: 'Status', value: `${isEnded ? '❌' : getEmoji('gtick')} ${isEnded ? 'Ended' : 'Active'}`, inline: true },
                { name: 'Total Entries', value: `${getEmoji('gob')} ${(gw.participants || []).length}`, inline: true },
                { name: isEnded ? 'Ended' : 'Ends', value: `${getEmoji('alaram')} <t:${ts}:R> (<t:${ts}:f>)`, inline: true },
                { name: 'Channel', value: `${getEmoji('book')} <#${gw.channelId}>`, inline: true },
                { name: 'Hosted By', value: `${getEmoji('crown')} <@${gw.createdBy}>`, inline: true }
            )
            .setTimestamp();

        if (gw.description) {
            embed.setDescription(gw.description);
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};

