import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Download, Heart, Mail, UserRound } from "lucide-react";
import { api, errMsg } from "./api.js";
import { useAuth } from "./auth.jsx";
import { CourseCard } from "./pub.jsx";
import { dateFr } from "./lib.js";
import { Btn, BtnSun, Empty, Input, Label, Skeleton, Textarea, useToast } from "./ui.jsx";

export function Favorites() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api.get("/wishlist").then(setList).catch(() => setList([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-royal">
            <Heart size={16} /> Votre sélection
          </p>
          <h1 className="mt-1 font-display text-4xl font-extrabold sm:text-5xl">Mes favoris</h1>
        </div>
        <Link to="/cours" className="flex items-center gap-1 text-sm font-semibold text-royal">
          Explorer le catalogue <ArrowRight size={16} />
        </Link>
      </div>
      {list === null ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty icon="💛" title="Aucun favori pour le moment">
          Parcourez le catalogue et cliquez sur le cœur d'un cours pour le retrouver ici.
          <div className="mt-5">
            <BtnSun as={Link} to="/cours">
              Découvrir les cours
            </BtnSun>
          </div>
        </Empty>
      ) : (
        <>
          <p className="mt-4 text-sm text-ink/55">
            {list.length} cours enregistré{list.length > 1 ? "s" : ""}
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((course) => (
              <CourseCard key={course.id} c={course} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Certificates() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api.get("/me/certificates").then(setList).catch(() => setList([]));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="flex items-center gap-2 text-sm font-semibold text-royal">
        <Award size={16} /> Vos réussites
      </p>
      <h1 className="mt-1 font-display text-4xl font-extrabold sm:text-5xl">Mes certificats</h1>
      {list === null ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : list.length === 0 ? (
        <Empty icon="🏅" title="Votre premier certificat vous attend">
          Terminez un cours à 100 % pour recevoir un certificat vérifiable et téléchargeable en PDF.
          <div className="mt-5">
            <BtnSun as={Link} to="/mes-cours">
              Continuer mes cours
            </BtnSun>
          </div>
        </Empty>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {list.map((cert) => (
            <div key={cert.code} className="card flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sun text-ink">
                  <Award size={22} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-bold">{cert.course}</p>
                  <p className="text-xs text-ink/55">
                    {dateFr(cert.issuedAt)} · {cert.code}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/certificat/${cert.code}`}
                  className="rounded-full bg-royal/10 px-3 py-2 text-xs font-semibold text-royal"
                >
                  Voir
                </Link>
                <a
                  href={`/api/certificates/${cert.code}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Télécharger le PDF"
                  className="grid h-9 w-9 place-items-center rounded-full bg-royal text-white"
                >
                  <Download size={15} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", headline: "", bio: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((data) => {
        setForm({ name: data.name || "", headline: data.headline || "", bio: data.bio || "" });
        setUser(data);
      })
      .catch((error) => toast(errMsg(error), "error"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api.patch("/auth/me", form);
      setUser(data);
      toast("Profil mis à jour.");
    } catch (error) {
      toast(errMsg(error), "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-72" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center gap-4">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl font-display text-2xl font-extrabold text-white"
          style={{ background: user?.avatarColor || "#1E3A8A" }}
        >
          {form.name?.[0] || "L"}
        </span>
        <div>
          <h1 className="font-display text-4xl font-extrabold">Mon profil</h1>
          <p className="flex items-center gap-1.5 text-sm text-ink/55">
            <Mail size={14} /> {user?.email}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="card mt-8 space-y-4 p-5 sm:p-7">
        <div>
          <Label>Nom complet</Label>
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </div>
        <div>
          <Label>Titre / spécialité</Label>
          <Input
            value={form.headline}
            onChange={(event) => setForm({ ...form, headline: event.target.value })}
            placeholder="Ex. : Développeur web en apprentissage"
          />
        </div>
        <div>
          <Label>À propos de moi</Label>
          <Textarea
            rows={5}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            placeholder="Vos objectifs, vos centres d'intérêt, ce que vous souhaitez apprendre…"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-royal/10 px-3 py-1 text-xs font-semibold text-royal">
            {user?.role === "instructor" ? "Formateur" : user?.role === "admin" ? "Administrateur" : "Apprenant"}
          </span>
          <BtnSun disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</BtnSun>
        </div>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/favoris" className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
          <Heart size={20} className="text-rose-500" />
          <span className="font-semibold">Mes favoris</span>
        </Link>
        <Link to="/certificats" className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
          <Award size={20} className="text-royal" />
          <span className="font-semibold">Mes certificats</span>
        </Link>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-ink/45">
        <UserRound size={14} /> Votre adresse email ne peut pas être modifiée dans cette démo.
      </p>
    </div>
  );
}
