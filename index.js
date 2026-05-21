// Node.js core modules
const path = require("path");
const fs = require("fs");

// Third-party libraries
const config = require("./config/config.js");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Collection,
  PermissionsBitField,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

// Internal project utilities
const { getEmoji } = require("./utils/emoji.js");
const { handleInteraction } = require("./utils/handler.js");

// Constants
const DISCORD_TOKEN = config.DISCORD_TOKEN;
const PREFIX = config.PREFIX;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
});
client.activeTicketTimers = new Map();

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);


  client.user.setPresence({
    status: "idle",
    activities: [
      {
        name: "Nations !!",
        type: 3 // 👀 3 = Watching
      }
    ]
  });
});

// Global Hub - Tools to be passed to commands
const tools = {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  coc: require("./utils/cocManager.js"),
  data: require("./utils/dataManager.js"),
  emoji: require("./utils/emoji.js"),
  config: config,
  client: client
};

// ─────────────────────────────────────────
// ; PREFIX MESSAGE COMMANDS
// ─────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Check for active ticket auto-close timer cancellation
  if (client.activeTicketTimers && client.activeTicketTimers.has(message.channel.id)) {
    const ticketOwnerId = message.channel.topic;
    if (message.author.id === ticketOwnerId) {
      const timerData = client.activeTicketTimers.get(message.channel.id);
      if (timerData) {
        clearTimeout(timerData.timeout);
        client.activeTicketTimers.delete(message.channel.id);
        await message.channel.send("✅ **Timer cancelled.** The ticket creator has replied.").catch(() => null);
      }
    }
  }

  let usedPrefix = null;
  if (message.content.startsWith(PREFIX)) usedPrefix = PREFIX;
  else if (message.content.startsWith("!")) usedPrefix = "!";

  if (!usedPrefix) return;

  const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const exclamationCommands = ["fwa", "cwl", "bases"];
  
  // If the command is fwa, cwl, or bases, it MUST use '!'
  if (exclamationCommands.includes(commandName) && usedPrefix !== "!") return;
  
  // If it is NOT one of those three, it MUST use ';'
  if (!exclamationCommands.includes(commandName) && usedPrefix === "!") return;

  try {
    const context = { ...tools, commandName, prefix: usedPrefix };

    if (commandName === "link") {
      const command = require("./commands/coc/profile/link.js");
      await command.execute(message, args, context);

    } else if (commandName === "profile" || commandName === "p") {
      const command = require("./commands/coc/profile/profile.js");
      await command.execute(message, args, context);

    } else if (commandName === "unlink") {
      const command = require("./commands/coc/profile/unlink.js");
      await command.execute(message, args, context);

    } else if (commandName === "as") {
      const command = require("./commands/discord/roles/as.js");
      await command.execute(message, args, context);

    } else if (commandName === "crinfo") {
      const command = require("./commands/discord/roles/clanroleinfo.js");
      await command.execute(message, args, context);

    } else if (commandName === "clans" || commandName === "clan") {
      const command = require("./commands/coc/clan/clan.js");
      await command.execute(message, args, context);

    } else if (commandName === "ahelp") {
      const { ahelp } = require("./commands/info/help.js");
      await ahelp.execute(message, args, context);

    } else if (commandName === "help") {
      const { help } = require("./commands/info/help.js");
      await help.execute(message, args, context);

    } else if (commandName === "delc") {
      const command = require("./commands/discord/channel/delc.js");
      await command.run(message, args, context);

    } else if (commandName === "delete") {
      const command = require("./commands/discord/channel/delete.js");
      await command.run(message, args, context);

    } else if (commandName === "cwl") {
      const command = require("./commands/coc/war/cwl.js");
      await command.execute(message, args, context);

    } else if (commandName === "compo") {
      const command = require("./commands/coc/clan/compo.js");
      await command.execute(message, args, context);

    } else if (commandName === "bases") {
      const command = require("./commands/coc/clan/bases.js");
      await command.execute(message, args, context);

    } else if (commandName === "fwa") {
      const command = require("./commands/coc/clan/fwa.js");
      await command.execute(message, args, context);

    } else if (commandName === "war" || commandName === "warweight") {
      const command = require("./commands/coc/war/warweight.js");
      await command.execute(message, args, context);

    } else if (commandName === "app" || commandName === "re") {
      const command = require("./commands/discord/roles/app.js");
      await command.execute(message, args, context);
    }

  } catch (err) {
    console.error(err);
    message.channel.send("⚠️ There was an error executing that command.");
  }
});

// SLASH COMMAND LOADER
// ─────────────────────────────────────────
client.commands = new Collection();

function getCommandFiles(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getCommandFiles(fullPath));
    } else if (item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const commandFiles = getCommandFiles(path.resolve(__dirname, './commands'));
for (const file of commandFiles) {
  try {
    const command = require(file);
    if (command.data && command.data.name) {
      client.commands.set(command.data.name, command);
    }
  } catch (err) {
    console.error(`Failed to load command at ${file}:`, err.message);
  }
}

// ─────────────────────────────────────────
// INTERACTION HANDLER
// ─────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction, tools);
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && command.autocomplete) {
        await command.autocomplete(interaction, tools);
      }
    } else {
      await handleInteraction(interaction, tools);
    }
  } catch (error) {
    console.error("❌ Interaction Error:", error);
  }
});

// ─────────────────────────────────────────
// WELCOME / LEAVE EVENTS
// ─────────────────────────────────────────
const WELCOME_CHANNEL_ID = config.WELCOME_CHANNEL_ID || "1154293306637946890";
const SUPPORT_ROLE_ID    = config.STAFF_ROLE_IDS?.[0] || "1154276716982833154";
const RULES_CHANNEL_ID   = config.RULES_CHANNEL_ID   || "1154111265258614795";
const TICKET_CHANNEL_ID  = config.PANEL_CHANNEL_ID   || "1427670112533614623";

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`Welcome to 『✦ Nations ✦』`)
    .setDescription(
      `A proud **Clan** part of ${getEmoji("whited")} **FWA CLANS** ${getEmoji("whited")} who does **Farm Wars**.` +
      ` Please type \`!fwa\` & \`!faq\` to know about Farm war's ${getEmoji("gtick")}\n\n` +

      `\`\`\`We belong to "The Nations" Family.\`\`\`\n` +

      `> If you wish to join our clan then please head to <#${TICKET_CHANNEL_ID}>.\n\n` +

      `> If you're already a member of our clan then please do the needful as listed below.\n` +
      `• **Step** 🔵: Post your PLAYER tag.\n` +
      `• **Step** 🔵: Post a picture of My Profile tab.\n\n` +

      `${getEmoji("arrow")} Once done please wait for a staff member to assist you. We will be with you shortly.\n\n` +

      `彡 Meanwhile visit <#${RULES_CHANNEL_ID}> to know how we run 彡`
    )
    .setFooter({ text: "Welcome to the family!", iconURL: member.guild.iconURL({ dynamic: true }) })
    .setTimestamp();

  await channel.send({
    content: `Hello 🎋 ${member}. Please read the instructions below & follow suit. 🍺`,
    embeds: [embed]
  }).catch(() => null);
});

client.on("guildMemberRemove", async (member) => {
  const channelId = "1154294780969373786";
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(Math.floor(Math.random() * 0xFFFFFF))
    .setTitle("👋 Member Left")
    .setDescription(`${member.user.tag} (${member}) has left the server.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `User ID: ${member.id}` })
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => { });
});


// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
client.login(DISCORD_TOKEN);
