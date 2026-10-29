const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Upload Database ────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, '../data/uploadedBases.json');

let uploadsCache = null;

function loadUploads() {
    if (uploadsCache !== null) return uploadsCache;
    try {
        if (fs.existsSync(DB_PATH)) {
            uploadsCache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            return uploadsCache;
        }
    } catch (err) {
        console.error('❌ [BaseService] Failed to load uploads DB:', err.message);
    }
    uploadsCache = [];
    return uploadsCache;
}

function saveUploads(uploads) {
    uploadsCache = uploads;
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(uploads, null, 2), 'utf8');
    } catch (err) {
        console.error('❌ [BaseService] Failed to save uploads DB:', err.message);
    }
}

function addUpload(record) {
    const uploads = loadUploads();
    uploads.push(record);
    saveUploads(uploads);
    return record;
}

// ─── Link Validation ────────────────────────────────────────────────────────

/**
 * Validates a Clash of Clans base layout link.
 * Expected format: https://link.clashofclans.com/...?action=OpenLayout&id=TH{N}:{TYPE}:{ID}
 * @param {string} link
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateBaseLink(link) {
    if (!link || typeof link !== 'string') {
        return { valid: false, reason: 'No link provided.' };
    }

    const trimmed = link.trim();

    // Protocol check
    if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
        return { valid: false, reason: 'Link must start with https://' };
    }

    let url;
    try {
        url = new URL(trimmed);
    } catch {
        return { valid: false, reason: 'Invalid URL format.' };
    }

    // Domain check
    const validHosts = ['link.clashofclans.com'];
    if (!validHosts.includes(url.hostname)) {
        return { valid: false, reason: 'Not a Clash of Clans link.' };
    }

    // Action check
    const action = url.searchParams.get('action');
    if (!action || action !== 'OpenLayout') {
        return { valid: false, reason: 'Not a base layout link.' };
    }

    // ID check
    const id = url.searchParams.get('id');
    if (!id) {
        return { valid: false, reason: 'Missing layout ID.' };
    }

    // TH level in ID
    const thMatch = id.match(/^TH(\d+):/i);
    if (!thMatch) {
        return { valid: false, reason: 'Cannot determine Town Hall level from link.' };
    }

    const thLevel = parseInt(thMatch[1], 10);
    if (thLevel < 1 || thLevel > 18) {
        return { valid: false, reason: `Invalid Town Hall level: ${thLevel}` };
    }

    return { valid: true };
}

// ─── Image Attachment Validation ────────────────────────────────────────────

/**
 * Validates an uploaded base layout image attachment.
 * @param {object} attachment - Discord.js Attachment object
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateBaseImage(attachment) {
    if (!attachment) {
        return { valid: false, reason: 'No image attachment provided.' };
    }

    const contentType = attachment.contentType || '';
    const name = (attachment.name || '').toLowerCase();
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const hasValidExtension = validExtensions.some(ext => name.endsWith(ext));

    if (!contentType.startsWith('image/') && !hasValidExtension) {
        return { valid: false, reason: 'Uploaded file is not a supported image (PNG, JPG, WEBP).' };
    }

    return { valid: true };
}

// ─── Link Parsing ───────────────────────────────────────────────────────────

/**
 * Parses a validated CoC base link and extracts metadata.
 * @param {string} link
 * @returns {{ thLevel: number, layoutType: string, layoutId: string, fullId: string }}
 */
function parseBaseLink(link) {
    const url = new URL(link.trim());
    const id = url.searchParams.get('id');

    // ID format: TH{N}:{TYPE}:{BASE64_ID}
    // Examples: TH17:WB:AAAAMwAAAAJvKqSJR0K6j5vKXNzKC0Eo
    //           TH15:HV:AAAAVAAAAAHixZ2x1n8Q5kcjKac5Ta3R
    const parts = id.split(':');

    const thMatch = parts[0].match(/^TH(\d+)$/i);
    const thLevel = thMatch ? parseInt(thMatch[1], 10) : null;

    const layoutType = parts[1] || 'Unknown';
    const layoutId = parts.slice(2).join(':') || '';
    const fullId = id;

    return { thLevel, layoutType, layoutId, fullId };
}

/**
 * Generates a hash based on the layout ID.
 * @param {string} fullId
 * @returns {string}
 */
function hashLayout(fullId) {
    return crypto.createHash('sha256').update(fullId).digest('hex').substring(0, 16);
}

// ─── Layout Type Display Names ──────────────────────────────────────────────

function getLayoutTypeName(code) {
    const types = {
        'WB': 'War Base',
        'HV': 'Home Village',
        'BB': 'Builder Base',
    };
    return types[code] || code;
}

function getBaseRecord(layoutHash) {
    const uploads = loadUploads();
    return uploads.find(u => u.id === layoutHash || u.layout_hash === layoutHash) || null;
}

function recordDownload(layoutHash, user) {
    const uploads = loadUploads();
    const record = uploads.find(u => u.id === layoutHash || u.layout_hash === layoutHash);
    if (!record) return null;

    if (!Array.isArray(record.downloads)) {
        record.downloads = [];
    }

    const existingIndex = record.downloads.findIndex(d => d.user_id === user.id);
    const downloadEntry = {
        user_id: user.id,
        username: user.tag || user.username,
        display_name: user.displayName || user.username,
        timestamp: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
        record.downloads[existingIndex] = downloadEntry;
    } else {
        record.downloads.push(downloadEntry);
    }

    saveUploads(uploads);
    return record;
}

function buildBaseButtons(record) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const { getEmojiObject } = require('./botemoji.js');

    const layoutHash = record.id || record.layout_hash;
    const thLevel = record.town_hall_level;
    const thEmojiName = `th${thLevel}`;
    const resolvedEmojiKey = getEmojiObject(thEmojiName) ? thEmojiName : 'clancastle';
    const thEmojiObj = getEmojiObject(resolvedEmojiKey);

    // 1. "Open" Button
    const openBtn = new ButtonBuilder()
        .setCustomId(`base_open:${layoutHash}`)
        .setLabel('Open')
        .setStyle(ButtonStyle.Success);

    if (thEmojiObj) {
        openBtn.setEmoji(thEmojiObj);
    }

    // 2. "Downloads" Button with Graph Emoji
    const downloadCount = Array.isArray(record.downloads) ? record.downloads.length : 0;
    const downloadLabel = downloadCount === 0 ? 'Downloads' : `${downloadCount} Downloaded`;

    const statsBtn = new ButtonBuilder()
        .setCustomId(`base_stats:${layoutHash}`)
        .setLabel(downloadLabel)
        .setStyle(ButtonStyle.Secondary);

    const graphEmojiObj = getEmojiObject('graph');
    if (graphEmojiObj) {
        statsBtn.setEmoji(graphEmojiObj);
    }

    return new ActionRowBuilder().addComponents(openBtn, statsBtn);
}

// ─── Export ─────────────────────────────────────────────────────────────────

module.exports = {
    validateBaseLink,
    validateBaseImage,
    parseBaseLink,
    hashLayout,
    getLayoutTypeName,
    addUpload,
    loadUploads,
    saveUploads,
    getBaseRecord,
    recordDownload,
    buildBaseButtons,
};

