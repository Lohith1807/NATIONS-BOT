const fs = require('fs');
const path = require('path');

const serversPath = path.join(__dirname, '..', 'data', 'servers.json');
const usersPath = path.join(__dirname, '..', 'data', 'users.json');
function readJSON(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return {};
    }
}

function writeJSON(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e);
    }
}

module.exports = {
    getServers: () => readJSON(serversPath),
    saveServers: (data) => writeJSON(serversPath, data),
    getUsers: () => readJSON(usersPath),
    saveUsers: (data) => writeJSON(usersPath, data)
};
