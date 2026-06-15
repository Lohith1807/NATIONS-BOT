const { SlashCommandBuilder } = require('discord.js');
const { addTodo } = require('../todoManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("todo")
        .setDescription("Add a new task to the todo list")
        .addStringOption(option => 
            option.setName("bots")
                .setDescription("The target bot/assignment for this task")
                .setRequired(true)
                .addChoices(
                    { name: "CLASH", value: "CLASH" },
                    { name: "VALKON", value: "VALKON" }
                )
        )
        .addStringOption(option => 
            option.setName("message")
                .setDescription("The work details to add")
                .setRequired(true)
        ),
    async execute(interaction) {
        const botTarget = interaction.options.getString("bots");
        const message = interaction.options.getString("message");
        const username = interaction.user.username;
        const userId = interaction.user.id;

        const newTodo = addTodo(message, username, userId, botTarget);

        const targetUserId = botTarget === 'CLASH' ? '1393061101838532630' : '1416822914950496366';
        let dmStatus = "";

        try {
            const targetUser = await interaction.client.users.fetch(targetUserId);
            await targetUser.send({
                content: `new update came for your bot please check it by using /todo-list in server`
            });
            dmStatus = ` (Notified <@${targetUserId}> via DM)`;
        } catch (dmErr) {
            console.error(`❌ Failed to send DM to ${targetUserId}:`, dmErr.message);
            dmStatus = ` (⚠️ Could not send DM notification to <@${targetUserId}>)`;
        }

        return interaction.reply({
            content: `✅ Task added to the todo list for **${botTarget}**: **${newTodo.task}**${dmStatus}`,
            ephemeral: false
        });
    }
};
