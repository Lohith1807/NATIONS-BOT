// This file centralizes all configuration and secrets from the environment
require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
  // Discord Configuration
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  PREFIX: process.env.PREFIX || ";",

  // COC Configuration
  COC_API_TOKEN: process.env.COC_API_TOKEN,


  // Channel IDs
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  ADMIN_CATEGORY_ID: process.env.ADMIN_CATEGORY_ID,
  WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID,
  RULES_CHANNEL_ID: process.env.RULES_CHANNEL_ID,

  // Role IDs
  ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || "").split(","),
  STAFF_ROLE_IDS: (process.env.STAFF_ROLE || "").split(","),
  GLOBAL_ROLE_ID: process.env.GLOBAL_ROLE_ID,
  SEEKER_ROLE_ID: process.env.SEEKER_ROLE_ID,
  APPROVE_ROLE_ID: process.env.APPROVE_ROLE_ID,
  REJECT_ROLE_ID: process.env.REJECT_ROLE_ID,

  // Additional Notify Channels
  APPROVE_NOTIFY_CHANNEL_ID: process.env.APPROVE_NOTIFY_CHANNEL_ID,
  REJECT_NOTIFY_CHANNEL_ID: process.env.REJECT_NOTIFY_CHANNEL_ID,

  // Ticket Configuration
  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID,
  PANEL_CHANNEL_ID: process.env.PANEL_CHANNEL_ID,
  TICKET_LOG_CHANNEL_ID: process.env.TICKET_LOG_CHANNEL_ID,
  GUILD_ID: process.env.GUILD_ID,
};
