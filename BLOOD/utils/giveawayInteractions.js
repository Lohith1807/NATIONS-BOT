const { MessageFlags } = require('discord.js');
const { getEmoji } = require('./botemoji.js');
const {
    addParticipant,
    buildGiveawayEmbed,
    buildEnterButton,
} = require('./giveawayManager.js');

/**
 * Handles giveaway button interactions (`giveaway_enter:<giveawayId>`).
 */
async function handleGiveawayInteractions(interaction) {
    if (!interaction.isButton()) return false;
    if (!interaction.customId.startsWith('giveaway_enter:')) return false;

    const giveawayId = interaction.customId.split(':')[1];

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = addParticipant(giveawayId, interaction.user.id);
        if (!result.ok) {
            if (result.reason === 'already_entered') {
                await interaction.editReply({
                    content: `${getEmoji('alaram')} You have already entered giveaway \`${giveawayId}\`!`,
                });
                return true;
            }
            await interaction.editReply({
                content: `${getEmoji('bluex')} ${result.reason}`,
            });
            return true;
        }

        // Update live entry count on the giveaway embed & button
        if (interaction.message && typeof interaction.message.edit === 'function' && result.giveaway) {
            await interaction.message.edit({
                embeds: [buildGiveawayEmbed(result.giveaway)],
                components: [buildEnterButton(result.giveaway, false)],
            }).catch(() => {});
        }

        await interaction.editReply({
            content: `${getEmoji('gtick')} You have entered giveaway \`${result.giveaway.id}\` (**${result.giveaway.prize}**)! Good luck! 🎉`,
        });
        return true;
    } catch (err) {
        console.error('❌ [GiveawayInteractions] Error handling button:', err);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Something went wrong while entering the giveaway.' });
            } else {
                await interaction.reply({ content: '❌ Something went wrong while entering the giveaway.', flags: MessageFlags.Ephemeral });
            }
        } catch (_) {}
        return true;
    }
}

module.exports = {
    handleGiveawayInteractions,
};
