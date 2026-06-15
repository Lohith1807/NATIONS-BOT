const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addTodo } = require('../../utils/todoManager.js');
const { getEmoji } = require('../../utils/botemoji.js');

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
            
            const dmEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(`${getEmoji("alaram")} Bot Update Notification`)
                .setDescription('new update came for your bot please check it by using /todo-list in server')
                .setTimestamp();

            await targetUser.send({ embeds: [dmEmbed] });
            dmStatus = ` (Notified <@${targetUserId}> via DM)`;
        } catch (dmErr) {
            console.error(`${getEmoji("bluex")} Failed to send DM to ${targetUserId}:`, dmErr.message);
            dmStatus = ` (${getEmoji("alaram")} Could not send DM notification to <@${targetUserId}>)`;
        }

        return interaction.reply({
            content: `${getEmoji("gtick")} Task added to the todo list for **${botTarget}**: **${newTodo.task}**${dmStatus}`,
            ephemeral: false
        });
    }
};
