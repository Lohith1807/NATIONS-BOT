const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { buildInviteEmbed, createRefreshButton } = require('./bot2_utils.js');

const BOT2_TOKEN     = process.env.BOT2_TOKEN;
const BOT2_CLIENT_ID = "1514551450867466320";

const bot2 = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildInvites],
});

bot2.commands = new Collection();
const commandsPath = path.join(__dirname, 'bot2_commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commandsData = [];
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    bot2.commands.set(command.data.name, command);
    if(command.data.toJSON) commandsData.push(command.data.toJSON());
    else commandsData.push(command.data);
}

let bot2CommandsRegistered = false;

bot2.once("ready", async () => {
    console.log(`✅ [Bot2] ${bot2.user.tag} is online`);
    if (bot2CommandsRegistered) return;
    bot2CommandsRegistered = true;

    const rest = new REST({ version: "10" }).setToken(BOT2_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(BOT2_CLIENT_ID), { body: commandsData });
        console.log("✅ [Bot2] Slash commands registered.");
    } catch (err) {
        console.error("❌ [Bot2] Failed to register commands:", err);
    }
});

bot2.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = bot2.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction, bot2);
        } catch (err) {
            console.error(err);
            if(interaction.deferred) {
                await interaction.editReply({ content: "❌ Error executing command" }).catch(()=>null);
            } else {
                await interaction.reply({ content: "❌ Error executing command", ephemeral: true }).catch(()=>null);
            }
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith("refresh_invite:")) {
        const code = interaction.customId.split(":")[1];
        await interaction.deferUpdate();

        try {
            const embed = await buildInviteEmbed(interaction.guild, code);
            if (!embed) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF9900)
                            .setTitle("⚠️ Invite No Longer Available")
                            .setDescription(`Invite \`${code}\` could not be found — it may have been deleted.`),
                    ],
                    components: [],
                });
            }

            await interaction.editReply({
                embeds: [embed],
                components: [createRefreshButton(code)],
            });
        } catch (err) {
            console.error("❌ [Bot2] Refresh error:", err);
        }
    }
});

bot2.login(BOT2_TOKEN);
