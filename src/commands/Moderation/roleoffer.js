
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('roleoffer')
        .setDescription('Offer a Discord role to a member through DM.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Member receiving the role offer')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Role being offered')
                .setRequired(true)
        ),

    async execute(interaction, guildConfig, client) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');
            const guild = interaction.guild;

            const staff = await guild.members.fetch(interaction.user.id);
            const member = await guild.members.fetch(user.id);
            const bot = await guild.members.fetchMe();

            if (!staff.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.editReply(
                    'You do not have permission to offer roles.'
                );
            }

            if (
                !staff.permissions.has(PermissionFlagsBits.Administrator) &&
                staff.roles.highest.comparePositionTo(role) <= 0
            ) {
                return interaction.editReply(
                    'You cannot offer a role equal to or above your highest role.'
                );
            }

            if (
                !bot.permissions.has(PermissionFlagsBits.ManageRoles) ||
                bot.roles.highest.comparePositionTo(role) <= 0 ||
                role.managed
            ) {
                return interaction.editReply(
                    'EVO BOT cannot assign that role. Check its permissions and role hierarchy.'
                );
            }

            if (member.roles.cache.has(role.id)) {
                return interaction.editReply(
                    `${user.username} already has the ${role.name} role.`
                );
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('EVO BOT — Role Invitation')
                .setDescription(
                    `You have been offered the **${role.name}** role in **${guild.name}**.\n\n` +
                    'Would you like to accept this role?'
                )
                .setFooter({
                    text: 'Select an option below to respond.'
                })
                .setTimestamp();

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`er:accept:${guild.id}:${role.id}:${user.id}`)
                    .setLabel('Yes, Accept')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId(`er:decline:${guild.id}:${role.id}:${user.id}`)
                    .setLabel('No, Decline')
                    .setStyle(ButtonStyle.Danger)
            );

            await user.send({
                embeds: [embed],
                components: [buttons],
                allowedMentions: { parse: [] }
            });

            await interaction.editReply(
                `Role offer sent to **${user.username}** for **${role.name}**.`
            );

        } catch (error) {
            console.error('Role offer error:', error);

            await interaction.editReply(
                'Failed to send the role offer. Check the member, bot permissions, and whether their DMs are open.'
            );
        }
    }
};
