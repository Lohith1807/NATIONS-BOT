const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { isStaffOrAdmin } = require('../../utils/data.js');
const { getEmoji, revertEmojis } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-announcement')
        .setDescription('Edit an existing announcement message sent by the bot (Staff/Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The ID of the announcement message to edit')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('embed_message')
                .setDescription('Should the message be embedded? (Yes/No)')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the announcement is located (optional)')
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

        const messageId = interaction.options.getString('message_id');
        let targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        let targetMessage = null;

        if (targetChannel) {
            try {
                targetMessage = await targetChannel.messages.fetch(messageId);
            } catch (_) {}
        }

        if (!targetMessage && !interaction.options.getChannel('channel')) {
            return interaction.reply({
                content: `${getEmoji("bluex")} Announcement message with ID \`${messageId}\` not found in this channel. Please specify the **channel** option.`,
                ephemeral: true
            });
        }

        if (!targetMessage) {
            return interaction.reply({
                content: `${getEmoji("bluex")} Announcement message with ID \`${messageId}\` not found in the specified channel.`,
                ephemeral: true
            });
        }

        if (targetMessage.author.id !== interaction.client.user.id) {
            return interaction.reply({
                content: `${getEmoji("bluex")} I can only edit announcements that were sent by me (${interaction.client.user}).`,
                ephemeral: true
            });
        }

        let existingContent = targetMessage.content;
        if (targetMessage.embeds && targetMessage.embeds.length > 0) {
            existingContent = targetMessage.embeds[0].description || existingContent;
        }

        const isEmbed = interaction.options.getBoolean('embed_message');

        const modal = new ModalBuilder()
            .setCustomId(`edit_announcement_modal:${targetChannel.id}:${targetMessage.id}:${isEmbed}`)
            .setTitle('Edit Announcement');

        const textInput = new TextInputBuilder()
            .setCustomId('announcement_text')
            .setLabel('Announcement Text')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(revertEmojis(existingContent))
            .setRequired(true)
            .setMaxLength(4000);

        const row = new ActionRowBuilder().addComponents(textInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
};
