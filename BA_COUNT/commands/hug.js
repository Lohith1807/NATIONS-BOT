const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Give someone a hug!')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to hug')
                .setRequired(true)),
    
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const user = interaction.user;

        const file = new AttachmentBuilder(path.join(__dirname, '../assets/hug.gif'));
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setDescription(`**${user.username}** gave a warm hug to **${target.username}**!`)
            .setImage('attachment://hug.gif');

        await interaction.reply({ embeds: [embed], files: [file] });
    },
};
