
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// إنشاء قاعدة البيانات
const db = new Database("digitalcity.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    area TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  )
`);

// إعدادات استقبال البيانات
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "3mb" }));

// الجلسات
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
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
app.post("/api/reports", (req, res) => {
  try {
    const { type, area, description, image } = req.body;

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

    const result = db.prepare(`
      INSERT INTO reports (type, area, description, image, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      type.trim(),
      area.trim(),
      description.trim(),
      image || "",
      new Date().toISOString()
    );

    res.status(201).json({
      message: "تم حفظ البلاغ بنجاح.",
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "حدث خطأ أثناء حفظ البلاغ."
    });
  }
});


// عرض البلاغات للمسؤول فقط
app.get("/api/reports", requireAdmin, (req, res) => {
  try {
    const reports = db.prepare(`
      SELECT
        id,
        type,
        area,
        description,
        image,
        status,
        created_at AS createdAt
      FROM reports
      ORDER BY id DESC
    `).all();

    res.json(reports);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "تعذر تحميل البلاغات."
    });
  }
});

// تحديث حالة البلاغ
app.patch("/api/reports/:id", requireAdmin, (req, res) => {
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

    const result = db.prepare(`
      UPDATE reports
      SET status = ?
      WHERE id = ?
    `).run(status, id);

    if (result.changes === 0) {
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
app.delete("/api/reports/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "رقم البلاغ غير صحيح."
      });
    }

    const result = db.prepare(`
      DELETE FROM reports
      WHERE id = ?
    `).run(id);

    if (result.changes === 0) {
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

app.get("/api/reports", requireAdmin, (req, res) => {
  const reports = db.prepare(`
    SELECT
      id,
      type,
      area,
      description,
      image,
      status,
      created_at AS createdAt
    FROM reports
    ORDER BY id DESC
  `).all();

  res.json(reports);
});

// تسجيل الدخول
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

app.listen(PORT, () => {
  console.log(`DIGITALCITY server running at http://localhost:${PORT}`);
});
