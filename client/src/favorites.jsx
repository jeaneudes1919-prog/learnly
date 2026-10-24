import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { api, errMsg } from "./api.js";
import { useAuth } from "./auth.jsx";
import { useToast } from "./ui.jsx";

export function FavoriteButton({ courseId, className = "" }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "student") {
      setSaved(false);
      return;
    }
    api
      .get(`/wishlist/${courseId}`)
      .then((data) => setSaved(!!data.saved))
      .catch(() => {});
  }, [courseId, user?.id]);

  if (!user)
    return (
      <button
        type="button"
        aria-label="Connectez-vous pour ajouter aux favoris"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          navigate("/connexion", { state: { from: location.pathname } });
        }}
        className={
          "grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink/50 shadow-sm transition hover:text-rose-500 " +
          className
        }
      >
        <Heart size={18} />
      </button>
    );

  if (user.role !== "student") return null;

  const toggle = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      if (next) await api.post(`/wishlist/${courseId}`);
      else await api.del(`/wishlist/${courseId}`);
      toast(next ? "Cours ajouté à vos favoris." : "Cours retiré de vos favoris.", "success");
    } catch (error) {
      setSaved(!next);
      toast(errMsg(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={saved ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={saved}
      onClick={toggle}
      className={
        "grid h-10 w-10 place-items-center rounded-full bg-white/95 shadow-sm transition hover:scale-105 " +
        (saved ? "text-rose-500" : "text-ink/50 hover:text-rose-500") +
        " " +
        className
      }
    >
      <Heart size={18} className={saved ? "fill-current" : ""} />
    </button>
  );
}
