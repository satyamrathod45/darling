import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Film } from "lucide-react";

export default function AnimeTrailer({ trailer, title }) {
  const [playing, setPlaying] = useState(false);

  const videoId =
    trailer?.youtube_id ||
    trailer?.video_id ||
    trailer?.trailer?.youtube_id ||
    trailer?.trailer?.video_id;

  const embedUrl =
    trailer?.embed_url ||
    trailer?.trailer?.embed_url ||
    (videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : "");

  if (!embedUrl) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#100d14] px-6 text-center">
        <Film size={34} className="text-zinc-600" />
        <p className="mt-4 font-semibold text-zinc-300">
          Trailer unavailable
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          A trailer hasn't been provided for this anime.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-2xl shadow-black/20"
    >
      {playing ? (
        <div className="aspect-video">
          <iframe
            src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-[#100d14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
          aria-label={`Play ${title} trailer`}
        >
          {trailer?.images?.image_url && (
            <img
              src={trailer.images.image_url}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-500 group-hover:scale-105 group-hover:opacity-75"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

          <span className="relative grid size-16 place-items-center rounded-full border border-white/30 bg-pink-500 text-white shadow-xl shadow-pink-500/30 transition duration-300 group-hover:scale-110 group-hover:bg-pink-400 sm:size-20">
            <Play size={28} fill="currentColor" />
          </span>

          <span className="absolute bottom-4 left-4 right-4 text-left text-sm font-semibold text-white sm:bottom-5 sm:left-5">
            Watch trailer
          </span>
        </button>
      )}
    </motion.div>
  );
}