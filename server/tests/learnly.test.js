process.env.DB_FILE = ":memory:";
process.env.JWT_SECRET = "learnly-test-secret";

const { default: request } = await import("supertest");
const { default: app } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { seed } = await import("../src/seed.js");

const api = request(app);
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const tokens = {};
const users = {};

const lessonsOf = (courseId) =>
  db
    .prepare(
      `SELECT l.* FROM lessons l JOIN sections s ON s.id=l.section_id WHERE s.course_id=? ORDER BY s.position,l.position`
    )
    .all(courseId);

const answersOf = (lesson) => {
  const quiz = JSON.parse(lesson.quiz);
  const answers = {};
  quiz.questions.forEach((question, index) => {
    answers[index] = question.options.map((option, i) => (option.correct ? i : -1)).filter((i) => i >= 0);
  });
  return answers;
};

beforeAll(async () => {
  seed();
  const login = async (email) => {
    const res = await api.post("/api/auth/login").send({ email, password: "Learnly2026!" });
    if (res.status !== 200) throw new Error(`Login ${email} : ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data.accessToken;
  };
  tokens.student = await login("student@learnly.dev");
  tokens.instructor = await login("prof@learnly.dev");
  tokens.admin = await login("admin@learnly.dev");
  for (let i = 1; i <= 3; i++) {
    const res = await api.post("/api/auth/register").send({
      name: `Apprenant Test ${i}`,
      email: `apprenant-test-${i}-${Date.now()}@learnly.dev`,
      password: "TestPass123!",
    });
    if (res.status !== 201) throw new Error(`Register test ${i} : ${res.status} ${JSON.stringify(res.body)}`);
    tokens[`fresh${i}`] = res.body.data.accessToken;
    users[`fresh${i}`] = res.body.data.user;
  }
});

afterAll(() => db.close());

describe("Quiz", () => {
  it("corrige une réponse simple, multiple et partiellement fausse", async () => {
    const student = db.prepare("SELECT id FROM users WHERE email='student@learnly.dev'").get();
    const lesson = db
      .prepare(
        `SELECT l.* FROM lessons l JOIN sections s ON s.id=l.section_id
         JOIN enrollments e ON e.course_id=s.course_id AND e.user_id=?
         WHERE l.type='quiz' ORDER BY l.id LIMIT 1`
      )
      .get(student.id);
    const quiz = JSON.parse(lesson.quiz);
    const answers = answersOf(lesson);

    const perfect = await api.post(`/api/quizzes/${lesson.id}/attempt`).set(bearer(tokens.student)).send({ answers });
    expect(perfect.status).toBe(200);
    expect(perfect.body.data.score).toBe(100);
    expect(perfect.body.data.passed).toBe(true);

    const multipleIndex = quiz.questions.findIndex((question) => question.type === "multiple");
    expect(multipleIndex).toBeGreaterThanOrEqual(0);
    const partial = { ...answers };
    partial[multipleIndex] = [quiz.questions[multipleIndex].options.findIndex((option) => option.correct)];
    const corrected = await api
      .post(`/api/quizzes/${lesson.id}/attempt`)
      .set(bearer(tokens.student))
      .send({ answers: partial });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.results[multipleIndex].correct).toBe(false);
    expect(corrected.body.data.score).toBeLessThan(100);
  });
});

describe("Progression et certificat", () => {
  it("calcule 100 %, émet un seul certificat et le conserve", async () => {
    const token = tokens.fresh1;
    const course = db.prepare("SELECT * FROM courses WHERE slug='maitriser-react-de-zero'").get();
    const enrollment = await api.post("/api/enroll").set(bearer(token)).send({ courseId: course.id });
    expect(enrollment.status).toBe(201);

    let last;
    for (const lesson of lessonsOf(course.id)) {
      if (lesson.type === "quiz") {
        last = await api
          .post(`/api/quizzes/${lesson.id}/attempt`)
          .set(bearer(token))
          .send({ answers: answersOf(lesson) });
      } else {
        last = await api.post(`/api/lessons/${lesson.id}/complete`).set(bearer(token)).send({});
      }
      expect(last.status).toBe(200);
    }
    expect(last.body.data.progress).toBe(100);
    expect(last.body.data.certificate).toMatch(/^LRN-[A-F0-9]{8}$/);

    const learn = await api.get(`/api/courses/${course.id}/learn`).set(bearer(token));
    expect(learn.status).toBe(200);
    expect(learn.body.data.progress).toBe(100);
    expect(learn.body.data.certificate).toBe(last.body.data.certificate);
    expect(db.prepare("SELECT COUNT(*) n FROM certificates WHERE user_id=?").get(users.fresh1.id).n).toBe(1);
  });
});

describe("Accès et paiement", () => {
  it("refuse une leçon non gratuite à un non-inscrit", async () => {
    const lesson = db
      .prepare(
        `SELECT l.id FROM lessons l JOIN sections s ON s.id=l.section_id JOIN courses c ON c.id=s.course_id
         WHERE c.status='published' AND l.free_preview=0 LIMIT 1`
      )
      .get();
    const res = await api.get(`/api/lessons/${lesson.id}`).set(bearer(tokens.fresh2));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("crée l'inscription après un paiement simulé", async () => {
    const course = db.prepare("SELECT * FROM courses WHERE price>0 AND status='published' ORDER BY id LIMIT 1").get();
    const res = await api
      .post("/api/payments/checkout")
      .set(bearer(tokens.fresh2))
      .send({ courseId: course.id, method: "card" });
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^PAY-/);
    const learning = await api.get("/api/me/learning").set(bearer(tokens.fresh2));
    expect(learning.body.data.some((item) => item.id === course.id)).toBe(true);
  });
});

describe("Règles métier", () => {
  it("refuse un avis sous 30 % de progression", async () => {
    const course = db.prepare("SELECT * FROM courses WHERE price=0 AND status='published' ORDER BY id LIMIT 1").get();
    await api.post("/api/enroll").set(bearer(tokens.fresh3)).send({ courseId: course.id });
    const res = await api
      .post(`/api/courses/${course.id}/reviews`)
      .set(bearer(tokens.fresh3))
      .send({ rating: 5, comment: "Trop tôt pour juger." });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/30/);
  });

  it("impose 1 section et 3 leçons avant la soumission", async () => {
    const created = await api
      .post("/api/instructor/courses")
      .set(bearer(tokens.instructor))
      .send({ title: "Cours de test publication", categoryId: 1, level: "debutant", price: 0 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const tooEarly = await api.post(`/api/instructor/courses/${id}/submit`).set(bearer(tokens.instructor));
    expect(tooEarly.status).toBe(400);

    const curriculum = await api
      .put(`/api/instructor/courses/${id}/curriculum`)
      .set(bearer(tokens.instructor))
      .send({
        sections: [
          {
            title: "Section de test",
            lessons: [
              { title: "Leçon 1", type: "text", content: "Contenu 1", duration_min: 5, free_preview: true },
              { title: "Leçon 2", type: "text", content: "Contenu 2", duration_min: 5, free_preview: false },
              { title: "Leçon 3", type: "text", content: "Contenu 3", duration_min: 5, free_preview: false },
            ],
          },
        ],
      });
    expect(curriculum.status).toBe(200);
    const submitted = await api.post(`/api/instructor/courses/${id}/submit`).set(bearer(tokens.instructor));
    expect(submitted.status).toBe(200);
    expect(db.prepare("SELECT status FROM courses WHERE id=?").get(id).status).toBe("pending");
  });

  it("refuse les routes formateur à un étudiant", async () => {
    const res = await api.get("/api/instructor/analytics").set(bearer(tokens.student));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Certificat public", () => {
  it("vérifie le certificat et renvoie un vrai PDF", async () => {
    const cert = db.prepare("SELECT code FROM certificates ORDER BY id LIMIT 1").get();
    const check = await api.get(`/api/certificates/${cert.code}`);
    expect(check.status).toBe(200);
    expect(check.body.data.code).toBe(cert.code);

    const pdf = await api
      .get(`/api/certificates/${cert.code}/pdf`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/application\/pdf/);
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("Notes, favoris et administration", () => {
  it("crée, liste et supprime une note et un favori", async () => {
    const student = db.prepare("SELECT id FROM users WHERE email='student@learnly.dev'").get();
    const lesson = db
      .prepare(
        `SELECT l.id FROM lessons l JOIN sections s ON s.id=l.section_id
         JOIN enrollments e ON e.course_id=s.course_id AND e.user_id=? WHERE l.type!='quiz' LIMIT 1`
      )
      .get(student.id);
    const note = await api
      .post(`/api/lessons/${lesson.id}/notes`)
      .set(bearer(tokens.student))
      .send({ content: "Note de test" });
    expect(note.status).toBe(201);
    const notes = await api.get(`/api/lessons/${lesson.id}/notes`).set(bearer(tokens.student));
    expect(notes.body.data.some((item) => item.content === "Note de test")).toBe(true);
    const removed = await api.delete(`/api/notes/${note.body.data.id}`).set(bearer(tokens.student));
    expect(removed.status).toBe(200);

    const course = db.prepare("SELECT id FROM courses WHERE status='published' ORDER BY id DESC LIMIT 1").get();
    const saved = await api.post(`/api/wishlist/${course.id}`).set(bearer(tokens.student));
    expect(saved.body.data.saved).toBe(true);
    const unsaved = await api.delete(`/api/wishlist/${course.id}`).set(bearer(tokens.student));
    expect(unsaved.body.data.saved).toBe(false);
  });

  it("bloque un utilisateur puis le débloque", async () => {
    const target = users.fresh3;
    const blocked = await api.patch(`/api/admin/users/${target.id}`).set(bearer(tokens.admin)).send({ blocked: true });
    expect(blocked.status).toBe(200);
    const login = await api.post("/api/auth/login").send({ email: target.email, password: "TestPass123!" });
    expect(login.status).toBe(403);
    const unblocked = await api.patch(`/api/admin/users/${target.id}`).set(bearer(tokens.admin)).send({ blocked: false });
    expect(unblocked.status).toBe(200);
  });
});
