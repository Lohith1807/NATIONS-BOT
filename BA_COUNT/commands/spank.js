const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spank')
        .setDescription('Spank someone!')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to spank')
                .setRequired(true)),
    
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const user = interaction.user;

        const file = new AttachmentBuilder(path.join(__dirname, '../assets/spank.gif'));
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription(`**${user.username}** playfully spanked **${target.username}**!`)
            .setImage('attachment://spank.gif');

        await interaction.reply({ embeds: [embed], files: [file] });
    },
};
