import { memo } from "react";
import { motion } from "framer-motion";
import { Star, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAnimeImage, getAnimeTitle } from "../../lib/tenrai";

function AnimeCard({ anime, index = 0 }) {
  const navigate = useNavigate();

  const image = getAnimeImage(anime);
  const title = getAnimeTitle(anime);
  const animeId = anime?.mal_id ?? anime?.id;

  function openDetails() {
    if (!animeId) return;
    navigate(`/anime/${animeId}`);
  }

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.035, 0.2),
      }}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={openDetails}
      aria-label={`View details for ${title}`}
      className="group w-full min-w-0 snap-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-4 focus-visible:ring-offset-[#09080c]"
    >
      <div className="relative aspect-[3/4.2] overflow-hidden rounded-xl bg-[#17141c] ring-1 ring-white/[0.06] transition duration-300 group-hover:ring-pink-500/40 sm:rounded-2xl">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center text-xs text-zinc-500">
            Poster unavailable
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

        {anime?.score != null && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md sm:left-3 sm:top-3 sm:text-xs">
            <Star
              size={11}
              className="fill-amber-400 text-amber-400"
            />
            {Number(anime.score).toFixed(1)}
          </div>
        )}

        {anime?.episodes != null && (
          <div className="absolute right-2 top-2 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-medium text-zinc-200 backdrop-blur-md sm:right-3 sm:top-3">
            {anime.episodes} EP
          </div>
        )}

        <div className="absolute bottom-3 left-3 grid size-9 translate-y-2 place-items-center rounded-full bg-pink-500 text-white opacity-0 shadow-lg shadow-pink-500/20 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Play size={16} fill="currentColor" />
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-2 text-xs font-semibold leading-5 text-zinc-200 transition-colors group-hover:text-pink-300 sm:text-sm">
          {title}
        </h3>

        <div className="mt-1 flex items-center gap-2 overflow-hidden text-[10px] text-zinc-500 sm:text-xs">
          {anime?.type && (
            <span className="truncate">{anime.type}</span>
          )}

          {anime?.year && (
            <>
              {anime?.type && (
                <span className="text-zinc-700">•</span>
              )}
              <span>{anime.year}</span>
            </>
          )}

          {!anime?.type && !anime?.year && anime?.status && (
            <span className="truncate">{anime.status}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export default memo(AnimeCard);