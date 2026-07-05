const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goodmorning')
        .setDescription('Say good morning to everyone!'),
    
    async execute(interaction) {
        const user = interaction.user;

        const file = new AttachmentBuilder(path.join(__dirname, '../assets/good-morning.gif'));
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setDescription(`**${user.username}** says Good Morning!`)
            .setImage('attachment://good-morning.gif');

        await interaction.reply({ embeds: [embed], files: [file] });
    },
};
