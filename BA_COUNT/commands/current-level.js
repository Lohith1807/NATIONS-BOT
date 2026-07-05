const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getServers, getUsers } = require('../utils/dataManager');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

async function createProgressImage(current, target, currentLevelStr, nextLevelStr, totalCount) {
    const width = 800;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Main Background
    ctx.fillStyle = '#18191c'; // Very dark gray/purple
    ctx.roundRect(0, 0, width, height, 20);
    ctx.fill();

    // Inner Glow/Border simulation
    ctx.strokeStyle = '#d4af37'; // Gold
    ctx.lineWidth = 2;
    ctx.roundRect(5, 5, width - 10, height - 10, 15);
    ctx.stroke();

    // Top Gold Banner
    const bannerGradient = ctx.createLinearGradient(0, 0, width, 0);
    bannerGradient.addColorStop(0, '#d4af37');
    bannerGradient.addColorStop(0.5, '#ffdf73');
    bannerGradient.addColorStop(1, '#d4af37');
    ctx.fillStyle = bannerGradient;
    ctx.beginPath();
    ctx.roundRect(20, 20, width - 40, 60, 15);
    ctx.fill();

    // Banner Text
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.fillText('👑 Server Counting Level 👑', width / 2, 62);

    // Middle text block
    ctx.font = 'bold 45px sans-serif';
    ctx.fillStyle = '#ffdf73'; // Gold
    ctx.textAlign = 'left';
    ctx.fillText(`👑 Level ${currentLevelStr}`, 30, 150);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`🎛 Total Count: ${totalCount}`, width - 30, 150);

    // Progress Bar Background
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.roundRect(30, 180, width - 60, 40, 20);
    ctx.fill();

    // Progress Bar Glow/Border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Progress Bar Fill
    const progress = Math.min(Math.max(current / target, 0), 1);
    if (progress > 0) {
        const barGradient = ctx.createLinearGradient(30, 180, 30 + (width - 60) * progress, 180);
        barGradient.addColorStop(0, '#a124ba'); // Purple
        barGradient.addColorStop(1, '#ffdf73'); // Gold
        
        ctx.fillStyle = barGradient;
        ctx.beginPath();
        ctx.roundRect(30, 180, (width - 60) * progress, 40, 20);
        ctx.fill();
    }

    // Remaining counts text
    const pending = target - current;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`📉 ${pending} counts remaining for Level ${nextLevelStr}`, 30, 260);

    return await canvas.encode('png');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('current-level')
        .setDescription('Shows the current counting level and progress towards the next level'),
    
    async execute(interaction) {
        const guildId = interaction.guildId;
        const servers = getServers();
        
        if (!servers[guildId]) {
            return await interaction.reply({ content: `Counting is not setup in this server yet.`, ephemeral: true });
        }
        
        const serverConfig = servers[guildId];
        const currentCount = serverConfig.currentCount || 0;
        const levels = serverConfig.levels || {};
        
        const users = getUsers();
        let userCount = 0;
        if (users[guildId] && users[guildId][interaction.user.id]) {
            userCount = users[guildId][interaction.user.id].score || 0;
        }

        let currentLevel = 0;
        let nextLevelCount = null;
        let nextLevel = null;
        let prevLevelCount = 0; // Baseline for progress bar

        // Sort thresholds numerically
        const thresholds = Object.keys(levels).map(Number).sort((a, b) => a - b);
        
        for (const t of thresholds) {
            if (currentCount >= t) {
                currentLevel = levels[t];
                prevLevelCount = t;
            } else {
                nextLevelCount = t;
                nextLevel = levels[t];
                break;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Server Counting Progress')
            .setColor('#7289da')
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .addFields(
                { name: 'Current Level', value: `**Level ${currentLevel}**`, inline: true },
                { name: 'Current Count', value: `**${currentCount}**`, inline: true },
                { name: 'Your Personal Counts', value: `**${userCount}** counts`, inline: false }
            );

        if (nextLevelCount !== null) {
            const pending = nextLevelCount - currentCount;
            // Progress calculations
            const requiredForNext = nextLevelCount - prevLevelCount;
            const progressInCurrent = currentCount - prevLevelCount;
            
            // Generate canvas image
            const imageBuffer = await createProgressImage(progressInCurrent, requiredForNext, currentLevel, nextLevel, currentCount);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'progress.png' });
            
            embed.setImage('attachment://progress.png')
                 .addFields(
                    { name: 'Pending', value: `${pending} counts remaining to reach Level ${nextLevel}! 🚀`, inline: false }
                 );
                 
            await interaction.reply({ embeds: [embed], files: [attachment] });
        } else {
            embed.addFields(
                { name: 'Next Level', value: `You have reached the maximum configured level! 🎉`, inline: false }
            );
            await interaction.reply({ embeds: [embed] });
        }
    },
};
