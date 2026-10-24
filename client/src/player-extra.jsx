import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, MessageSquare, NotebookPen, Trash2 } from "lucide-react";
import { api, errMsg } from "./api.js";
import { dateFr } from "./lib.js";
import { BtnSun, Skeleton, Stars, Textarea, useToast } from "./ui.jsx";

const RESOURCES = {
  dev: [
    ["MDN Web Docs", "https://developer.mozilla.org/fr/"],
    ["React — documentation", "https://fr.react.dev/learn"],
    ["Node.js — guides", "https://nodejs.org/fr/learn"],
  ],
  reseaux: [
    ["Cloudflare Learning Center", "https://www.cloudflare.com/fr-fr/learning/"],
    ["Cisco Networking Academy", "https://www.netacad.com/"],
    ["OWASP Top 10", "https://owasp.org/www-project-top-ten/"],
  ],
  data: [
    ["Python — documentation", "https://docs.python.org/fr/3/"],
    ["Pandas — guides", "https://pandas.pydata.org/docs/user_guide/"],
    ["Kaggle Learn", "https://www.kaggle.com/learn"],
  ],
  design: [
    ["Figma — ressources", "https://www.figma.com/resource-library/"],
    ["Laws of UX", "https://lawsofux.com/"],
    ["Web Content Accessibility Guidelines", "https://www.w3.org/WAI/standards-guidelines/wcag/"],
  ],
  business: [
    ["HubSpot — guides marketing", "https://www.hubspot.fr/marketing"],
    ["Google Digital Garage", "https://learndigital.withgoogle.com/digitalgarage-fr"],
    ["Atlassian — agile", "https://www.atlassian.com/fr/agile"],
  ],
  langues: [
    ["BBC Learning English", "https://www.bbc.co.uk/learningenglish/"],
    ["Cambridge Dictionary", "https://dictionary.cambridge.org/fr/"],
    ["Duolingo", "https://fr.duolingo.com/"],
  ],
};

export function LessonPanel({ courseId, lesson, categorySlug }) {
  const toast = useToast();
  const [tab, setTab] = useState("notes");
  const [notes, setNotes] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState(null);

  const loadNotes = () =>
    api
      .get(`/lessons/${lesson.id}/notes`)
      .then(setNotes)
      .catch(() => setNotes([]));

  useEffect(() => {
    setTab("notes");
    setNotes(null);
    setText("");
    loadNotes();
    api
      .get(`/courses/${courseId}/reviews?limit=5`)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [lesson.id, courseId]);

  const save = async () => {
    if (!text.trim()) return toast("Écrivez d'abord une note.", "warn");
    setBusy(true);
    try {
      await api.post(`/lessons/${lesson.id}/notes`, { content: text.trim() });
      setText("");
      await loadNotes();
      toast("Note enregistrée.");
    } catch (error) {
      toast(errMsg(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.del(`/notes/${id}`);
      setNotes((list) => list.filter((note) => note.id !== id));
      toast("Note supprimée.");
    } catch (error) {
      toast(errMsg(error), "error");
    }
  };

  const resources = [
    ...(lesson.videoUrl ? [["Voir la vidéo de la leçon", lesson.videoUrl]] : []),
    ...(RESOURCES[categorySlug] || RESOURCES.dev),
  ];

  const tabs = [
    ["notes", "Notes", NotebookPen],
    ["resources", "Ressources", BookOpen],
    ["reviews", "Avis", MessageSquare],
  ];

  return (
    <div className="card overflow-hidden">
      <div role="tablist" aria-label="Outils de la leçon" className="flex gap-1 border-b border-black/5 bg-cream p-2">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition " +
              (tab === key ? "bg-white text-royal shadow-sm" : "text-ink/50 hover:text-ink")
            }
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "notes" && (
          <div className="space-y-3">
            <p className="text-xs text-ink/50">Vos notes personnelles pour cette leçon.</p>
            <Textarea
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Une idée, une question, un exemple à retenir…"
              aria-label="Nouvelle note"
            />
            <BtnSun onClick={save} disabled={busy} className="w-full !py-2.5">
              {busy ? "Enregistrement…" : "Enregistrer la note"}
            </BtnSun>
            {notes === null ? (
              <Skeleton className="h-16" />
            ) : notes.length === 0 ? (
              <p className="rounded-xl bg-cream px-3 py-3 text-xs text-ink/50">Aucune note pour l'instant.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-xl border border-black/5 bg-cream p-3">
                    <p className="whitespace-pre-line text-sm text-ink/75">{note.content}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-ink/40">{dateFr(note.createdAt)}</span>
                      <button
                        onClick={() => remove(note.id)}
                        aria-label="Supprimer la note"
                        className="text-ink/35 transition hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "resources" && (
          <ul className="space-y-2">
            {resources.map(([label, href]) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2.5 text-sm font-medium transition hover:border-royal/30 hover:bg-royal/5"
                >
                  <span>{label}</span>
                  <ExternalLink size={14} className="shrink-0 text-royal" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {tab === "reviews" && (
          <div>
            {reviews === null ? (
              <Skeleton className="h-20" />
            ) : reviews.length === 0 ? (
              <p className="rounded-xl bg-cream px-3 py-3 text-xs text-ink/50">
                Aucun avis pour ce cours. Terminez 30 % du cours pour être le premier à partager votre expérience.
              </p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-xl border border-black/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm">{review.name}</b>
                      <Stars value={review.rating} size={12} />
                    </div>
                    <p className="mt-1 text-xs text-ink/65">{review.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
