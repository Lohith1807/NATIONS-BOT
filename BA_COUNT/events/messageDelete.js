const { getServers } = require('../utils/dataManager');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        const guildId = message.guildId;
        if (!guildId) return;

        const servers = getServers();
        const serverConfig = servers[guildId];

        if (!serverConfig) return;
        if (message.channel.id !== serverConfig.channelId) return;

        // Verify that this message was previously counted
        if (!serverConfig.lastMessages || !serverConfig.lastMessages[message.id]) {
            return;
        }

        const deletedNumber = serverConfig.lastMessages[message.id];
        const nextNumber = serverConfig.currentCount + 1;
        const author = message.author;

        let content = '';
        if (author) {
            content = `<@${author.id}> this guy deleted number ${deletedNumber}\n\nnext number is : ${nextNumber}`;
        } else {
            content = `Someone deleted the number ${deletedNumber}\n\nnext number is : ${nextNumber}`;
        }

        await message.channel.send({ content }).catch(() => {});
    }
};
