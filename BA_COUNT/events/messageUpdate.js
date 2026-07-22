const { getServers } = require('../utils/dataManager');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        // Fetch full message if partial
        if (newMessage.partial) {
            try {
                newMessage = await newMessage.fetch();
            } catch (err) {
                console.error('Failed to fetch partial message:', err);
                return;
            }
        }

        if (newMessage.author?.bot) return;

        const guildId = newMessage.guildId;
        if (!guildId) return;

        const servers = getServers();
        const serverConfig = servers[guildId];

        if (!serverConfig) return;
        if (newMessage.channel.id !== serverConfig.channelId) return;

        // Verify that this message was previously counted
        if (!serverConfig.lastMessages || !serverConfig.lastMessages[newMessage.id]) {
            return;
        }

        const oldNumber = serverConfig.lastMessages[newMessage.id];
        const author = newMessage.author;
        if (!author) return;

        const content = newMessage.content ? newMessage.content.trim() : '';

        // Safe evaluation of the new content to see if it represents a number
        let inputNumber = null;
        const mathRegex = /^[\da-fA-FxXbBoO+\-*/. ()]+$/;
        
        if (mathRegex.test(content) && content !== '') {
            try {
                const evalResult = Function(`'use strict'; return (${content})`)();
                if (typeof evalResult === 'number' && !isNaN(evalResult) && isFinite(evalResult)) {
                    inputNumber = evalResult;
                }
            } catch (error) {
            }
        }

        if (inputNumber !== oldNumber && /^[a-fA-F0-9]+$/.test(content) && content !== '') {
            if (parseInt(content, 2) === oldNumber) {
                inputNumber = oldNumber;
            } else if (parseInt(content, 16) === oldNumber) {
                inputNumber = oldNumber;
            } else {
                const parsedDec = parseInt(content, 10);
                if (!isNaN(parsedDec)) {
                    inputNumber = parsedDec;
                } else {
                    const parsedHex = parseInt(content, 16);
                    if (!isNaN(parsedHex)) {
                        inputNumber = parsedHex;
                    }
                }
            }
        }

        const displayNewNumber = (inputNumber !== null) ? inputNumber : (content || 'empty/unsupported content');
        const nextNumber = serverConfig.currentCount + 1;

        // Tag user and display the change message
        await newMessage.channel.send({
            content: `<@${author.id}> this guy changed changed number from ${oldNumber} to ${displayNewNumber}\n\nnext number is : ${nextNumber}`
        }).catch(() => {});
    }
};
