import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, Menu, X } from "lucide-react";
import { useAuth } from "./auth.jsx";
import { Guard } from "./Guard.jsx";
import { AuthPage, Catalog, CoursePage, Home, Verify } from "./pub.jsx";
import { MyLearning, Player } from "./learn.jsx";
import { AdminPage, Editor, Studio } from "./studio.jsx";
import { Certificates, Favorites, Profile } from "./community.jsx";
import { Analytics, Students } from "./studio-extra.jsx";
import { Preview } from "./preview.jsx";
import { BtnSun, Empty, Skeleton } from "./ui.jsx";

export default function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!location.pathname.startsWith("/apprendre")) window.scrollTo(0, 0);
    setOpen(false);
  }, [location.pathname]);

  const player = location.pathname.startsWith("/apprendre");
  const links = [
    ["/cours", "Catalogue"],
    ...(user?.role === "student"
      ? [
          ["/mes-cours", "Mes cours"],
          ["/favoris", "Favoris"],
          ["/certificats", "Certificats"],
          ["/profil", "Profil"],
        ]
      : []),
    ...(user?.role === "instructor"
      ? [
          ["/studio", "Studio"],
          ["/studio/analytique", "Analytique"],
          ["/studio/etudiants", "Étudiants"],
          ["/profil", "Profil"],
        ]
      : []),
    ...(user?.role === "admin"
      ? [
          ["/admin", "Administration"],
          ["/profil", "Profil"],
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      {!player && (
        <header className="sticky top-0 z-40 border-b border-black/5 bg-cream/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-royal text-sun">
                <GraduationCap size={20} />
              </span>
              Learnly
            </Link>
            <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
              {links.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/studio"}
                  className={({ isActive }) => "transition hover:text-royal " + (isActive ? "text-royal" : "")}
                >
                  {label}
                </NavLink>
              ))}
              {user ? (
                <>
                  <Link to="/profil" className="flex items-center gap-2 text-ink/60 hover:text-royal">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white"
                      style={{ background: user.avatarColor }}
                    >
                      {user.name[0]}
                    </span>
                    {user.name.split(" ")[0]}
                  </Link>
                  <button onClick={logout} className="rounded-full border border-black/10 px-4 py-2 hover:bg-black/5">
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link to="/connexion" className="hover:text-royal">
                    Connexion
                  </Link>
                  <BtnSun as={Link} to="/inscription" className="!px-5 !py-2.5">
                    S'inscrire
                  </BtnSun>
                </>
              )}
            </nav>
            <button aria-label="Menu" onClick={() => setOpen(!open)} className="md:hidden">
              {open ? <X /> : <Menu />}
            </button>
          </div>
          <AnimatePresence>
            {open && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-black/5 bg-cream md:hidden"
              >
                <div className="flex flex-col gap-4 p-5 text-lg font-medium">
                  {links.map(([to, label]) => (
                    <Link key={to} to={to}>
                      {label}
                    </Link>
                  ))}
                  {user ? (
                    <button onClick={logout} className="text-left text-ink/60">
                      Déconnexion
                    </button>
                  ) : (
                    <>
                      <Link to="/connexion">Connexion</Link>
                      <Link to="/inscription" className="text-royal">
                        S'inscrire
                      </Link>
                    </>
                  )}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </header>
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={player ? "player" : location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/cours" element={<Catalog />} />
            <Route path="/cours/:slug" element={<CoursePage />} />
            <Route path="/apercu/:courseId/:lessonId" element={<Preview />} />
            <Route path="/certificat/:code" element={<Verify />} />
            <Route path="/connexion" element={<AuthPage />} />
            <Route path="/inscription" element={<AuthPage register />} />
            <Route
              path="/mes-cours"
              element={
                <Guard roles={["student"]}>
                  <MyLearning />
                </Guard>
              }
            />
            <Route
              path="/favoris"
              element={
                <Guard roles={["student"]}>
                  <Favorites />
                </Guard>
              }
            />
            <Route
              path="/certificats"
              element={
                <Guard roles={["student"]}>
                  <Certificates />
                </Guard>
              }
            />
            <Route
              path="/profil"
              element={
                <Guard>
                  <Profile />
                </Guard>
              }
            />
            <Route
              path="/apprendre/:courseId/:lessonId?"
              element={
                <Guard>
                  <Player />
                </Guard>
              }
            />
            <Route
              path="/studio"
              element={
                <Guard roles={["instructor"]}>
                  <Studio />
                </Guard>
              }
            />
            <Route
              path="/studio/cours/:id"
              element={
                <Guard roles={["instructor", "admin"]}>
                  <Editor />
                </Guard>
              }
            />
            <Route
              path="/studio/analytique"
              element={
                <Guard roles={["instructor", "admin"]}>
                  <Analytics />
                </Guard>
              }
            />
            <Route
              path="/studio/etudiants"
              element={
                <Guard roles={["instructor", "admin"]}>
                  <Students />
                </Guard>
              }
            />
            <Route
              path="/admin"
              element={
                <Guard roles={["admin"]}>
                  <AdminPage />
                </Guard>
              }
            />
            <Route
              path="*"
              element={
                <Empty icon="🧭" title="Page introuvable">
                  <Link to="/" className="font-semibold text-royal underline">
                    Retour à l'accueil
                  </Link>
                </Empty>
              }
            />
          </Routes>
        </motion.main>
      </AnimatePresence>

      {!player && (
        <footer className="mt-20 border-t border-black/5 py-10 text-center text-sm text-ink/55">
          <p className="font-display text-xl font-extrabold text-ink">Learnly</p>
          <p className="mt-1">Plateforme d'apprentissage en ligne · Projet de démonstration</p>
        </footer>
      )}
    </div>
  );
}
