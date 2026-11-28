const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const {
    getGiveaway,
    getGuildGiveaways,
} = require('../../utils/giveawayManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-reroll')
        .setDescription('View current winners and reroll via Auto or Manual mode (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('giveaway-id')
                .setDescription('Giveaway ID (e.g. GW-1001)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option
                .setName('spot')
                .setDescription('Optional: winner spot number to reroll (e.g. 1 for 1st spot)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused().toLowerCase();
            const giveaways = getGuildGiveaways(interaction.guildId)
                .filter(g => g.status === 'ended')
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
                content: `❌ Only **Server Administrators** can reroll giveaway winners.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const giveawayId = interaction.options.getString('giveaway-id').trim();
        const spotNumber = interaction.options.getInteger('spot');

        const gw = getGiveaway(giveawayId);
        if (!gw || gw.guildId !== interaction.guild.id) {
            return interaction.reply({
                content: `❌ Giveaway \`${giveawayId}\` not found in this server.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (gw.status === 'active') {
            return interaction.reply({
                content: `${getEmoji('alaram')} Giveaway \`${gw.id}\` has not ended yet.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const currentWinners = Array.isArray(gw.finalWinners) && gw.finalWinners.length > 0
            ? gw.finalWinners
            : (gw.pendingWinners || []);
        if (spotNumber && spotNumber > currentWinners.length) {
            return interaction.reply({
                content: `❌ Invalid spot **#${spotNumber}**. This giveaway has **${currentWinners.length}** winner spot(s).`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const winnerLines = currentWinners.length > 0
            ? currentWinners.map((id, i) => `**${i + 1}.** ${getEmoji('pinkdot')} <@${id}> (\`${id}\`)`).join('\n')
            : '*No winners*';

        const spotKey = spotNumber ? String(spotNumber - 1) : 'all';
        const scopeText = spotNumber ? `Spot #${spotNumber}` : 'All Spots';

        const embed = new EmbedBuilder()
            .setTitle(`Giveaway Reroll — ${gw.id}`)
            .setColor('#F39C12')
            .setDescription(
                `${getEmoji('gift')} **Giveaway:** ${gw.prize}\n` +
                `${getEmoji('book')} **Target:** ${scopeText}\n` +
                `${getEmoji('gob')} **Total Entries:** ${(gw.participants || []).length}\n\n` +
                `${getEmoji('no1')} **Current Winner List:**\n${winnerLines}\n\n` +
                `Choose **Auto** to randomly reroll, or **Manual** to search & pick a specific participant.`
            )
            .setFooter({ text: `Giveaway ID: ${gw.id}` })
            .setTimestamp();

        const autoBtn = new ButtonBuilder()
            .setCustomId(`giveaway_cmd_auto:${gw.id}:${spotKey}`)
            .setLabel('Auto')
            .setStyle(ButtonStyle.Primary);

        const manualBtn = new ButtonBuilder()
            .setCustomId(`giveaway_cmd_manual:${gw.id}:${spotKey}`)
            .setLabel('Manual')
            .setStyle(ButtonStyle.Secondary);

        return interaction.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(autoBtn, manualBtn)],
            flags: MessageFlags.Ephemeral,
        });
    },
};
