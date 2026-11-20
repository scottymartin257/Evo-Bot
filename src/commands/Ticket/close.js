
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Closes the current ticket.")
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("The reason for closing the ticket.")
                .setRequired(false)
        ),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });

        if (!deferred) return;

        const channel = interaction.channel;

        const reason =
            interaction.options?.getString("reason") ||
            "Closed via command without a specific reason.";

        // Check whether this is one of our DM ticket channels.
        const isDmTicket =
            interaction.guildId === process.env.DM_TICKET_GUILD_ID &&
            channel.type === ChannelType.GuildText &&
            channel.parentId === process.env.DM_TICKET_CATEGORY_ID &&
            channel.topic?.startsWith('DM-TICKET:');

        // Handle DM tickets separately from regular tickets.
        if (isDmTicket) {
            const staffRoleId = process.env.DM_TICKET_STAFF_ROLE_ID;

            const member = await interaction.guild.members.fetch(
                interaction.user.id
            );

            const canClose =
                member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                (staffRoleId && member.roles.cache.has(staffRoleId));

            if (!canClose) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: 'Only authorized staff can close DM tickets.'
                });
            }

            try {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "DM Ticket Closed!",
                            "This private DM ticket is being closed."
                        )
                    ]
                });

                logger.info('DM ticket closed', {
                    channelId: channel.id,
                    closedBy: interaction.user.id,
                    reason
                });

                // Delete the DM ticket channel.
                await channel.delete(
                    `DM ticket closed by ${interaction.user.tag}: ${reason}`
                );

                return;
            } catch (error) {
                logger.error('Failed to close DM ticket:', error);

                return await InteractionHelper.safeEditReply(interaction, {
                    content: `Failed to close DM ticket: ${error.message}`,
                    embeds: []
                });
            }
        }

        // Original ticket system remains unchanged.
        const permissionContext = await getTicketPermissionContext({
            client,
            interaction
        });

        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'This command can only be used in a valid ticket channel.'
            });
        }

        if (!permissionContext.canCloseTicket) {
            return await replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'You need the `Manage Channels` permission, the configured `Ticket Staff Role`, or be the ticket creator to close this ticket.'
            });
        }

        await closeTicket(channel, interaction.user, reason);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Ticket Closed!",
                    "This ticket has been closed successfully."
                )
            ]
        });

        logger.info('Ticket closed successfully', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: channel.id,
            channelName: channel.name,
            guildId: interaction.guildId,
            reason,
            commandName: 'close'
        });
    }
};
