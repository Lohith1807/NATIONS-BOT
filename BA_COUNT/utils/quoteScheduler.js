const cron = require('node-cron');
const { AttachmentBuilder } = require('discord.js');
const { getConfig, generateQuote } = require('./quoteService.js');
const { generateQuoteImage } = require('./quoteImageGenerator.js');

let activeCronJobs = [];

/**
 * Dispatches a quote to the specified channel (or configured default channel).
 * Strictly sends an image-only attachment without any embed or text.
 */
async function sendDailyQuote(client, channelIdOverride = null, themeOverride = null) {
    const config = getConfig();
    const targetChannelId = channelIdOverride || config.channelId;

    if (!targetChannelId) {
        console.warn('⚠️ [QuoteScheduler] No channel configured for daily quote. Use /dailyquote setup to configure.');
        return { success: false, reason: 'NO_CHANNEL' };
    }

    try {
        const channel = await client.channels.fetch(targetChannelId).catch(() => null);
        if (!channel) {
            console.error(`❌ [QuoteScheduler] Could not fetch channel with ID ${targetChannelId}`);
            return { success: false, reason: 'CHANNEL_NOT_FOUND' };
        }

        console.log(`🤖 [QuoteScheduler] Generating daily quote (Theme: ${themeOverride || 'Random'})...`);
        const quoteData = await generateQuote(themeOverride);
        console.log(`✨ [QuoteScheduler] Quote created [${quoteData.theme}]: "${quoteData.quote}" — ${quoteData.author}`);

        const imgBuffer = await generateQuoteImage(quoteData);
        const attachment = new AttachmentBuilder(imgBuffer, { name: 'daily-quote.png' });

        // User requirement: Strictly non-embed and no text, only the image attachment
        await channel.send({
            files: [attachment]
        });

        console.log(`✅ [QuoteScheduler] Successfully sent quote image to #${channel.name || targetChannelId}`);
        return { success: true, quote: quoteData };
    } catch (err) {
        console.error('❌ [QuoteScheduler] Error sending daily quote:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Initializes the daily cron schedules based on dailyQuoteConfig.json
 * Supports multiple scheduled times per day (e.g. 7 AM, 12 PM, 8 PM IST).
 */
function initQuoteScheduler(client) {
    // Clear any existing cron jobs
    if (activeCronJobs.length > 0) {
        for (const job of activeCronJobs) {
            try {
                job.stop();
            } catch (e) {}
        }
        activeCronJobs = [];
    }

    const config = getConfig();
    if (!config.enabled) {
        console.log('⏸️ [QuoteScheduler] Daily quote schedule is currently disabled in config.');
        return;
    }

    // Default to 7:00 AM, 12:00 PM, 8:00 PM IST if not configured
    let times = config.times;
    if (!Array.isArray(times) || times.length === 0) {
        if (config.time) {
            times = [config.time];
        } else {
            times = ['07:00', '12:00', '20:00'];
        }
    }

    const timezone = config.timezone || 'Asia/Kolkata';

    for (const timeStr of times) {
        const parts = timeStr.split(':');
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);

        if (isNaN(hour) || isNaN(minute)) continue;

        const cronExpression = `${minute} ${hour} * * *`;

        try {
            const job = cron.schedule(cronExpression, async () => {
                console.log(`⏰ [QuoteScheduler] Scheduled quote triggered at ${timeStr} (${timezone}) [Actual: ${new Date().toLocaleString('en-US', { timeZone: timezone })}]`);
                await sendDailyQuote(client);
            }, {
                scheduled: true,
                timezone: timezone
            });

            activeCronJobs.push(job);
        } catch (err) {
            console.error(`❌ [QuoteScheduler] Failed to schedule cron job for ${timeStr}:`, err);
        }
    }

    console.log(`✅ [QuoteScheduler] Scheduled ${activeCronJobs.length} quote times per day: ${times.join(', ')} (${timezone}) [Channel: ${config.channelId || 'Not Set'}]`);
}

/**
 * Reloads the scheduler when configuration changes
 */
function reloadQuoteScheduler(client) {
    initQuoteScheduler(client);
}

module.exports = {
    initQuoteScheduler,
    reloadQuoteScheduler,
    sendDailyQuote
};
