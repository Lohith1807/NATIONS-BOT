const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { extractInviteCode, buildInviteEmbed, createRefreshButton } = require('../bot2_utils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("checkinvite")
        .setDescription("Check how many members joined using a specific invite link")
        .addStringOption(option =>
            option
                .setName("link")
                .setDescription("The Discord invite link or code (e.g. https://discord.gg/abc123)")
                .setRequired(true)
        ),
    async execute(interaction, botClient) {
        await interaction.deferReply();

        const input = interaction.options.getString("link");
        const code  = extractInviteCode(input);

        if (!code) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF4444)
                        .setTitle("❌ Invalid Link")
                        .setDescription("Please provide a valid Discord invite link.\n**Example:** `https://discord.gg/abc123`"),
                ],
            });
        }

        try {
            const botMember = interaction.guild.members.cache.get(botClient.user.id);
            if (!botMember.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF4444)
                            .setTitle("❌ Missing Permission")
                            .setDescription("I need the **Manage Server** permission to read invite usage."),
                    ],
                });
            }

            const embed = await buildInviteEmbed(interaction.guild, code);

            if (!embed) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF9900)
                            .setTitle("⚠️ Invite Not Found in This Server")
                            .setDescription(
                                `No invite with code \`${code}\` was found in **${interaction.guild.name}**.\n\n` +
                                `• The invite may belong to a **different server**\n` +
                                `• The invite may have **expired or been deleted**`
                            ),
                    ],
                });
            }

            await interaction.editReply({
                embeds: [embed],
                components: [createRefreshButton(code)],
            });

        } catch (err) {
            console.error("❌ [Bot2] Error:", err);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF4444)
                        .setTitle("❌ Error")
                        .setDescription(`Something went wrong.\n\`\`\`${err.message}\`\`\``),
                ],
            });
        }
    }
};
