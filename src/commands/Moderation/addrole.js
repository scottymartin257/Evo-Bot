
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Assign a role to a server member.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Member receiving the role')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Role to assign')
                .setRequired(true)
        ),

    async execute(interaction, guildConfig, client) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');

            const member = await interaction.guild.members.fetch(user.id);
            const staff = await interaction.guild.members.fetch(interaction.user.id);
            const bot = await interaction.guild.members.fetchMe();

            if (!staff.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.editReply('You do not have permission to manage roles.');
            }

            if (
                !staff.permissions.has(PermissionFlagsBits.Administrator) &&
                staff.roles.highest.comparePositionTo(role) <= 0
            ) {
                return interaction.editReply('That role is higher than or equal to your highest role.');
            }

            if (
                !bot.permissions.has(PermissionFlagsBits.ManageRoles) ||
                bot.roles.highest.comparePositionTo(role) <= 0 ||
                role.managed
            ) {
                return interaction.editReply('EVO BOT cannot assign that role. Check its role hierarchy and permissions.');
            }

            if (member.roles.cache.has(role.id)) {
                return interaction.editReply(`${user.username} already has the ${role.name} role.`);
            }

            await member.roles.add(
                role,
                `Assigned by ${interaction.user.tag} using /addrole`
            );

            await interaction.editReply(
                `Successfully assigned **${role.name}** to **${user.username}**.`
            );

        } catch (error) {
            console.error('Addrole error:', error);

            await interaction.editReply(
                'Failed to assign the role. Check bot permissions and Railway logs.'
            );
        }
    }
};
