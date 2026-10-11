const { createCanvas } = require('@napi-rs/canvas');

// Color Palettes for different themes
const THEME_PALETTES = {
    motivational: {
        bgGradient: ['#0f0c1b', '#1f1329', '#2a0845'],
        accentGradient: ['#ff8a00', '#da1b60'],
        glowColor: 'rgba(255, 107, 0, 0.22)',
        cardBg: 'rgba(25, 20, 40, 0.65)',
        cardBorder: 'rgba(255, 138, 0, 0.35)',
        badgeBg: 'rgba(255, 138, 0, 0.15)',
        badgeText: '#ffa726',
        quoteColor: '#ffffff',
        authorColor: '#ffb74d',
        markColor: 'rgba(255, 138, 0, 0.25)'
    },
    gaming: {
        bgGradient: ['#090a1a', '#101432', '#180e38'],
        accentGradient: ['#00f2fe', '#4facfe'],
        glowColor: 'rgba(0, 242, 254, 0.20)',
        cardBg: 'rgba(15, 20, 45, 0.65)',
        cardBorder: 'rgba(0, 242, 254, 0.35)',
        badgeBg: 'rgba(0, 242, 254, 0.15)',
        badgeText: '#00e5ff',
        quoteColor: '#ffffff',
        authorColor: '#80d8ff',
        markColor: 'rgba(0, 242, 254, 0.25)'
    },
    dark: {
        bgGradient: ['#08080a', '#120d13', '#1a0d14'],
        accentGradient: ['#e52d27', '#b31217'],
        glowColor: 'rgba(229, 45, 39, 0.18)',
        cardBg: 'rgba(18, 16, 20, 0.72)',
        cardBorder: 'rgba(229, 45, 39, 0.30)',
        badgeBg: 'rgba(229, 45, 39, 0.15)',
        badgeText: '#ff5252',
        quoteColor: '#f0f0f2',
        authorColor: '#ff8a80',
        markColor: 'rgba(229, 45, 39, 0.25)'
    },
    emotional: {
        bgGradient: ['#0b0d1b', '#191535', '#241a3e'],
        accentGradient: ['#a18cd1', '#fbc2eb'],
        glowColor: 'rgba(180, 140, 240, 0.20)',
        cardBg: 'rgba(25, 22, 45, 0.65)',
        cardBorder: 'rgba(180, 140, 240, 0.30)',
        badgeBg: 'rgba(180, 140, 240, 0.15)',
        badgeText: '#ce93d8',
        quoteColor: '#ffffff',
        authorColor: '#e1bee7',
        markColor: 'rgba(180, 140, 240, 0.25)'
    },
    friendship: {
        bgGradient: ['#0c141f', '#102539', '#15334c'],
        accentGradient: ['#43e97b', '#38f9d7'],
        glowColor: 'rgba(67, 233, 123, 0.18)',
        cardBg: 'rgba(16, 32, 48, 0.65)',
        cardBorder: 'rgba(67, 233, 123, 0.30)',
        badgeBg: 'rgba(67, 233, 123, 0.15)',
        badgeText: '#69f0ae',
        quoteColor: '#ffffff',
        authorColor: '#b9f6ca',
        markColor: 'rgba(67, 233, 123, 0.22)'
    },
    love: {
        bgGradient: ['#180a14', '#2d1123', '#3d1228'],
        accentGradient: ['#ff758c', '#ff7eb3'],
        glowColor: 'rgba(255, 117, 140, 0.22)',
        cardBg: 'rgba(38, 16, 28, 0.68)',
        cardBorder: 'rgba(255, 117, 140, 0.35)',
        badgeBg: 'rgba(255, 117, 140, 0.15)',
        badgeText: '#ff4081',
        quoteColor: '#ffffff',
        authorColor: '#ff80ab',
        markColor: 'rgba(255, 117, 140, 0.25)'
    },
    psychology: {
        bgGradient: ['#0a1118', '#11222c', '#0f2f3d'],
        accentGradient: ['#2af598', '#009efd'],
        glowColor: 'rgba(0, 158, 253, 0.20)',
        cardBg: 'rgba(15, 30, 42, 0.68)',
        cardBorder: 'rgba(0, 158, 253, 0.32)',
        badgeBg: 'rgba(0, 158, 253, 0.15)',
        badgeText: '#40c4ff',
        quoteColor: '#ffffff',
        authorColor: '#80d8ff',
        markColor: 'rgba(0, 158, 253, 0.25)'
    },
    life: {
        bgGradient: ['#0f1715', '#162822', '#18382c'],
        accentGradient: ['#11998e', '#38ef7d'],
        glowColor: 'rgba(56, 239, 125, 0.18)',
        cardBg: 'rgba(20, 36, 30, 0.68)',
        cardBorder: 'rgba(56, 239, 125, 0.30)',
        badgeBg: 'rgba(56, 239, 125, 0.15)',
        badgeText: '#69f0ae',
        quoteColor: '#ffffff',
        authorColor: '#a7f3d0',
        markColor: 'rgba(56, 239, 125, 0.22)'
    },
    funny: {
        bgGradient: ['#161309', '#2a200f', '#3b2c12'],
        accentGradient: ['#f6d365', '#fda085'],
        glowColor: 'rgba(246, 211, 101, 0.20)',
        cardBg: 'rgba(34, 28, 16, 0.68)',
        cardBorder: 'rgba(246, 211, 101, 0.32)',
        badgeBg: 'rgba(246, 211, 101, 0.15)',
        badgeText: '#ffd54f',
        quoteColor: '#ffffff',
        authorColor: '#ffe082',
        markColor: 'rgba(246, 211, 101, 0.25)'
    },
    default: {
        bgGradient: ['#0e1017', '#151928', '#1c1c36'],
        accentGradient: ['#7f00ff', '#e100ff'],
        glowColor: 'rgba(170, 75, 255, 0.20)',
        cardBg: 'rgba(24, 25, 45, 0.68)',
        cardBorder: 'rgba(170, 75, 255, 0.32)',
        badgeBg: 'rgba(170, 75, 255, 0.15)',
        badgeText: '#d500f9',
        quoteColor: '#ffffff',
        authorColor: '#ea80fc',
        markColor: 'rgba(170, 75, 255, 0.25)'
    }
};

function getPalette(themeId) {
    const key = (themeId || '').toLowerCase();
    return THEME_PALETTES[key] || THEME_PALETTES.default;
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
        const width = ctx.measureText(testLine).width;
        if (width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Generates a cinematic, high-resolution quote image buffer.
 * Dimensions: 1200 x 675 (16:9)
 */
async function generateQuoteImage(quoteData) {
    const width = 1200;
    const height = 675;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const palette = getPalette(quoteData.theme);
    const quoteText = quoteData.quote || 'No quote provided';
    const authorText = quoteData.author || 'Unknown';
    const themeName = (quoteData.themeName || quoteData.theme || 'Daily Quote').toUpperCase();

    // 1. Draw Multi-stop Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, palette.bgGradient[0]);
    bgGrad.addColorStop(0.5, palette.bgGradient[1]);
    bgGrad.addColorStop(1, palette.bgGradient[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient Lighting / Radial Glow Blobs
    const glow1 = ctx.createRadialGradient(width * 0.85, height * 0.2, 20, width * 0.85, height * 0.2, 400);
    glow1.addColorStop(0, palette.glowColor);
    glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(width * 0.15, height * 0.8, 30, width * 0.15, height * 0.8, 450);
    glow2.addColorStop(0, palette.glowColor);
    glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);

    // 3. Subtle Particle / Accent Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const dotCoords = [
        [100, 90, 2], [220, 160, 1.5], [1120, 140, 2.5], [1050, 260, 1.5],
        [80, 520, 1.8], [240, 590, 2.2], [1140, 550, 1.8], [980, 600, 2],
        [600, 50, 1.5], [680, 630, 2]
    ];
    for (const [dx, dy, r] of dotCoords) {
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // 4. Central Glassmorphic Card Dimensions
    const cardMarginX = 80;
    const cardMarginY = 60;
    const cardWidth = width - cardMarginX * 2;
    const cardHeight = height - cardMarginY * 2;
    const cardRadius = 24;

    // Card shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;

    // Draw Glassmorphic Card Base
    drawRoundedRect(ctx, cardMarginX, cardMarginY, cardWidth, cardHeight, cardRadius);
    ctx.fillStyle = palette.cardBg;
    ctx.fill();
    ctx.restore();

    // Card Glass Border Stroke
    drawRoundedRect(ctx, cardMarginX, cardMarginY, cardWidth, cardHeight, cardRadius);
    ctx.lineWidth = 1.8;
    const borderGrad = ctx.createLinearGradient(cardMarginX, cardMarginY, cardMarginX + cardWidth, cardMarginY + cardHeight);
    borderGrad.addColorStop(0, palette.cardBorder);
    borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.10)');
    borderGrad.addColorStop(1, palette.cardBorder);
    ctx.strokeStyle = borderGrad;
    ctx.stroke();

    // Top Accent Glow Line inside card
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cardMarginX + 80, cardMarginY);
    ctx.lineTo(cardMarginX + cardWidth - 80, cardMarginY);
    const topAccent = ctx.createLinearGradient(cardMarginX + 80, 0, cardMarginX + cardWidth - 80, 0);
    topAccent.addColorStop(0, 'rgba(255, 255, 255, 0)');
    topAccent.addColorStop(0.5, palette.badgeText);
    topAccent.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = topAccent;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 5. Theme Badge (Top Left of Card)
    const badgeX = cardMarginX + 50;
    const badgeY = cardMarginY + 45;
    const badgeTextStr = themeName;
    ctx.font = 'bold 13px "Segoe UI", "Arial", sans-serif';
    const badgeTextWidth = ctx.measureText(badgeTextStr).width;
    const badgeWidth = badgeTextWidth + 48;
    const badgeHeight = 32;

    drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 16);
    ctx.fillStyle = palette.badgeBg;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = palette.cardBorder;
    ctx.stroke();

    // Glowing Dot Indicator inside badge
    ctx.save();
    ctx.shadowColor = palette.badgeText;
    ctx.shadowBlur = 8;
    ctx.fillStyle = palette.badgeText;
    ctx.beginPath();
    ctx.arc(badgeX + 18, badgeY + badgeHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Badge Theme Text
    ctx.fillStyle = palette.badgeText;
    ctx.font = 'bold 13px "Segoe UI", "Arial", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeTextStr, badgeX + 28, badgeY + badgeHeight / 2);

    // Decorative Oversized Quotation Mark in Background
    ctx.save();
    ctx.font = 'bold 160px "Georgia", "Times New Roman", serif';
    ctx.fillStyle = palette.markColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('“', cardMarginX + 45, cardMarginY + 70);
    ctx.restore();

    // 6. Calculate Dynamic Font Size for Quote Text
    let fontSize = 42;
    if (quoteText.length > 150) {
        fontSize = 32;
    } else if (quoteText.length > 100) {
        fontSize = 36;
    } else if (quoteText.length < 60) {
        fontSize = 46;
    }

    ctx.font = `italic 500 ${fontSize}px "Segoe UI", "Georgia", "Arial", sans-serif`;
    const maxContentWidth = cardWidth - 140;
    let lines = wrapText(ctx, `“${quoteText}”`, maxContentWidth);

    const lineHeight = fontSize * 1.42;
    const totalQuoteHeight = lines.length * lineHeight;

    const contentStartY = cardMarginY + 130 + Math.max(0, (260 - totalQuoteHeight) / 2);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = palette.quoteColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textCenterX = width / 2;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], textCenterX, contentStartY + i * lineHeight);
    }
    ctx.restore();

    // 7. Author Line
    const authorY = contentStartY + totalQuoteHeight + 28;
    ctx.font = '600 20px "Segoe UI", "Arial", sans-serif';
    ctx.fillStyle = palette.authorColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`—  ${authorText}`, textCenterX, authorY);

    // 8. Bottom Divider & Footer
    const footerDividerY = cardMarginY + cardHeight - 65;
    ctx.beginPath();
    ctx.moveTo(cardMarginX + 50, footerDividerY);
    ctx.lineTo(cardMarginX + cardWidth - 50, footerDividerY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Footer Left: Branding
    ctx.font = 'bold 12px "Segoe UI", "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DAILY QUOTE • BLOOD ALLIANCE', cardMarginX + 50, footerDividerY + 32);

    // Footer Right: Date
    const todayStr = new Date().toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).toUpperCase();

    ctx.textAlign = 'right';
    ctx.fillText(todayStr, cardMarginX + cardWidth - 50, footerDividerY + 32);

    return canvas.toBuffer('image/png');
}

module.exports = {
    generateQuoteImage,
    getPalette
};
