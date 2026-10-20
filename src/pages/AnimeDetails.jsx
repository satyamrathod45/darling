import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Star,
  CalendarDays,
  Clock3,
  Tv,
  Heart,
  ExternalLink,
  Globe,
  LoaderCircle,
  Bookmark,
  ChevronRight,
} from "lucide-react";

import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import AnimeTrailer from "../components/anime/AnimeTrailer";
import {
  getAnimeDetails,
  getAnimeVideos,
  getAnimeImage,
  getAnimeTitle,
} from "../lib/tenrai";

const API_URL = "https://api.tenrai.org/v1";

function InfoItem({ icon: Icon, label, value }) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon size={17} className="mt-0.5 shrink-0 text-pink-400" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-zinc-200">
          {Array.isArray(value) ? value.join(", ") : value}
        </p>
      </div>
    </div>
  );
}

function getTrailer(videos) {
  if (videos?.trailer?.embed_url || videos?.trailer?.youtube_id) {
    return videos.trailer;
  }

  return (
    videos?.promo?.find(
      (item) =>
        item?.trailer?.embed_url ||
        item?.trailer?.youtube_id ||
        item?.trailer?.video_id,
    )?.trailer ?? null
  );
}

function getEntryId(item) {
  const id = item?.mal_id ?? item?.id;
  return id == null ? "" : String(id);
}

function getRelationEntries(response) {
  const groups = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : [];

  return groups.flatMap((group) =>
    (Array.isArray(group?.entry) ? group.entry : []).map((entry) => ({
      ...entry,
      relation: group?.relation || "Related",
    })),
  );
}

function getUniqueAnime(items, currentId) {
  const seen = new Set([String(currentId)]);

  return items.filter((item) => {
    const id = getEntryId(item);

    if (!id || seen.has(id)) return false;

    seen.add(id);
    return true;
  });
}

function getAnimeImageUrl(item) {
  return (
    getAnimeImage(item) ||
    item?.images?.webp?.large_image_url ||
    item?.images?.webp?.image_url ||
    item?.images?.jpg?.large_image_url ||
    item?.images?.jpg?.image_url ||
    item?.image_url ||
    ""
  );
}

function RelatedAnimeCard({ item }) {
  const animeId = getEntryId(item);
  const title =
    item?.title_english ||
    item?.title ||
    item?.name ||
    item?.title_japanese ||
    "Unknown anime";
  const image = getAnimeImageUrl(item);

  if (!animeId) return null;

  return (
    <Link
      to={`/anime/${animeId}`}
      className="group min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025] transition hover:border-pink-500/40 hover:bg-white/[0.045]"
    >
      <div className="aspect-[3/4] overflow-hidden bg-white/[0.04]">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-zinc-500">
            No image available
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold text-zinc-200 transition group-hover:text-pink-300">
          {title}
        </h3>

        {item?.type && (
          <p className="mt-1 text-xs text-zinc-500">{item.type}</p>
        )}

        <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-pink-400">
          View details <ChevronRight size={13} />
        </p>
      </div>
    </Link>
  );
}

function AnimeCollection({ title, description, items, showRelation = false }) {
  if (!items.length) return null;

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-pink-500" />
            <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          </div>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>

        <span className="shrink-0 text-xs text-zinc-500">
          {items.length} titles
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <div
            key={`${getEntryId(item)}-${item.relation || ""}`}
            className="relative min-w-0"
          >
            {showRelation && (
              <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-md border border-pink-400/20 bg-black/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-pink-300 backdrop-blur">
                {item.relation}
              </span>
            )}
            <RelatedAnimeCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AnimeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [anime, setAnime] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trailerLoading, setTrailerLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFavourite, setIsFavourite] = useState(false);
  const [favouriteLoading, setFavouriteLoading] = useState(true);
  const [favouriteSaving, setFavouriteSaving] = useState(false);
  const [relatedAnime, setRelatedAnime] = useState([]);
  const [seasonAnime, setSeasonAnime] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAnime() {
      setLoading(true);
      setTrailerLoading(true);
      setError("");
      setAnime(null);
      setTrailer(null);

      if (!id || !/^\d+$/.test(id)) {
        setError("This anime URL is invalid.");
        setLoading(false);
        setTrailerLoading(false);
        return;
      }

      const detailsTask = getAnimeDetails(id, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setAnime(data);
        })
        .catch((err) => {
          if (!controller.signal.aborted && err.name !== "AbortError") {
            setError(err.message || "Unable to load anime details.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });

      const trailerTask = getAnimeVideos(id, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setTrailer(getTrailer(data));
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setTrailerLoading(false);
        });

      await Promise.allSettled([detailsTask, trailerTask]);
    }

    loadAnime();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRelatedAnime() {
      setRelatedAnime([]);
      setSeasonAnime([]);

      if (!id || !/^\d+$/.test(id)) return;

      try {
        const [recommendationsResponse, relationsResponse] = await Promise.all([
          fetch(`${API_URL}/anime/${id}/recommendations`, {
            signal: controller.signal,
          }),
          fetch(`${API_URL}/anime/${id}/relations`, {
            signal: controller.signal,
          }),
        ]);

        const [recommendationsData, relationsData] = await Promise.all([
          recommendationsResponse.ok
            ? recommendationsResponse.json()
            : null,
          relationsResponse.ok ? relationsResponse.json() : null,
        ]);

        if (controller.signal.aborted) return;

        const recommendations = (recommendationsData?.data ?? [])
          .map((item) => item?.entry ?? item?.anime ?? item)
          .filter((item) => getEntryId(item));

        const relations = getRelationEntries(relationsData).filter((item) => {
          const relation = String(item.relation || "").toLowerCase();
          const type = String(item.type || item.media_type || "").toLowerCase();

          const isStoryConnection =
            relation.includes("prequel") ||
            relation.includes("sequel") ||
            relation.includes("parent story") ||
            relation.includes("side story");

          const isAnimeFormat =
            !type ||
            ["tv", "movie", "ova", "ona", "special"].some((format) =>
              type.includes(format),
            );

          return isStoryConnection && isAnimeFormat && getEntryId(item);
        });

        setRelatedAnime(getUniqueAnime(recommendations, id).slice(0, 12));
        setSeasonAnime(getUniqueAnime(relations, id).slice(0, 12));
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load related anime:", err);
        }
      }
    }

    loadRelatedAnime();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    let active = true;

    async function checkFavourite() {
      setFavouriteLoading(true);
      setIsFavourite(false);

      if (!anime) {
        setFavouriteLoading(false);
        return;
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) return;

        const { data, error: favouriteError } = await supabase
          .from("favourites")
          .select("mal_id")
          .eq("user_id", user.id)
          .eq("mal_id", anime.mal_id ?? anime.id)
          .maybeSingle();

        if (favouriteError) throw favouriteError;
        if (active) setIsFavourite(Boolean(data));
      } catch (err) {
        console.error("Failed to check favourite status:", err);
      } finally {
        if (active) setFavouriteLoading(false);
      }
    }

    checkFavourite();

    return () => {
      active = false;
    };
  }, [anime]);

  async function toggleFavourite() {
    if (!anime || favouriteSaving) return;

    setFavouriteSaving(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        navigate("/login", { state: { from: `/anime/${id}` } });
        return;
      }

      const animeId = anime.mal_id ?? anime.id;
      const request = isFavourite
        ? supabase
            .from("favourites")
            .delete()
            .eq("user_id", user.id)
            .eq("mal_id", animeId)
        : supabase
            .from("favourites")
            .insert({ user_id: user.id, mal_id: animeId });

      const { error: favouriteError } = await request;
      if (favouriteError) throw favouriteError;

      setIsFavourite(!isFavourite);
    } catch (err) {
      console.error("Failed to update favourite:", err);
      setError(err.message || "Couldn't update your favourites. Please try again.");
    } finally {
      setFavouriteSaving(false);
    }
  }

  async function watchAnime() {
    if (!anime) return;

    const animeId = anime.mal_id ?? anime.id;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (user) {
        const { error: historyError } = await supabase
          .from("watch_history")
          .upsert(
            {
              user_id: user.id,
              mal_id: animeId,
            },
            { onConflict: "user_id,mal_id" },
          );

        if (historyError) throw historyError;
      }
    } catch (err) {
      console.error("Failed to update watch history:", err);
    }

    navigate(`/watch/${animeId}?episode=1`);
  }

  const title = anime ? getAnimeTitle(anime) : "";
  const image = anime ? getAnimeImage(anime) : "";
  const backgroundImage =
    anime?.images?.webp?.large_image_url ||
    anime?.images?.jpg?.large_image_url ||
    image;

  const genres = anime?.genres ?? [];
  const studios = anime?.studios ?? [];
  const producers = anime?.producers ?? [];
  const themes = anime?.themes ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09080c] text-white">
        <Navbar />
        <div className="mx-auto max-w-[1440px] animate-pulse px-5 py-10 sm:px-8 lg:px-12">
          <div className="h-[320px] rounded-3xl bg-white/[0.04] sm:h-[440px]" />
          <div className="mt-8 h-8 w-2/3 rounded-lg bg-white/[0.06]" />
          <div className="mt-4 h-4 w-1/3 rounded bg-white/[0.04]" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="aspect-video rounded-2xl bg-white/[0.04]" />
            <div className="h-64 rounded-2xl bg-white/[0.04]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="min-h-screen bg-[#09080c] text-white">
        <Navbar />
        <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-5 text-center">
          <div className="grid size-16 place-items-center rounded-2xl border border-pink-500/20 bg-pink-500/[0.08] text-pink-300">
            <Tv size={28} />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Anime unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {error || "We couldn't find this anime."}
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-400"
          >
            <ArrowLeft size={16} />
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#09080c] text-white">
      <Navbar />

      <main>
        <section className="relative isolate min-h-[520px] overflow-hidden sm:min-h-[580px] lg:min-h-[650px]">
          {backgroundImage && (
            <img
              src={backgroundImage}
              alt=""
              fetchPriority="high"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
            />
          )}

          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#09080c] via-[#09080c]/85 to-[#09080c]/35" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#09080c] via-[#09080c]/30 to-[#09080c]/30" />
          <div className="absolute inset-0 -z-10 bg-[#09080c]/15" />

          <div className="mx-auto flex min-h-[520px] max-w-[1440px] items-end px-5 pb-12 pt-10 sm:min-h-[580px] sm:px-8 sm:pb-16 lg:min-h-[650px] lg:px-12">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="w-full"
            >
              <Link
                to="/home"
                className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-300 transition hover:text-pink-300"
              >
                <ArrowLeft size={16} />
                Back to Home
              </Link>

              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:gap-8">
                {image && (
                  <img
                    src={image}
                    alt={title}
                    className="hidden aspect-[3/4] w-40 shrink-0 rounded-2xl object-cover shadow-2xl shadow-black/50 ring-1 ring-white/15 sm:block lg:w-48"
                  />
                )}

                <div className="max-w-3xl">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {anime.type && (
                      <span className="rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold text-zinc-200 backdrop-blur">
                        {anime.type}
                      </span>
                    )}
                    {anime.status && (
                      <span className="rounded-lg border border-pink-400/20 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-300">
                        {anime.status}
                      </span>
                    )}
                  </div>

                  <h1 className="text-3xl font-black leading-tight tracking-tight [text-wrap:balance] sm:text-5xl lg:text-6xl">
                    {title}
                  </h1>

                  {anime.title_japanese && (
                    <p className="mt-2 text-sm text-zinc-400 sm:text-base">
                      {anime.title_japanese}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-zinc-300">
                    {anime.score != null && (
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
                        <Star size={16} fill="currentColor" />
                        {anime.score}
                        <span className="font-normal text-zinc-500">/ 10</span>
                      </span>
                    )}
                    {anime.year && <span>{anime.year}</span>}
                    {anime.episodes && <span>{anime.episodes} episodes</span>}
                    {anime.duration && <span>{anime.duration}</span>}
                    {anime.rating && (
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
                        {anime.rating}
                      </span>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={watchAnime}
                      className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-pink-500 px-6 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 hover:bg-pink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
                    >
                      <Play size={18} fill="currentColor" />
                      Watch Now
                    </button>

                    <button
                      type="button"
                      onClick={toggleFavourite}
                      disabled={favouriteLoading || favouriteSaving}
                      aria-pressed={isFavourite}
                      className={`inline-flex h-12 items-center gap-2 rounded-xl border px-5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                        isFavourite
                          ? "border-pink-500/50 bg-pink-500/15 text-pink-300 hover:bg-pink-500/20"
                          : "border-white/15 bg-black/25 text-white backdrop-blur hover:border-pink-500/40 hover:text-pink-300"
                      }`}
                    >
                      <Heart
                        size={17}
                        fill={isFavourite ? "currentColor" : "none"}
                      />
                      {favouriteLoading
                        ? "Checking..."
                        : favouriteSaving
                          ? "Saving..."
                          : isFavourite
                            ? "Remove Favourite"
                            : "Add to Favourite"}
                    </button>

                    {trailer && (
                      <button
                        type="button"
                        onClick={() =>
                          document
                            .getElementById("anime-trailer")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            })
                        }
                        className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                      >
                        <Play size={17} />
                        Watch Trailer
                      </button>
                    )}

                    <a
                      href={anime.url || `https://myanimelist.net/anime/${id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-semibold text-zinc-300 backdrop-blur transition hover:text-white"
                    >
                      <ExternalLink size={16} />
                      MAL
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)] lg:gap-12">
            <div className="min-w-0">
              <section className="pt-8 sm:pt-10">
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-6 w-1 rounded-full bg-pink-500" />
                  <h2 className="text-xl font-bold sm:text-2xl">Synopsis</h2>
                </div>

                <p className="whitespace-pre-line text-sm leading-7 text-zinc-400 sm:text-base sm:leading-8">
                  {anime.synopsis || "No synopsis is available for this anime yet."}
                </p>

                {genres.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {genres.map((genre) => (
                      <span
                        key={genre.mal_id ?? genre.name}
                        className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-pink-500/30 hover:text-pink-300"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section id="anime-trailer" className="scroll-mt-28 pt-10 sm:pt-12">
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-6 w-1 rounded-full bg-pink-500" />
                  <div>
                    <h2 className="text-xl font-bold sm:text-2xl">
                      Official Trailer
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Get a preview of the story.
                    </p>
                  </div>
                </div>

                {trailerLoading ? (
                  <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                    <LoaderCircle
                      size={24}
                      className="animate-spin text-pink-400"
                    />
                  </div>
                ) : (
                  <AnimeTrailer trailer={trailer} title={title} />
                )}
              </section>
            </div>

            <aside className="min-w-0 pt-8 sm:pt-10">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
                <h2 className="text-lg font-bold">Anime Information</h2>

                <div className="mt-6 grid gap-5">
                  <InfoItem
                    icon={CalendarDays}
                    label="Aired"
                    value={anime.aired?.string || anime.year}
                  />
                  <InfoItem
                    icon={Tv}
                    label="Episodes"
                    value={
                      anime.episodes != null
                        ? `${anime.episodes} episodes`
                        : "Unknown"
                    }
                  />
                  <InfoItem
                    icon={Clock3}
                    label="Duration"
                    value={anime.duration}
                  />
                  <InfoItem icon={Globe} label="Source" value={anime.source} />
                  <InfoItem
                    icon={Star}
                    label="Rank"
                    value={anime.rank ? `#${anime.rank}` : null}
                  />
                  <InfoItem
                    icon={Heart}
                    label="Popularity"
                    value={anime.popularity ? `#${anime.popularity}` : null}
                  />
                  <InfoItem
                    icon={Tv}
                    label="Studios"
                    value={studios.map((studio) => studio.name)}
                  />
                  <InfoItem
                    icon={Bookmark}
                    label="Producers"
                    value={producers.map((producer) => producer.name)}
                  />
                  <InfoItem
                    icon={Globe}
                    label="Themes"
                    value={themes.map((theme) => theme.name)}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-pink-500/15 bg-gradient-to-br from-pink-500/[0.10] to-transparent p-5">
                <h3 className="font-bold text-white">Ready to start watching?</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Jump into {title} and start with episode one.
                </p>
                <button
                  type="button"
                  onClick={watchAnime}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-4 text-sm font-bold text-white transition hover:bg-pink-400"
                >
                  <Play size={16} fill="currentColor" />
                  Watch Now
                </button>
              </div>
            </aside>
          </div>

          <div className="mt-12 space-y-12">
            <AnimeCollection
              title="Seasons"
              description="Explore prequels, sequels, and connected story entries."
              items={seasonAnime}
              showRelation
            />
            <AnimeCollection
              title="Related Anime"
              description="More anime you might enjoy."
              items={relatedAnime}
            />
          </div>
        </div>
      </main>
    </div>
  );
}