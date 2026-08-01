const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Create a quiz for users to answer.')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to ping for this quiz')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('questions')
                .setDescription('Number of questions (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)),
    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const noOfQuestions = interaction.options.getInteger('questions');

        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId(`quizCreateModal_${role.id}_${noOfQuestions}`)
            .setTitle(`Create a Quiz (${noOfQuestions} questions)`);

        // Add text inputs for each question
        for (let i = 1; i <= noOfQuestions; i++) {
            const questionInput = new TextInputBuilder()
                .setCustomId(`question_${i}`)
                .setLabel(`Question ${i}`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder(`Enter question ${i} here`);
            
            const actionRow = new ActionRowBuilder().addComponents(questionInput);
            modal.addComponents(actionRow);
        }

        // Show the modal to the user
        await interaction.showModal(modal);
    },
};
