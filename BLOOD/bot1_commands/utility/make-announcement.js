const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { isStaffOrAdmin } = require('../../utils/data.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('make_announcement')
        .setDescription('Create an announcement in a specified channel (Staff/Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addBooleanOption(option =>
            option.setName('embed_message')
                .setDescription('Should the message be embedded? (Yes/No)')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('send_image')
                .setDescription('Send the Blood Alliance banner image with the announcement? (Yes/No)')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!isStaffOrAdmin(interaction.member)) {
            return interaction.reply({
                content: `${getEmoji("bluex")} You need **Staff or Admin** permissions to use this command.`,
                ephemeral: true,
            });
        }

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const isEmbed = interaction.options.getBoolean('embed_message');
        const sendImage = interaction.options.getBoolean('send_image');

        const modal = new ModalBuilder()
            .setCustomId(`make_announcement_modal:${targetChannel.id}:${isEmbed}:${sendImage}`)
            .setTitle('Create Announcement');

        const textInput = new TextInputBuilder()
            .setCustomId('announcement_text')
            .setLabel('Announcement Text')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter announcement. :arrow:, :gtick:, etc. will animate.')
            .setRequired(true)
            .setMaxLength(4000);

        const row = new ActionRowBuilder().addComponents(textInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
};
