import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  LoaderCircle,
  Play,
  Search,
  TriangleAlert,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import {
  getAnimeDetails,
  getAnimeEpisodes,
  getAnimeImage,
  getAnimeTitle,
} from "../lib/tenrai";

const API_URL = "https://api.tenrai.org/v1";
const PLAYER_BASE = "https://ani.api-webs.com/simple/mal";
const EPISODES_PER_BATCH = 100;

function getEpisodeNumber(item) {
  const value = item?.episode ?? item?.number ?? item?.episode_number;

  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) return Number(match[0]);
  }

  return Number(item?.mal_id) || null;
}

function getEpisodeTitle(item, number) {
  const title =
    item?.title ||
    item?.title_english ||
    item?.name ||
    item?.title_japanese;

  return title && !/^episode\s*\d+$/i.test(title.trim())
    ? title
    : `Episode ${number}`;
}

function getTotalEpisodes(anime, pagination) {
  return Math.max(
    Number(pagination?.items?.total) || Number(pagination?.total) || 0,
    Number(anime?.episodes) || 0,
  );
}

function getAnimeId(item) {
  const id = item?.mal_id ?? item?.id;
  return id == null ? "" : String(id);
}

function getAnimePoster(item) {
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

function uniqueAnime(items, currentId) {
  const seen = new Set([String(currentId)]);

  return items.filter((item) => {
    const id = getAnimeId(item);
    if (!id || seen.has(id)) return false;

    seen.add(id);
    return true;
  });
}

function AnimeCard({ anime, relation }) {
  const id = getAnimeId(anime);
  const title =
    anime?.title_english ||
    anime?.title ||
    anime?.name ||
    anime?.title_japanese ||
    "Unknown anime";
  const image = getAnimePoster(anime);

  if (!id) return null;

  return (
    <Link
      to={`/anime/${id}`}
      className="group relative min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025] transition hover:border-pink-500/40 hover:bg-white/[0.05]"
    >
      {relation && (
        <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-md border border-pink-400/20 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-pink-300">
          {relation}
        </span>
      )}

      <div className="aspect-[3/4] overflow-hidden bg-white/[0.04]">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-zinc-500">
            No image available
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold text-zinc-200 transition group-hover:text-pink-300">
          {title}
        </h3>

        {anime?.type && (
          <p className="mt-1 text-xs text-zinc-500">{anime.type}</p>
        )}

        <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-pink-400">
          View details <ChevronRight size={13} />
        </p>
      </div>
    </Link>
  );
}

function AnimeSection({ title, description, items, showRelations = false }) {
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
          <AnimeCard
            key={`${getAnimeId(item)}-${item.relation || ""}`}
            anime={item}
            relation={showRelations ? item.relation : null}
          />
        ))}
      </div>
    </section>
  );
}

export default function Watch() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedEpisode = Math.max(
    1,
    Number(searchParams.get("episode")) || 1,
  );

  const [anime, setAnime] = useState(null);
  const [episode, setEpisode] = useState(requestedEpisode);
  const [batch, setBatch] = useState(
    Math.floor((requestedEpisode - 1) / EPISODES_PER_BATCH) + 1,
  );
  const [episodes, setEpisodes] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loadingAnime, setLoadingAnime] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [error, setError] = useState("");
  const [animeError, setAnimeError] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("sub");
  const [retryCount, setRetryCount] = useState(0);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [seasonAnime, setSeasonAnime] = useState([]);
  const [relatedAnime, setRelatedAnime] = useState([]);

  // Load anime details.
  useEffect(() => {
    const controller = new AbortController();

    async function loadAnime() {
      setLoadingAnime(true);
      setAnimeError("");
      setAnime(null);

      try {
        const result = await getAnimeDetails(id, controller.signal);

        if (!controller.signal.aborted) {
          setAnime(result?.data ?? result);
        }
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") {
          setAnimeError(err.message || "Unable to load anime details.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingAnime(false);
      }
    }

    if (!id || !/^\d+$/.test(id)) {
      setAnimeError("Invalid anime ID.");
      setLoadingAnime(false);
      setAnime(null);
    } else {
      loadAnime();
    }

    return () => controller.abort();
  }, [id]);

  // Load episode list.
  useEffect(() => {
    const controller = new AbortController();

    async function loadEpisodes() {
      setLoadingEpisodes(true);
      setError("");
      setEpisodes([]);
      setPagination({});

      try {
        const result = await getAnimeEpisodes(
          id,
          batch,
          controller.signal,
        );

        const list = Array.isArray(result?.episodes) ? result.episodes : [];
        const sorted = [...list].sort(
          (a, b) =>
            (getEpisodeNumber(a) ?? 0) - (getEpisodeNumber(b) ?? 0),
        );

        if (controller.signal.aborted) return;

        setEpisodes(sorted);
        setPagination(result?.pagination ?? {});

        if (!sorted.length) {
          setError(
            "The API returned no episodes for this batch. Try another batch or check the API response.",
          );
        }
      } catch (err) {
        if (!controller.signal.aborted && err.name !== "AbortError") {
          setError(err.message || "Unable to load the episode list.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingEpisodes(false);
      }
    }

    if (id && /^\d+$/.test(id)) {
      loadEpisodes();
    } else {
      setLoadingEpisodes(false);
    }

    return () => controller.abort();
  }, [id, batch, retryCount]);

  // Sync the selected episode with the URL.
  useEffect(() => {
    setEpisode(requestedEpisode);
    setBatch(Math.floor((requestedEpisode - 1) / EPISODES_PER_BATCH) + 1);
  }, [id, requestedEpisode]);

  // Save viewing activity for the signed-in user.
  useEffect(() => {
    let active = true;

    async function saveWatchHistory() {
      if (!id || !/^\d+$/.test(id)) return;

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user || !active) return;

        const animeId = Number(id);

        const { data: existing, error: lookupError } = await supabase
          .from("watch_history")
          .select("user_id, mal_id")
          .eq("user_id", user.id)
          .eq("mal_id", animeId)
          .maybeSingle();

        if (lookupError) throw lookupError;
        if (!active) return;

        if (!existing) {
          const { error: insertError } = await supabase
            .from("watch_history")
            .insert({
              user_id: user.id,
              mal_id: animeId,
            });

          if (insertError) throw insertError;
        }

        // Update these optional fields if the table supports them.
        // The basic history record remains valid without these columns.
        if (active) {
          const { error: updateError } = await supabase
            .from("watch_history")
            .update({
              episode,
              watched_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .eq("mal_id", animeId);

          if (
            updateError &&
            !/column .* does not exist|schema cache/i.test(updateError.message)
          ) {
            throw updateError;
          }
        }
      } catch (err) {
        if (active) {
          console.error("Failed to save watch history:", err);
        }
      }
    }

    saveWatchHistory();

    return () => {
      active = false;
    };
  }, [id, episode]);

  // Load seasons and recommendations separately.
  useEffect(() => {
    const controller = new AbortController();

    async function loadAnimeSuggestions() {
      setSeasonAnime([]);
      setRelatedAnime([]);

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
          .filter((item) => getAnimeId(item));

        const relations = getRelationEntries(relationsData).filter((item) => {
          const relation = String(item.relation || "").toLowerCase();
          const type = String(item.type || item.media_type || "").toLowerCase();

          const isStoryRelation =
            relation.includes("prequel") ||
            relation.includes("sequel") ||
            relation.includes("parent story") ||
            relation.includes("side story");

          const isAnimeFormat =
            !type ||
            ["tv", "movie", "ova", "ona", "special"].some((format) =>
              type.includes(format),
            );

          return isStoryRelation && isAnimeFormat && getAnimeId(item);
        });

        setSeasonAnime(uniqueAnime(relations, id).slice(0, 12));
        setRelatedAnime(uniqueAnime(recommendations, id).slice(0, 12));
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load anime suggestions:", err);
        }
      }
    }

    loadAnimeSuggestions();
    return () => controller.abort();
  }, [id]);

  const totalEpisodes = getTotalEpisodes(anime, pagination);

  const totalBatches = Math.max(
    1,
    Math.ceil(totalEpisodes / EPISODES_PER_BATCH),
    Number(pagination?.last_visible_page) || 1,
  );

  const batchStart = (batch - 1) * EPISODES_PER_BATCH + 1;

  const filteredEpisodes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return episodes.filter((item) => {
      const number = getEpisodeNumber(item);
      const title = getEpisodeTitle(item, number ?? "?");

      return (
        !query ||
        String(number ?? "").includes(query) ||
        title.toLowerCase().includes(query)
      );
    });
  }, [episodes, search]);

  const selectedEpisode = episodes.find(
    (item) => getEpisodeNumber(item) === episode,
  );

  const selectedTitle = selectedEpisode
    ? getEpisodeTitle(selectedEpisode, episode)
    : `Episode ${episode}`;

  const playerUrl = `${PLAYER_BASE}/${encodeURIComponent(id)}/${episode}/${language}`;

  const changeEpisode = useCallback(
    (nextEpisode) => {
      const next = Number(nextEpisode);
      if (!Number.isFinite(next) || next < 1) return;

      setEpisode(next);
      setBatch(Math.floor((next - 1) / EPISODES_PER_BATCH) + 1);
      setPlayerLoading(true);

      setSearchParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          updated.set("episode", String(next));
          return updated;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  function changeBatch(value) {
    const nextBatch = Number(value);
    if (!Number.isFinite(nextBatch) || nextBatch < 1) return;

    setBatch(nextBatch);
    setSearch("");
  }

  if (loadingAnime && !anime) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="flex items-center gap-3 text-zinc-300">
          <LoaderCircle className="h-6 w-6 animate-spin text-pink-500" />
          Loading anime...
        </div>
      </main>
    );
  }

  const title = getAnimeTitle(anime);
  const image = getAnimeImage(anime);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Link
          to={`/anime/${id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-pink-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to anime details
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {image && (
              <img
                src={image}
                alt={title}
                className="h-20 w-14 shrink-0 rounded-lg object-cover shadow-lg shadow-black/40"
              />
            )}

            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-pink-500">
                Now watching
              </p>
              <h1 className="truncate text-2xl font-bold sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 truncate text-sm text-zinc-400">
                Episode {episode}: {selectedTitle}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => changeEpisode(episode - 1)}
              disabled={episode <= 1}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm transition hover:border-pink-500/50 hover:bg-pink-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              onClick={() => changeEpisode(episode + 1)}
              className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-pink-500"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {animeError && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {animeError}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40">
              {playerLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black">
                  <LoaderCircle className="h-8 w-8 animate-spin text-pink-500" />
                  <p className="text-sm text-zinc-400">
                    Loading episode {episode}...
                  </p>
                </div>
              )}

              <iframe
                key={`${id}-${episode}-${language}`}
                src={playerUrl}
                title={`${title} Episode ${episode}`}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="origin"
                onLoad={() => setPlayerLoading(false)}
              />
            </div>

            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-400">
                  Episode {episode}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{selectedTitle}</h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-zinc-500">Audio</span>

                {["sub", "dub"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setLanguage(mode);
                      setPlayerLoading(true);
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      language === mode
                        ? "bg-pink-600 text-white"
                        : "border border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {mode === "sub" ? "Sub" : "Dub"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-pink-500" />
                <h2 className="text-lg font-semibold">About this anime</h2>
              </div>
              <p className="whitespace-pre-line text-sm leading-7 text-zinc-400">
                {anime?.synopsis || "No synopsis is available for this anime."}
              </p>
            </div>
          </section>

          <aside className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101010]">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Episodes</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {totalEpisodes
                      ? `${totalEpisodes} episodes listed by the API`
                      : "Episodes fetched from Tenrai"}
                  </p>
                </div>

                <span className="rounded-lg bg-pink-500/10 px-3 py-1.5 text-sm font-semibold text-pink-400">
                  EP {episode}
                </span>
              </div>

              <label className="relative mt-5 block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search episode number or title..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-500/60"
                />
              </label>

              <label className="mt-3 block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Select episode batch
                </span>

                <div className="relative">
                  <select
                    value={batch}
                    onChange={(event) => changeBatch(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-[#191919] px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-pink-500/60"
                  >
                    {Array.from(
                      { length: totalBatches },
                      (_, index) => index + 1,
                    ).map((batchNumber) => {
                      const start =
                        (batchNumber - 1) * EPISODES_PER_BATCH + 1;
                      const end = totalEpisodes
                        ? Math.min(
                            batchNumber * EPISODES_PER_BATCH,
                            totalEpisodes,
                          )
                        : batchNumber * EPISODES_PER_BATCH;

                      return (
                        <option key={batchNumber} value={batchNumber}>
                          {start}–{end}
                        </option>
                      );
                    })}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </label>
            </div>

            <div className="max-h-[620px] min-h-52 overflow-y-auto">
              {loadingEpisodes ? (
                <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
                  <LoaderCircle className="h-7 w-7 animate-spin text-pink-500" />
                  <p className="text-sm text-zinc-400">
                    Fetching episode titles...
                  </p>
                  <p className="text-xs text-zinc-600">
                    Batch {batch}: {batchStart}–
                    {batch * EPISODES_PER_BATCH}
                  </p>
                </div>
              ) : error ? (
                <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
                  <TriangleAlert className="h-7 w-7 text-amber-400" />
                  <p className="text-sm leading-6 text-zinc-400">{error}</p>
                  <button
                    type="button"
                    onClick={() => setRetryCount((value) => value + 1)}
                    className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold transition hover:bg-pink-500"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredEpisodes.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-zinc-400">
                    No matching episodes in this batch.
                  </p>
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="mt-3 text-sm text-pink-400 hover:text-pink-300"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredEpisodes.map((item, index) => {
                    const number = getEpisodeNumber(item);
                    const itemTitle = getEpisodeTitle(
                      item,
                      number ?? index + batchStart,
                    );
                    const isActive = number === episode;

                    return (
                      <button
                        key={`${number ?? index}-${item?.mal_id ?? ""}`}
                        type="button"
                        onClick={() =>
                          changeEpisode(number ?? index + batchStart)
                        }
                        className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                          isActive
                            ? "border border-pink-500/30 bg-pink-500/10"
                            : "border border-transparent hover:bg-white/[0.05]"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                            isActive
                              ? "bg-pink-600 text-white"
                              : "bg-white/[0.06] text-zinc-400 group-hover:text-white"
                          }`}
                        >
                          {number ?? "?"}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-xs font-medium ${
                              isActive ? "text-pink-400" : "text-zinc-500"
                            }`}
                          >
                            Episode {number ?? "?"}
                          </span>
                          <span
                            className={`mt-1 block line-clamp-2 text-sm leading-5 ${
                              isActive
                                ? "font-semibold text-white"
                                : "text-zinc-300"
                            }`}
                          >
                            {itemTitle}
                          </span>
                        </span>

                        <Play
                          className={`h-4 w-4 shrink-0 ${
                            isActive
                              ? "fill-pink-500 text-pink-500"
                              : "text-zinc-600 group-hover:text-pink-400"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => changeBatch(batch - 1)}
                disabled={batch <= 1}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous batch
              </button>

              <span className="text-xs text-zinc-500">
                Batch {batch} / {totalBatches}
              </span>

              <button
                type="button"
                onClick={() => changeBatch(batch + 1)}
                disabled={batch >= totalBatches}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next batch
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>

        <div className="mt-14 space-y-12">
          <AnimeSection
            title="Seasons"
            description="Continue the story with prequels, sequels, and connected entries."
            items={seasonAnime}
            showRelations
          />

          <AnimeSection
            title="Related Anime"
            description="Discover more anime you might enjoy."
            items={relatedAnime}
          />
        </div>
      </div>
    </main>
  );
}