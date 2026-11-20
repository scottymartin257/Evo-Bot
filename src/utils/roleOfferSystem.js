
import {
    Events,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
const processingOffers = new Set();
const completedOffers = new Set();
export function installRoleOfferSystem(client) {
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('er:')) return;

      const parts = interaction.customId.split(':');
if (parts.length !== 7) return;

const [
    ,
    action,
    guildId,
    roleId,
    userId,
    offerId,
    offeredBy
] = parts;

        if (!['accept', 'decline'].includes(action)) return;

        try {
            // Only the intended recipient can respond.
            if (interaction.user.id !== userId) {
                return await interaction.reply({
                    content: 'This role invitation is not for you.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Require a genuine bot-authored DM invitation.
            if (
                interaction.guildId ||
                interaction.message.author.id !== client.user.id
            ) {
                return await interaction.reply({
                    content: 'Invalid role invitation.',
                    flags: MessageFlags.Ephemeral
                });
            }
if (
    processingOffers.has(offerId) ||
    completedOffers.has(offerId)
) {
    return await interaction.reply({
        content: 'This role invitation is already being processed or has been completed.',
        flags: MessageFlags.Ephemeral
    });
}

processingOffers.add(offerId);
            await interaction.deferUpdate();

            const guild = await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            const role = await guild.roles.fetch(roleId);
            const bot = await guild.members.fetchMe();

            // Verify the staff member who originally offered the role.
const offeringStaff = await guild.members.fetch(offeredBy).catch(() => null);

const staffStillAuthorized =
    offeringStaff &&
    offeringStaff.permissions.has(PermissionFlagsBits.ManageRoles) &&
    (
        offeringStaff.permissions.has(PermissionFlagsBits.Administrator) ||
        (role && offeringStaff.roles.highest.comparePositionTo(role) > 0)
    );

if (action === 'accept' && !staffStillAuthorized) {
    return await interaction.followUp({
        content: 'This role invitation is no longer authorized. Please contact staff for a new invitation.',
        flags: MessageFlags.Ephemeral
    });
}

            if (!role) {
                return await interaction.followUp({
                    content: 'This role no longer exists.',
                    flags: MessageFlags.Ephemeral
                });
            }

            let result;

            if (action === 'accept') {
                if (
                    !bot.permissions.has(PermissionFlagsBits.ManageRoles) ||
                    bot.roles.highest.comparePositionTo(role) <= 0 ||
                    role.managed
                ) {
                    return await interaction.followUp({
                        content: 'EVO BOT cannot assign this role.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(
                        role,
                        'Accepted role invitation through EVO BOT'
                    );
                }

                result = 'Accepted';
            } else {
                result = 'Declined';
            }

            // Disable both buttons after responding.
            await interaction.message.edit({
                components: []
            });

            const response = new EmbedBuilder()
                .setColor(action === 'accept' ? 0x2ecc71 : 0xe74c3c)
                .setTitle(`Role Invitation ${result}`)
                .setDescription(
                    action === 'accept'
                        ? `You accepted the **${role.name}** role in **${guild.name}**.`
                        : `You declined the **${role.name}** role in **${guild.name}**.`
                )
                .setTimestamp();

            await interaction.followUp({
                embeds: [response]
            });

            // Log result in the existing private DM ticket.
            const configuredGuildId = process.env.DM_TICKET_GUILD_ID;
            const categoryId = process.env.DM_TICKET_CATEGORY_ID;

            if (configuredGuildId === guildId && categoryId) {
                try {
                    const channels = await guild.channels.fetch();

                    const ticket = channels.find(channel =>
                        channel &&
                        channel.type === ChannelType.GuildText &&
                        channel.parentId === categoryId &&
                        channel.topic === `DM-TICKET:${userId}`
                    );

                    if (ticket) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(
                                action === 'accept' ? 0x2ecc71 : 0xe74c3c
                            )
                            .setTitle(`Role Offer ${result}`)
                            .addFields(
                                {
                                    name: 'Member',
                                    value: `<@${userId}>`
                                },
                                {
                                    name: 'Role',
                                    value: `<@&${roleId}>`
                                },
                                {
                                    name: 'Result',
                                    value: result
                                }
                            )
                            .setTimestamp();

                        await ticket.send({
                            embeds: [logEmbed],
                            allowedMentions: { parse: [] }
                        });
                    }
                } catch (logError) {
                    console.error(
                        'Role offer ticket logging failed:',
                        logError
                    );
                }
            }
        } catch (error) {
            console.error('Role offer interaction error:', error);

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({
                        content: 'Unable to process this role invitation.',
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.reply({
                        content: 'Unable to process this role invitation.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                console.error('Role offer reply error:', replyError);
            }
        }
    });
}
