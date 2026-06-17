const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { getEmoji } = require('./botemoji.js');

const dataPath = path.join(__dirname, '../data/reminder.json');

function getReminders() {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify([], null, 2));
        return [];
    }
    try {
        const raw = fs.readFileSync(dataPath, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveReminders(reminders) {
    fs.writeFileSync(dataPath, JSON.stringify(reminders, null, 2));
}

function addReminder(userId, channelId, message, timestamp) {
    const reminders = getReminders();
    const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    reminders.push({ id, userId, channelId, message, timestamp: Number(timestamp) });
    saveReminders(reminders);
    return id;
}

function removeReminder(id) {
    const reminders = getReminders().filter(r => r.id !== id);
    saveReminders(reminders);
}

function updateReminder(id, updates) {
    const reminders = getReminders();
    const index = reminders.findIndex(r => r.id === id);
    if (index !== -1) {
        reminders[index] = { ...reminders[index], ...updates };
        saveReminders(reminders);
    }
}

function getUserReminders(userId) {
    return getReminders().filter(r => r.userId === userId);
}

function parseTime(timeStr) {
    const match = timeStr.trim().match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return val * (units[unit] || 0) || null;
}

async function checkReminders(client) {
    const reminders = getReminders();
    const now = Date.now();
    for (const r of reminders) {
        if (now >= Number(r.timestamp)) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${getEmoji('alaram')} Reminder!`)
                .setDescription(`${getEmoji('yarrow')} ${r.message}`)
                .setTimestamp()
                .setFooter({ text: 'Blood Reminders' });

            try {
                const user = await client.users.fetch(r.userId);
                await user.send({ embeds: [embed] });
            } catch {
                try {
                    const channel = await client.channels.fetch(r.channelId);
                    if (channel) await channel.send({
                        content: `<@${r.userId}>`,
                        embeds: [embed]
                    });
                } catch (_) {}
            }
            removeReminder(r.id);
        }
    }
}

module.exports = {
    getReminders,
    saveReminders,
    addReminder,
    removeReminder,
    updateReminder,
    getUserReminders,
    parseTime,
    checkReminders
};
