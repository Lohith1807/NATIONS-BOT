const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Play Tic-Tac-Toe against the bot or a friend!')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('Challenge a user to Tic-Tac-Toe!')
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
            return await handlePvPChallenge(interaction, opponent);
        } else {
            return await startTicTacToe(interaction, interaction.user, { id: 'bot', username: 'Bot' });
        }
    }
};

async function handlePvPChallenge(interaction, opponent) {
    const yesButton = new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success);
    const noButton = new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger);
    const challengeRow = new ActionRowBuilder().addComponents(yesButton, noButton);

    const challengeMsg = await interaction.reply({
        content: `<@${opponent.id}>, <@${interaction.user.id}> has challenged you to Tic-Tac-Toe! Are you ready to fight?`,
        components: [challengeRow],
        fetchReply: true
    });

    const challengeCollector = challengeMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
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
                content: `Challenge accepted! Starting game...`,
                components: []
            });
            startTicTacToe(interaction, interaction.user, opponent, challengeMsg);
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

async function startTicTacToe(interaction, p1, p2, existingMsg = null) {
    let board = [null, null, null, null, null, null, null, null, null];
    let currentPlayer = p1.id;
    let gameOver = false;

    const buildBoard = (disabled = false) => {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const idx = i * 3 + j;
                const val = board[idx];
                const btn = new ButtonBuilder()
                    .setCustomId(`ttt_${idx}`)
                    .setStyle(val === 'X' ? ButtonStyle.Success : (val === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary))
                    .setDisabled(disabled || val !== null);
                
                if (val === 'X') btn.setLabel('X');
                else if (val === 'O') btn.setLabel('O');
                else btn.setLabel('\u200b'); // zero width space for empty buttons
                
                row.addComponents(btn);
            }
            rows.push(row);
        }
        return rows;
    };

    const checkWin = () => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let line of lines) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a]; // 'X' or 'O'
            }
        }
        if (!board.includes(null)) return 'draw';
        return null;
    };

    const getEmbed = () => {
        let desc = '';
        let color = '#2b2d31';
        if (gameOver) {
            const winner = checkWin();
            if (winner === 'X') {
                desc = `🏆 <@${p1.id}> (X) won the game!`;
                color = '#00ff00';
            } else if (winner === 'O') {
                desc = `🏆 ${p2.id === 'bot' ? 'The Bot' : `<@${p2.id}>`} (O) won the game!`;
                color = '#ff0000';
            } else {
                desc = `🤝 It's a draw!`;
                color = '#ffff00';
            }
        } else {
            desc = `It's ${currentPlayer === p1.id ? `<@${p1.id}> (X)` : (p2.id === 'bot' ? 'Bot (O)' : `<@${p2.id}> (O)`)}'s turn!`;
        }

        return new EmbedBuilder()
            .setTitle('❌ Tic-Tac-Toe ⭕')
            .setDescription(desc)
            .setColor(color);
    };

    let msg;
    if (existingMsg) {
        msg = await existingMsg.edit({ content: '', embeds: [getEmbed()], components: buildBoard() });
    } else {
        msg = await interaction.reply({ embeds: [getEmbed()], components: buildBoard(), fetchReply: true });
    }

    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
    });

    const doBotTurn = async () => {
        if (gameOver) return;
        
        // Find all empty spots
        const emptySpots = [];
        board.forEach((val, idx) => { if (val === null) emptySpots.push(idx); });
        
        if (emptySpots.length > 0) {
            const pick = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            board[pick] = 'O';
            
            const win = checkWin();
            if (win) {
                gameOver = true;
                collector.stop('finished');
            } else {
                currentPlayer = p1.id; // switch back to player 1
            }
            await msg.edit({ embeds: [getEmbed()], components: buildBoard(gameOver) }).catch(() => {});
        }
    };

    collector.on('collect', async i => {
        if (!i.customId.startsWith('ttt_')) return; // Just in case

        if (i.user.id !== currentPlayer) {
            return i.reply({ content: `It's not your turn, or you are not in this game!`, ephemeral: true });
        }

        const idx = parseInt(i.customId.split('_')[1]);
        if (board[idx] !== null) return i.reply({ content: 'That spot is already taken!', ephemeral: true });

        // Update board
        board[idx] = currentPlayer === p1.id ? 'X' : 'O';
        
        // Check win
        const win = checkWin();
        if (win) {
            gameOver = true;
            collector.stop('finished');
        } else {
            // Swap turns
            currentPlayer = currentPlayer === p1.id ? p2.id : p1.id;
        }

        await i.update({ embeds: [getEmbed()], components: buildBoard(gameOver) });

        // If it's the bot's turn, trigger bot play after a small delay
        if (!gameOver && currentPlayer === 'bot') {
            setTimeout(() => {
                doBotTurn();
            }, 800); // 0.8 second delay for realism
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason !== 'finished' && !gameOver) {
            gameOver = true;
            const toEdit = {
                embeds: [new EmbedBuilder().setTitle('❌ Tic-Tac-Toe ⭕').setDescription('Game timed out.').setColor('#ff0000')],
                components: buildBoard(true)
            };
            msg.edit(toEdit).catch(() => {});
        }
    });
}
