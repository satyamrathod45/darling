import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AnimeCard from "./AnimeCard";

export default function AnimeSection({
  title,
  subtitle,
  anime = [],
  loading = false,
  error = "",
  viewAllTo = "/search?q=anime",
}) {
  const sliderRef = useRef(null);
  const navigate = useNavigate();

  function scrollSlider(direction) {
    if (!sliderRef.current) return;

    const amount = sliderRef.current.clientWidth * 0.8;

    sliderRef.current.scrollBy({
      left: direction * amount,
      behavior: "smooth",
    });
  }

  return (
    <section className="mt-10 sm:mt-14">
      <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-pink-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-400 sm:text-xs">
              Discover
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(viewAllTo)}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-pink-300 sm:flex"
          >
            View all
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollSlider(-1)}
            className="grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-400 transition-colors hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollSlider(1)}
            className="grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-400 transition-colors hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="aspect-[3/4.2] rounded-xl bg-white/[0.045] sm:rounded-2xl" />
              <div className="mt-3 h-3 w-4/5 rounded bg-white/[0.06]" />
              <div className="mt-2 h-2.5 w-2/5 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-8 text-sm text-zinc-400">
          {error}
        </div>
      ) : anime.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-8 text-sm text-zinc-400">
          No anime available right now.
        </div>
      ) : (
        <motion.div
          ref={sliderRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
        >
          {anime.map((item, index) => (
            <div
              key={item.mal_id ?? item.id ?? `${title}-${index}`}
              className="w-[43%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[17%]"
            >
              <AnimeCard anime={item} index={index} onClick/>
            </div>
          ))}
        </motion.div>
      )}
    </section>
  );
}