const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const {
    getGiveaway,
    getGuildGiveaways,
    endGiveaway,
} = require('../../utils/giveawayManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-end')
        .setDescription('End an active giveaway immediately and announce winners (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
                .filter(g => g.status === 'active')
                .filter(g =>
                    g.id.toLowerCase().includes(focused) ||
                    (g.prize || '').toLowerCase().includes(focused)
                )
                .slice(-25)
                .reverse();

            await interaction.respond(
                giveaways.map(g => ({
                    name: `${g.id} — ${g.prize}`.slice(0, 100),
                    value: g.id,
                }))
            );
        } catch (_) {
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: `❌ Only **Server Administrators** can end giveaways.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const giveawayId = interaction.options.getString('giveaway-id').trim();
        const gw = getGiveaway(giveawayId);

        if (!gw || gw.guildId !== interaction.guild.id) {
            return interaction.reply({
                content: `❌ Giveaway \`${giveawayId}\` not found in this server.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (gw.status === 'ended' || gw.announced) {
            return interaction.reply({
                content: `${getEmoji('alaram')} Giveaway \`${gw.id}\` has already ended.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ok = await endGiveaway(interaction.client, gw.id);
        if (!ok) {
            return interaction.editReply({
                content: `❌ Could not end giveaway \`${gw.id}\` (it may already be ending).`,
            });
        }

        return interaction.editReply({
            content: `${getEmoji('gtick')} Giveaway \`${gw.id}\` (**${gw.prize}**) has been ended and winners were announced in <#${gw.channelId}>!`,
        });
    },
};
