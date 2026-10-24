import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { db } from "./db.js";
import { auth, optAuth, role } from "./auth.js";
import { HttpError, ah, parse } from "./util.js";

const r = Router();
const slug = (n) =>
  n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const BASE = `SELECT c.*,u.name iname,u.headline iheadline,cat.name cname,cat.icon cicon,cat.slug cslug,
(SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.course_id=c.id) rating,
(SELECT COUNT(*) FROM reviews r WHERE r.course_id=c.id) rcount,
(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) students,
(SELECT COUNT(*) FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=c.id) lessons,
(SELECT COALESCE(SUM(l.duration_min),0) FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=c.id) duration
FROM courses c JOIN users u ON u.id=c.instructor_id LEFT JOIN categories cat ON cat.id=c.category_id`;

const card = (c) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  subtitle: c.subtitle,
  level: c.level,
  language: c.language || "fr",
  price: c.price,
  color: c.color,
  status: c.status,
  category: { name: c.cname, icon: c.cicon, slug: c.cslug },
  instructor: { id: c.instructor_id, name: c.iname, headline: c.iheadline },
  rating: c.rating || 0,
  ratingCount: c.rcount,
  students: c.students,
  lessons: c.lessons,
  duration: c.duration,
  createdAt: c.created_at,
});

const enrolled = (uid, cid) =>
  !!(uid && db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?").get(uid, cid));

const courseOfLesson = (id) =>
  db
    .prepare(
      `SELECT l.*,s.course_id,c.instructor_id,c.status,c.title course_title,c.slug course_slug,c.color course_color
       FROM lessons l JOIN sections s ON s.id=l.section_id JOIN courses c ON c.id=s.course_id WHERE l.id=?`
    )
    .get(id);

const staffOf = (u, c) => u && (u.role === "admin" || u.id === c.instructor_id);
const canAccess = (u, l) => !!l.free_preview || enrolled(u?.id, l.course_id) || staffOf(u, l);

function progressOf(uid, cid) {
  const total = db.prepare("SELECT COUNT(*) n FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=?").get(cid).n;
  const done = db
    .prepare(
      "SELECT COUNT(*) n FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id JOIN sections s ON s.id=l.section_id WHERE p.user_id=? AND s.course_id=?"
    )
    .get(uid, cid).n;
  const pct = total ? Math.round((100 * done) / total) : 0;
  let cert = db.prepare("SELECT code FROM certificates WHERE user_id=? AND course_id=?").get(uid, cid)?.code || null;
  if (pct === 100 && total > 0 && enrolled(uid, cid)) {
    db.prepare("UPDATE enrollments SET completed_at=COALESCE(completed_at,?) WHERE user_id=? AND course_id=?").run(
      new Date().toISOString(),
      uid,
      cid
    );
    if (!cert) {
      cert = "LRN-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      db.prepare("INSERT INTO certificates(user_id,course_id,code) VALUES(?,?,?)").run(uid, cid, cert);
    }
  }
  return { progress: pct, done, total, certificate: cert };
}

const curriculum = (cid, uid) =>
  db
    .prepare("SELECT * FROM sections WHERE course_id=? ORDER BY position")
    .all(cid)
    .map((s) => ({
      id: s.id,
      title: s.title,
      lessons: db
        .prepare("SELECT id,title,type,duration_min,free_preview FROM lessons WHERE section_id=? ORDER BY position")
        .all(s.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          duration: l.duration_min,
          free: !!l.free_preview,
          done: uid ? !!db.prepare("SELECT 1 FROM lesson_progress WHERE user_id=? AND lesson_id=?").get(uid, l.id) : false,
        })),
    }));

const lastLessonFor = (uid, cid) => {
  const next = db
    .prepare(
      `SELECT l.id,l.title FROM lessons l JOIN sections s ON s.id=l.section_id
       LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=?
       WHERE s.course_id=? AND p.user_id IS NULL ORDER BY s.position,l.position LIMIT 1`
    )
    .get(uid, cid);
  const last = db
    .prepare(
      `SELECT l.id,l.title FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id JOIN sections s ON s.id=l.section_id
       WHERE p.user_id=? AND s.course_id=? ORDER BY p.completed_at DESC LIMIT 1`
    )
    .get(uid, cid);
  return next || last || null;
};

const certInfo = (code) =>
  db
    .prepare(
      `SELECT ce.code,ce.issued_at,u.name student,c.title course,c.slug course_slug,i.name instructor
       FROM certificates ce JOIN users u ON u.id=ce.user_id JOIN courses c ON c.id=ce.course_id
       JOIN users i ON i.id=c.instructor_id WHERE ce.code=?`
    )
    .get(code);

const pageOf = (q) => {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 12));
  return { page, limit, offset: (page - 1) * limit };
};

const lessonData = (l, user) => {
  const q = l.quiz ? JSON.parse(l.quiz) : null;
  const best = user
    ? db.prepare("SELECT MAX(score) score,COUNT(*) attempts FROM quiz_attempts WHERE user_id=? AND lesson_id=?").get(user.id, l.id)
    : null;
  return {
    id: l.id,
    courseId: l.course_id,
    course: { id: l.course_id, title: l.course_title, slug: l.course_slug, color: l.course_color },
    title: l.title,
    type: l.type,
    content: l.content,
    videoUrl: l.video_url,
    duration: l.duration_min,
    done: user ? !!db.prepare("SELECT 1 FROM lesson_progress WHERE user_id=? AND lesson_id=?").get(user.id, l.id) : false,
    bestScore: best?.score ?? null,
    attempts: best?.attempts ?? 0,
    quiz: q
      ? {
          passScore: q.passScore,
          questions: q.questions.map((x, i) => ({
            id: x.id ?? i,
            text: x.text,
            type: x.type,
            options: x.options.map((o) => o.text),
          })),
        }
      : null,
  };
};

// ---------- Public ----------
r.get(
  "/categories",
  ah((req, res) => res.json({ data: db.prepare("SELECT * FROM categories ORDER BY id").all() }))
);

r.get(
  "/courses",
  ah((req, res) => {
    const { category, level, price, q, sort } = req.query;
    const where = ["c.status='published'"];
    const params = [];
    if (category) {
      where.push("cat.slug=?");
      params.push(category);
    }
    if (level) {
      where.push("c.level=?");
      params.push(level);
    }
    if (price === "free") where.push("c.price=0");
    if (price === "paid") where.push("c.price>0");
    if (q) {
      where.push("(c.title LIKE ? OR c.subtitle LIKE ? OR c.description LIKE ? OR u.name LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const order =
      { rating: "rating DESC,rcount DESC", new: "c.id DESC", price: "c.price ASC", popular: "students DESC,rating DESC" }[
        sort
      ] || "students DESC,rating DESC";
    const { page, limit, offset } = pageOf(req.query);
    const total = db
      .prepare(
        `SELECT COUNT(*) n FROM courses c JOIN users u ON u.id=c.instructor_id LEFT JOIN categories cat ON cat.id=c.category_id WHERE ${where.join(
          " AND "
        )}`
      )
      .get(...params).n;
    const data = db
      .prepare(`${BASE} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset)
      .map(card);
    res.json({ data, meta: { page, limit, total } });
  })
);

r.get(
  "/courses/:id/reviews",
  ah((req, res) => {
    const cid = Number(req.params.id);
    const { page, limit, offset } = pageOf(req.query);
    const total = db.prepare("SELECT COUNT(*) n FROM reviews WHERE course_id=?").get(cid).n;
    const data = db
      .prepare(
        `SELECT r.id,r.rating,r.comment,r.created_at,u.name,u.avatar_color FROM reviews r
         JOIN users u ON u.id=r.user_id WHERE r.course_id=? ORDER BY r.id DESC LIMIT ? OFFSET ?`
      )
      .all(cid, limit, offset);
    res.json({ data, meta: { page, limit, total } });
  })
);

r.get(
  "/courses/:slug",
  optAuth,
  ah((req, res) => {
    const c = db.prepare(BASE + " WHERE c.slug=?").get(req.params.slug);
    if (!c || (c.status !== "published" && !staffOf(req.user, c)))
      throw new HttpError(404, "NOT_FOUND", "Cours introuvable");
    const en = enrolled(req.user?.id, c.id);
    const isWishlisted = req.user
      ? !!db.prepare("SELECT 1 FROM wishlist WHERE user_id=? AND course_id=?").get(req.user.id, c.id)
      : false;
    const reviews = db
      .prepare(
        `SELECT r.id,r.rating,r.comment,r.created_at,u.name,u.avatar_color FROM reviews r
         JOIN users u ON u.id=r.user_id WHERE r.course_id=? ORDER BY r.id DESC LIMIT 10`
      )
      .all(c.id);
    const sections = curriculum(c.id, req.user?.id);
    res.json({
      data: {
        ...card(c),
        description: c.description,
        isEnrolled: en,
        isWishlisted,
        progress: en ? progressOf(req.user.id, c.id) : null,
        curriculum: sections,
        whatYouWillLearn: sections.map((s) => s.title),
        reviews,
      },
    });
  })
);

r.get(
  "/instructors/:id",
  ah((req, res) => {
    const u = db
      .prepare("SELECT id,name,headline,bio,avatar_color FROM users WHERE id=? AND role IN ('instructor','admin')")
      .get(Number(req.params.id));
    if (!u) throw new HttpError(404, "NOT_FOUND", "Formateur introuvable");
    const courses = db
      .prepare(BASE + " WHERE c.instructor_id=? AND c.status='published' ORDER BY students DESC")
      .all(u.id)
      .map(card);
    res.json({ data: { ...u, courses } });
  })
);

r.get(
  "/certificates/:code",
  ah((req, res) => {
    const c = certInfo(req.params.code);
    if (!c) throw new HttpError(404, "NOT_FOUND", "Certificat introuvable");
    res.json({
      data: {
        code: c.code,
        issuedAt: c.issued_at,
        student: c.student,
        course: c.course,
        courseSlug: c.course_slug,
        instructor: c.instructor,
      },
    });
  })
);

r.get(
  "/certificates/:code/pdf",
  ah((req, res) => {
    const c = certInfo(req.params.code);
    if (!c) throw new HttpError(404, "NOT_FOUND", "Certificat introuvable");
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="certificat-${c.code}.pdf"`);
    doc.pipe(res);
    const W = doc.page.width;
    const H = doc.page.height;
    doc.rect(0, 0, W, H).fill("#FFFBF2");
    doc.lineWidth(6).strokeColor("#FCA311").rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(1).strokeColor("#1E3A8A").rect(42, 42, W - 84, H - 84).stroke();
    doc.fillColor("#1E3A8A").font("Helvetica-Bold").fontSize(14).text("LEARNLY", 0, 86, { align: "center", characterSpacing: 8 });
    doc.fillColor("#14213D").font("Helvetica-Bold").fontSize(38).text("CERTIFICAT DE RÉUSSITE", 0, 122, { align: "center" });
    doc.font("Helvetica").fontSize(15).fillColor("#555").text("Ce certificat est décerné à", 0, 200, { align: "center" });
    doc.font("Helvetica-Bold").fontSize(34).fillColor("#1E3A8A").text(c.student, 0, 228, { align: "center" });
    doc.font("Helvetica").fontSize(15).fillColor("#555").text("pour avoir terminé avec succès le cours", 0, 290, { align: "center" });
    doc.font("Helvetica-Bold").fontSize(24).fillColor("#14213D").text(c.course, 80, 320, { align: "center", width: W - 160 });
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#555")
      .text(
        `Formateur : ${c.instructor}   ·   Délivré le ${new Date(c.issued_at).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`,
        0,
        H - 130,
        { align: "center" }
      );
    doc.fontSize(11).fillColor("#1E3A8A").text(`Code de vérification : ${c.code}`, 0, H - 108, { align: "center" });
    doc.end();
  })
);

r.get(
  "/preview/lessons/:id",
  optAuth,
  ah((req, res) => {
    const l = courseOfLesson(Number(req.params.id));
    if (!l) throw new HttpError(404, "NOT_FOUND", "Leçon introuvable");
    if (l.status !== "published" && !staffOf(req.user, l))
      throw new HttpError(404, "NOT_FOUND", "Leçon introuvable");
    if (!l.free_preview) throw new HttpError(403, "FORBIDDEN", "Cet aperçu n'est pas public");
    res.json({ data: lessonData(l, req.user) });
  })
);

r.use(auth);

// ---------- Étudiant ----------
r.post(
  "/enroll",
  ah((req, res) => {
    const d = parse(z.object({ courseId: z.number().int() }), req.body);
    const c = db.prepare("SELECT * FROM courses WHERE id=? AND status='published'").get(d.courseId);
    if (!c) throw new HttpError(404, "NOT_FOUND", "Cours introuvable");
    if (c.price > 0) throw new HttpError(402, "PAYMENT_REQUIRED", "Ce cours est payant");
    const before = enrolled(req.user.id, c.id);
    db.prepare("INSERT OR IGNORE INTO enrollments(user_id,course_id) VALUES(?,?)").run(req.user.id, c.id);
    if (!before) {
      db.prepare("INSERT INTO payments(user_id,course_id,amount,method,status,reference) VALUES(?,?,0,'free','paid',?)").run(
        req.user.id,
        c.id,
        "FREE-" + crypto.randomBytes(5).toString("hex").toUpperCase()
      );
    }
    res.status(201).json({ data: { ok: true, ...progressOf(req.user.id, c.id) } });
  })
);

r.post(
  "/payments/checkout",
  ah(async (req, res) => {
    const d = parse(
      z.object({
        courseId: z.number().int(),
        method: z.enum(["mobile_money", "card", "free"]),
        phone: z.string().max(20).optional(),
      }),
      req.body
    );
    const c = db.prepare("SELECT * FROM courses WHERE id=? AND status='published'").get(d.courseId);
    if (!c) throw new HttpError(404, "NOT_FOUND", "Cours introuvable");
    if (enrolled(req.user.id, c.id)) throw new HttpError(409, "CONFLICT", "Vous êtes déjà inscrit");
    if (c.price === 0) {
      const ref = "FREE-" + crypto.randomBytes(5).toString("hex").toUpperCase();
      db.transaction(() => {
        db.prepare("INSERT INTO payments(user_id,course_id,amount,method,status,reference) VALUES(?,?,0,'free','paid',?)").run(
          req.user.id,
          c.id,
          ref
        );
        db.prepare("INSERT INTO enrollments(user_id,course_id) VALUES(?,?)").run(req.user.id, c.id);
      })();
      return res.status(201).json({ data: { reference: ref } });
    }
    if (d.method === "free") throw new HttpError(400, "VALIDATION_ERROR", "Ce cours est payant");
    if (d.method === "mobile_money" && !/^\d{8,}$/.test((d.phone || "").replace(/\D/g, "")))
      throw new HttpError(400, "VALIDATION_ERROR", "Numéro Mobile Money invalide");
    await new Promise((ok) => setTimeout(ok, 1500));
    if (d.method === "mobile_money" && (d.phone || "").replace(/\D/g, "").endsWith("00"))
      throw new HttpError(402, "PAYMENT_REQUIRED", "Paiement refusé par l'opérateur : solde insuffisant");
    const ref = "PAY-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    db.transaction(() => {
      db.prepare("INSERT INTO payments(user_id,course_id,amount,method,status,reference) VALUES(?,?,?,?,'paid',?)").run(
        req.user.id,
        c.id,
        c.price,
        d.method,
        ref
      );
      db.prepare("INSERT INTO enrollments(user_id,course_id) VALUES(?,?)").run(req.user.id, c.id);
    })();
    res.status(201).json({ data: { reference: ref } });
  })
);

r.get(
  "/me/learning",
  ah((req, res) => {
    const rows = db
      .prepare(BASE + " JOIN enrollments e ON e.course_id=c.id WHERE e.user_id=? ORDER BY e.id DESC")
      .all(req.user.id)
      .map((c) => ({
        ...card(c),
        ...progressOf(req.user.id, c.id),
        lastLesson: lastLessonFor(req.user.id, c.id),
      }));
    res.json({ data: rows });
  })
);

r.get(
  "/me/certificates",
  ah((req, res) => {
    const rows = db
      .prepare(
        `SELECT ce.code,ce.issued_at issuedAt,c.title course,c.slug courseSlug,c.color
         FROM certificates ce JOIN courses c ON c.id=ce.course_id WHERE ce.user_id=? ORDER BY ce.id DESC`
      )
      .all(req.user.id);
    res.json({ data: rows });
  })
);

r.get(
  "/courses/:id/learn",
  ah((req, res) => {
    const c = db
      .prepare(
        `SELECT c.*,cat.slug cslug,cat.name cname,cat.icon cicon FROM courses c
         LEFT JOIN categories cat ON cat.id=c.category_id WHERE c.id=?`
      )
      .get(Number(req.params.id));
    if (!c || (c.status !== "published" && !staffOf(req.user, c)))
      throw new HttpError(404, "NOT_FOUND", "Cours introuvable");
    if (!enrolled(req.user.id, c.id) && !staffOf(req.user, c))
      throw new HttpError(403, "FORBIDDEN", "Inscrivez-vous pour accéder à ce cours");
    res.json({
      data: {
        course: {
          id: c.id,
          title: c.title,
          slug: c.slug,
          color: c.color,
          category: { name: c.cname, icon: c.cicon, slug: c.cslug },
        },
        sections: curriculum(c.id, req.user.id),
        lastLesson: lastLessonFor(req.user.id, c.id),
        ...progressOf(req.user.id, c.id),
      },
    });
  })
);

r.get(
  "/lessons/:id",
  ah((req, res) => {
    const l = courseOfLesson(Number(req.params.id));
    if (!l) throw new HttpError(404, "NOT_FOUND", "Leçon introuvable");
    if (!canAccess(req.user, l)) throw new HttpError(403, "FORBIDDEN", "Inscrivez-vous pour accéder à cette leçon");
    res.json({ data: lessonData(l, req.user) });
  })
);

r.post(
  "/lessons/:id/complete",
  ah((req, res) => {
    const l = courseOfLesson(Number(req.params.id));
    if (!l) throw new HttpError(404, "NOT_FOUND", "Leçon introuvable");
    if (l.type === "quiz") throw new HttpError(400, "VALIDATION_ERROR", "Réussissez le quiz pour valider cette leçon");
    if (!enrolled(req.user.id, l.course_id)) throw new HttpError(403, "FORBIDDEN", "Inscrivez-vous d'abord");
    db.prepare("INSERT OR IGNORE INTO lesson_progress(user_id,lesson_id) VALUES(?,?)").run(req.user.id, l.id);
    res.json({ data: progressOf(req.user.id, l.course_id) });
  })
);

r.delete(
  "/lessons/:id/complete",
  ah((req, res) => {
    const l = courseOfLesson(Number(req.params.id));
    if (!l) throw new HttpError(404, "NOT_FOUND", "Leçon introuvable");
    if (!enrolled(req.user.id, l.course_id)) throw new HttpError(403, "FORBIDDEN", "Inscrivez-vous d'abord");
    db.prepare("DELETE FROM lesson_progress WHERE user_id=? AND lesson_id=?").run(req.user.id, l.id);
    res.json({ data: progressOf(req.user.id, l.course_id) });
  })
);

function attemptQuiz(req, res) {
  const l = courseOfLesson(Number(req.params.id));
  if (!l || !l.quiz) throw new HttpError(404, "NOT_FOUND", "Quiz introuvable");
  if (!enrolled(req.user.id, l.course_id)) throw new HttpError(403, "FORBIDDEN", "Inscrivez-vous d'abord");
  const d = parse(z.object({ answers: z.record(z.array(z.number().int())) }), req.body);
  const q = JSON.parse(l.quiz);
  const results = q.questions.map((x, i) => {
    const key = x.id ?? i;
    const raw = d.answers[key] ?? d.answers[String(key)] ?? d.answers[i] ?? d.answers[String(i)] ?? [];
    const good = x.options.map((o, k) => (o.correct ? k : -1)).filter((k) => k >= 0);
    const selected = [...new Set(raw)].sort((a, b) => a - b);
    return {
      correct: good.length === selected.length && good.every((k, j) => k === selected[j]),
      good,
      selected,
      explanation: x.explanation || "",
    };
  });
  const score = Math.round((100 * results.filter((x) => x.correct).length) / q.questions.length);
  const passed = score >= q.passScore;
  db.prepare("INSERT INTO quiz_attempts(user_id,lesson_id,score,passed,answers_json) VALUES(?,?,?,?,?)").run(
    req.user.id,
    l.id,
    score,
    passed ? 1 : 0,
    JSON.stringify(d.answers)
  );
  if (passed) db.prepare("INSERT OR IGNORE INTO lesson_progress(user_id,lesson_id) VALUES(?,?)").run(req.user.id, l.id);
  res.json({ data: { score, passed, passScore: q.passScore, results, ...progressOf(req.user.id, l.course_id) } });
}

r.post("/lessons/:id/quiz", ah(attemptQuiz));
r.post("/quizzes/:id/attempt", ah(attemptQuiz));

r.get(
  "/quizzes/:id/attempts",
  ah((req, res) => {
    const l = courseOfLesson(Number(req.params.id));
    if (!l || !l.quiz) throw new HttpError(404, "NOT_FOUND", "Quiz introuvable");
    if (!canAccess(req.user, l)) throw new HttpError(403, "FORBIDDEN", "Accès refusé");
    const rows = db
      .prepare("SELECT id,score,passed,created_at createdAt FROM quiz_attempts WHERE user_id=? AND lesson_id=? ORDER BY id DESC")
      .all(req.user.id, l.id);
    res.json({ data: { attempts: rows, bestScore: rows.reduce((a, x) => Math.max(a, x.score), 0) } });
  })
);

r.get(
  "/lessons/:id/notes",
  ah((req, res) => {
    const l = courseOfLesson(Number(req.params.id));
    if (!l) throw new HttpError(404, "NOT_FOUND", "Leçon introuvable");
    if (!canAccess(req.user, l)) throw new HttpError(403, "FORBIDDEN", "Accès refusé");
    const rows = db
      .prepare("SELECT id,content,created_at createdAt FROM notes WHERE user_id=? AND lesson_id=? ORDER BY id DESC")
      .all(req.user.id, l.id);
    res.json({ data: rows });
  })
);

r.post(
  "/lessons/:id/notes",
  ah((req, res) => {
    const l = courseOfLesson(Number(req.params.id));
    if (!l) throw new HttpError(404, "NOT_FOUND", "Leçon introuvable");
    if (!canAccess(req.user, l)) throw new HttpError(403, "FORBIDDEN", "Accès refusé");
    const d = parse(z.object({ content: z.string().trim().min(1, "Note vide").max(5000) }), req.body);
    const id = db.prepare("INSERT INTO notes(user_id,lesson_id,content) VALUES(?,?,?)").run(req.user.id, l.id, d.content)
      .lastInsertRowid;
    res.status(201).json({ data: db.prepare("SELECT id,content,created_at createdAt FROM notes WHERE id=?").get(id) });
  })
);

r.delete(
  "/notes/:id",
  ah((req, res) => {
    const n = db.prepare("SELECT * FROM notes WHERE id=?").get(Number(req.params.id));
    if (!n || n.user_id !== req.user.id) throw new HttpError(404, "NOT_FOUND", "Note introuvable");
    db.prepare("DELETE FROM notes WHERE id=?").run(n.id);
    res.json({ data: { ok: true } });
  })
);

r.post(
  "/courses/:id/reviews",
  ah((req, res) => {
    const d = parse(
      z.object({
        rating: z.number().int().min(1, "Note de 1 à 5").max(5, "Note de 1 à 5"),
        comment: z.string().trim().max(500).optional(),
      }),
      req.body
    );
    const cid = Number(req.params.id);
    if (!enrolled(req.user.id, cid)) throw new HttpError(403, "FORBIDDEN", "Réservé aux inscrits");
    if (progressOf(req.user.id, cid).progress < 30)
      throw new HttpError(400, "VALIDATION_ERROR", "Terminez au moins 30 % du cours pour donner votre avis");
    db.prepare(
      "INSERT INTO reviews(user_id,course_id,rating,comment) VALUES(?,?,?,?) ON CONFLICT(user_id,course_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment"
    ).run(req.user.id, cid, d.rating, d.comment || "");
    const agg = db.prepare("SELECT AVG(rating) a,COUNT(*) n FROM reviews WHERE course_id=?").get(cid);
    db.prepare("UPDATE courses SET rating_avg=?,rating_count=? WHERE id=?").run(agg.a || 0, agg.n, cid);
    res.status(201).json({ data: { ok: true } });
  })
);

r.get(
  "/wishlist",
  ah((req, res) => {
    const rows = db
      .prepare(BASE + " JOIN wishlist w ON w.course_id=c.id WHERE w.user_id=? ORDER BY w.created_at DESC")
      .all(req.user.id)
      .map(card);
    res.json({ data: rows });
  })
);

r.get(
  "/wishlist/:courseId",
  ah((req, res) => {
    const saved = !!db
      .prepare("SELECT 1 FROM wishlist WHERE user_id=? AND course_id=?")
      .get(req.user.id, Number(req.params.courseId));
    res.json({ data: { saved } });
  })
);

const saveWish = ah((req, res) => {
  const c = db.prepare("SELECT 1 FROM courses WHERE id=? AND status='published'").get(Number(req.params.courseId));
  if (!c) throw new HttpError(404, "NOT_FOUND", "Cours introuvable");
  db.prepare("INSERT OR IGNORE INTO wishlist(user_id,course_id) VALUES(?,?)").run(req.user.id, Number(req.params.courseId));
  res.json({ data: { saved: true } });
});
r.post("/wishlist/:courseId", saveWish);
r.put("/wishlist/:courseId", saveWish);

r.delete(
  "/wishlist/:courseId",
  ah((req, res) => {
    db.prepare("DELETE FROM wishlist WHERE user_id=? AND course_id=?").run(req.user.id, Number(req.params.courseId));
    res.json({ data: { saved: false } });
  })
);

// ---------- Studio formateur ----------
const ins = role("instructor", "admin");
const mine = (req, id) => {
  const c = db.prepare("SELECT * FROM courses WHERE id=?").get(id);
  if (!c || (req.user.role !== "admin" && c.instructor_id !== req.user.id))
    throw new HttpError(404, "NOT_FOUND", "Cours introuvable");
  return c;
};

const courseSchema = z.object({
  title: z.string().trim().min(5, "Titre trop court (5 min)").max(90),
  subtitle: z.string().max(160).optional(),
  description: z.string().max(3000).optional(),
  categoryId: z.number().int().nullable().optional(),
  level: z.enum(["debutant", "intermediaire", "avance"]).default("debutant"),
  price: z.number().int().min(0, "Prix invalide").max(500000).default(0),
  language: z.string().max(5).default("fr"),
});

r.get(
  ["/studio/courses", "/instructor/courses"],
  ins,
  ah((req, res) =>
    res.json({
      data: db
        .prepare(BASE + " WHERE c.instructor_id=? ORDER BY c.id DESC")
        .all(req.user.id)
        .map(card),
    })
  )
);

r.post(
  ["/studio/courses", "/instructor/courses"],
  ins,
  ah((req, res) => {
    const d = parse(courseSchema, req.body);
    let s = slug(d.title);
    if (db.prepare("SELECT 1 FROM courses WHERE slug=?").get(s)) s += "-" + crypto.randomBytes(2).toString("hex");
    const cols = ["#1E3A8A", "#DB2777", "#16A34A", "#7C3AED", "#0891B2", "#EA580C"];
    const id = db
      .prepare(
        "INSERT INTO courses(instructor_id,category_id,title,slug,subtitle,description,level,language,price,color) VALUES(?,?,?,?,?,?,?,?,?,?)"
      )
      .run(
        req.user.id,
        d.categoryId ?? null,
        d.title,
        s,
        d.subtitle || "",
        d.description || "",
        d.level,
        d.language,
        d.price,
        cols[Math.floor(Math.random() * cols.length)]
      ).lastInsertRowid;
    res.status(201).json({ data: { id } });
  })
);

r.get(
  ["/studio/courses/:id", "/instructor/courses/:id"],
  ins,
  ah((req, res) => {
    const c = mine(req, Number(req.params.id));
    res.json({
      data: {
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        categoryId: c.category_id,
        level: c.level,
        language: c.language,
        price: c.price,
        status: c.status,
        slug: c.slug,
        sections: db
          .prepare("SELECT * FROM sections WHERE course_id=? ORDER BY position")
          .all(c.id)
          .map((s) => ({
            id: s.id,
            title: s.title,
            lessons: db
              .prepare("SELECT * FROM lessons WHERE section_id=? ORDER BY position")
              .all(s.id)
              .map((l) => ({
                id: l.id,
                title: l.title,
                type: l.type,
                content: l.content,
                video_url: l.video_url,
                duration_min: l.duration_min,
                free_preview: !!l.free_preview,
                quiz: l.quiz ? JSON.parse(l.quiz) : null,
              })),
          })),
      },
    });
  })
);

r.patch(
  ["/studio/courses/:id", "/instructor/courses/:id"],
  ins,
  ah((req, res) => {
    const c = mine(req, Number(req.params.id));
    const d = parse(courseSchema, req.body);
    db.prepare(
      "UPDATE courses SET title=?,subtitle=?,description=?,category_id=?,level=?,language=?,price=?,updated_at=? WHERE id=?"
    ).run(
      d.title,
      d.subtitle || "",
      d.description || "",
      d.categoryId ?? null,
      d.level,
      d.language,
      d.price,
      new Date().toISOString(),
      c.id
    );
    res.json({ data: { ok: true } });
  })
);

r.delete(
  ["/studio/courses/:id", "/instructor/courses/:id"],
  ins,
  ah((req, res) => {
    const c = mine(req, Number(req.params.id));
    db.prepare("DELETE FROM courses WHERE id=?").run(c.id);
    res.json({ data: { ok: true } });
  })
);

const lessonSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().trim().min(2, "Titre de leçon requis").max(100),
  type: z.enum(["video", "text", "quiz"]),
  content: z.string().max(20000).default(""),
  video_url: z.string().max(300).default(""),
  duration_min: z.number().int().min(1).max(600).default(5),
  free_preview: z.boolean().default(false),
  quiz: z
    .object({
      passScore: z.number().int().min(10).max(100),
      questions: z
        .array(
          z.object({
            text: z.string().trim().min(3, "Question requise"),
            type: z.enum(["single", "multiple"]),
            explanation: z.string().max(400).default(""),
            options: z
              .array(z.object({ text: z.string().trim().min(1, "Option vide"), correct: z.boolean() }))
              .min(2, "2 options minimum"),
          })
        )
        .min(1, "Ajoutez au moins une question"),
    })
    .nullable()
    .optional(),
});

r.put(
  ["/studio/courses/:id/curriculum", "/instructor/courses/:id/curriculum"],
  ins,
  ah((req, res) => {
    const c = mine(req, Number(req.params.id));
    const d = parse(
      z.object({
        sections: z.array(
          z.object({
            id: z.number().int().optional(),
            title: z.string().trim().min(2, "Titre de section requis").max(100),
            lessons: z.array(lessonSchema),
          })
        ),
      }),
      req.body
    );
    for (const s of d.sections)
      for (const l of s.lessons)
        if (l.type === "quiz") {
          if (!l.quiz) throw new HttpError(400, "VALIDATION_ERROR", `Le quiz « ${l.title} » est vide`);
          if (l.quiz.questions.some((q) => !q.options.some((o) => o.correct)))
            throw new HttpError(400, "VALIDATION_ERROR", `Chaque question du quiz « ${l.title} » doit avoir une bonne réponse`);
        }
    db.transaction(() => {
      const keepS = [];
      const keepL = [];
      d.sections.forEach((s, si) => {
        let sid = s.id;
        if (sid && db.prepare("SELECT 1 FROM sections WHERE id=? AND course_id=?").get(sid, c.id))
          db.prepare("UPDATE sections SET title=?,position=? WHERE id=?").run(s.title, si, sid);
        else sid = db.prepare("INSERT INTO sections(course_id,title,position) VALUES(?,?,?)").run(c.id, s.title, si).lastInsertRowid;
        keepS.push(sid);
        s.lessons.forEach((l, li) => {
          const q = l.type === "quiz" ? JSON.stringify(l.quiz) : null;
          let lid = l.id;
          const own = lid && db.prepare("SELECT 1 FROM lessons l JOIN sections s ON s.id=l.section_id WHERE l.id=? AND s.course_id=?").get(lid, c.id);
          if (own)
            db.prepare(
              "UPDATE lessons SET section_id=?,title=?,type=?,content=?,video_url=?,duration_min=?,position=?,free_preview=?,quiz=? WHERE id=?"
            ).run(sid, l.title, l.type, l.content, l.video_url, l.duration_min, li, l.free_preview ? 1 : 0, q, lid);
          else
            lid = db
              .prepare(
                "INSERT INTO lessons(section_id,title,type,content,video_url,duration_min,position,free_preview,quiz) VALUES(?,?,?,?,?,?,?,?,?)"
              )
              .run(sid, l.title, l.type, l.content, l.video_url, l.duration_min, li, l.free_preview ? 1 : 0, q).lastInsertRowid;
          keepL.push(lid);
        });
      });
      for (const l of db.prepare("SELECT l.id FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=?").all(c.id))
        if (!keepL.includes(l.id)) db.prepare("DELETE FROM lessons WHERE id=?").run(l.id);
      for (const s of db.prepare("SELECT id FROM sections WHERE course_id=?").all(c.id))
        if (!keepS.includes(s.id)) db.prepare("DELETE FROM sections WHERE id=?").run(s.id);
    })();
    res.json({ data: { ok: true } });
  })
);

r.post(
  ["/studio/courses/:id/submit", "/instructor/courses/:id/submit"],
  ins,
  ah((req, res) => {
    const c = mine(req, Number(req.params.id));
    const sections = db.prepare("SELECT COUNT(*) n FROM sections WHERE course_id=?").get(c.id).n;
    const lessons = db
      .prepare("SELECT COUNT(*) n FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=?")
      .get(c.id).n;
    if (sections < 1 || lessons < 3)
      throw new HttpError(400, "VALIDATION_ERROR", "Ajoutez au moins 1 section et 3 leçons avant de soumettre le cours");
    db.prepare("UPDATE courses SET status='pending',updated_at=? WHERE id=?").run(new Date().toISOString(), c.id);
    res.json({ data: { ok: true } });
  })
);

r.get(
  ["/studio/stats", "/instructor/stats"],
  ins,
  ah((req, res) => {
    const rows = db
      .prepare(BASE + " WHERE c.instructor_id=?")
      .all(req.user.id)
      .map((c) => ({
        ...card(c),
        revenue: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE course_id=?").get(c.id).s,
        completed: db.prepare("SELECT COUNT(*) n FROM enrollments WHERE course_id=? AND completed_at IS NOT NULL").get(c.id).n,
      }));
    res.json({
      data: {
        courses: rows,
        students: rows.reduce((a, c) => a + c.students, 0),
        revenue: rows.reduce((a, c) => a + c.revenue, 0),
        published: rows.filter((c) => c.status === "published").length,
      },
    });
  })
);

r.get(
  ["/studio/analytics", "/instructor/analytics"],
  ins,
  ah((req, res) => {
    const all =
      req.user.role === "admin"
        ? db.prepare(BASE + " ORDER BY c.id DESC").all()
        : db.prepare(BASE + " WHERE c.instructor_id=? ORDER BY c.id DESC").all(req.user.id);
    const courses = all.map(card);
    const cid = req.query.courseId ? Number(req.query.courseId) : courses[0]?.id;
    const course = courses.find((c) => c.id === cid);
    if (!course) return res.json({ data: { courses, courseId: null, summary: null, enrollmentsByDay: [], dropoff: [], reviews: [] } });
    const students = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE course_id=?").get(cid).n;
    const completed = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE course_id=? AND completed_at IS NOT NULL").get(cid).n;
    const revenue = db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payments WHERE course_id=?").get(cid).n;
    const rating = db.prepare("SELECT COALESCE(AVG(rating),0) a,COUNT(*) n FROM reviews WHERE course_id=?").get(cid);
    const certs = db.prepare("SELECT COUNT(*) n FROM certificates WHERE course_id=?").get(cid).n;
    const byDay = db
      .prepare(
        "SELECT substr(created_at,1,10) date,COUNT(*) count FROM enrollments WHERE course_id=? AND created_at>=? GROUP BY date"
      )
      .all(cid, new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
    const map = Object.fromEntries(byDay.map((x) => [x.date, x.count]));
    const enrollmentsByDay = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
      return { date, count: map[date] || 0 };
    });
    const dropoff = db
      .prepare(
        `SELECT l.id,l.title,s.title section,COUNT(DISTINCT p.user_id) done
         FROM lessons l JOIN sections s ON s.id=l.section_id
         LEFT JOIN lesson_progress p ON p.lesson_id=l.id
         WHERE s.course_id=? GROUP BY l.id ORDER BY s.position,l.position`
      )
      .all(cid)
      .map((x) => ({ ...x, rate: students ? Math.round((100 * x.done) / students) : 0 }));
    const reviews = db
      .prepare(
        `SELECT r.rating,r.comment,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id
         WHERE r.course_id=? ORDER BY r.id DESC LIMIT 5`
      )
      .all(cid);
    res.json({
      data: {
        courses,
        courseId: cid,
        summary: {
          students,
          completed,
          completionRate: students ? Math.round((100 * completed) / students) : 0,
          revenue,
          rating: Math.round((rating.a || 0) * 10) / 10,
          ratingCount: rating.n,
          certificates: certs,
        },
        enrollmentsByDay,
        dropoff,
        reviews,
      },
    });
  })
);

r.get(
  ["/studio/students", "/instructor/students"],
  ins,
  ah((req, res) => {
    const cid = req.query.courseId ? Number(req.query.courseId) : null;
    const params = [];
    let where = "";
    if (req.user.role === "admin") {
      if (cid) {
        where = "WHERE e.course_id=?";
        params.push(cid);
      }
    } else if (cid) {
      where = "WHERE e.course_id=? AND c.instructor_id=?";
      params.push(cid, req.user.id);
    } else {
      where = "WHERE c.instructor_id=?";
      params.push(req.user.id);
    }
    const rows = db
      .prepare(
        `SELECT e.user_id,e.course_id,e.created_at enrolledAt,e.completed_at completedAt,u.name,u.email,u.avatar_color,
         c.title,c.color FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
         ${where} ORDER BY e.id DESC LIMIT 200`
      )
      .all(...params)
      .map((x) => ({
        id: x.user_id,
        name: x.name,
        email: x.email,
        avatarColor: x.avatar_color,
        course: { id: x.course_id, title: x.title, color: x.color },
        enrolledAt: x.enrolledAt,
        completedAt: x.completedAt,
        progress: progressOf(x.user_id, x.course_id).progress,
      }));
    res.json({ data: rows });
  })
);

// ---------- Admin ----------
const adm = role("admin");
r.get(
  "/admin/stats",
  adm,
  ah((req, res) =>
    res.json({
      data: {
        users: db.prepare("SELECT COUNT(*) n FROM users").get().n,
        courses: db.prepare("SELECT COUNT(*) n FROM courses WHERE status='published'").get().n,
        pending: db.prepare("SELECT COUNT(*) n FROM courses WHERE status='pending'").get().n,
        enrollments: db.prepare("SELECT COUNT(*) n FROM enrollments").get().n,
        certificates: db.prepare("SELECT COUNT(*) n FROM certificates").get().n,
        revenue: db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payments").get().n,
      },
    })
  )
);

r.get(
  "/admin/courses",
  adm,
  ah((req, res) => {
    const status = req.query.status;
    const rows = status
      ? db.prepare(BASE + " WHERE c.status=? ORDER BY (c.status='pending') DESC,c.id DESC").all(status)
      : db.prepare(BASE + " ORDER BY (c.status='pending') DESC,c.id DESC").all();
    res.json({ data: rows.map(card) });
  })
);

r.patch(
  "/admin/courses/:id/status",
  adm,
  ah((req, res) => {
    const d = parse(z.object({ status: z.enum(["published", "draft", "archived"]) }), req.body);
    const c = db.prepare("SELECT * FROM courses WHERE id=?").get(Number(req.params.id));
    if (!c) throw new HttpError(404, "NOT_FOUND", "Cours introuvable");
    if (d.status === "published") {
      const lessons = db
        .prepare("SELECT COUNT(*) n FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=?")
        .get(c.id).n;
      if (lessons < 3) throw new HttpError(400, "VALIDATION_ERROR", "Un cours publié doit contenir au moins 3 leçons");
    }
    db.prepare("UPDATE courses SET status=?,updated_at=? WHERE id=?").run(d.status, new Date().toISOString(), c.id);
    res.json({ data: { ok: true } });
  })
);

r.get(
  "/admin/users",
  adm,
  ah((req, res) => {
    const rows = db
      .prepare("SELECT id,name,email,role,headline,bio,avatar_color,blocked,created_at FROM users ORDER BY id DESC LIMIT 100")
      .all();
    res.json({ data: rows });
  })
);

r.patch(
  "/admin/users/:id",
  adm,
  ah((req, res) => {
    const id = Number(req.params.id);
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
    if (!u) throw new HttpError(404, "NOT_FOUND", "Utilisateur introuvable");
    const d = parse(
      z.object({
        role: z.enum(["student", "instructor", "admin"]).optional(),
        blocked: z.boolean().optional(),
      }),
      req.body
    );
    if (id === req.user.id && d.blocked === true)
      throw new HttpError(400, "VALIDATION_ERROR", "Vous ne pouvez pas bloquer votre propre compte");
    db.prepare("UPDATE users SET role=?,blocked=? WHERE id=?").run(
      d.role ?? u.role,
      d.blocked === undefined ? u.blocked : d.blocked ? 1 : 0,
      id
    );
    const next = db.prepare("SELECT id,name,email,role,blocked FROM users WHERE id=?").get(id);
    res.json({ data: next });
  })
);

export default r;
