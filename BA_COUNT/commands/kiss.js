const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('Give someone a kiss!')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to kiss')
                .setRequired(true)),
    
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const user = interaction.user;

        const file = new AttachmentBuilder(path.join(__dirname, '../assets/kiss.gif'));
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setDescription(`**${user.username}** kissed **${target.username}**!`)
            .setImage('attachment://kiss.gif');

        await interaction.reply({ embeds: [embed], files: [file] });
    },
};
