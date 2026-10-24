import { useEffect, useState } from "react";

export function useMediaQuery(query) {
  const read = () =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(query);
    const update = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}
