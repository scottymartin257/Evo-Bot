import { logger } from "../utils/logger.js";

let twitchWasLive = false;
let twitchAccessToken = null;
let twitchTokenExpiresAt = 0;

async function getTwitchAccessToken(clientId, clientSecret) {
  if (
    twitchAccessToken &&
    Date.now() < twitchTokenExpiresAt - 60000
  ) {
    return twitchAccessToken;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?${params.toString()}`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Twitch authentication failed (${response.status}): ${text}`
    );
  }

  const data = await response.json();

  twitchAccessToken = data.access_token;
  twitchTokenExpiresAt =
    Date.now() + data.expires_in * 1000;

  return twitchAccessToken;
}

async function sendTwitchLiveNotification(
  client,
  streamConfig,
  stream
) {
  const discordConfig = streamConfig.discord;

  if (!discordConfig?.channelId) {
    logger.warn(
      "Twitch notification channel is not configured."
    );
    return;
  }

  const channel = await client.channels.fetch(
    discordConfig.channelId
  );

  if (!channel?.isTextBased()) {
    logger.warn(
      `Twitch notification channel ${discordConfig.channelId} is not a text channel.`
    );
    return;
  }

  const username = streamConfig.twitch.username;

  const roleMention = discordConfig.roleId
    ? `<@&${discordConfig.roleId}>`
    : "";

  const game = stream.game_name
    ? `\n🎮 **Playing:** ${stream.game_name}`
    : "";

  const title = stream.title
    ? `\n📺 **${stream.title}**`
    : "";

  await channel.send({
    content:
      `${roleMention}\n` +
      `🔴 **${username} is LIVE on Twitch!**` +
      `${title}` +
      `${game}\n\n` +
      `https://www.twitch.tv/${username}`,
  });

  logger.info(
    `✅ Twitch LIVE notification sent for ${username}`
  );
}

async function checkTwitch(client, config) {
  const streamConfig =
    config.bot?.streamNotifications;

  if (!streamConfig?.enabled) {
    return;
  }

  const twitch = streamConfig.twitch;

  if (!twitch?.enabled) {
    return;
  }

  if (
    !twitch.username ||
    !twitch.clientId ||
    !twitch.clientSecret
  ) {
    logger.warn(
      "Twitch notifications require username, TWITCH_CLIENT_ID, and TWITCH_CLIENT_SECRET."
    );
    return;
  }

  try {
    const token = await getTwitchAccessToken(
      twitch.clientId,
      twitch.clientSecret
    );

    const params = new URLSearchParams({
      user_login: twitch.username,
    });

    const response = await fetch(
      `https://api.twitch.tv/helix/streams?${params.toString()}`,
      {
        headers: {
          "Client-ID": twitch.clientId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        `Twitch API error (${response.status}): ${text}`
      );
    }

    const data = await response.json();

    const stream = data.data?.[0] ?? null;
    const isLive = Boolean(stream);

    // Offline -> Live
    if (isLive && !twitchWasLive) {
      await sendTwitchLiveNotification(
        client,
        streamConfig,
        stream
      );
    }

    // Live -> Offline
    if (!isLive && twitchWasLive) {
      logger.info(
        `${twitch.username} is no longer live on Twitch.`
      );
    }

    twitchWasLive = isLive;
  } catch (error) {
    logger.error(
      "❌ Twitch notification check failed:",
      error
    );
  }
}

let notificationInterval = null;

export function startStreamNotifications(
  client,
  config
) {
  const streamConfig =
    config.bot?.streamNotifications;

  if (!streamConfig?.enabled) {
    logger.info(
      "Stream notifications are disabled."
    );
    return;
  }

  if (notificationInterval) {
    logger.warn(
      "Stream notification service is already running."
    );
    return;
  }

  logger.info(
    "🔔 Starting stream notification service..."
  );

  // Check immediately
  checkTwitch(client, config);

  // Check Twitch every 60 seconds
  notificationInterval = setInterval(() => {
    checkTwitch(client, config);
  }, 60_000);
}

export function stopStreamNotifications() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;

    logger.info(
      "Stream notification service stopped."
    );
  }
}
