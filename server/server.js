// server.js — نسخة معدّلة مع تسجيل (logs) وتصحيحات علشان تظهر الـ guilds
// شرح سريع: يطبع معلومات الـ token وـ guilds في الكونسول لِتَشخيص المشكلة.
// لا تغيّر الـ SECRETS هنا — خزّنها في Environment / Replit Secrets.

import express from "express";
import session from "cookie-session";
import dotenv from "dotenv";

dotenv.config();

// متغيرات البيئة
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  REDIRECT_URI,
  SESSION_SECRET,
} = process.env;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !REDIRECT_URI || !SESSION_SECRET) {
  console.error(
    "❌ Missing environment variables. Please set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, REDIRECT_URI, SESSION_SECRET"
  );
  process.exit(1);
}

const app = express();
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "sess",
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000,
  })
);

// Scopes المطلوبة
const OAUTH_SCOPES = ["identify", "guilds", "guilds.join", "applications.commands"];

// تأكد أن REDIRECT_URI ينتهي بـ /callback
const redirectUrl = REDIRECT_URI.endsWith("/callback")
  ? REDIRECT_URI
  : `${REDIRECT_URI.replace(/\/$/, "")}/callback`;

// دالة بناء رابط الـ OAuth
function discordOAuthUrl() {
  const base = "https://discord.com/api/oauth2/authorize";
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUrl,
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    prompt: "consent",
  });
  return `${base}?${params.toString()}`;
}

// صفحة تسجيل الدخول -> يعيد توجيه إلى Discord OAuth
app.get("/login", (req, res) => {
  res.redirect(discordOAuthUrl());
});

// نقطة العودة (callback) بعد تسجيل الدخول على Discord
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const data = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUrl,
    });

    // تبادل الكود مع توكن
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: data.toString(),
    });

    let tokenJson;
    try {
      tokenJson = await tokenRes.json();
    } catch (err) {
      console.error("❌ Failed to parse token response JSON:", err);
      console.error("Raw token response status:", tokenRes.status, tokenRes.statusText);
      return res.status(500).send("Token parse error");
    }

    console.log("🔸 token response status:", tokenRes.status, tokenRes.statusText);
    console.log("🔸 token response body:", tokenJson);

    if (!tokenJson.access_token) {
      console.error("❌ No access_token in token response. Full token response printed above.");
      return res.status(500).send("No access token");
    }

    // جلب بيانات المستخدم
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const userJson = await userRes.json();
    console.log(`✅ Logged in as ${userJson.username}#${userJson.discriminator}`);

    // جلب السيرفرات (guilds)
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });

    console.log("🔸 guilds endpoint status:", guildsRes.status, guildsRes.statusText);
    let guilds;
    try {
      guilds = await guildsRes.json();
    } catch (err) {
      console.error("❌ Failed to parse guilds JSON:", err);
      guilds = [];
    }

    console.log("🔸 first few guilds (raw):", Array.isArray(guilds) ? guilds.slice(0, 5) : guilds);

    // بعض أنظمة Discord تُعيد permissions كسلسلة أو رقم — نهيئها بأمان
    const formattedGuilds = (Array.isArray(guilds) ? guilds : []).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      owner: !!g.owner,
      // نحاول تحويل القيمة لرقم صحيح قدر الإمكان
      permissions: Number(g.permissions ?? 0),
      raw: g, // نحتفظ بالـ raw للـ debugging إن احتجت
    }));

    console.log("🔹 Total guilds formatted:", formattedGuilds.length);

    // حفظ الجلسة
    req.session.user = {
      id: userJson.id,
      username: `${userJson.username}#${userJson.discriminator}`,
      avatar: userJson.avatar,
    };
    req.session.guilds = formattedGuilds;
    req.session.token = tokenJson.access_token;

    // رجوع للداشبورد
    res.redirect("/dashboard.html");
  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("Authentication error");
  }
});

// دالة التحقق من صلاحية مشرف (Admin) — نفترض permissions رقم
function hasAdmin(permissions) {
  try {
    const permsNum = Number(permissions || 0);
    const ADMIN_BIT = 0x8;
    return (permsNum & ADMIN_BIT) === ADMIN_BIT;
  } catch {
    return false;
  }
}

// API لإظهار معلومات المستخدم
app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.json({ ok: false });
  res.json({ ok: true, user: req.session.user });
});

// API للسيرفرات اللي عندك صلاحية إدارة فيها (فلتر)
app.get("/api/my-guilds", (req, res) => {
  const guilds = req.session.guilds || [];
  const adminGuilds = guilds.filter((g) => hasAdmin(g.permissions));
  res.json({ ok: true, guilds: adminGuilds });
});

// API خام لأغراض التشخيص — يرجع كل الـ guilds كما استلمناها
app.get("/api/raw-guilds", (req, res) => {
  const guilds = req.session.guilds || [];
  res.json({ ok: true, guilds });
});

// تسجيل خروج
app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

// الصفحة الرئيسية (HTML بسيط)
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!DOCTYPE html>
    <html lang="ar">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>RollMaster Dashboard</title>
        <style>
          body {
            background-color: #0d001f;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center; padding:70px;
          }
          h1 { font-size:36px;color:#b388ff }
          a { display:inline-block; background:linear-gradient(135deg,#8b2fff,#b84dff);
              color:white;padding:14px 30px;border-radius:12px;text-decoration:none;
              font-size:18px;font-weight:bold;box-shadow:0 0 20px #8b2fff66;margin-top:25px; }
        </style>
      </head>
      <body>
        <h1>🌌 RollMaster Dashboard</h1>
        <p>قم بتسجيل الدخول باستخدام حسابك على Discord لإدارة السيرفر.</p>
        <a href="/login">🔑 تسجيل الدخول عبر Discord</a>
        <footer style="margin-top:50px;opacity:0.6">© 2025 RollMaster Bot</footer>
      </body>
    </html>
  `);
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Server listening on port", PORT);
  console.log("🔁 OAuth redirect URL (should match Discord Dev Portal):", redirectUrl);
  console.log("🔁 OAuth scopes:", OAUTH_SCOPES.join(" "));
});
import "../bot.js";
