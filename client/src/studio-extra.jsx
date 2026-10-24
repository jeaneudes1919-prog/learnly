import { useEffect, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, GraduationCap, LayoutDashboard, Star, Users } from "lucide-react";
import { api, errMsg } from "./api.js";
import { dateFr } from "./lib.js";
import { Counter, Empty, ProgressRing, Select, Skeleton, Stars, useToast } from "./ui.jsx";

const links = [
  ["/studio", "Vue d'ensemble", LayoutDashboard],
  ["/studio/analytique", "Analytique", BarChart3],
  ["/studio/etudiants", "Étudiants", Users],
];

export function StudioNav() {
  return (
    <nav className="mt-5 flex flex-wrap gap-2" aria-label="Navigation du studio">
      {links.map(([to, label, Icon]) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/studio"}
          className={({ isActive }) =>
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition " +
            (isActive ? "bg-royal text-white" : "bg-white text-ink/60 hover:bg-black/5")
          }
        >
          <Icon size={15} /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Analytics() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const courseId = params.get("courseId") || "";
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api
      .get("/instructor/analytics" + (courseId ? `?courseId=${courseId}` : ""))
      .then(setData)
      .catch((error) => {
        toast(errMsg(error), "error");
        setData({ courses: [], summary: null, enrollmentsByDay: [], dropoff: [], reviews: [] });
      });
  }, [courseId]);

  if (!data)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Skeleton className="h-72" />
      </div>
    );

  if (!data.summary)
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm font-semibold text-royal">Espace formateur</p>
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Analytique</h1>
        <StudioNav />
        <Empty icon="📊" title="Aucune donnée pour le moment">
          Créez et publiez un cours pour suivre les inscriptions, la complétion et les revenus.
        </Empty>
      </div>
    );

  const summary = data.summary;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-royal">Espace formateur</p>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Analytique</h1>
        </div>
        <div className="w-full sm:w-72">
          <Select
            aria-label="Choisir un cours"
            value={courseId || data.courseId}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              next.set("courseId", event.target.value);
              setParams(next);
            }}
          >
            {data.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <StudioNav />

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Apprenants", summary.students, "", Users],
          ["Taux de complétion", summary.completionRate, "%", GraduationCap],
          ["Revenus", summary.revenue, " FCFA", BarChart3],
          ["Note moyenne", summary.rating, "/5", Star],
        ].map(([label, value, suffix, Icon]) => (
          <div key={label} className="card p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink/50">
              <Icon size={14} /> {label}
            </p>
            <p className="mt-2 font-display text-3xl font-extrabold">
              {label === "Note moyenne" ? `${value}${suffix}` : <Counter value={value} suffix={suffix} />}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold">Inscriptions sur 30 jours</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.enrollmentsByDay} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="enrollGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E3A8A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#14213D12" />
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(value) => dateFr(value)} />
                <Area type="monotone" dataKey="count" name="Inscriptions" stroke="#1E3A8A" fill="url(#enrollGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold">Complétion par leçon</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dropoff.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#14213D12" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="title" width={110} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value}%`, "Complétion"]} />
                <Bar dataKey="rate" fill="#16A34A" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card mt-5 p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Derniers avis</h2>
        {data.reviews.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">Aucun avis pour le moment.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.reviews.map((review, index) => (
              <li key={index} className="rounded-2xl border border-black/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm">{review.name}</b>
                  <Stars value={review.rating} size={13} />
                </div>
                <p className="mt-2 text-sm text-ink/65">{review.comment}</p>
                <p className="mt-2 text-xs text-ink/40">{dateFr(review.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function Students() {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get("/instructor/courses").then(setCourses).catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    setRows(null);
    api
      .get("/instructor/students" + (courseId ? `?courseId=${courseId}` : ""))
      .then(setRows)
      .catch((error) => {
        toast(errMsg(error), "error");
        setRows([]);
      });
  }, [courseId]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-royal">Espace formateur</p>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Étudiants</h1>
        </div>
        <div className="w-full sm:w-72">
          <Select aria-label="Filtrer par cours" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">Tous mes cours</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <StudioNav />

      {rows === null ? (
        <div className="mt-7 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty icon="👩‍🎓" title="Aucun étudiant pour l'instant">
          Les inscriptions à vos cours apparaîtront ici avec leur progression.
        </Empty>
      ) : (
        <div className="mt-7 overflow-hidden rounded-2xl border border-black/5 bg-white">
          <div className="hidden grid-cols-[1.2fr_1fr_90px_120px] gap-4 border-b border-black/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-ink/45 sm:grid">
            <span>Étudiant</span>
            <span>Cours</span>
            <span>Progression</span>
            <span>Inscrit le</span>
          </div>
          {rows.map((student) => (
            <div
              key={`${student.id}-${student.course.id}`}
              className="grid gap-3 border-b border-black/5 px-5 py-4 last:border-0 sm:grid-cols-[1.2fr_1fr_90px_120px] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: student.avatarColor }}
                >
                  {student.name[0]}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{student.name}</p>
                  <p className="truncate text-xs text-ink/50">{student.email}</p>
                </div>
              </div>
              <p className="truncate text-sm text-ink/65">{student.course.title}</p>
              <div className="flex items-center gap-2">
                <ProgressRing value={student.progress} size={44} stroke={5} color={student.progress === 100 ? "#16A34A" : "#1E3A8A"} />
                <span className="text-xs font-semibold sm:hidden">{student.progress}%</span>
              </div>
              <span className="text-xs text-ink/50">{dateFr(student.enrolledAt)}</span>
            </div>
          ))}
        </div>
      )}
      {rows && rows.length > 0 && (
        <p className="mt-4 text-xs text-ink/45">
          {rows.length} inscription{rows.length > 1 ? "s" : ""} affichée{rows.length > 1 ? "s" : ""} · Les revenus et la
          complétion détaillée sont dans l'onglet Analytique.
        </p>
      )}
    </div>
  );
}
