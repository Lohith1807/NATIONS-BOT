const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'quizzes.json');

// Ensure data directory and file exist
function init() {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(dataFilePath)) {
        fs.writeFileSync(dataFilePath, JSON.stringify({ answeredUsers: {}, activeQuizzes: {} }, null, 2));
    }
}

function getQuizData() {
    init();
    try {
        const rawData = fs.readFileSync(dataFilePath);
        const data = JSON.parse(rawData);
        data.answeredUsers = data.answeredUsers || {};
        data.activeQuizzes = data.activeQuizzes || {};
        return data;
    } catch (err) {
        return { answeredUsers: {}, activeQuizzes: {} };
    }
}

function saveQuizData(data) {
    init();
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

function hasUserAnswered(quizId, userId) {
    const data = getQuizData();
    if (!data.answeredUsers[quizId]) {
        return false;
    }
    return data.answeredUsers[quizId].includes(userId);
}

function markUserAnswered(quizId, userId) {
    const data = getQuizData();
    if (!data.answeredUsers[quizId]) {
        data.answeredUsers[quizId] = [];
    }
    if (!data.answeredUsers[quizId].includes(userId)) {
        data.answeredUsers[quizId].push(userId);
        saveQuizData(data);
    }
}

function saveActiveQuiz(quizId, quizInfo) {
    const data = getQuizData();
    data.activeQuizzes[quizId] = quizInfo;
    saveQuizData(data);
}

function getActiveQuiz(quizId) {
    const data = getQuizData();
    return data.activeQuizzes[quizId];
}

module.exports = {
    hasUserAnswered,
    markUserAnswered,
    saveActiveQuiz,
    getActiveQuiz
};
