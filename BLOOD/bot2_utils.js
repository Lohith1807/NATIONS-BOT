const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function extractInviteCode(input) {
    const match = input.match(/(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/([a-zA-Z0-9-]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9-]+$/.test(input.trim())) return input.trim();
    return null;
}

async function buildInviteEmbed(guild, code) {
    const guildInvites = await guild.invites.fetch();
    const invite = guildInvites.get(code);
    if (!invite) return null;

    const uses      = invite.uses ?? 0;
    const maxUses   = invite.maxUses === 0 ? "∞ (Unlimited)" : `${invite.maxUses}`;
    const inviter   = invite.inviter ? `${invite.inviter.tag} (<@${invite.inviter.id}>)` : "Unknown / Vanity URL";
    const channel   = invite.channel ? `<#${invite.channel.id}>` : "Unknown";
    const expiresAt = invite.expiresAt
        ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>`
        : "Never (permanent)";
    const createdAt = invite.createdAt
        ? `<t:${Math.floor(invite.createdAt.getTime() / 1000)}:D>`
        : "Unknown";

    return new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`🔗 Invite Usage — \`${code}\``)
        .setDescription(`Server: **${guild.name}**`)
        .addFields(
            { name: "✅ Members Joined via This Link", value: `## ${uses.toLocaleString()}`, inline: false },
            { name: "🎯 Max Uses",   value: maxUses,   inline: true },
            { name: "📌 Channel",    value: channel,   inline: true },
            { name: "👤 Created By", value: inviter,   inline: false },
            { name: "📅 Created On", value: createdAt, inline: true },
            { name: "⏳ Expires",    value: expiresAt, inline: true },
        )
        .setFooter({ text: "Uses = people who joined via this invite  •  Last refreshed" })
        .setTimestamp();
}

function createRefreshButton(code) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`refresh_invite:${code}`)
            .setLabel("🔄 Refresh")
            .setStyle(ButtonStyle.Secondary)
    );
}

module.exports = { extractInviteCode, buildInviteEmbed, createRefreshButton };
