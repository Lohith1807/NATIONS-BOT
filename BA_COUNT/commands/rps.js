const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play a game of Rock, Paper, Scissors against the bot or a friend!')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('Challenge a user to RPS!')
                .setRequired(false)
        ),
        
    async execute(interaction) {
        const opponent = interaction.options.getUser('opponent');

        if (opponent) {
            if (opponent.bot) {
                return interaction.reply({ content: 'You cannot challenge bots!', ephemeral: true });
            }
            if (opponent.id === interaction.user.id) {
                return interaction.reply({ content: 'You cannot challenge yourself!', ephemeral: true });
            }
            return await handlePvP(interaction, opponent);
        } else {
            return await handlePvB(interaction);
        }
    }
};

const emojis = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️'
};
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function getRpsButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rock').setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('paper').setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('scissors').setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Primary)
    );
}

function getDisabledButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rock').setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('paper').setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('scissors').setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Primary).setDisabled(true)
    );
}

async function handlePvB(interaction) {
    const row = getRpsButtons();
    const embed = new EmbedBuilder()
        .setTitle('Rock, Paper, Scissors!')
        .setDescription('Choose your weapon below:')
        .setColor('#2b2d31');

    const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'You cannot play in someone else\'s game! Start your own with /rps.', ephemeral: true });
        }

        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        const userChoice = i.customId;

        let resultMessage = '';
        let color = '#2b2d31';

        if (userChoice === botChoice) {
            resultMessage = 'It\'s a tie! 🤝';
            color = '#ffff00';
        } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            resultMessage = 'You win! 🎉';
            color = '#00ff00';
        } else {
            resultMessage = 'I win! 😈';
            color = '#ff0000';
        }

        const resultEmbed = new EmbedBuilder()
            .setTitle('Rock, Paper, Scissors - Results')
            .addFields(
                { name: 'You chose', value: `${emojis[userChoice]} ${capitalize(userChoice)}`, inline: true },
                { name: 'I chose', value: `${emojis[botChoice]} ${capitalize(botChoice)}`, inline: true },
                { name: 'Result', value: resultMessage, inline: false }
            )
            .setColor(color);

        await i.update({ embeds: [resultEmbed], components: [getDisabledButtons()] });
        collector.stop();
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            embed.setDescription('Game timed out. You took too long to choose!');
            embed.setColor('#ff0000');
            interaction.editReply({ embeds: [embed], components: [getDisabledButtons()] }).catch(() => {});
        }
    });
}

async function handlePvP(interaction, opponent) {
    const yesButton = new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success);
    const noButton = new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger);
    const challengeRow = new ActionRowBuilder().addComponents(yesButton, noButton);

    const challengeMsg = await interaction.reply({
        content: `<@${opponent.id}>, <@${interaction.user.id}> has challenged you! Are you ready to fight?`,
        components: [challengeRow],
        fetchReply: true
    });

    const challengeCollector = challengeMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
    });

    challengeCollector.on('collect', async i => {
        if (i.user.id !== opponent.id) {
            return i.reply({ content: 'Only the challenged user can reply to this!', ephemeral: true });
        }

        challengeCollector.stop('answered');

        if (i.customId === 'no') {
            return i.update({
                content: `That Noob <@${opponent.id}> Got Fear to play with you 😂 hence <@${interaction.user.id}> you win!`,
                components: []
            });
        }

        if (i.customId === 'yes') {
            await i.update({
                content: `<@${interaction.user.id}> vs <@${opponent.id}>\nBoth players, choose your weapons!`,
                components: [getRpsButtons()]
            });

            // Start PvP Game Collector
            startPvPGame(interaction, opponent, challengeMsg);
        }
    });

    challengeCollector.on('end', (collected, reason) => {
        if (reason !== 'answered') {
            interaction.editReply({
                content: `<@${opponent.id}> didn't respond in time. Challenge cancelled.`,
                components: []
            }).catch(() => {});
        }
    });
}

function startPvPGame(interaction, opponent, message) {
    const pvpCollector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
    });

    const choices = {};

    pvpCollector.on('collect', async i => {
        if (i.user.id !== interaction.user.id && i.user.id !== opponent.id) {
            return i.reply({ content: 'You are not in this game!', ephemeral: true });
        }

        if (choices[i.user.id]) {
            return i.reply({ content: 'You have already made your choice!', ephemeral: true });
        }

        choices[i.user.id] = i.customId;
        await i.reply({ content: `You chose ${emojis[i.customId]} ${capitalize(i.customId)}! Waiting for the other player...`, ephemeral: true });

        if (choices[interaction.user.id] && choices[opponent.id]) {
            pvpCollector.stop('finished');

            const p1Choice = choices[interaction.user.id];
            const p2Choice = choices[opponent.id];

            let resultMessage = '';
            let color = '#2b2d31';

            if (p1Choice === p2Choice) {
                resultMessage = 'It\'s a tie! 🤝';
                color = '#ffff00';
            } else if (
                (p1Choice === 'rock' && p2Choice === 'scissors') ||
                (p1Choice === 'paper' && p2Choice === 'rock') ||
                (p1Choice === 'scissors' && p2Choice === 'paper')
            ) {
                resultMessage = `<@${interaction.user.id}> wins! 🎉`;
                color = '#00ff00';
            } else {
                resultMessage = `<@${opponent.id}> wins! 🎉`;
                color = '#ff0000';
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle('Rock, Paper, Scissors - Results')
                .addFields(
                    { name: interaction.user.username, value: `${emojis[p1Choice]} ${capitalize(p1Choice)}`, inline: true },
                    { name: 'VS', value: '⚡', inline: true },
                    { name: opponent.username, value: `${emojis[p2Choice]} ${capitalize(p2Choice)}`, inline: true },
                    { name: 'Result', value: resultMessage, inline: false }
                )
                .setColor(color);

            await message.edit({ content: 'Match Finished!', embeds: [resultEmbed], components: [getDisabledButtons()] }).catch(() => {});
        }
    });

    pvpCollector.on('end', (collected, reason) => {
        if (reason !== 'finished') {
            message.edit({
                content: 'Game timed out. Someone took too long to choose!',
                components: [getDisabledButtons()]
            }).catch(() => {});
        }
    });
}
