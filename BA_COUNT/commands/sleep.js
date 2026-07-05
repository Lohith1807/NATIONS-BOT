const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goodnight')
        .setDescription('Tell everyone you are going to sleep!'),
    
    async execute(interaction) {
        const user = interaction.user;

        const file = new AttachmentBuilder(path.join(__dirname, '../assets/sleep.gif'));
        const embed = new EmbedBuilder()
            .setColor('#00008B')
            .setDescription(`**${user.username}** is going to sleep. Good night!`)
            .setImage('attachment://sleep.gif');

        await interaction.reply({ embeds: [embed], files: [file] });
    },
};
