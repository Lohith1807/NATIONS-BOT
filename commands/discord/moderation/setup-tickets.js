const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Sends the ticket setup panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, context) {
        const { config, emoji } = context;
        const { getEmoji, getEmojiObject } = emoji;

        const ADMIN_ROLE_IDS = config.ADMIN_ROLE_IDS || [];
        const isAuthorized = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                             ADMIN_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));

        if (!isAuthorized) {
            return interaction.reply({
                content: '❌ You do not have the required permissions to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // Only use emojis that exist in emoji.js:
        // coc, crown, question
        const cocEmoji     = getEmojiObject('coc');     // clan apply
        const crownEmoji   = getEmojiObject('crown');   // rep apply
        const questionEmoji = getEmojiObject('question'); // help

        const ticketImage = new AttachmentBuilder('./assets/images/tickets.png');

        const embed = new EmbedBuilder()
            .setTitle('Apply to be a part of Nations!')
            .setDescription(
                '### Thank you for showing interest in The Nations!\n' +
                'Before we proceed, please link your account(s) to initiate a ticket and begin your journey.\n\n' +
                `• ${getEmoji('coc')} **Clan Apply** — Want to join one of our clans?\n` +
                `• ${getEmoji('crown')} **Rep Apply** — Want to become a Clan Representative?\n` +
                `• ${getEmoji('question')} **Help Assistance** — Need help or have a question?\n\n` +
                '**Welcome to Nations. Let the journey begin!**'
            )
            .setColor(0xff0000)
            .setImage('attachment://nations_storm_footer.png');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('apply_clan')
                .setLabel('Clan Apply')
                .setEmoji({ id: cocEmoji.id, name: cocEmoji.name, animated: cocEmoji.animated })
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('rep_apply')
                .setLabel('Rep Apply')
                .setEmoji({ id: crownEmoji.id, name: crownEmoji.name, animated: crownEmoji.animated })
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('help_assistance')
                .setLabel('Help Assistance')
                .setEmoji({ id: questionEmoji.id, name: questionEmoji.name, animated: questionEmoji.animated })
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({
            embeds: [embed],
            components: [row],
            files: [ticketImage]
        });

        await interaction.editReply({ content: '✅ Ticket Panel has been sent successfully!' });
    }
};
