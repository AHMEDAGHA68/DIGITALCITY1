
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// الاتصال بقاعدة بيانات Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on("error", (error) => {
  console.error("Database connection error:", error);
});

// إعدادات Express
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "3mb" }));

// إعداد الجلسات
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60
    }
  })
);

// التحقق من المسؤول
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  return res.status(401).json({
    message: "يجب تسجيل دخول المسؤول أولًا."
  });
}

// حماية لوحة التحكم
app.get("/dashboard.html", (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect("/admin-login.html");
  }

  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// استقبال بلاغ جديد
app.post("/api/reports", async (req, res) => {
  try {
    const { type, area, description, image = "" } = req.body;

    if (
      typeof type !== "string" ||
      typeof area !== "string" ||
      typeof description !== "string" ||
      !type.trim() ||
      !area.trim() ||
      !description.trim()
    ) {
      return res.status(400).json({
        message: "يرجى إدخال جميع البيانات المطلوبة."
      });
    }

    const allowedTypes = [
      "تراكم القمامة",
      "عطل إنارة",
      "مشكلة في الطريق",
      "تسرب مياه",
      "مشكلة أخرى"
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "نوع البلاغ غير صحيح."
      });
    }

    if (
      typeof image !== "string" ||
      (image && !/^data:image\/(jpeg|png|webp);base64,/.test(image))
    ) {
      return res.status(400).json({
        message: "صيغة الصورة غير صحيحة."
      });
    }

    const result = await pool.query(
      `INSERT INTO public.reports
       (type, area, description, image, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [
        type.trim(),
        area.trim(),
        description.trim(),
        image
      ]
    );

    res.status(201).json({
      message: "تم حفظ البلاغ بنجاح.",
      id: result.rows[0].id
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "حدث خطأ أثناء حفظ البلاغ."
    });
  }
});

// عرض البلاغات للمسؤول فقط
app.get("/api/reports", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        type,
        area,
        description,
        image,
        status,
        created_at AS "createdAt"
      FROM public.reports
      ORDER BY id DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "تعذر تحميل البلاغات."
    });
  }
});

// تحديث حالة البلاغ
app.patch("/api/reports/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "processing",
      "solved"
    ];

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "رقم البلاغ غير صحيح."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "حالة البلاغ غير صحيحة."
      });
    }

    const result = await pool.query(
      `UPDATE public.reports
       SET status = $1
       WHERE id = $2`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "البلاغ غير موجود."
      });
    }

    res.json({
      message: "تم تحديث حالة البلاغ بنجاح."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "تعذر تحديث البلاغ."
    });
  }
});

// حذف بلاغ
app.delete("/api/reports/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "رقم البلاغ غير صحيح."
      });
    }

    const result = await pool.query(
      `DELETE FROM public.reports WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "البلاغ غير موجود."
      });
    }

    res.json({
      message: "تم حذف البلاغ بنجاح."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "تعذر حذف البلاغ."
    });
  }
});

// تسجيل دخول المسؤول
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).send("حدث خطأ في تسجيل الدخول.");
      }

      req.session.isAdmin = true;

      res.redirect("/dashboard.html");
    });
  } else {
    res.status(401).send("اسم المستخدم أو كلمة المرور غير صحيحة.");
  }
});

// تسجيل الخروج
app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/index.html");
  });
});

// الملفات العامة
app.use(express.static(__dirname));

// تشغيل الخادم بعد التأكد من اتصال قاعدة البيانات
async function startServer() {
  try {
    await pool.query("SELECT 1");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`DIGITALCITY server running on port ${PORT}`);
      console.log("Supabase database connected successfully.");
    });

  } catch (error) {
    console.error("Could not connect to Supabase:", error.message);
    process.exit(1);
  }
}

startServer();
