



// 🎨 Helper: random color
function getRandomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

// 🧱 Helper: build embed
function buildEmbed(EmbedBuilder, title, description, color = 0x2ecc71) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

// 🧾 Log to the specified Discord log channel
async function logErrorToChannel(client, LOG_CHANNEL_ID, EmbedBuilder, title, error) {
  const { ChannelType } = require("discord.js");
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

  const errorEmbed = buildEmbed(
    EmbedBuilder,
    `⚠️ ${title}`,
    `\`\`\`${error?.message || error}\`\`\``,
    0xe74c3c
  );
  logChannel.send({ embeds: [errorEmbed] }).catch(() => { });
}

module.exports = {
  name: "delc",
  description: "Deletes the current category and all its channels",
  async run(message, args, { EmbedBuilder, client, config }) {
    const ALLOWED_ROLES_DELETE = config.ADMIN_ROLE_IDS;
    const LOG_CHANNEL_ID = config.LOG_CHANNEL_ID;
    const currentChannel = message.channel; // ✅ Store reference before deletion

    if (message.deletable) await message.delete().catch(() => { });

    // 🔒 Role Check
    const hasPermission = message.member.roles.cache.some(role =>
      ALLOWED_ROLES_DELETE.includes(role.id)
    );

    if (!hasPermission) {
      const embed = buildEmbed(
        EmbedBuilder,
        "🚫 Access Denied",
        "You do not have permission to use this command.",
        0xe74c3c
      );
      return currentChannel.send({ embeds: [embed] });
    }

    // 🏷️ Check if inside a category
    const category = currentChannel.parent;
    if (!category) {
      const embed = buildEmbed(
        EmbedBuilder,
        "⚠️ Invalid Channel",
        "This channel is not inside a category.",
        0xe67e22
      );
      return currentChannel.send({ embeds: [embed] });
    }

    // ⚠️ Ask for confirmation
    const confirmEmbed = buildEmbed(
      EmbedBuilder,
      "⚠️ Confirm Deletion",
      `Are you sure you want to delete **${category.name}** and all its channels?`,
      0xf1c40f
    );

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm_delc')
            .setLabel('Confirm Deletion')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('cancel_delc')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );

    const confirmMsg = await currentChannel.send({ embeds: [confirmEmbed], components: [row] });

    const collector = confirmMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5 * 60 * 1000 // 5 minutes
    });

    collector.on('collect', async (interaction) => {
        // Only allow the command author or admins to click the buttons
        const isAuthor = interaction.user.id === message.author.id;
        const isAllowedAdmin = interaction.member.roles.cache.some(role => ALLOWED_ROLES_DELETE.includes(role.id));

        if (!isAuthor && !isAllowedAdmin) {
            return interaction.reply({
                content: "❌ You don't have permission to use these buttons.",
                ephemeral: true
            });
        }

        if (interaction.customId === 'confirm_delc') {
            await interaction.deferUpdate();
            collector.stop("confirmed");

            // ✅ Success message before deletion
            const startEmbed = buildEmbed(
              EmbedBuilder,
              "🗑️ Deletion Started",
              `Deleting category **${category.name}** and all its channels...`,
              0x3498db
            );
            
            // Try to edit the message to show it's starting, but if it gets deleted too fast it's fine
            await confirmMsg.edit({ embeds: [startEmbed], components: [] }).catch(() => {});

            // Delete all child channels
            const children = message.guild.channels.cache.filter(c => c.parentId === category.id);
            let deletedCount = 0;

            for (const ch of children.values()) {
              await ch.delete().catch(err => {
                logErrorToChannel(client, LOG_CHANNEL_ID, EmbedBuilder, `Failed to delete channel #${ch.name}`, err);
              });
              deletedCount++;
            }

            // Delete the category
            await category.delete().catch(err => {
              logErrorToChannel(client, LOG_CHANNEL_ID, EmbedBuilder, `Failed to delete category ${category.name}`, err);
            });

            // ✅ Log the completion
            await logErrorToChannel(
              client,
              LOG_CHANNEL_ID,
              EmbedBuilder,
              "✅ Deletion Complete",
              `**Category:** ${category.name}\n**Deleted by:** ${interaction.user.tag} (${interaction.user.id})\n**Channels Deleted:** ${deletedCount}`
            );
        } else if (interaction.customId === 'cancel_delc') {
            await interaction.deferUpdate();
            collector.stop("cancelled");

            const cancelEmbed = buildEmbed(
              EmbedBuilder,
              "❌ Deletion Cancelled",
              "You cancelled the deletion process.",
              0xe74c3c
            );
            await confirmMsg.edit({ embeds: [cancelEmbed], components: [] }).catch(() => {});
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = buildEmbed(
                EmbedBuilder,
                "⏳ Timeout",
                "No confirmation received within 5 minutes. Deletion cancelled.",
                0xe67e22
            );
            await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        }
    });
  }
};
