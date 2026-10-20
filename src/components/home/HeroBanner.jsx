
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play,
  Info,
  ChevronLeft,
  ChevronRight,
  Star,
  VolumeX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAnimeImage,
  getAnimeTitle,
  getAnimeVideos,
  getYouTubeVideoId,
} from "../../lib/tenrai";

async function fetchAnimeBanner(malId, signal) {
  if (!malId) return "";

  const query = `
    query ($id: Int) {
      Media(idMal: $id, type: ANIME) {
        bannerImage
      }
    }
  `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { id: Number(malId) },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`AniList returned ${response.status}`);
  }

  const result = await response.json();
  return result?.data?.Media?.bannerImage || "";
}

function findTrailerUrl(response) {
  const candidates = [
    response?.trailer,
    response?.data?.trailer,
    response?.video,
    response?.data?.video,
    ...(Array.isArray(response) ? response : []),
    ...(Array.isArray(response?.data) ? response.data : []),
    ...(Array.isArray(response?.videos) ? response.videos : []),
    ...(Array.isArray(response?.data?.videos) ? response.data.videos : []),
    ...(Array.isArray(response?.results) ? response.results : []),
    ...(Array.isArray(response?.data?.results) ? response.data.results : []),
  ].filter(Boolean);

  for (const item of candidates) {
    const url =
      typeof item === "string"
        ? item
        : item?.url ||
          item?.trailer_url ||
          item?.youtube_url ||
          item?.embed_url ||
          item?.link ||
          (item?.youtube_id
            ? `https://www.youtube.com/watch?v=${item.youtube_id}`
            : item?.video_id
              ? `https://www.youtube.com/watch?v=${item.video_id}`
              : "");

    if (!url) continue;

    const videoId = getYouTubeVideoId(url);
    if (videoId) return videoId;
  }

  return "";
}

export default function HeroBanner({ anime = [], loading = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [bannerImages, setBannerImages] = useState({});
  const [trailers, setTrailers] = useState({});
  const [trailerLoading, setTrailerLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setActiveIndex(0);
    setHovered(false);
  }, [anime]);

  useEffect(() => {
    if (anime.length < 2 || hovered) return;

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % anime.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [anime.length, hovered]);

  const current = anime[activeIndex];
  const animeId = current?.mal_id ?? current?.id;
  const malId = current?.mal_id;
  const title = current ? getAnimeTitle(current) : "";
  const fallbackImage = current ? getAnimeImage(current) : "";

  useEffect(() => {
    if (!malId) return;

    if (Object.prototype.hasOwnProperty.call(bannerImages, malId)) {
      return;
    }

    const controller = new AbortController();

    fetchAnimeBanner(malId, controller.signal)
      .then((banner) => {
        setBannerImages((previous) => ({
          ...previous,
          [malId]: banner || null,
        }));
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setBannerImages((previous) => ({
            ...previous,
            [malId]: null,
          }));
        }
      });

    return () => controller.abort();
  }, [malId, bannerImages]);

  useEffect(() => {
    if (!hovered || !animeId) return;

    if (Object.prototype.hasOwnProperty.call(trailers, animeId)) {
      return;
    }

    let cancelled = false;

    async function loadTrailer() {
      setTrailerLoading(true);

      try {
        const response = await getAnimeVideos(animeId);
        const videoId = findTrailerUrl(response);

        if (!cancelled) {
          setTrailers((previous) => ({
            ...previous,
            [animeId]: videoId || null,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Could not load anime trailer:", error);
          setTrailers((previous) => ({
            ...previous,
            [animeId]: null,
          }));
        }
      } finally {
        if (!cancelled) setTrailerLoading(false);
      }
    }

    loadTrailer();

    return () => {
      cancelled = true;
    };
  }, [hovered, animeId, trailers]);

  function changeSlide(direction) {
    if (!anime.length) return;

    setActiveIndex(
      (index) => (index + direction + anime.length) % anime.length
    );
  }

  const bannerImage = malId ? bannerImages[malId] : "";
  const image = bannerImage || fallbackImage;
  const trailerId = animeId ? trailers[animeId] : "";
  const showTrailer = hovered && Boolean(trailerId);

  const score = Number(current?.score ?? current?.mean ?? 0);

  const year =
    current?.year ??
    current?.season_year ??
    current?.aired?.prop?.from?.year ??
    (current?.aired?.from
      ? String(current.aired.from).slice(0, 4)
      : "");

  const synopsis =
    current?.synopsis ||
    current?.background ||
    "Discover your next favourite anime. Explore the story, meet the characters, and find your next world to get lost in.";

  return (
    <section
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Featured anime"
      className="relative isolate min-h-[440px] overflow-hidden bg-[#0b090e] sm:min-h-[500px] lg:min-h-[570px]"
    >
      <div className="absolute inset-0 -z-20 overflow-hidden bg-[#0b090e]">
        <AnimatePresence mode="wait">
          {!showTrailer && image && (
            <motion.img
              key={`image-${animeId ?? activeIndex}`}
              src={image}
              alt={title || "Featured anime"}
              fetchPriority="high"
              decoding="async"
              draggable={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 h-full w-full object-cover object-center sm:object-[center_30%]"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTrailer && (
            <motion.div
              key={`trailer-${animeId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              <iframe
                key={trailerId}
                src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1`}
                title={`${title} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#09080c] via-[#09080c]/85 to-[#09080c]/20 sm:via-[#09080c]/65" />

      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#09080c] via-[#09080c]/20 to-[#09080c]/20" />

      <div className="absolute inset-0 -z-10 bg-gradient-to-l from-transparent to-[#09080c]/15" />

      <div className="mx-auto flex min-h-[440px] max-w-[1440px] items-center px-5 pb-16 pt-10 sm:min-h-[500px] sm:px-8 sm:pb-20 lg:min-h-[570px] lg:px-12">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={animeId ?? activeIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl"
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-pink-300 backdrop-blur-md sm:text-xs">
                <span className="size-1.5 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.8)]" />
                {showTrailer ? "Now Playing Trailer" : "This Week on DARLING"}
              </div>

              <h1 className="max-w-2xl text-3xl font-black leading-[1.12] tracking-tight text-white [text-wrap:balance] sm:text-5xl lg:text-6xl">
                {title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-300 sm:text-sm">
                {current.type && <span>{current.type}</span>}

                {year && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span>{year}</span>
                  </>
                )}

                {current.episodes && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span>{current.episodes} episodes</span>
                  </>
                )}

                {score > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 font-semibold text-amber-300 backdrop-blur">
                    <Star size={13} fill="currentColor" />
                    {score.toFixed(1)}
                  </span>
                )}
              </div>

              <p className="mt-5 line-clamp-3 max-w-xl text-sm leading-7 text-zinc-300 sm:mt-6 sm:text-base">
                {synopsis}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => animeId && navigate(`/anime/${animeId}`)}
                  className="inline-flex h-11 items-center gap-2.5 rounded-xl bg-pink-500 px-5 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition duration-200 hover:-translate-y-0.5 hover:bg-pink-400 hover:shadow-pink-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
                >
                  <Play size={17} fill="currentColor" />
                  Explore Anime
                </button>

                <button
                  type="button"
                  onClick={() => animeId && navigate(`/anime/${animeId}`)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/[0.12]"
                >
                  <Info size={17} />
                  Details
                </button>
              </div>

              {hovered && !trailerId && (
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-400">
                  {trailerLoading ? (
                    <>
                      <span className="size-3 animate-spin rounded-full border-2 border-pink-400/30 border-t-pink-400" />
                      Loading trailer...
                    </>
                  ) : (
                    <>
                      <VolumeX size={14} />
                      Trailer unavailable for this anime
                    </>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="w-full max-w-xl">
              <div className="h-4 w-36 animate-pulse rounded bg-pink-500/20" />
              <div className="mt-5 h-12 w-4/5 animate-pulse rounded-lg bg-white/10" />
              <div className="mt-3 h-12 w-3/5 animate-pulse rounded-lg bg-white/[0.06]" />
              <div className="mt-6 h-4 w-full animate-pulse rounded bg-white/[0.06]" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-white/[0.06]" />

              {!loading && (
                <p className="mt-5 text-sm text-zinc-400">
                  Featured anime will appear here when available.
                </p>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {anime.length > 1 && (
        <div className="absolute bottom-6 left-5 right-5 flex items-center justify-between sm:bottom-8 sm:left-8 sm:right-8 lg:left-12 lg:right-12">
          <div className="flex items-center gap-1.5">
            {anime.slice(0, 8).map((item, index) => (
              <button
                key={item.mal_id ?? item.id ?? index}
                type="button"
                aria-label={`Show featured anime ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? "w-8 bg-pink-400"
                    : "w-3 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous featured anime"
              onClick={() => changeSlide(-1)}
              className="grid size-9 place-items-center rounded-xl border border-white/15 bg-black/20 text-white backdrop-blur transition hover:border-pink-400/50 hover:bg-pink-500/15"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              aria-label="Next featured anime"
              onClick={() => changeSlide(1)}
              className="grid size-9 place-items-center rounded-xl border border-white/15 bg-black/20 text-white backdrop-blur transition hover:border-pink-400/50 hover:bg-pink-500/15"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
