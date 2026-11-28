const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');
const {
    getGiveaway,
    getGuildGiveaways,
    setManualWinner,
    resetWinnerSelection,
} = require('../../utils/giveawayManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-winselect')
        .setDescription('Secretly manage giveaway winner selection before the giveaway ends (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('giveaway-id')
                .setDescription('Giveaway ID (e.g. GW-1001)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('Winner selection action')
                .setRequired(true)
                .addChoices(
                    { name: 'Random', value: 'random' },
                    { name: 'Manual', value: 'manual' },
                    { name: 'Reset', value: 'reset' }
                )
        )
        .addUserOption(option =>
            option
                .setName('winner')
                .setDescription('User to assign as a winner (required for Manual action)')
                .setRequired(false)
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
                .slice(0, 25);

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
                content: `${getEmoji('bluex')} Only **Server Administrators** can use this command.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const giveawayId = interaction.options.getString('giveaway-id').trim();
        const action = interaction.options.getString('action');
        const winnerUser = interaction.options.getUser('winner');

        const gw = getGiveaway(giveawayId);
        if (!gw || gw.guildId !== interaction.guild.id) {
            return interaction.reply({
                content: `${getEmoji('bluex')} Giveaway \`${giveawayId}\` not found in this server.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (gw.status !== 'active') {
            return interaction.reply({
                content: `${getEmoji('bluex')} Giveaway \`${gw.id}\` has already ended and can no longer be modified.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (action === 'manual') {
            if (!winnerUser) {
                return interaction.reply({
                    content: `${getEmoji('bluex')} Please specify the \`winner\` user when using **Manual** mode.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const result = setManualWinner(gw.id, winnerUser.id, interaction.user);
            if (!result.ok) {
                return interaction.reply({
                    content: `${getEmoji('bluex')} ${result.reason}`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const updated = result.giveaway;
            const currentList = updated.manualWinners.map(id => `<@${id}>`).join(', ');
            const replacedNote = result.replacedUserId
                ? `\n${getEmoji('alaram')} Replaced previous selection <@${result.replacedUserId}> (limit: ${updated.winnerCount}).`
                : '';

            return interaction.reply({
                content:
                    `${getEmoji('gtick')} **Secret Manual Winner Updated** for \`${updated.id}\` (**${updated.prize}**)\n` +
                    `${getEmoji('arrow')} **Mode:** Manual Override\n` +
                    `${getEmoji('arrow')} **Selected (${updated.manualWinners.length}/${updated.winnerCount}):** ${currentList}` +
                    replacedNote +
                    `\n\n*This change is private. No public messages or notifications were sent.*`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (action === 'random' || action === 'reset') {
            const result = resetWinnerSelection(gw.id, interaction.user, action);
            if (!result.ok) {
                return interaction.reply({
                    content: `${getEmoji('bluex')} ${result.reason}`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                content:
                    `${getEmoji('gtick')} **Automatic Random Selection Restored** for \`${gw.id}\` (**${gw.prize}**)\n` +
                    `${getEmoji('arrow')} **Mode:** Automatic Random\n` +
                    `${getEmoji('arrow')} Any manual winner overrides have been cleared.\n\n*This change is private.*`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
