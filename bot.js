// bot.js 💎 (نسخة محسّنة — بدون موقع)
// ✅ نظام الحضور + منشن رول + تحذيرات + منع التسجيل بعد الوقت + رسائل خاصة
import { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, Partials } from "discord.js";
import cron from "node-cron";
import fs from "fs";
import setupModeration from "./modn.js";

process.env.TZ = "Asia/Riyadh";
const DATA_FILE = "attendance_data.json";

// ------------------ Utilities ------------------
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (err) {
      console.error("⚠️ خطأ بقراءة ملف البيانات، سيتم إنشاء ملف جديد:", err.message);
      return { attendanceLists: [] };
    }
  }
  return { attendanceLists: [] };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ خطأ بحفظ البيانات:", err.message);
  }
}

function validateTimeFormat(time) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ------------------ إرسال رسالة الحضور ------------------
async function sendAttendanceMessage(client, list) {
  const data = loadData();
  const fresh = data.attendanceLists.find((l) => l.name === list.name);
  if (!fresh) {
    console.log("⚠️ لم أجد القائمة (ربما حُذفت):", list.name);
    return;
  }

  // تأكد أن القناة موجودة وقابلة للاستخدام
  const channel = await client.channels.fetch(fresh.channelId).catch(() => null);
  if (!channel) {
    console.log(`⚠️ القناة غير موجودة أو لا يمكن الوصول لها: ${fresh.channelId} (قائمة: ${fresh.name})`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(`📝 ${fresh.title}`)
    .setDescription(`${fresh.description}\n\n**اضغط ✅ لتسجيل حضورك!**`)
    .addFields(
      { name: "🕐 البداية", value: fresh.startTime || "-", inline: true },
      { name: "⏰ النهاية", value: fresh.endTime || "-", inline: true },
      { name: "👥 الحضور", value: "لا يوجد حضور بعد", inline: false }
    )
    .setTimestamp();

  try {
    const msg = await channel.send({
      content: fresh.roleId ? `<@&${fresh.roleId}>` : "",
      embeds: [embed],
    });
    await msg.react("✅").catch(() => null);

    fresh.messageId = msg.id;
    fresh.attendees = [];
    fresh.warnings = fresh.warnings || {};
    saveData(data);
    console.log(`📨 تم إرسال الحضور "${fresh.name}" في القناة ${fresh.channelId}`);
  } catch (err) {
    console.error("❌ خطأ عند إرسال رسالة الحضور:", err.message);
  }
}

// ------------------ تشغيل البوت ------------------
async function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("❌ لم يتم العثور على توكن البوت في المتغيرات.");

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  let data = loadData();

  client.once("ready", () => {
    console.log(`✅ البوت جاهز: ${client.user.tag}`);
    setupSchedules(client, data);
  });

  // ربط ملف أوامر الإدارة (modn.js)
  setupModeration(client);

  // إنشاء القوائم عبر الأمر /existing
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "❌ هذا الأمر للمسؤولين فقط.", ephemeral: true });

    if (interaction.commandName === "existing") {
      const listName = interaction.options.getString("name");
      const title = interaction.options.getString("title");
      const description = interaction.options.getString("description");
      const startTime = interaction.options.getString("start_time");
      const endTime = interaction.options.getString("end_time");
      const sendTime = interaction.options.getString("send_time");
      const frequency = interaction.options.getString("frequency");
      const role = interaction.options.getRole("role");
      const warningsChannel = interaction.options.getChannel("warnings_channel");

      if (![startTime, endTime, sendTime].every((t) => validateTimeFormat(t)))
        return interaction.reply({ content: "❌ تأكد أن الأوقات بصيغة HH:MM.", ephemeral: true });

      data = loadData();
      if (data.attendanceLists.find((l) => l.name === listName))
        return interaction.reply({ content: `❌ القائمة "${listName}" موجودة مسبقًا.`, ephemeral: true });

      const newList = {
        name: listName,
        title,
        description,
        startTime,
        endTime,
        sendTime,
        frequency,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        roleId: role ? role.id : null,
        warningsChannelId: warningsChannel ? warningsChannel.id : null,
        attendees: [],
        warnings: {},
        messageId: null,
      };

      data.attendanceLists.push(newList);
      saveData(data);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ تم إنشاء قائمة الحضور")
        .setDescription("سيتم إرسال الجدول تلقائيًا حسب التوقيت المحدد.")
        .addFields(
          { name: "📋 العنوان", value: title || "-", inline: true },
          { name: "🕐 البداية", value: startTime || "-", inline: true },
          { name: "⏰ النهاية", value: endTime || "-", inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      setupSchedules(client, loadData());
    }
  });

  // تسجيل الحضور عبر الرياكشن
  client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => null);

    const dataLocal = loadData();
    const list = dataLocal.attendanceLists.find((l) => l.messageId === reaction.message.id);
    if (!list || reaction.emoji.name !== "✅") return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = timeToMinutes(list.endTime);

    if (currentMinutes > endMinutes) {
      await reaction.users.remove(user.id).catch(() => null);
      try { await user.send("🔒 **انتهى وقت تسجيل الحضور لهذا اليوم.**"); } catch {}
      return;
    }

    if (!list.attendees.includes(user.id)) {
      list.attendees.push(user.id);
      list.warnings = list.warnings || {};
      list.warnings[user.id] = 0;
      saveData(dataLocal);

      try { await user.send("✅ **تم تسجيل حضورك بنجاح!**"); } catch {}
      await updateAttendanceMessage(client, list);
    }
  });

  await client.login(token);
}

// ------------------ تحديث رسالة الحضور ------------------
async function updateAttendanceMessage(client, list) {
  const data = loadData();
  const fresh = data.attendanceLists.find((l) => l.name === list.name);
  if (!fresh) return;

  const channel = await client.channels.fetch(fresh.channelId).catch(() => null);
  if (!channel || !fresh.messageId) return;

  const msg = await channel.messages.fetch(fresh.messageId).catch(() => null);
  if (!msg) return;

  const attendeesList = (fresh.attendees && fresh.attendees.length)
    ? fresh.attendees.map((id) => `<@${id}>`).join("\n")
    : "لا يوجد حضور بعد";

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(`📝 ${fresh.title}`)
    .setDescription(`${fresh.description}\n\n**اضغط ✅ لتسجيل حضورك!**`)
    .addFields(
      { name: "🕐 البداية", value: fresh.startTime || "-", inline: true },
      { name: "⏰ النهاية", value: fresh.endTime || "-", inline: true },
      { name: "👥 الحضور", value: attendeesList, inline: false }
    )
    .setTimestamp();

  await msg.edit({ embeds: [embed] }).catch((e) => console.log("⚠️ تحديث الرسالة فشل:", e.message));
}

// ------------------ فحص التحذيرات واغلاق التسجيل ------------------
async function checkAndHandleWarnings(client, listName) {
  const data = loadData();
  const list = data.attendanceLists.find((l) => l.name === listName);
  if (!list) {
    console.log("⚠️ لا توجد قائمة بهذه الإسم:", listName);
    return;
  }

  // تأكد من تهيئة warnings
  list.warnings = list.warnings || {};

  // جلب الجيلد
  const guild = await client.guilds.fetch(list.guildId).catch(() => null);
  if (!guild) {
    console.log(`⚠️ لم أتمكن من جلب السيرفر ${list.guildId} (قائمة: ${list.name})`);
    return;
  }

  const members = await guild.members.fetch().catch(() => null);
  if (!members) {
    console.log(`⚠️ لم أتمكن من جلب الأعضاء في السيرفر ${list.guildId}`);
    return;
  }

  console.log(`🔎 فحص غياب للقائمة "${list.name}" — أعضاء مدخلين: ${members.size}`);

  const absents = [];
  // members هو Collection — نستعمل values() ونحمي كل عملية
  for (const m of members.values()) {
    try {
      if (!m) continue;
      if (m.user && m.user.bot) continue;
      if (list.roleId && !m.roles?.cache?.has(list.roleId)) continue;
      if (!list.attendees.includes(m.id)) {
        absents.push(m.id);
      } else {
        list.warnings[m.id] = 0;
      }
    } catch (e) {
      console.log("⚠️ خطأ أثناء فحص عضو:", e.message);
    }
  }

  const warned = [];
  for (const id of absents) {
    try {
      list.warnings[id] = (list.warnings[id] || 0) + 1;
      if (list.warnings[id] >= 2) warned.push({ id, count: list.warnings[id] });
      if (list.warnings[id] > 3) list.warnings[id] = 3;
    } catch (e) {
      console.log("⚠️ خطأ أثناء تحديث التحذيرات:", e.message);
    }
  }

  saveData(data);

  // تعديل رسالة القفل (إن وُجدت)
  try {
    const channel = await client.channels.fetch(list.channelId).catch(() => null);
    if (channel && list.messageId) {
      const msg = await channel.messages.fetch(list.messageId).catch(() => null);
      if (msg && msg.embeds && msg.embeds[0]) {
        const embed = EmbedBuilder.from(msg.embeds[0])
          .setColor(0xff0000)
          .setDescription("🔒 **انتهى وقت تسجيل الحضور لهذا اليوم 🙂👍**");
        await msg.edit({ embeds: [embed] }).catch(() => null);
      }
    }
  } catch (e) {
    console.log("⚠️ لم يتم تعديل رسالة القفل:", e.message);
  }

  // إرسال التحذيرات لقناة التحذير (إن وُجدت)
  try {
    if (list.warningsChannelId && warned.length > 0) {
      const warnChannel = await client.channels.fetch(list.warningsChannelId).catch(() => null);
      if (warnChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("⚠️ تحذير غياب متكرر")
          .setDescription("الأعضاء التالية أسماؤهم غابوا يومين أو أكثر:")
          .addFields({
            name: "المتغيبون",
            value: warned.map((w) => `<@${w.id}> — تحذير ${w.count}`).join("\n"),
          })
          .setTimestamp();
        await warnChannel.send({ embeds: [embed] }).catch(() => null);
      }
    }
  } catch (e) {
    console.log("⚠️ خطأ عند إرسال تحذيرات:", e.message);
  }

  console.log(`✅ انتهى فحص القائمة "${list.name}". تحذيرات مرسلة: ${warned.length}`);
}

// ------------------ الجدولة ------------------
function setupSchedules(client, data) {
  // نوقف أي مهمة موجودة من قبل (لو دعمته المكتبة)
  try {
    if (typeof cron.getTasks === "function") {
      cron.getTasks().forEach((t) => t.stop());
    }
  } catch {}

  data.attendanceLists.forEach((list) => {
    if (!list.sendTime || !list.endTime) return;
    try {
      const [sendH, sendM] = list.sendTime.split(":").map(Number);
      const [endH, endM] = list.endTime.split(":").map(Number);

      cron.schedule(`${sendM} ${sendH} * * *`, () => {
        try { sendAttendanceMessage(client, list); } catch (e) { console.log("⚠️ cron sendAttendanceMessage error:", e.message); }
      }, { timezone: "Asia/Riyadh" });

      cron.schedule(`${endM} ${endH} * * *`, () => {
        try { checkAndHandleWarnings(client, list.name); } catch (e) { console.log("⚠️ cron checkAndHandleWarnings error:", e.message); }
      }, { timezone: "Asia/Riyadh" });

      console.log(`⏰ مجدول: ${list.name} (send ${list.sendTime} — check ${list.endTime})`);
    } catch (e) {
      console.log("⚠️ خطأ بإنشاء الجدولة للقائمة:", list.name, e.message);
    }
  });
}

// ------------------ ابدأ ------------------
startBot().catch((err) => {
  console.error("❌ فشل تشغيل البوت:", err.message);
});
