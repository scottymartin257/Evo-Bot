import { logger } from "../utils/logger.js";

let twitchWasLive = false;

async function getTwitchAccessToken(clientId, clientSecret) {
  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(`Twitch auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function checkTwitch(client, config) {
  const streamConfig = config.bot.streamNotifications;

  if (!streamConfig?.enabled) return;
  if (!streamConfig.twitch?.enabled) return;

  const {
    username,
    clientId,
    clientSecret,
  } = streamConfig.twitch;

  if (!clientId || !clientSecret) {
    logger.warn(
      "Twitch notifications disabled: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET missing."
    );
    return;
  }

  try {
    const accessToken = await getTwitchAccessToken(
      clientId,
      clientSecret
    );

    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Twitch stream lookup failed: ${response.status}`
      );
    }

    const data = await response.json();
    const stream = data.data?.[0];

    const isLive = Boolean(stream);

    if (isLive && !twitchWasLive) {
      const channelId =
        streamConfig.discord.channelId;

      const roleId =
        streamConfig.discord.roleId;

      const channel =
        await client.channels.fetch(channelId);

      if (channel) {
        await channel.send({
          content:
            `<@&${roleId}>\n` +
            `🔴 **${username} is LIVE on Twitch!**\n` +
            `https://twitch.tv/${username}`,
        });
      }

      logger.info(
        `Sent Twitch LIVE notification for ${username}`
      );
    }

    twitchWasLive = isLive;
  } catch (error) {
    logger.error(
      "Twitch notification check failed:",
      error
    );
  }
}

export function startStreamNotifications(client, config) {
  const streamConfig =
    config.bot.streamNotifications;

  if (!streamConfig?.enabled) {
    logger.info(
      "Stream notifications are disabled."
    );
    return;
  }

  logger.info("Starting stream notifications...");

  // Initial Twitch check
  checkTwitch(client, config);

  // Check every 60 seconds
  setInterval(() => {
    checkTwitch(client, config);
  }, 60_000);
}
