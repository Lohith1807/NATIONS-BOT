const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const {
    getUserReminders,
    getReminders,
    removeReminder,
    updateReminder,
    parseTime
} = require('./reminderManager.js');
const { getEmoji, getEmojiObject } = require('./botemoji.js');

// Build the reminder list embed + buttons (used to refresh in-place)
function buildListPayload(userId) {
    const reminders = getUserReminders(userId);

    if (reminders.length === 0) {
        return {
            content: `${getEmoji('alaram')} You have no more active reminders.`,
            embeds: [],
            components: []
        };
    }

    const embed = new EmbedBuilder()
        .setTitle(`${getEmoji('alaram')} Your Reminders`)
        .setColor(0x5865F2)
        .setDescription(
            reminders.map((r, i) =>
                `${getEmoji('arrow')} **${i + 1}.** <t:${Math.floor(Number(r.timestamp) / 1000)}:R>\n${getEmoji('rarrow')} ${r.message}`
            ).join('\n\n')
        )
        .setFooter({ text: 'Use the buttons below to edit or delete reminders' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rem_edit_btn')
            .setLabel('Edit')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(getEmojiObject('refresh')),
        new ButtonBuilder()
            .setCustomId('rem_delete_btn')
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(getEmojiObject('delete'))
    );

    return { content: '', embeds: [embed], components: [row] };
}

// Build select menu for picking a reminder
function buildSelectPayload(userId, customId, placeholder) {
    const reminders = getUserReminders(userId);

    const options = reminders.slice(0, 25).map((r, i) => {
        const label = `${i + 1}. ${r.message}`.slice(0, 100);
        const desc = `Due: <t:${Math.floor(Number(r.timestamp) / 1000)}:R>`.slice(0, 100);
        return { label, description: desc, value: r.id };
    });

    const select = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(options);

    return { components: [new ActionRowBuilder().addComponents(select)] };
}

async function handleReminderInteractions(interaction) {
    const id = interaction.customId;

    // Only handle our reminder custom IDs
    if (!id || !id.startsWith('rem_')) return false;

    try {
        // ── BUTTONS ──────────────────────────────────────────────────────────
        if (interaction.isButton()) {

            if (id === 'rem_edit_btn') {
                const reminders = getUserReminders(interaction.user.id);
                if (reminders.length === 0) {
                    await interaction.update({ content: '🔔 You have no active reminders.', embeds: [], components: [] });
                    return true;
                }
                const payload = buildSelectPayload(interaction.user.id, 'rem_edit_select', 'Choose a reminder to edit...');
                await interaction.update({ embeds: [], ...payload });
                return true;
            }

            if (id === 'rem_delete_btn') {
                const reminders = getUserReminders(interaction.user.id);
                if (reminders.length === 0) {
                    await interaction.update({ content: '🔔 You have no active reminders.', embeds: [], components: [] });
                    return true;
                }
                const payload = buildSelectPayload(interaction.user.id, 'rem_delete_select', 'Choose a reminder to delete...');
                await interaction.update({ embeds: [], ...payload });
                return true;
            }

            if (id.startsWith('rem_confirm_del_')) {
                const remId = id.replace('rem_confirm_del_', '');
                removeReminder(remId);
                const payload = buildListPayload(interaction.user.id);
                await interaction.update(payload);
                return true;
            }

            if (id === 'rem_cancel_del') {
                const payload = buildListPayload(interaction.user.id);
                await interaction.update(payload);
                return true;
            }
        }

        // ── SELECT MENUS ──────────────────────────────────────────────────────
        if (interaction.isStringSelectMenu()) {

            if (id === 'rem_delete_select') {
                const remId = interaction.values[0];
                const reminder = getReminders().find(r => r.id === remId);

                if (!reminder) {
                    await interaction.update({ content: '❌ Reminder not found.', embeds: [], components: [] });
                    return true;
                }

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rem_confirm_del_${remId}`)
                        .setLabel('✅ Yes, Delete')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('rem_cancel_del')
                        .setLabel('❌ No, Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

                await interaction.update({
                    content: `Are you sure you want to delete this reminder?\n> **${reminder.message}**`,
                    embeds: [],
                    components: [confirmRow]
                });
                return true;
            }

            if (id === 'rem_edit_select') {
                const remId = interaction.values[0];
                const reminder = getReminders().find(r => r.id === remId);

                if (!reminder) {
                    await interaction.update({ content: '❌ Reminder not found.', embeds: [], components: [] });
                    return true;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`rem_edit_modal_${remId}`)
                    .setTitle('Edit Reminder');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('edit_message')
                            .setLabel('New message')
                            .setStyle(TextInputStyle.Paragraph)
                            .setValue(reminder.message)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('edit_time')
                            .setLabel('New time (e.g. 10m, 2h) — leave blank to keep')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                    )
                );

                await interaction.showModal(modal);
                return true;
            }
        }

        // ── MODAL SUBMITS ──────────────────────────────────────────────────────
        if (interaction.isModalSubmit()) {

            if (id.startsWith('rem_edit_modal_')) {
                const remId = id.replace('rem_edit_modal_', '');
                const newMessage = interaction.fields.getTextInputValue('edit_message');
                const newTimeStr = interaction.fields.getTextInputValue('edit_time');

                const updates = { message: newMessage };

                if (newTimeStr && newTimeStr.trim() !== '') {
                    const duration = parseTime(newTimeStr.trim());
                    if (!duration) {
                        await interaction.reply({ content: '❌ Invalid time format. Use e.g. `10m`, `2h`.', ephemeral: true });
                        return true;
                    }
                    updates.timestamp = Date.now() + duration;
                }

                updateReminder(remId, updates);

                // Modal submits cannot call .update() — must use .reply() or .deferUpdate()
                await interaction.reply({ content: '✅ Reminder updated!', ephemeral: true });
                return true;
            }
        }

    } catch (err) {
        console.error('[Bot1] Reminder interaction error:', err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true });
            }
        } catch (_) {}
        return true;
    }

    return false;
}

module.exports = { handleReminderInteractions };
