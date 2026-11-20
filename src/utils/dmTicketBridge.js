
import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  Events
} from 'discord.js';

import { logger } from './logger.js';

// Tracks active tickets while the bot is running.
// Persistent storage will be added in the next step.
const activeTickets = new Map();

export function installDmTicketBridge(client) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;

      const guildId = process.env.DM_TICKET_GUILD_ID;
      const categoryId = process.env.DM_TICKET_CATEGORY_ID;
      const staffRoleId = process.env.DM_TICKET_STAFF_ROLE_ID;

      if (!guildId || !categoryId || !staffRoleId) return;

      const guild = await client.guilds.fetch(guildId);

      // Incoming direct message from a user
      if (message.channel.type === ChannelType.DM) {
        const user = message.author;

        let channelId = activeTickets.get(user.id);
        let ticket = channelId
          ? await guild.channels.fetch(channelId).catch(() => null)
          : null;

        if (!ticket) {
          // Find an existing ticket after a restart
          const channels = await guild.channels.fetch();

          ticket = channels.find(
            ch =>
              ch?.parentId === categoryId &&
              ch.topic === `DM-TICKET:${user.id}`
          );

          if (!ticket) {
            ticket = await guild.channels.create({
              name: `dm-${user.username
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .slice(0, 60)}`,
              type: ChannelType.GuildText,
              parent: categoryId,
              topic: `DM-TICKET:${user.id}`,
              permissionOverwrites: [
                {
                  id: guild.roles.everyone.id,
                  deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                  id: staffRoleId,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                  ]
                },
                {
                  id: client.user.id,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory
                  ]
                }
              ]
            });
          }

          activeTickets.set(user.id, ticket.id);
        }

        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('New DM from User')
          .addFields(
            {
              name: 'User',
              value: `${user.tag} (${user.id})`
            },
            {
              name: 'Message',
              value: message.content?.slice(0, 1024) || 'Attachment only'
            }
          )
          .setTimestamp();

        await ticket.send({
          embeds: [embed],
          files: message.attachments.map(a => a.url),
          allowedMentions: { parse: [] }
        });

        return;
      }

      // Staff messages inside a private ticket
      if (
        message.guildId === guildId &&
        message.channel.parentId === categoryId &&
        message.channel.topic?.startsWith('DM-TICKET:')
      ) {
        const member = await guild.members.fetch(message.author.id);

        if (
          !member.permissions.has(PermissionFlagsBits.ModerateMembers) &&
          !member.roles.cache.has(staffRoleId)
        ) return;

        const userId = message.channel.topic.split(':')[1];
        const user = await client.users.fetch(userId);

        await user.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('Message from Staff')
              .setDescription(message.content || 'Attachment included')
              .setTimestamp()
          ],
          files: message.attachments.map(a => a.url),
          allowedMentions: { parse: [] }
        });

        await message.react('✅');
      }
    } catch (error) {
      logger.error('DM ticket bridge error:', error);
    }
  });
}
