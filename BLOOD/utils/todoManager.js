const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getEmoji, emojis } = require('./botemoji.js');

const TODO_FILE = path.join(__dirname, '../data/todo.json');

function getTodos() {
    try {
        if (!fs.existsSync(TODO_FILE)) return [];
        const raw = fs.readFileSync(TODO_FILE, 'utf8');
        return raw ? JSON.parse(raw) : [];
    } catch (err) {
        console.error('Error reading todo.json:', err);
        return [];
    }
}

function saveTodos(todos) {
    try {
        fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing todo.json:', err);
    }
}

function addTodo(task, user, userId, bot) {
    const todos = getTodos();
    const newTodo = {
        id: Date.now().toString(),
        task,
        user,
        userId,
        bot,
        createdAt: new Date().toISOString()
    };
    todos.push(newTodo);
    saveTodos(todos);
    return newTodo;
}

function removeTodo(id) {
    const todos = getTodos();
    const updated = todos.filter(t => t.id !== id);
    saveTodos(updated);
    return todos.length !== updated.length;
}

function getTodoListEmbed() {
    const todos = getTodos();
    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle(`${getEmoji("blood")} Blood Alliance — Active To-Do List`)
        .setTimestamp();

    if (todos.length === 0) {
        embed.setDescription(`${getEmoji("bluestar")} **All clear! No pending tasks.**\nUse \`/todo\` to add new tasks.`);
    } else {
        const description = todos.map((t, idx) => {
            const date = new Date(t.createdAt);
            const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const botTag = t.bot ? ` [**${t.bot}**]` : '';
            return `**${idx + 1}.** ${t.task}${botTag}\n   └ *Created by:* <@${t.userId}> (${timeStr})`;
        }).join('\n\n');
        embed.setDescription(description);
    }

    return embed;
}

function getTodoComponents(showDropdown = false) {
    const todos = getTodos();
    const components = [];

    // Always create the button row (Update button)
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('todo_update')
            .setLabel('Update List')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.refresh || '🔄')
    );
    components.push(buttonRow);

    if (showDropdown && todos.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('todo_select')
            .setPlaceholder('Select a task to mark as completed...')
            .setMinValues(1)
            .setMaxValues(1);

        // Map up to 25 items (Discord limit for select menu options)
        const options = todos.slice(0, 25).map((t, idx) => {
            let label = `${idx + 1}. ${t.task}`;
            if (label.length > 100) label = label.substring(0, 97) + '...';
            
            let description = `By ${t.user}`;
            if (description.length > 100) description = description.substring(0, 100);

            return {
                label,
                description,
                value: t.id
            };
        });

        selectMenu.addOptions(options);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        components.unshift(selectRow);
    }

    return components;
}

module.exports = {
    getTodos,
    addTodo,
    removeTodo,
    getTodoListEmbed,
    getTodoComponents
};
