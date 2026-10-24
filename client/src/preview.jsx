import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, PlayCircle } from "lucide-react";
import { api } from "./api.js";
import { BtnSun, Empty, Md, Skeleton } from "./ui.jsx";

export function Preview() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLesson(null);
    setError(false);
    api
      .get(`/preview/lessons/${lessonId}`)
      .then(setLesson)
      .catch(() => setError(true));
  }, [lessonId]);

  if (error)
    return (
      <Empty icon="🔒" title="Aperçu indisponible">
        Cette leçon n'est pas accessible sans inscription.
        <div className="mt-5">
          <BtnSun as={Link} to="/cours">
            Voir le catalogue
          </BtnSun>
        </div>
      </Empty>
    );

  if (!lesson)
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to={`/cours/${lesson.course.slug}`} className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-royal">
        <ArrowLeft size={15} /> Retour au cours
      </Link>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-mint/15 px-3 py-1 text-xs font-bold text-mint">APERÇU GRATUIT</span>
        <span className="text-xs text-ink/45">{lesson.course.title}</span>
      </div>
      <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-5xl">{lesson.title}</h1>

      {lesson.type === "video" && lesson.videoUrl?.startsWith("https://www.youtube.com/embed/") ? (
        <iframe
          src={lesson.videoUrl}
          title={lesson.title}
          allowFullScreen
          className="mt-7 aspect-video w-full rounded-2xl shadow-xl"
        />
      ) : lesson.type === "quiz" ? (
        <div className="card mt-7 p-6">
          <p className="flex items-center gap-2 font-display text-xl font-bold">
            <BookOpen size={20} className="text-royal" /> Quiz de la leçon
          </p>
          <p className="mt-2 text-sm text-ink/60">
            Ce quiz contient {lesson.quiz?.questions.length || 0} questions. Inscrivez-vous au cours pour le passer et
            valider vos acquis.
          </p>
        </div>
      ) : (
        <div className="card mt-7 p-5 sm:p-8">
          <Md text={lesson.content} />
        </div>
      )}

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl bg-royal p-6 text-white sm:flex-row sm:p-8">
        <div>
          <p className="font-display text-2xl font-extrabold">Envie de suivre le cours complet ?</p>
          <p className="mt-1 text-sm text-white/70">Progression, quiz corrigés et certificat vérifiable.</p>
        </div>
        <BtnSun as={Link} to={`/cours/${lesson.course.slug}`} className="shrink-0">
          <PlayCircle size={17} /> Voir le cours <ArrowRight size={16} />
        </BtnSun>
      </div>
    </div>
  );
}
