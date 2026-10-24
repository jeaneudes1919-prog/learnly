import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db } from "./db.js";
import { HttpError, ah, parse } from "./util.js";

export const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const COLORS = ["#1E3A8A", "#FCA311", "#16A34A", "#DB2777", "#7C3AED", "#0891B2"];

export const pub = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  headline: u.headline,
  bio: u.bio || "",
  avatarColor: u.avatar_color,
  blocked: !!u.blocked,
});

const access = (u) => jwt.sign({ sub: u.id, role: u.role }, SECRET, { expiresIn: "15m" });

function issue(res, u) {
  const rt = crypto.randomBytes(48).toString("base64url");
  db.prepare("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)").run(
    u.id,
    sha(rt),
    new Date(Date.now() + 7 * 864e5).toISOString()
  );
  res.cookie("rt", rt, { httpOnly: true, sameSite: "lax", path: "/api/auth", maxAge: 7 * 864e5 });
  return access(u);
}

const load = (req) => {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  const p = jwt.verify(t, SECRET);
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(p.sub);
  if (!u || u.blocked) throw new Error("blocked");
  return u;
};

export const auth = (req, res, next) => {
  try {
    req.user = load(req);
    next();
  } catch {
    next(new HttpError(401, "UNAUTHORIZED", "Authentification requise"));
  }
};

export const optAuth = (req, res, next) => {
  try {
    req.user = load(req);
  } catch {
    req.user = null;
  }
  next();
};

export const role = (...rs) => (req, res, next) =>
  rs.includes(req.user.role) ? next() : next(new HttpError(403, "FORBIDDEN", "Accès réservé"));

const limiter = rateLimit({
  windowMs: 60000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Trop de tentatives, réessayez dans une minute" } },
});

const reg = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(60),
  email: z.string().trim().email("Email invalide"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
  role: z.enum(["student", "instructor"]).default("student"),
});

const r = Router();

r.post(
  "/register",
  limiter,
  ah((req, res) => {
    const d = parse(reg, req.body);
    if (db.prepare("SELECT 1 FROM users WHERE email=?").get(d.email.toLowerCase()))
      throw new HttpError(409, "CONFLICT", "Cet email est déjà utilisé");
    const id = db
      .prepare("INSERT INTO users(name,email,password_hash,role,avatar_color) VALUES(?,?,?,?,?)")
      .run(
        d.name,
        d.email.toLowerCase(),
        bcrypt.hashSync(d.password, 10),
        d.role,
        COLORS[Math.floor(Math.random() * COLORS.length)]
      ).lastInsertRowid;
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
    res.status(201).json({ data: { user: pub(u), accessToken: issue(res, u) } });
  })
);

r.post(
  "/login",
  limiter,
  ah((req, res) => {
    const d = parse(z.object({ email: z.string().trim(), password: z.string() }), req.body);
    const u = db.prepare("SELECT * FROM users WHERE email=?").get(d.email.toLowerCase());
    if (!u || !bcrypt.compareSync(d.password, u.password_hash))
      throw new HttpError(401, "UNAUTHORIZED", "Email ou mot de passe incorrect");
    if (u.blocked) throw new HttpError(403, "FORBIDDEN", "Ce compte est bloqué");
    res.json({ data: { user: pub(u), accessToken: issue(res, u) } });
  })
);

r.post(
  "/refresh",
  ah((req, res) => {
    const rt = req.cookies?.rt;
    const row = rt && db.prepare("SELECT * FROM refresh_tokens WHERE token_hash=? AND revoked=0").get(sha(rt));
    if (!row || row.expires_at < new Date().toISOString())
      throw new HttpError(401, "UNAUTHORIZED", "Session expirée");
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(row.user_id);
    if (!u || u.blocked) throw new HttpError(401, "UNAUTHORIZED", "Compte indisponible");
    db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE id=?").run(row.id);
    res.json({ data: { user: pub(u), accessToken: issue(res, u) } });
  })
);

r.post(
  "/logout",
  ah((req, res) => {
    const rt = req.cookies?.rt;
    if (rt) db.prepare("UPDATE refresh_tokens SET revoked=1 WHERE token_hash=?").run(sha(rt));
    res.clearCookie("rt", { path: "/api/auth" });
    res.json({ data: { ok: true } });
  })
);

r.get("/me", auth, (req, res) => res.json({ data: pub(req.user) }));

r.patch(
  "/me",
  auth,
  ah((req, res) => {
    const d = parse(
      z.object({
        name: z.string().trim().min(2, "Nom trop court").max(60).optional(),
        headline: z.string().trim().max(120).optional(),
        bio: z.string().trim().max(1000).optional(),
      }),
      req.body
    );
    const next = {
      name: d.name ?? req.user.name,
      headline: d.headline ?? req.user.headline ?? "",
      bio: d.bio ?? req.user.bio ?? "",
    };
    db.prepare("UPDATE users SET name=?,headline=?,bio=? WHERE id=?").run(
      next.name,
      next.headline,
      next.bio,
      req.user.id
    );
    res.json({ data: pub(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id)) });
  })
);

export default r;
