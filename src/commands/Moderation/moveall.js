import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("moveall")
    .setDescription("Move all members from one voice channel to another.")
    .addChannelOption((option) =>
      option
        .setName("from")
        .setDescription("Voice channel to move members from.")
        .addChannelTypes(
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice
        )
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("to")
        .setDescription("Voice channel to move members to.")
        .addChannelTypes(
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice
        )
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  async execute(interaction) {
    const fromChannel = interaction.options.getChannel("from");
    const toChannel = interaction.options.getChannel("to");

    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used inside a server.",
        ephemeral: true,
      });
    }

    if (fromChannel.id === toChannel.id) {
      return interaction.reply({
        content: "❌ The source and destination channels cannot be the same.",
        ephemeral: true,
      });
    }

    const botMember = interaction.guild.members.me;

    if (
      !botMember.permissions.has(PermissionFlagsBits.MoveMembers)
    ) {
      return interaction.reply({
        content: "❌ I don't have the **Move Members** permission.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const members = [...fromChannel.members.values()];

    if (members.length === 0) {
      return interaction.editReply({
        content: `❌ There are no members in **${fromChannel.name}**.`,
      });
    }

    let moved = 0;
    let failed = 0;

    for (const member of members) {
      try {
        await member.voice.setChannel(
          toChannel,
          `Moved by ${interaction.user.tag} using /moveall`
        );

        moved++;
      } catch (error) {
        console.error(
          `Failed to move ${member.user.tag}:`,
          error
        );

        failed++;
      }
    }

    return interaction.editReply({
      content:
        `✅ Moved **${moved}** member${moved === 1 ? "" : "s"} ` +
        `from **${fromChannel.name}** to **${toChannel.name}**.` +
        (failed > 0
          ? `\n⚠️ **${failed}** member${failed === 1 ? "" : "s"} could not be moved.`
          : ""),
    });
  },
};
