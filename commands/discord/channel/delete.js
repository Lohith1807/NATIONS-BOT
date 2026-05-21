

function parseDMY(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(p => parseInt(p, 10));
    if (!day || !month || !year) return null;
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
}

async function deleteMessagesInBatches(channel, filterFn) {
    let deletedCount = 0;
    let lastId = null;

    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
        if (fetched.size === 0) break;

        const messagesToDelete = filterFn ? fetched.filter(filterFn) : fetched;
        if (messagesToDelete.size === 0) {
            lastId = fetched.last()?.id;
            continue;
        }

        const now = Date.now();
        const newerMessages = messagesToDelete.filter(m => now - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
        const olderMessages = messagesToDelete.filter(m => now - m.createdTimestamp >= 14 * 24 * 60 * 60 * 1000);

        // Bulk delete for recent ones
        if (newerMessages.size > 0) {
            await channel.bulkDelete(newerMessages, true).catch(() => { });
            deletedCount += newerMessages.size;
        }

        // Delete old ones individually
        for (const [, msg] of olderMessages) {
            await msg.delete().catch(() => { });
            deletedCount++;
        }

        lastId = fetched.last()?.id;
    }

    return deletedCount;
}

module.exports = {
    name: "delete",
    description: "Delete messages by count, date, or all",
    async run(message, args, { config }) {
        try {
            const ALLOWED_ROLES = config.ADMIN_ROLE_IDS;
            const { PermissionsBitField } = require("discord.js");
            // 🔐 Check role
            if (!message.member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id))) {
                return message.channel.send('❌ You do not have permission to use this command.');
            }

            // 🔐 Check Manage Messages permission
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return message.channel.send('❌ You need the **Manage Messages** permission to use this command.');
            }

            if (!args.length) {
                return message.channel.send('❌ Usage: `;delete <count>` | `;delete from DD/MM/YYYY` | `;delete all`');
            }

            await message.delete().catch(() => { });

            // 🔥 Delete ALL
            if (args[0].toLowerCase() === 'all') {
                const totalDeleted = await deleteMessagesInBatches(message.channel);
                return message.channel.send(`✅ Deleted **${totalDeleted}** messages from this channel.`);
            }

            // 🔢 Delete COUNT
            if (!isNaN(args[0])) {
                let count = parseInt(args[0]);
                if (count < 1 || count > 1000) {
                    return message.channel.send('❌ Please provide a number between **1** and **1000**.');
                }

                let deletedCount = 0;
                let lastId = null;

                while (deletedCount < count) {
                    const fetchCount = Math.min(100, count - deletedCount);
                    const fetched = await message.channel.messages.fetch({ limit: fetchCount, before: lastId });
                    if (fetched.size === 0) break;

                    const now = Date.now();
                    const newerMessages = fetched.filter(m => now - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
                    const olderMessages = fetched.filter(m => now - m.createdTimestamp >= 14 * 24 * 60 * 60 * 1000);

                    if (newerMessages.size > 0) {
                        await message.channel.bulkDelete(newerMessages, true).catch(() => { });
                        deletedCount += newerMessages.size;
                    }

                    for (const [, msg] of olderMessages) {
                        await msg.delete().catch(() => { });
                        deletedCount++;
                    }

                    lastId = fetched.last()?.id;
                }

                return message.channel.send(`✅ Deleted **${deletedCount}** messages.`);
            }

            // 📅 Delete FROM DATE
            if (args[0].toLowerCase() === 'from' && args[1]) {
                let fromDate = parseDMY(args[1]);
                if (!fromDate) {
                    return message.channel.send('❌ Invalid date format. Use `DD/MM/YYYY`.');
                }

                const totalDeleted = await deleteMessagesInBatches(message.channel, m => m.createdAt >= fromDate);
                return message.channel.send(`✅ Deleted **${totalDeleted}** messages from **${args[1]}** onwards.`);
            }

            return message.channel.send('❌ Usage: `;delete <count>` | `;delete from DD/MM/YYYY` | `;delete all`');
        } catch (error) {
            console.error('❌ Error in delete command:', error);
            return message.channel.send('⚠️ An error occurred while trying to delete messages. Some messages might not have been deleted.').catch(() => { });
        }
    }
};
