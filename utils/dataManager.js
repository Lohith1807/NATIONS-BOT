/**
 * Centralized Data Manager for JSON file operations
 * Eliminates redundant read/write code across command files
 */

const fs = require("fs");
const path = require("path");

// JSON file paths
const DATA_DIR = path.join(__dirname, "../data");

const PATHS = {
    userdata: path.join(DATA_DIR, "userdata.json"),
    clanrole: path.join(DATA_DIR, "clanrole.json"),
    clandata: path.join(DATA_DIR, "clandata.json"),
    clans: path.join(DATA_DIR, "clans.json"),
    strikeplayers: path.join(DATA_DIR, "strikeplayers.json"),
    helpData: path.join(DATA_DIR, "helpData.json")
};

// ==================== READ FUNCTIONS ====================

/**
 * Get strike players data (unlinked players with strikes)
 * @returns {Object} Strike players data object
 */
function getStrikePlayers() {
    try {
        if (!fs.existsSync(PATHS.strikeplayers)) return {};
        const raw = fs.readFileSync(PATHS.strikeplayers, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error("Error reading strikeplayers.json:", err.message);
        return {};
    }
}

/**
 * Get user data (linked Discord users to CoC accounts)
 * @returns {Object} User data object
 */
function getUserData() {
    try {
        if (!fs.existsSync(PATHS.userdata)) return {};
        const raw = fs.readFileSync(PATHS.userdata, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error("Error reading userdata.json:", err.message);
        return {};
    }
}

/**
 * Get clan roles (clan tag to Discord role mappings)
 * @returns {Object} Clan roles object
 */
function getClanRoles() {
    try {
        if (!fs.existsSync(PATHS.clanrole)) return {};
        const raw = fs.readFileSync(PATHS.clanrole, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error("Error reading clanrole.json:", err.message);
        return {};
    }
}





/**
 * Get clans data
 * @returns {Object} Clans data object
 */
function getClans() {
    try {
        if (!fs.existsSync(PATHS.clans)) return {};
        const raw = fs.readFileSync(PATHS.clans, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error("Error reading clans.json:", err.message);
        return {};
    }
}

/**
 * Get help data for the /help command
 * @returns {Object} Help data object
 */
function getHelpData() {
    try {
        if (!fs.existsSync(PATHS.helpData)) return {};
        const raw = fs.readFileSync(PATHS.helpData, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error("Error reading helpData.json:", err.message);
        return {};
    }
}

// ==================== WRITE FUNCTIONS ====================

/**
 * Save user data
 * @param {Object} data - User data to save
 */
function saveUserData(data) {
    try {
        fs.writeFileSync(PATHS.userdata, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing userdata.json:", err.message);
        throw err;
    }
}

/**
 * Save clan roles
 * @param {Object} data - Clan roles to save
 */
function saveClanRoles(data) {
    try {
        fs.writeFileSync(PATHS.clanrole, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing clanrole.json:", err.message);
        throw err;
    }
}





/**
 * Save clans data
 * @param {Object} data - Clans data to save
 */
function saveClans(data) {
    try {
        fs.writeFileSync(PATHS.clans, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing clans.json:", err.message);
        throw err;
    }
}

/**
 * Save strike players data
 * @param {Object} data - Strike players data to save
 */
function saveStrikePlayers(data) {
    try {
        fs.writeFileSync(PATHS.strikeplayers, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing strikeplayers.json:", err.message);
        throw err;
    }
}

/**
 * Save help data
 * @param {Object} data - Help data to save
 */
function saveHelpData(data) {
    try {
        fs.writeFileSync(PATHS.helpData, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing helpData.json:", err.message);
        throw err;
    }
}

// ==================== EXPORTS ====================

module.exports = {
    // Read functions
    getUserData,
    getClanRoles,
    getClans,
    getStrikePlayers,
    getHelpData,

    // Write functions
    saveUserData,
    saveClanRoles,
    saveClans,
    saveStrikePlayers,
    saveHelpData,

    // Expose paths for special cases
    PATHS
};
