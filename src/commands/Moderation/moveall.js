import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';

import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("moveall")
        .setDescription("Move all members from one voice channel to another")
        .addChannelOption(option =>
            option
                .setName("from")
                .setDescription("Voice channel to move members from")
                .addChannelTypes(
                    ChannelType.GuildVoice
                )
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName("to")
                .setDescription("Voice channel to move members to")
                .addChannelTypes(
                    ChannelType.GuildVoice
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

    category: "moderation",

    abuseProtection: {
        maxAttempts: 5,
        windowMs: 60_000
    },

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);

        if (!deferSuccess) {
            logger.warn(`Moveall interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'moveall'
            });
            return;
        }

        try {
            const fromChannel = interaction.options.getChannel("from");
            const toChannel = interaction.options.getChannel("to");

            if (!interaction.guild) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.UNKNOWN,
                    message: 'This command can only be used inside a server.'
                });
            }

            if (fromChannel.id === toChannel.id) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'The source and destination voice channels cannot be the same.'
                });
            }

            const botMember = interaction.guild.members.me;

            if (
                !botMember.permissions.has(PermissionFlagsBits.MoveMembers)
            ) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.UNKNOWN,
                    message: 'I do not have the Move Members permission.'
                });
            }

            const members = [...fromChannel.members.values()];

            if (members.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        warningEmbed(
                            '⚠️ No Members Found',
                            `There are no members currently connected to **${fromChannel.name}**.`
                        )
                    ]
                });
            }

            const results = {
                successful: [],
                failed: []
            };

            for (const member of members) {
                try {
                    await member.voice.setChannel(
                        toChannel,
                        `Moved by ${interaction.user.tag} using /moveall`
                    );

                    results.successful.push({
                        user: member.user.tag,
                        userId: member.user.id
                    });

                    logger.info(`Member moved with /moveall`, {
                        memberId: member.user.id,
                        memberTag: member.user.tag,
                        moderatorId: interaction.user.id,
                        fromChannel: fromChannel.id,
                        toChannel: toChannel.id,
                        guildId: interaction.guildId
                    });

                } catch (error) {
                    logger.error(
                        `Failed to move ${member.user.tag}:`,
                        error
                    );

                    results.failed.push({
                        user: member.user.tag,
                        userId: member.user.id,
                        reason: error.message || "Unknown error"
                    });
                }
            }

            let description = '';

            if (results.successful.length > 0) {
                description +=
                    `✅ **Successfully Moved (${results.successful.length})**\n`;

                results.successful.forEach(result => {
                    description += `• ${result.user}\n`;
                });

                description += '\n';
            }

            if (results.failed.length > 0) {
                description +=
                    `❌ **Failed (${results.failed.length})**\n`;

                results.failed.forEach(result => {
                    description +=
                        `• ${result.user} - ${result.reason}\n`;
                });

                description += '\n';
            }

            description +=
                `**From:** ${fromChannel}\n` +
                `**To:** ${toChannel}\n` +
                `**Moved By:** ${interaction.user}`;

            const embed =
                results.successful.length > 0
                    ? successEmbed
                    : warningEmbed;

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    embed(
                        '🔊 Move All Completed',
                        description
                    )
                ]
            });

        } catch (error) {
            logger.error("Error in moveall command:", error);

            return await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'An error occurred while moving members. Please try again later.'
            });
        }
    }
};
