const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sync-emojis")
        .setDescription("Sync all server emojis to the bot's Developer Portal application emojis")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(option =>
            option.setName("overwrite")
                .setDescription("Delete existing application emojis with the same name before uploading")
                .setRequired(false)
        ),
    async execute(interaction) {
        // Ensure only server administrators can run this command
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ You need **Administrator** permissions to use this command.",
                ephemeral: true,
            });
        }

        // Defer reply since fetching/uploading emojis can take longer than the 3-second interaction window
        await interaction.deferReply({ ephemeral: true });

        try {
            // Fetch all emojis from the current server
            const guildEmojis = await interaction.guild.emojis.fetch();
            if (guildEmojis.size === 0) {
                return interaction.editReply({
                    content: "❌ No emojis found in this server."
                });
            }

            // Fetch all existing application emojis from the developer portal
            let appEmojis;
            try {
                appEmojis = await interaction.client.application.emojis.fetch();
            } catch (fetchErr) {
                console.error("❌ Failed to fetch application emojis:", fetchErr);
                return interaction.editReply({
                    content: "❌ Failed to fetch existing application emojis. Make sure the bot has application permissions and the developer portal features are supported."
                });
            }
            
            const overwrite = interaction.options.getBoolean("overwrite") || false;

            let uploaded = 0;
            let skipped = 0;
            let failed = 0;
            let deleted = 0;

            const uploadDetails = [];

            // Status message
            await interaction.editReply({
                content: `🔄 Starting sync of **${guildEmojis.size}** server emojis to your Application Emojis...`
            });

            for (const [id, emoji] of guildEmojis) {
                try {
                    // Check if an application emoji with the same name already exists
                    const existingAppEmoji = appEmojis.find(e => e.name === emoji.name);

                    if (existingAppEmoji) {
                        if (overwrite) {
                            // Delete the existing application emoji
                            await existingAppEmoji.delete();
                            deleted++;
                        } else {
                            // Skip if already exists and overwrite is false
                            skipped++;
                            continue;
                        }
                    }

                    // Fetch the emoji image as a Buffer
                    const response = await axios.get(emoji.url, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data, 'binary');

                    // Create the application emoji
                    await interaction.client.application.emojis.create({
                        attachment: buffer,
                        name: emoji.name
                    });

                    uploaded++;
                    uploadDetails.push(`✅ ${emoji.animated ? '🎞️' : '🖼️'} **:${emoji.name}:**`);
                } catch (err) {
                    console.error(`❌ Failed to sync emoji ${emoji.name}:`, err);
                    failed++;
                }
            }

            // Refetch all current application emojis to write the latest IDs to botemoji.js
            let finalAppEmojis;
            try {
                finalAppEmojis = await interaction.client.application.emojis.fetch();
            } catch (refetchErr) {
                console.error("❌ Failed to fetch final application emojis list:", refetchErr);
                finalAppEmojis = appEmojis; // fallback to initially fetched emojis
            }

            const emojiMap = {};
            const animatedSet = [];

            for (const [id, appEmoji] of finalAppEmojis) {
                emojiMap[appEmoji.name] = appEmoji.id;
                if (appEmoji.animated) {
                    animatedSet.push(appEmoji.name);
                }
            }

            const fs = require('fs');
            const path = require('path');
            const botemojiPath = path.join(__dirname, '../../utils/botemoji.js');

            const fileContent = `const emojis = ${JSON.stringify(emojiMap, null, 2)};

// Set of animated emoji names to determine <a:name:id> formatting
const animatedEmojis = new Set(${JSON.stringify(animatedSet, null, 2)});

const getEmoji = (name) => {
  if (!emojis[name]) return ""; // Return empty string if emoji not found
  const id = emojis[name];
  if (animatedEmojis.has(name)) {
    return \`<a:\${name}:\${id}>\`;
  }
  return \`<:\${name}:\${id}>\`;
};

const getEmojiObject = (name) => {
  if (!emojis[name]) return null;
  return {
    id: emojis[name],
    name: name,
    animated: animatedEmojis.has(name)
  };
};

module.exports = {
  emojis,
  getEmoji,
  getEmojiObject
};
`;

            try {
                fs.writeFileSync(botemojiPath, fileContent, 'utf8');
            } catch (writeErr) {
                console.error("❌ Failed to write botemoji.js:", writeErr);
            }

            // Prepare completion embed
            const embed = new EmbedBuilder()
                .setTitle("🔮 Application Emojis Sync Complete")
                .setColor("#2ecc71")
                .addFields(
                    { name: "Total Guild Emojis", value: `${guildEmojis.size}`, inline: true },
                    { name: "Successfully Uploaded", value: `${uploaded}`, inline: true },
                    { name: "Skipped (Already Exists)", value: `${skipped}`, inline: true },
                    { name: "Deleted (Overwritten)", value: `${deleted}`, inline: true },
                    { name: "Failed", value: `${failed}`, inline: true }
                )
                .setTimestamp();

            if (uploadDetails.length > 0) {
                let detailsText = uploadDetails.join("\n");
                if (detailsText.length > 1000) {
                    detailsText = detailsText.substring(0, 997) + "...";
                }
                embed.setDescription(`**Uploaded Emojis:**\n${detailsText}\n\n*Updated \`botemoji.js\` file with synced emojis.*`);
            } else {
                embed.setDescription("No new emojis were uploaded. *Updated \`botemoji.js\` file.*");
            }

            await interaction.editReply({
                content: "✅ Emoji sync completed!",
                embeds: [embed]
            });

        } catch (err) {
            console.error("❌ Error running sync-emojis:", err);
            await interaction.editReply({
                content: `❌ An error occurred during emoji sync: \`${err.message}\``
            });
        }
    }
};
