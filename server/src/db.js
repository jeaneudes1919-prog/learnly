import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const file = process.env.DB_FILE || "data/learnly.db";
if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
export const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','instructor','admin')),
  headline TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_color TEXT NOT NULL,
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS refresh_tokens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '📚'
);
CREATE TABLE IF NOT EXISTS courses(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id INTEGER NOT NULL REFERENCES users(id),
  category_id INTEGER REFERENCES categories(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subtitle TEXT DEFAULT '',
  description TEXT DEFAULT '',
  level TEXT NOT NULL DEFAULT 'debutant' CHECK(level IN ('debutant','intermediaire','avance')),
  language TEXT NOT NULL DEFAULT 'fr',
  price INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','published','archived')),
  duration_min INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  students_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS sections(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('video','text','quiz')),
  content TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  duration_min INTEGER DEFAULT 5,
  position INTEGER NOT NULL DEFAULT 0,
  free_preview INTEGER NOT NULL DEFAULT 0,
  quiz TEXT
);
CREATE TABLE IF NOT EXISTS enrollments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT ${NOW},
  completed_at TEXT,
  UNIQUE(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS payments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('mobile_money','card','free')),
  status TEXT NOT NULL DEFAULT 'paid',
  reference TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS lesson_progress(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TEXT DEFAULT ${NOW},
  PRIMARY KEY(user_id,lesson_id)
);
CREATE TABLE IF NOT EXISTS quiz_attempts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  answers_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS reviews(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  created_at TEXT DEFAULT ${NOW},
  UNIQUE(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS certificates(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  issued_at TEXT DEFAULT ${NOW},
  UNIQUE(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT ${NOW}
);
CREATE TABLE IF NOT EXISTS wishlist(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT ${NOW},
  PRIMARY KEY(user_id,course_id)
);
`);

// Migrations douces pour les bases créées par la version initiale.
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn("users", "bio", "TEXT DEFAULT ''");
addColumn("users", "blocked", "INTEGER NOT NULL DEFAULT 0");
addColumn("courses", "language", "TEXT NOT NULL DEFAULT 'fr'");
addColumn("courses", "duration_min", "INTEGER NOT NULL DEFAULT 0");
addColumn("courses", "rating_avg", "REAL NOT NULL DEFAULT 0");
addColumn("courses", "rating_count", "INTEGER NOT NULL DEFAULT 0");
addColumn("courses", "students_count", "INTEGER NOT NULL DEFAULT 0");
addColumn("courses", "updated_at", "TEXT DEFAULT ''");
addColumn("payments", "status", "TEXT NOT NULL DEFAULT 'paid'");
addColumn("quiz_attempts", "answers_json", "TEXT DEFAULT '{}'");
