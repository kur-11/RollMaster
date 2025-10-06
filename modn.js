// modn.js 💎
// 🛡️ أوامر الإدارة (عربي كتابية + إنجليزي سلاش)
// ✅ تايم / بان / تبخر / نك + فك الباند (ن بان) + فك التايم (تكلم)
// ✅ /timeout /ban /kick /nickname /unban /untimeout

import { PermissionFlagsBits } from "discord.js";

export default (client) => {
  // 🎯 الأوامر الكتابية (بالعربية)
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/\s+/);
    const command = args[0]?.toLowerCase();

    // ⏰ تايم
    if (["تايم"].includes(command)) {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply("🚫 ما عندك صلاحية التايم!");
      const member = message.mentions.members.first();
      const time = parseInt(args[2]);
      if (!member || isNaN(time))
        return message.reply("❌ استخدم: `تايم @الشخص عدد_الدقائق`");
      await member.timeout(time * 60 * 1000, "Timeout من مشرف");
      message.reply(`🕓 تم إعطاء تايم لـ ${member} لمدة ${time} دقيقة.`);
    }

    // 🔓 تكلم (فك التايم)
    if (["تكلم"].includes(command)) {
      if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return message.reply("🚫 ما عندك صلاحية فك التايم!");
      const member = message.mentions.members.first();
      if (!member) return message.reply("❌ استخدم: `تكلم @الشخص`");
      await member.timeout(null);
      message.reply(`🔓 تم فك التايم عن ${member.user.tag}`);
    }

    // 🔨 بان
    if (["بان"].includes(command)) {
      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
        return message.reply("🚫 ما عندك صلاحية البان!");
      const member = message.mentions.members.first();
      if (!member) return message.reply("❌ استخدم: `بان @الشخص`");
      await member.ban({ reason: "Ban من مشرف" });
      message.reply(`🔨 تم تبنيد ${member.user.tag} بنجاح!`);
    }

    // 🔓 ن بان (فك الباند)
    if (["ن", "ن_بان", "نبان", "فك", "فك_الباند"].includes(command)) {
      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers))
        return message.reply("🚫 ما عندك صلاحية فك الباند!");
      const userId = args[1];
      if (!userId) return message.reply("❌ استخدم: `ن بان ID_المستخدم`");
      try {
        await message.guild.members.unban(userId);
        message.reply(`🔓 تم فك الباند عن <@${userId}>`);
      } catch {
        message.reply("⚠️ لم أستطع فك الباند — تأكد من الـ ID!");
      }
    }

    // 👢 تبخر
    if (["تبخر"].includes(command)) {
      if (!message.member.permissions.has(PermissionFlagsBits.KickMembers))
        return message.reply("🚫 ما عندك صلاحية الطرد!");
      const member = message.mentions.members.first();
      if (!member) return message.reply("❌ استخدم: `تبخر @الشخص`");
      await member.kick("Kick من مشرف");
      message.reply(`👢 تم تبخير ${member.user.tag} من السيرفر.`);
    }

    // ✏️ نك
    if (["نك"].includes(command)) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames))
        return message.reply("🚫 ما عندك صلاحية تغيير الأسماء!");
      const member = message.mentions.members.first();
      const newNick = args.slice(2).join(" ");
      if (!member || !newNick)
        return message.reply("❌ استخدم: `نك @الشخص الاسم_الجديد`");
      await member.setNickname(newNick);
      message.reply(`✏️ تم تغيير اسم ${member.user.tag} إلى **${newNick}**`);
    }
  });

  // ⚙️ أوامر السلاش (بالإنجليزية)
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member, guild } = interaction;

    // /timeout
    if (commandName === "timeout") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return interaction.reply({ content: "🚫 ما عندك صلاحية التايم!", ephemeral: true });
      const user = options.getMember("member");
      const minutes = options.getInteger("minutes");
      if (!user || !minutes)
        return interaction.reply("❌ استخدم: /timeout العضو الوقت_بالدقائق");
      await user.timeout(minutes * 60 * 1000);
      interaction.reply(`🕓 تم إعطاء تايم لـ ${user} لمدة ${minutes} دقيقة.`);
    }

    // /untimeout
    if (commandName === "untimeout") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers))
        return interaction.reply({ content: "🚫 ما عندك صلاحية فك التايم!", ephemeral: true });
      const user = options.getMember("member");
      if (!user)
        return interaction.reply("❌ استخدم: /untimeout العضو");
      await user.timeout(null);
      interaction.reply(`🔓 تم فك التايم عن ${user.user.tag}`);
    }

    // /ban
    if (commandName === "ban") {
      if (!member.permissions.has(PermissionFlagsBits.BanMembers))
        return interaction.reply({ content: "🚫 ما عندك صلاحية البان!", ephemeral: true });
      const user = options.getMember("member");
      if (!user) return interaction.reply("❌ استخدم: /ban العضو");
      await user.ban();
      interaction.reply(`🔨 تم تبنيد ${user.user.tag} بنجاح!`);
    }

    // /unban
    if (commandName === "unban") {
      if (!member.permissions.has(PermissionFlagsBits.BanMembers))
        return interaction.reply({ content: "🚫 ما عندك صلاحية فك الباند!", ephemeral: true });
      const userId = options.getString("user_id");
      try {
        await guild.members.unban(userId);
        interaction.reply(`🔓 تم فك الباند عن <@${userId}>`);
      } catch {
        interaction.reply("⚠️ لم أستطع فك الباند — تأكد من الـ ID!");
      }
    }

    // /kick
    if (commandName === "kick") {
      if (!member.permissions.has(PermissionFlagsBits.KickMembers))
        return interaction.reply({ content: "🚫 ما عندك صلاحية الطرد!", ephemeral: true });
      const user = options.getMember("member");
      if (!user) return interaction.reply("❌ استخدم: /kick العضو");
      await user.kick();
      interaction.reply(`👢 تم تبخير ${user.user.tag} من السيرفر.`);
    }

    // /nickname
    if (commandName === "nickname") {
      if (!member.permissions.has(PermissionFlagsBits.ManageNicknames))
        return interaction.reply({ content: "🚫 ما عندك صلاحية تغيير الأسماء!", ephemeral: true });
      const user = options.getMember("member");
      const newNick = options.getString("nickname");
      if (!user || !newNick)
        return interaction.reply("❌ استخدم: /nickname العضو الاسم_الجديد");
      await user.setNickname(newNick);
      interaction.reply(`✏️ تم تغيير اسم ${user.user.tag} إلى **${newNick}**`);
    }
  });
};
