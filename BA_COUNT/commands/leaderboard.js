const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUsers } = require('../utils/dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Shows the counting leaderboard for this server'),
    
    async execute(interaction) {
        const guildId = interaction.guildId;
        const allUsers = getUsers();
        
        const serverUsers = allUsers[guildId];
        
        if (!serverUsers || Object.keys(serverUsers).length === 0) {
            return await interaction.reply({ content: `No one has counted anything yet in this server!`, ephemeral: true });
        }
        
        const leaderboardData = Object.entries(serverUsers)
            .map(([userId, data]) => ({ userId, score: data.score }))
            .filter(user => user.score > 0)
            .sort((a, b) => b.score - a.score);
            
        if (leaderboardData.length === 0) {
            return await interaction.reply({ content: `No one has a score greater than 0 right now! Start counting to climb the ranks.`, ephemeral: true });
        }
            
        const embeds = [];
        const chunkSize = 20; // Show 20 users per embed

        for (let i = 0; i < leaderboardData.length; i += chunkSize) {
            // Discord allows a maximum of 10 embeds per message
            if (embeds.length >= 10) break;

            const chunk = leaderboardData.slice(i, i + chunkSize);
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setDescription(chunk.map((user, index) => {
                    return `**${i + index + 1}.** <@${user.userId}> - **${user.score}** counts`;
                }).join('\n'));
            
            if (i === 0) {
                embed.setTitle('🏆Leaderboard 🏆');
            }
            
            embeds.push(embed);
        }

        if (embeds.length > 0) {
            embeds[embeds.length - 1].setFooter({ text: 'Keep counting to climb the ranks!' });
        }
            
        await interaction.reply({ embeds: embeds });
    },
};
