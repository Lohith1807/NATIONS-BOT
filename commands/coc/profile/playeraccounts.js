const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const superscripts = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
};

function toSuperscript(num) {
    return num.toString().split('').map(d => superscripts[d] || d).join('');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playeraccounts')
        .setDescription('Shows linked Clash of Clans accounts for a user')
        .addUserOption(option =>
            option.setName('discorduser')
                .setDescription('The user to check accounts for')
                .setRequired(false)),

    async execute(interaction, context) {
        const { coc, data: dataManager, emoji: emojiUtils } = context;
        const targetUser = interaction.options.getUser('discorduser') || interaction.user;
        const userData = dataManager.getUserData();
        const accounts = userData[targetUser.id] || [];

        await interaction.deferReply();

        if (accounts.length === 0) {
            return interaction.editReply({ content: `❌ **${targetUser.username}** has no linked accounts.` });
        }

        try {
            const embed = await this.buildAccountEmbed(targetUser, accounts, coc, emojiUtils);
            const refreshButton = new ButtonBuilder()
                .setCustomId(`refresh_accounts:${targetUser.id}`)
                .setEmoji(emojiUtils.getEmojiObject('refresh') || '🔄')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(refreshButton);

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error in playeraccounts:', error);
            await interaction.editReply({ content: '❌ There was an error fetching the account details.' });
        }
    },

    async buildAccountEmbed(user, accounts, coc, emojiUtils) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} Accounts (${accounts.length})`, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setColor(0x2b2d31)
            .setTimestamp();

        let description = "";

        // Limit to 10 accounts to avoid timeout/length issues, though usually people have few
        const displayAccounts = accounts.slice(0, 15);

        const fetchPromises = displayAccounts.map(acc => coc.getPlayer(acc.tag).catch(() => null));
        const playerDetails = await Promise.all(fetchPromises);

        for (let i = 0; i < displayAccounts.length; i++) {
            const acc = displayAccounts[i];
            const p = playerDetails[i];

            if (!p) {
                description += `⚠️ **${acc.name}** (${acc.tag}) - *Failed to fetch*\n\n`;
                continue;
            }

            const thLevel = toSuperscript(p.townHallLevel);
            const playerLink = `https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=${p.tag.replace('#', '')}`;
            
            const clanName = p.clan ? p.clan.name : "No Clan";
            const roleMap = { member: "Member", admin: "Elder", coLeader: "Co-Leader", leader: "Leader" };
            const clanRole = p.role ? `(${roleMap[p.role] || p.role})` : "";
            const swordEmoji = emojiUtils.getEmoji('cocfight') || '⚔️';

            description += `${swordEmoji} [**${p.name}${thLevel}**](${playerLink})\n`;
            description += `${p.trophies} | ${clanName} ${clanRole}\n\n`;
        }

        embed.setDescription(description || "No accounts found.");
        return embed;
    }
};
