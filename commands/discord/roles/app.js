const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

function getRandomColor() {
  return Math.floor(Math.random() * 16777215);
}

function getUserDisplayName(member) {
  return member.nickname || member.user.username;
}

// Helper to remove seeker role and any registered clan roles
async function removeSeekerAndClanRoles(member, config, dataManager) {
  try {
    const rolesToRemove = [];
    const botMember = member.guild.members.me;

    // 1. Identify Seeker Role
    if (config.SEEKER_ROLE_ID && member.roles.cache.has(config.SEEKER_ROLE_ID)) {
      rolesToRemove.push(config.SEEKER_ROLE_ID);
    }

    // 2. Identify Clan Roles
    let clanRolesData = {};
    try {
      clanRolesData = dataManager.getClanRoles();
    } catch (e) {}

    const clanRoleIds = Object.values(clanRolesData).map(c => c.roleId);
    for (const clanRoleId of clanRoleIds) {
      if (member.roles.cache.has(clanRoleId)) {
        rolesToRemove.push(clanRoleId);
      }
    }

    // 3. Remove them safely
    if (rolesToRemove.length > 0) {
      const validRoles = member.roles.cache.filter(r => 
        rolesToRemove.includes(r.id) && 
        r.position < botMember.roles.highest.position &&
        !r.managed
      );
      if (validRoles.size > 0) {
        await member.roles.remove(validRoles);
      }
    }
  } catch (err) {
    console.error('[Error] Failed to remove seeker/clan roles:', err.message);
  }
}

module.exports = {
  name: 'app',
  description: 'Approve or reject a user based on their CoC linked accounts',
  async execute(input, args, context) {
    const { client, data: dataManager, EmbedBuilder, config, emoji: { getEmoji } } = context;
    const message = input; // For legacy logic compatibility
    
    // Command can be parsed directly from input if needed, but context.commandName has it cleanly.
    const command = context.commandName.toLowerCase();

    if (!['app', 're'].includes(command)) return;

    const mentionedUser = message.mentions.members.first();
    if (!mentionedUser) {
      const embed = new EmbedBuilder()
        .setDescription(`➥ Please mention a user to ${command === 'app' ? 'approve' : 'reject'}.\nExample: \`;${command} @user\``)
        .setColor(getRandomColor());
      return message.channel.send({ embeds: [embed] });
    }

    if (command === 'app') {
      // Load userdata.json
      let userdata;
      try {
        userdata = dataManager.getUserData();
      } catch (err) {
        console.error('Error reading userdata.json:', err);
        const embed = new EmbedBuilder()
          .setDescription('➥ Failed to read user data. Contact the developer.')
          .setColor(getRandomColor());
        return message.channel.send({ embeds: [embed] });
      }

      const linkedAccounts = userdata[mentionedUser.id];

      if (!linkedAccounts || !Array.isArray(linkedAccounts) || linkedAccounts.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('➥ Approval Denied')
          .setDescription(`${mentionedUser.user.tag} has not linked any Clash of Clans accounts.`)
          .setColor(getRandomColor())
          .setFooter({ text: 'They must link their account before being approved.' });

        return message.channel.send({ embeds: [embed] });
      }

      // If only one linked account, approve directly
      if (linkedAccounts.length === 1) {
        return approveUser(message, mentionedUser, linkedAccounts[0], client, config, getEmoji, dataManager);
      }

      // Multiple linked accounts — show select menu
      const options = linkedAccounts.map((acc, index) => ({
        label: acc.name,
        description: acc.tag,
        value: index.toString(),
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select-coc-account')
        .setPlaceholder('Select a Clash of Clans account to approve')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const promptEmbed = new EmbedBuilder()
        .setTitle('🛡️ Select a Clash of Clans Account')
        .setDescription(`Multiple accounts found for **${mentionedUser.user.tag}**.\nPlease select the account to approve.`)
        .setColor(getRandomColor());

      const reply = await message.channel.send({
        embeds: [promptEmbed],
        components: [row],
      });

      const collector = reply.createMessageComponentCollector({
        componentType: 3, // Select Menu
        time: 60000,
        filter: (i) => i.user.id === message.author.id,
      });

      collector.on('collect', async (interaction) => {
        await interaction.deferUpdate();
        const selectedIndex = parseInt(interaction.values[0]);
        const selectedAccount = linkedAccounts[selectedIndex];

        await approveUser(message, mentionedUser, selectedAccount, client, config, getEmoji, dataManager);

        await reply.edit({ components: [] });
        collector.stop();
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          const timeoutEmbed = EmbedBuilder.from(promptEmbed)
            .setColor(getRandomColor())
            .setFooter({ text: '⏱️ Timed out — no selection made.' });

          reply.edit({ components: [], embeds: [timeoutEmbed] });
        }
      });
    }

    if (command === 're') {
      // REJECT COMMAND - Remove all roles except @everyone, add reject role
      const member = mentionedUser;

      const rejectRole = message.guild.roles.cache.get(config.REJECT_ROLE_ID);
      if (!rejectRole) {
        const embed = new EmbedBuilder()
          .setDescription('➥ Reject role not found in server or not configured in .env.')
          .setColor(getRandomColor());
        return message.channel.send({ embeds: [embed] });
      }

      try {
        const botMember = message.guild.members.me;
        
        // Strip all roles and keep only Reapply and Seeker roles (plus managed server roles)
        const rolesToKeep = member.roles.cache.filter(r => r.managed || r.id === message.guild.id).map(r => r.id);
        
        if (config.REJECT_ROLE_ID && message.guild.roles.cache.has(config.REJECT_ROLE_ID)) {
          rolesToKeep.push(config.REJECT_ROLE_ID);
        }
        if (config.SEEKER_ROLE_ID && message.guild.roles.cache.has(config.SEEKER_ROLE_ID)) {
          rolesToKeep.push(config.SEEKER_ROLE_ID);
        }

        const safeRolesToKeep = rolesToKeep.filter(id => {
            const r = message.guild.roles.cache.get(id);
            return r && (r.position < botMember.roles.highest.position || r.managed || r.id === message.guild.id);
        });

        await member.roles.set(safeRolesToKeep).catch(e => console.log(`[Info] Could not set roles: ${e.message}`));

        const rejecterName = getUserDisplayName(message.member);

        const successEmbed = new EmbedBuilder()
          .setTitle(`${getEmoji("bluex")} User Rejected`)
          .setDescription(`${member.user.tag} has been rejected.`)
          .addFields({ name: 'Role Added', value: rejectRole.name })
          .setColor(getRandomColor())
          .setFooter({ text: `Un-qualified by ${rejecterName}` });

        await message.channel.send({ embeds: [successEmbed] });

        // Notify reject channel
        const notifyChannel = message.guild.channels.cache.get(config.REJECT_NOTIFY_CHANNEL_ID);
        if (notifyChannel && notifyChannel.isTextBased()) {
          const notifyEmbed = new EmbedBuilder()
            .setTitle(`# ⛔ | re-apply`)
            .setDescription(
              `This is # ⛔ | re-apply. You're here because:\n` +
              `• You either left the clan, were kicked, or exceeded strike limits.\n` +
              `• You can apply again after a week by typing \`!apply\`.\n\n` +
              `Nations X Storms - 💎 FWA`
            )
            .setColor(0x00FFFF) // Cyan color
            .setTimestamp();

          notifyChannel.send({ 
            content: `Please read the following <@${member.id}>`,
            embeds: [notifyEmbed] 
          });
        }
      } catch (err) {
        console.error('Error rejecting user:', err);
        const errorEmbed = new EmbedBuilder()
          .setDescription('➥ Failed to update roles. Check my permissions or role hierarchy.')
          .setColor(getRandomColor());
        message.channel.send({ embeds: [errorEmbed] });
      }
    }
  }
};

// Helper function to approve user
async function approveUser(message, member, account, client, config, getEmoji, dataManager) {
  const role = message.guild.roles.cache.get(config.APPROVE_ROLE_ID);
  if (!role) {
    const embed = new EmbedBuilder()
      .setDescription('➥ Approve role not found in server or not configured in .env.')
      .setColor(getRandomColor());
    return message.channel.send({ embeds: [embed] });
  }

  try {
    const botMember = message.guild.members.me;

    // Clean up seeker and clan roles first
    await removeSeekerAndClanRoles(member, config, dataManager);

    if (role.position < botMember.roles.highest.position) {
      await member.roles.add(role).catch(e => console.log(`[Info] Could not add approve role: ${e.message}`));
    } else {
      console.log(`[Warning] Cannot add approve role as it is higher than the bot's role.`);
    }

    const approverName = member.guild.members.cache.get(message.author.id)
      ? getUserDisplayName(message.member)
      : message.author.username;

    const successEmbed = new EmbedBuilder()
      .setTitle(`${getEmoji("gtick")} Approved Successfully`)
      .setDescription(`${member.user.tag} has been given the **${role.name}** role.`)
      .addFields({ name: 'Approved Account', value: `${account.name} (${account.tag})` })
      .setColor(getRandomColor())
      .setFooter({ text: `Approved by ${approverName}` });

    await message.channel.send({ embeds: [successEmbed] });

    // Send notification to approve notify channel
    const notifyChannel = message.guild.channels.cache.get(config.APPROVE_NOTIFY_CHANNEL_ID);
    if (notifyChannel && notifyChannel.isTextBased()) {
      const welcomeEmoji = getEmoji("welcome") || "👋";
      const notifyEmbed = new EmbedBuilder()
        .setTitle(`${welcomeEmoji} Welcome to # 🔰 | approved`)
        .setDescription(
          `● This is where you will find spaces in our clan channels.\n` +
          `● You will be @mentioned when there is a spot open for you.\n` +
          `● You can stay in your current clan if needed.\n` +
          `● If any questions please ask here.\n` +
          `● Feel free to talk in general channels.\n\n` +
          `Thank you and good day 💎.\n\n` +
          `- **Approved by** ${approverName} ✅`
        )
        .addFields(
          { name: 'Clash Account', value: `**${account.name}** (${account.tag})` }
        )
        .setColor(0x00FFFF) // Cyan color
        .setTimestamp();

      notifyChannel.send({ 
        content: `Hello <@${member.id}>! You have been approved.`,
        embeds: [notifyEmbed] 
      });
    }
  } catch (err) {
    console.error('Error assigning role:', err);
    const errorEmbed = new EmbedBuilder()
      .setDescription('➥ Failed to assign role. Check my permissions or role hierarchy.')
      .setColor(getRandomColor());
    message.channel.send({ embeds: [errorEmbed] });
  }
}
