
function splitIntoFields(items, limit = 1024) {
    const fields = [];
    let current = "";
    for (const item of items) {
        if ((current + item).length + 2 > limit) {
            fields.push(current);
            current = item;
        } else {
            current = current ? `${current}\n\n${item}` : item;
        }
    }
    if (current) fields.push(current);
    return fields;
}

module.exports = {
    ahelp: {
        name: "ahelp",
        description: "Shows a list of admin commands and all commands",
        execute(message, args, { EmbedBuilder, config, data }) {
            try {
                const ALLOWED_ROLE_ID = config.ADMIN_ROLE_IDS;
                const ALLOWED_CATEGORY_ID = config.ADMIN_CATEGORY_ID;

                if (!message.guild || !message.member) return;
                if (!ALLOWED_ROLE_ID.some(roleId => message.member.roles.cache.has(roleId))) return;

                // Check if the command is used in the allowed category
                if (!message.channel.parentId || message.channel.parentId !== ALLOWED_CATEGORY_ID) {
                    return message.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xe74c3c)
                                .setDescription("❌ You can only use this command in the designated admin category.")
                                .setTimestamp()
                        ]
                    });
                }

                const helpData = data.getHelpData();
                const commands = helpData.commands || {};
                const randomColor = Math.floor(Math.random() * 16777215);

                const staffItems = Object.entries(commands)
                    .filter(([_, info]) => info.permission && info.permission.includes("Staff/Admin"))
                    .map(([name, info]) => {
                        let prefix = ';';
                        if (info.syntax) {
                            if (info.syntax.includes('!')) prefix = '!';
                            else if (info.syntax.includes('/')) prefix = '/';
                        }
                        return `**${prefix}${name}** → ${info.use}`;
                    });

                const everyoneItems = Object.entries(commands)
                    .filter(([_, info]) => !info.permission || info.permission.includes("Everyone"))
                    .map(([name, info]) => {
                        let prefix = ';';
                        if (info.syntax) {
                            if (info.syntax.includes('!')) prefix = '!';
                            else if (info.syntax.includes('/')) prefix = '/';
                        }
                        return `**${prefix}${name}** → ${info.use}`;
                    });

                const helpEmbed = new EmbedBuilder()
                    .setColor(randomColor)
                    .setTitle("🛠️ All Bot Commands (Admin View)")
                    .setFooter({ text: `Requested by ${message.author.tag}` })
                    .setTimestamp();

                // Add Staff Fields
                const staffFields = splitIntoFields(staffItems);
                staffFields.forEach((val, i) => {
                    helpEmbed.addFields({ name: i === 0 ? "🛡️ Staff/Admin Commands" : "🛡️ Staff/Admin (cont.)", value: val });
                });

                // Add Everyone Fields
                const everyoneFields = splitIntoFields(everyoneItems);
                everyoneFields.forEach((val, i) => {
                    helpEmbed.addFields({ name: i === 0 ? "👤 Everyone Commands" : "👤 Everyone (cont.)", value: val });
                });

                message.channel.send({ embeds: [helpEmbed] }).catch(() => { });
                message.delete().catch(() => { });
            } catch (error) {
                console.error('❌ Error in ahelp command:', error);
                return message.channel.send('⚠️ Error loading admin help.').catch(() => { });
            }
        },
    },

    help: {
        name: "help",
        description: "Shows a list of user commands",
        execute(message, args, { EmbedBuilder, data }) {
            try {
                const helpData = data.getHelpData();
                const commands = helpData.commands || {};
                const randomColor = Math.floor(Math.random() * 16777215);

                const everyoneItems = Object.entries(commands)
                    .filter(([_, info]) => !info.permission || info.permission.includes("Everyone"))
                    .map(([name, info]) => {
                        let prefix = ';';
                        if (info.syntax) {
                            if (info.syntax.includes('!')) prefix = '!';
                            else if (info.syntax.includes('/')) prefix = '/';
                        }
                        return `**${prefix}${name}** → ${info.use}`;
                    });

                const everyoneFields = splitIntoFields(everyoneItems);
                const embeds = [];

                everyoneFields.forEach((val, i) => {
                    const embed = new EmbedBuilder()
                        .setColor(randomColor)
                        .setTitle(i === 0 ? "📖 Bot Commands" : "📖 Bot Commands (cont.)")
                        .setDescription(val)
                        .setFooter({ text: `Requested by ${message.author.tag}` })
                        .setTimestamp();
                    embeds.push(embed);
                });

                if (embeds.length === 0) {
                    return message.channel.send("No commands available for everyone.");
                }

                message.channel.send({ embeds: embeds.slice(0, 10) }).catch(() => { });
                message.delete().catch(() => { });
            } catch (error) {
                console.error('❌ Error in help command:', error);
                return message.channel.send('⚠️ Error loading help.').catch(() => { });
            }
        },
    }
};
