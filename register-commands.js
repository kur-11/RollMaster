// register-commands.js 💎
// ✅ أوامر الحضور + أوامر الإدارة (ban, kick, timeout, nickname, unban, untimeout)

import { REST, Routes, ApplicationCommandOptionType } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("❌ DISCORD_BOT_TOKEN not found in environment variables");

async function getApplicationId() {
  const rest = new REST({ version: "10" }).setToken(token);
  const app = await rest.get(Routes.oauth2CurrentApplication());
  return app.id;
}

const commands = [
  // 🗓️ أوامر الحضور
  {
    name: "existing",
    description: "إنشاء قائمة حضور جديدة",
    options: [
      { name: "name", description: "اسم القائمة (مثل AC)", type: ApplicationCommandOptionType.String, required: true },
      { name: "title", description: "عنوان القائمة", type: ApplicationCommandOptionType.String, required: true },
      { name: "description", description: "وصف القائمة", type: ApplicationCommandOptionType.String, required: true },
      { name: "start_time", description: "ساعة البداية (مثال: 11:35)", type: ApplicationCommandOptionType.String, required: true },
      { name: "end_time", description: "ساعة النهاية (مثال: 16:00)", type: ApplicationCommandOptionType.String, required: true },
      { name: "send_time", description: "ساعة الإرسال (مثال: 11:35)", type: ApplicationCommandOptionType.String, required: true },
      {
        name: "frequency",
        description: "تكرار الإرسال",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "اليوم فقط", value: "today" },
          { name: "كل الأيام", value: "daily" },
        ],
      },
      { name: "role", description: "الرول الذي سيتم منشنه مع رسالة الحضور (اختياري)", type: ApplicationCommandOptionType.Role, required: false },
      { name: "warnings_channel", description: "الروم الذي ستُرسل فيه التحذيرات (اختياري)", type: ApplicationCommandOptionType.Channel, required: false },
    ],
  },

  // 🧾 تعديل قائمة الحضور
  {
    name: "edit",
    description: "تعديل قائمة حضور موجودة",
    options: [
      { name: "name", description: "اسم القائمة", type: ApplicationCommandOptionType.String, required: true },
      { name: "title", description: "عنوان جديد (اختياري)", type: ApplicationCommandOptionType.String, required: false },
      { name: "description", description: "وصف جديد (اختياري)", type: ApplicationCommandOptionType.String, required: false },
      { name: "start_time", description: "ساعة بداية جديدة (اختياري)", type: ApplicationCommandOptionType.String, required: false },
      { name: "end_time", description: "ساعة نهاية جديدة (اختياري)", type: ApplicationCommandOptionType.String, required: false },
      { name: "send_time", description: "ساعة إرسال جديدة (اختياري)", type: ApplicationCommandOptionType.String, required: false },
      {
        name: "frequency",
        description: "تكرار جديد (اختياري)",
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: "اليوم فقط", value: "today" },
          { name: "كل الأيام", value: "daily" },
        ],
      },
      { name: "role", description: "رول جديد سيتم منشنه (اختياري)", type: ApplicationCommandOptionType.Role, required: false },
      { name: "warnings_channel", description: "روم جديد سيتم فيه إرسال التحذيرات (اختياري)", type: ApplicationCommandOptionType.Channel, required: false },
    ],
  },

  // ⚙️ أوامر الإدارة (السلاش)
  {
    name: "timeout",
    description: "إعطاء تايم لعضو",
    options: [
      { name: "member", description: "العضو", type: ApplicationCommandOptionType.User, required: true },
      { name: "minutes", description: "المدة بالدقائق", type: ApplicationCommandOptionType.Integer, required: true },
    ],
  },
  {
    name: "untimeout",
    description: "فك التايم عن عضو",
    options: [{ name: "member", description: "العضو", type: ApplicationCommandOptionType.User, required: true }],
  },
  {
    name: "ban",
    description: "تبنيد عضو من السيرفر",
    options: [{ name: "member", description: "العضو", type: ApplicationCommandOptionType.User, required: true }],
  },
  {
    name: "unban",
    description: "فك الباند عن عضو (باستخدام ID)",
    options: [{ name: "user_id", description: "ID المستخدم", type: ApplicationCommandOptionType.String, required: true }],
  },
  {
    name: "kick",
    description: "طرد عضو من السيرفر",
    options: [{ name: "member", description: "العضو", type: ApplicationCommandOptionType.User, required: true }],
  },
  {
    name: "nickname",
    description: "تغيير اسم عضو",
    options: [
      { name: "member", description: "العضو", type: ApplicationCommandOptionType.User, required: true },
      { name: "nickname", description: "الاسم الجديد", type: ApplicationCommandOptionType.String, required: true },
    ],
  },
];

async function registerCommands() {
  try {
    const appId = await getApplicationId();
    const rest = new REST({ version: "10" }).setToken(token);
    console.log("🚀 جاري تسجيل جميع الأوامر...");
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log("✅ تم تسجيل أوامر الحضور + الإدارة بنجاح!");
  } catch (error) {
    console.error("❌ خطأ أثناء تسجيل الأوامر:", error);
  }
}

registerCommands();
