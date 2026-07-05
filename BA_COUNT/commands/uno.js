const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');

const COLORS = ['🔴 Red', '🔵 Blue', '🟢 Green', '🟡 Yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw 2'];
const WILDS = ['Wild', 'Wild Draw 4'];

function createDeck() {
    let deck = [];
    for (const color of COLORS) {
        deck.push({ color, value: '0' });
        for (let i = 1; i <= 9; i++) {
            deck.push({ color, value: i.toString() });
            deck.push({ color, value: i.toString() });
        }
        for (const special of ['Skip', 'Reverse', 'Draw 2']) {
            deck.push({ color, value: special });
            deck.push({ color, value: special });
        }
    }
    for (let i = 0; i < 4; i++) {
        deck.push({ color: 'Black', value: 'Wild' });
        deck.push({ color: 'Black', value: 'Wild Draw 4' });
    }
    return shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getCardName(card) {
    if (card.color === 'Black') return card.value;
    return `${card.color.split(' ')[0]} ${card.color.split(' ')[1]} ${card.value}`;
}

function isPlayable(card, topCard, currentColor) {
    if (card.color === 'Black') return true;
    if (card.color === currentColor) return true;
    if (card.value === topCard.value) return true;
    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uno')
        .setDescription('Start a game of UNO in the channel!'),
        
    async execute(interaction) {
        const host = interaction.user;
        let players = [host];
        let gameStarted = false;

        const updateLobbyEmbed = () => {
            return new EmbedBuilder()
                .setTitle('🃏 UNO Lobby')
                .setDescription(`Host: <@${host.id}>\n\n**Players (${players.length}/4):**\n` + players.map((p, i) => `${i + 1}. <@${p.id}>`).join('\n'))
                .setColor('#ff0000');
        };

        const joinBtn = new ButtonBuilder().setCustomId('join').setLabel('Join').setStyle(ButtonStyle.Primary);
        const leaveBtn = new ButtonBuilder().setCustomId('leave').setLabel('Leave').setStyle(ButtonStyle.Secondary);
        const startBtn = new ButtonBuilder().setCustomId('start').setLabel('Start Game').setStyle(ButtonStyle.Success);
        
        let row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn, startBtn);

        const msg = await interaction.reply({ embeds: [updateLobbyEmbed()], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            if (i.customId === 'join') {
                if (players.find(p => p.id === i.user.id)) {
                    return i.reply({ content: 'You are already in the lobby!', ephemeral: true });
                }
                if (players.length >= 4) {
                    return i.reply({ content: 'The lobby is full!', ephemeral: true });
                }
                players.push(i.user);
                await i.update({ embeds: [updateLobbyEmbed()] });
            }
            if (i.customId === 'leave') {
                if (i.user.id === host.id) {
                    return i.reply({ content: 'The host cannot leave. They must wait for timeout or start the game.', ephemeral: true });
                }
                const idx = players.findIndex(p => p.id === i.user.id);
                if (idx > -1) {
                    players.splice(idx, 1);
                    await i.update({ embeds: [updateLobbyEmbed()] });
                } else {
                    i.reply({ content: 'You are not in the lobby!', ephemeral: true });
                }
            }
            if (i.customId === 'start') {
                if (i.user.id !== host.id) {
                    return i.reply({ content: 'Only the host can start the game!', ephemeral: true });
                }
                if (players.length < 2) {
                    return i.reply({ content: 'Need at least 2 players to start!', ephemeral: true });
                }
                gameStarted = true;
                collector.stop('started');
                await startGame(i, msg, players);
            }
        });

        collector.on('end', (collected, reason) => {
            if (!gameStarted) {
                msg.edit({ content: 'Lobby closed due to inactivity or not enough players.', components: [] }).catch(() => {});
            }
        });
    }
};

async function startGame(interaction, message, players) {
    let deck = createDeck();
    let discardPile = [];
    let hands = {};
    
    // Deal 7 cards to each player
    for (const player of players) {
        hands[player.id] = [];
        for (let i = 0; i < 7; i++) {
            hands[player.id].push(deck.pop());
        }
    }

    // First card
    let topCard = deck.pop();
    // Keep drawing if first card is wild or action to keep it simple
    while (topCard.color === 'Black' || ['Skip', 'Reverse', 'Draw 2'].includes(topCard.value)) {
        deck.unshift(topCard);
        topCard = deck.pop();
    }
    discardPile.push(topCard);
    
    let currentColor = topCard.color;
    let turnIndex = 0;
    let direction = 1;
    let gameOver = false;

    const drawCards = (playerId, amount) => {
        for (let i = 0; i < amount; i++) {
            if (deck.length === 0) {
                // Reshuffle discard pile into deck (keep top card)
                const lastCard = discardPile.pop();
                deck = shuffle(discardPile);
                discardPile = [lastCard];
            }
            if (deck.length > 0) {
                hands[playerId].push(deck.pop());
            }
        }
    };

    const nextTurn = (skip = false) => {
        turnIndex = (turnIndex + direction + players.length) % players.length;
        if (skip) {
            turnIndex = (turnIndex + direction + players.length) % players.length;
        }
    };

    const updateGameMessage = async () => {
        if (gameOver) return;

        const currentP = players[turnIndex];
        
        let desc = `**Top Card:** ${getCardName(topCard)}\n**Current Color:** ${currentColor}\n\n`;
        desc += `**Turn:** <@${currentP.id}>\n\n**Player Hands:**\n`;
        
        for (const p of players) {
            desc += `${p.id === currentP.id ? '👉 ' : ''}${p.username}: ${hands[p.id].length} cards\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🃏 UNO Game')
            .setDescription(desc)
            .setColor(currentColor.includes('Red') ? '#ff0000' : currentColor.includes('Blue') ? '#0000ff' : currentColor.includes('Green') ? '#00ff00' : '#ffff00');

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('play_turn').setLabel('View Hand & Play').setStyle(ButtonStyle.Primary)
        );

        await message.edit({ embeds: [embed], components: [actionRow] }).catch(() => {});
    };

    await interaction.update({ content: 'Game Started!', embeds: [], components: [] });
    await updateGameMessage();

    const gameCollector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600000 }); // 10 mins idle timeout

    gameCollector.on('collect', async i => {
        if (i.customId === 'play_turn') {
            const currentPlayer = players[turnIndex];
            if (i.user.id !== currentPlayer.id) {
                return i.reply({ content: `It's not your turn! Wait for <@${currentPlayer.id}>.`, ephemeral: true });
            }

            const hand = hands[currentPlayer.id];
            
            // Build Select Menu
            const options = hand.map((card, index) => {
                return {
                    label: getCardName(card),
                    value: index.toString(),
                    description: isPlayable(card, topCard, currentColor) ? 'Playable' : 'Cannot play'
                };
            });

            // If hand is too large for one menu (max 25), slice it (rare in UNO but possible)
            const menuOptions = options.slice(0, 25);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_card')
                .setPlaceholder('Select a card to play')
                .addOptions(menuOptions);

            const drawBtn = new ButtonBuilder().setCustomId('draw_card').setLabel('Draw a Card').setStyle(ButtonStyle.Danger);
            
            const row1 = new ActionRowBuilder().addComponents(selectMenu);
            const row2 = new ActionRowBuilder().addComponents(drawBtn);

            const ephemeralMsg = await i.reply({
                content: `**Top Card:** ${getCardName(topCard)}\n**Current Color:** ${currentColor}\n\nSelect a playable card or draw:`,
                components: [row1, row2],
                ephemeral: true,
                fetchReply: true
            });

            // Inner collector for the ephemeral menu
            const filter = (btnInt) => btnInt.user.id === i.user.id;
            const actionCollector = ephemeralMsg.createMessageComponentCollector({ filter, time: 60000, max: 1 });

            actionCollector.on('collect', async actionInt => {
                if (actionInt.customId === 'draw_card') {
                    drawCards(currentPlayer.id, 1);
                    await actionInt.update({ content: `You drew a card.`, components: [] });
                    nextTurn();
                    await updateGameMessage();
                } 
                else if (actionInt.customId === 'select_card') {
                    const cardIndex = parseInt(actionInt.values[0]);
                    const playedCard = hand[cardIndex];

                    if (!isPlayable(playedCard, topCard, currentColor)) {
                        return actionInt.reply({ content: 'You cannot play this card right now! It does not match the color or value.', ephemeral: true });
                    }

                    // Play the card
                    hand.splice(cardIndex, 1);
                    discardPile.push(playedCard);
                    topCard = playedCard;
                    currentColor = playedCard.color !== 'Black' ? playedCard.color : currentColor; // Temp until wild selection

                    let skipNext = false;

                    // Handle win
                    if (hand.length === 0) {
                        gameOver = true;
                        gameCollector.stop('win');
                        await actionInt.update({ content: 'You played your last card!', components: [] });
                        const winEmbed = new EmbedBuilder()
                            .setTitle('🎉 UNO Winner! 🎉')
                            .setDescription(`<@${currentPlayer.id}> has won the game!`)
                            .setColor('#00ff00');
                        await message.edit({ embeds: [winEmbed], components: [] });
                        return;
                    }

                    // Special card handling
                    if (playedCard.color === 'Black') {
                        // Wild or Wild Draw 4
                        const rBtn = new ButtonBuilder().setCustomId('🔴 Red').setLabel('Red').setStyle(ButtonStyle.Danger);
                        const bBtn = new ButtonBuilder().setCustomId('🔵 Blue').setLabel('Blue').setStyle(ButtonStyle.Primary);
                        const gBtn = new ButtonBuilder().setCustomId('🟢 Green').setLabel('Green').setStyle(ButtonStyle.Success);
                        const yBtn = new ButtonBuilder().setCustomId('🟡 Yellow').setLabel('Yellow').setStyle(ButtonStyle.Secondary);
                        const colorRow = new ActionRowBuilder().addComponents(rBtn, bBtn, gBtn, yBtn);

                        const colorMsg = await actionInt.update({ content: 'Choose a new color:', components: [colorRow], fetchReply: true });
                        
                        const colorCollector = ephemeralMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });
                        colorCollector.on('collect', async colorInt => {
                            currentColor = colorInt.customId;
                            
                            if (playedCard.value === 'Wild Draw 4') {
                                const nextPlayerIndex = (turnIndex + direction + players.length) % players.length;
                                drawCards(players[nextPlayerIndex].id, 4);
                                skipNext = true;
                            }
                            
                            await colorInt.update({ content: `Color changed to ${currentColor}!`, components: [] });
                            nextTurn(skipNext);
                            await updateGameMessage();
                        });
                        return; // Exit early to wait for color pick
                    } else {
                        if (playedCard.value === 'Skip') {
                            skipNext = true;
                        } else if (playedCard.value === 'Reverse') {
                            direction *= -1;
                            if (players.length === 2) skipNext = true; // Acts as skip in 2 player
                        } else if (playedCard.value === 'Draw 2') {
                            const nextPlayerIndex = (turnIndex + direction + players.length) % players.length;
                            drawCards(players[nextPlayerIndex].id, 2);
                            skipNext = true;
                        }
                    }

                    await actionInt.update({ content: `You played ${getCardName(playedCard)}!`, components: [] });
                    nextTurn(skipNext);
                    await updateGameMessage();
                }
            });
        }
    });

    gameCollector.on('end', (collected, reason) => {
        if (reason !== 'win' && !gameOver) {
            message.edit({ content: 'Game ended due to inactivity.', components: [] }).catch(() => {});
        }
    });
}
