
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  ArrowLeft,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Star,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  getAnimeImage,
  getAnimeTitle,
} from "../lib/tenrai";

const API = "https://api.tenrai.org/v1";
const PAGE_SIZE = 24;

const TYPES = [
  { value: "", label: "All types" },
  { value: "tv", label: "TV" },
  { value: "movie", label: "Movie" },
  { value: "ova", label: "OVA" },
  { value: "special", label: "Special" },
  { value: "ona", label: "ONA" },
];

const STATUSES = [
  { value: "", label: "Any status" },
  { value: "airing", label: "Currently airing" },
  { value: "complete", label: "Completed" },
  { value: "upcoming", label: "Upcoming" },
];

const SORTS = [
  { value: "popularity", label: "Most popular" },
  { value: "score", label: "Highest rated" },
  { value: "members", label: "Most members" },
  { value: "start_date", label: "Newest first" },
  { value: "title", label: "Title A–Z" },
];

function extractList(json) {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json)) return json;
  return [];
}

async function apiRequest(url, signal) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Too many requests. Please wait a moment and try again."
        : `Anime API request failed (${response.status}).`
    );
  }

  return response.json();
}

function getPageCount(json) {
  const pagination = json?.pagination ?? json?.data?.pagination ?? {};
  const total =
    Number(pagination?.items?.total) ||
    Number(pagination?.total) ||
    0;

  const lastPage =
    Number(pagination?.last_visible_page) ||
    Number(pagination?.last_page) ||
    0;

  return {
    total,
    lastPage,
    hasNext: Boolean(pagination?.has_next_page),
  };
}

function getAnimeId(anime) {
  return anime?.mal_id ?? anime?.id;
}

function getScore(anime) {
  const score = Number(anime?.score);
  return Number.isFinite(score) && score > 0 ? score.toFixed(1) : "N/A";
}

function getYear(anime) {
  const date = anime?.year
    ? String(anime.year)
    : anime?.season_year
      ? String(anime.season_year)
      : anime?.aired?.from
        ? String(anime.aired.from).slice(0, 4)
        : anime?.start_date
          ? String(anime.start_date).slice(0, 4)
          : "";

  return date;
}

function getType(anime) {
  return anime?.type || "Anime";
}

function getDescription(mode, query) {
  if (mode === "trending") {
    return "The anime everyone is watching right now.";
  }

  if (mode === "top-rated") {
    return "Explore the highest-rated anime in the catalogue.";
  }

  if (mode === "popular") {
    return "Fan favourites, legendary series, and popular picks.";
  }

  if (query) {
    return `Search results for "${query}". Refine your results with filters.`;
  }

  return "Discover your next favourite anime. Search, filter, and explore.";
}

function getNumberedPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = [1];
  if (current > 3) pages.push("...");

  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page++) {
    pages.push(page);
  }

  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default function AnimeCatalog() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const path = location.pathname;
  const mode = path === "/trending"
    ? "trending"
    : path === "/top-rated"
      ? "top-rated"
      : path === "/popular"
        ? "popular"
        : "search";

  const query = searchParams.get("q") || "";

  const [items, setItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genreLoading, setGenreLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(
    Math.max(1, Number(searchParams.get("page")) || 1)
  );
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [filters, setFilters] = useState({
    genre: searchParams.get("genre") || "",
    type: searchParams.get("type") || "",
    status: searchParams.get("status") || "",
    year: searchParams.get("year") || "",
    minScore: searchParams.get("min_score") || "",
    sort: searchParams.get("sort") || (
      mode === "top-rated" ? "score" : "popularity"
    ),
  });

  useEffect(() => {
    setSearchInput(query);
    setPage(Math.max(1, Number(searchParams.get("page")) || 1));
  }, [query, searchParams]);

  useEffect(() => {
    const cleaned = searchInput.trim();

    if (cleaned.length < 2 || cleaned === query.trim()) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);

      try {
        const params = new URLSearchParams({ q: cleaned, limit: "6", sfw: "" });
        const json = await apiRequest(`${API}/anime?${params.toString()}`, controller.signal);
        const results = extractList(json);
        if (!controller.signal.aborted) {
          setSuggestions(results.slice(0, 6));
          setShowSuggestions(true);
        }
      } catch (err) {
        if (err.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchInput, query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGenres() {
      setGenreLoading(true);

      try {
        const json = await apiRequest(`${API}/genres/anime`, controller.signal);
        if (!controller.signal.aborted) {
          setGenres(extractList(json));
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Could not load anime genres:", err);
        }
      } finally {
        if (!controller.signal.aborted) setGenreLoading(false);
      }
    }

    loadGenres();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAnime() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          sfw: "",
        });

        let endpoint;

        if (mode === "trending" && !hasActiveFilters(filters)) {
          endpoint = `${API}/top/anime?filter=airing&limit=${PAGE_SIZE}&page=${page}&sfw`;
        } else if (mode === "popular" && !hasActiveFilters(filters)) {
          endpoint = `${API}/top/anime?filter=bypopularity&limit=${PAGE_SIZE}&page=${page}&sfw`;
        } else if (mode === "top-rated" && !hasActiveFilters(filters)) {
          endpoint = `${API}/top/anime?limit=${PAGE_SIZE}&page=${page}&sfw`;
        } else {
          const apiParams = new URLSearchParams({
            page: String(page),
            limit: String(PAGE_SIZE),
            order_by: filters.sort || "popularity",
            sort: filters.sort === "title" ? "asc" : "desc",
            sfw: "",
          });

          if (query.trim()) apiParams.set("q", query.trim());
          if (filters.genre) apiParams.set("genres", filters.genre);
          if (filters.type) apiParams.set("type", filters.type);
          if (filters.status) apiParams.set("status", filters.status);
          if (filters.minScore) apiParams.set("min_score", filters.minScore);

          if (filters.year) {
            apiParams.set("start_date", `${filters.year}-01-01`);
            apiParams.set("end_date", `${filters.year}-12-31`);
          }

          endpoint = `${API}/anime?${apiParams.toString()}`;
        }

        const json = await apiRequest(endpoint, controller.signal);
        const list = extractList(json);
        const pageInfo = getPageCount(json);

        if (!controller.signal.aborted) {
          setItems(list);
          setTotal(pageInfo.total);
          setLastPage(
            pageInfo.lastPage ||
            (pageInfo.total
              ? Math.ceil(pageInfo.total / PAGE_SIZE)
              : pageInfo.hasNext
                ? page + 1
                : page)
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Could not load anime.");
          setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAnime();
    return () => controller.abort();
  }, [mode, query, page, filters]);

  function hasActiveFilters(value) {
    return Boolean(
      value.genre ||
      value.type ||
      value.status ||
      value.year ||
      value.minScore ||
      (value.sort && value.sort !== (
        mode === "top-rated" ? "score" : "popularity"
      ))
    );
  }

  const heading = mode === "trending"
    ? "Trending Anime"
    : mode === "top-rated"
      ? "Top Rated Anime"
      : mode === "popular"
        ? "Popular Anime"
        : query
          ? "Search Results"
          : "Discover Anime";

  const description = getDescription(mode, query);
  const maxPage = Math.max(1, lastPage);

  const activeFilterCount = useMemo(
    () => [
      filters.genre,
      filters.type,
      filters.status,
      filters.year,
      filters.minScore,
    ].filter(Boolean).length,
    [filters]
  );

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("page");
      if (value) next.set(key === "minScore" ? "min_score" : key, value);
      else next.delete(key === "minScore" ? "min_score" : key);
      return next;
    });
  }

  function resetFilters() {
    setFilters({
      genre: "",
      type: "",
      status: "",
      year: "",
      minScore: "",
      sort: mode === "top-rated" ? "score" : "popularity",
    });
    setPage(1);
    setSearchParams(query ? { q: query } : {});
  }

  function submitSearch(event) {
    event.preventDefault();

    const next = new URLSearchParams(searchParams);
    const cleaned = searchInput.trim();

    if (cleaned) next.set("q", cleaned);
    else next.delete("q");

    next.delete("page");
    setPage(1);
    setSearchParams(next);
  }

  function changePage(nextPage) {
    const safePage = Math.min(maxPage, Math.max(1, nextPage));
    setPage(safePage);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (safePage > 1) next.set("page", String(safePage));
      else next.delete("page");
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 pb-16 pt-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8">
          <Link
            to="/home"
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-pink-500/50 hover:text-pink-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-pink-500">
            <span className="h-2 w-2 rounded-full bg-pink-500" />
            DARLING DISCOVERY
          </div>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                {heading}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {description}
              </p>
            </div>

            <form onSubmit={submitSearch} className="flex w-full gap-2 lg:max-w-md">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={searchInput}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="Search anime titles..."
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-zinc-600 focus:border-pink-500/60"
                />

                {showSuggestions && searchInput.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl shadow-black/60">
                    {suggestionsLoading ? (
                      <div className="flex items-center gap-2 px-4 py-4 text-sm text-zinc-400">
                        <LoaderCircle className="h-4 w-4 animate-spin text-pink-500" />
                        Searching anime...
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((anime) => {
                        const id = getAnimeId(anime);
                        const title = getAnimeTitle(anime) || "Untitled Anime";
                        const image = getAnimeImage(anime);

                        return (
                          <Link
                            key={id}
                            to={`/anime/${id}`}
                            onMouseDown={() => setShowSuggestions(false)}
                            className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 transition last:border-0 hover:bg-pink-500/10"
                          >
                            {image ? (
                              <img src={image} alt="" className="h-12 w-9 rounded-md object-cover" />
                            ) : (
                              <div className="h-12 w-9 rounded-md bg-white/5" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-zinc-100">{title}</span>
                              <span className="mt-1 block text-xs text-zinc-500">
                                {getYear(anime)}{getYear(anime) ? " · " : ""}{getType(anime)}
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                          </Link>
                        );
                      })
                    ) : (
                      <p className="px-4 py-4 text-sm text-zinc-500">No suggestions found.</p>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="rounded-xl bg-pink-600 px-5 text-sm font-bold transition hover:bg-pink-500"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {[
            { label: "Trending", to: "/trending" },
            { label: "Top Rated", to: "/top-rated" },
            { label: "Popular", to: "/popular" },
            { label: "Discover", to: "/search" },
          ].map((tab) => {
            const active =
              (tab.to === "/trending" && mode === "trending") ||
              (tab.to === "/top-rated" && mode === "top-rated") ||
              (tab.to === "/popular" && mode === "popular") ||
              (tab.to === "/search" && mode === "search");

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-pink-500 bg-pink-500/10 text-pink-300"
                    : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}

          <button
            onClick={() => setShowFilters((value) => !value)}
            className={`ml-auto inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              showFilters || activeFilterCount
                ? "border-pink-500/50 bg-pink-500/10 text-pink-300"
                : "border-white/10 text-zinc-300 hover:bg-white/[0.05]"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-pink-600 px-2 py-0.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-7 rounded-2xl border border-white/10 bg-[#111111] p-4 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Refine your anime</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Combine filters to narrow your results.
                </p>
              </div>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition hover:text-pink-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset all
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FilterSelect
                label="Genre"
                value={filters.genre}
                onChange={(value) => updateFilter("genre", value)}
                options={[
                  { value: "", label: genreLoading ? "Loading genres..." : "All genres" },
                  ...genres.map((genre) => ({
                    value: String(genre.mal_id ?? genre.id ?? ""),
                    label: genre.name,
                  })).filter((genre) => genre.value),
                ]}
              />

              <FilterSelect
                label="Anime type"
                value={filters.type}
                onChange={(value) => updateFilter("type", value)}
                options={TYPES}
              />

              <FilterSelect
                label="Airing status"
                value={filters.status}
                onChange={(value) => updateFilter("status", value)}
                options={STATUSES}
              />

              <FilterSelect
                label="Release year"
                value={filters.year}
                onChange={(value) => updateFilter("year", value)}
                options={[
                  { value: "", label: "Any year" },
                  ...Array.from({ length: 40 }, (_, index) => {
                    const year = new Date().getFullYear() - index;
                    return { value: String(year), label: String(year) };
                  }),
                ]}
              />

              <FilterSelect
                label="Minimum score"
                value={filters.minScore}
                onChange={(value) => updateFilter("minScore", value)}
                options={[
                  { value: "", label: "Any score" },
                  ...[5, 6, 7, 8, 8.5, 9].map((score) => ({
                    value: String(score),
                    label: `${score}+ / 10`,
                  })),
                ]}
              />

              <FilterSelect
                label="Sort results"
                value={filters.sort}
                onChange={(value) => updateFilter("sort", value)}
                options={SORTS}
              />
            </div>
          </motion.section>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">
            {loading
              ? "Finding anime..."
              : total
                ? `${total.toLocaleString()} results found`
                : `${items.length} anime shown`}
          </p>
          <p className="text-xs text-zinc-600">
            Page {page}{lastPage > 1 ? ` of ${lastPage}` : ""}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Unable to load anime</p>
              <p className="mt-1 text-red-200/70">{error}</p>
              <button
                onClick={() => setPage((current) => current)}
                className="mt-2 underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center gap-3 text-zinc-400">
            <LoaderCircle className="h-6 w-6 animate-spin text-pink-500" />
            Loading anime catalogue...
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <Search className="mb-4 h-9 w-9 text-zinc-600" />
            <h2 className="text-xl font-bold">No anime found</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Try a different title or clear some filters to see more results.
            </p>
            <button
              onClick={resetFilters}
              className="mt-5 rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold hover:bg-pink-500"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            {items.map((anime, index) => {
              const animeId = getAnimeId(anime);
              const image = getAnimeImage(anime);
              const title = getAnimeTitle(anime);

              return (
                <motion.div
                  key={animeId ?? `${title}-${index}`}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.2) }}
                  className="group min-w-0"
                >
                  <Link
                    to={`/anime/${animeId}`}
                    className="block"
                    aria-label={`View ${title}`}
                  >
                    <div className="relative aspect-[3/4.3] overflow-hidden rounded-xl border border-white/[0.07] bg-[#151515]">
                      {image ? (
                        <img
                          src={image}
                          alt={title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-center text-sm text-zinc-600">
                          Image unavailable
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80" />

                      <div className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase text-zinc-200 backdrop-blur">
                        {getType(anime)}
                      </div>

                      {anime?.score && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs font-bold text-amber-300 backdrop-blur">
                          <Star className="h-3 w-3 fill-current" />
                          {getScore(anime)}
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-600 shadow-xl shadow-pink-950/40">
                          <Play className="ml-0.5 h-5 w-5 fill-white" />
                        </span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="line-clamp-2 text-sm font-bold leading-5 text-white sm:text-base">
                          {title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {getYear(anime)}{getYear(anime) ? " · " : ""}
                          {anime?.episodes ? `${anime.episodes} episodes` : getType(anime)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-pink-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {getNumberedPages(page, maxPage).map((pageNumber, index) =>
                pageNumber === "..." ? (
                  <span key={`dots-${index}`} className="px-1 text-zinc-600">...</span>
                ) : (
                  <button
                    key={pageNumber}
                    onClick={() => changePage(pageNumber)}
                    aria-current={page === pageNumber ? "page" : undefined}
                    className={`h-10 min-w-10 rounded-xl border px-3 text-sm font-semibold transition ${
                      page === pageNumber
                        ? "border-pink-500 bg-pink-600 text-white"
                        : "border-white/10 text-zinc-400 hover:border-pink-500/50 hover:text-white"
                    }`}
                  >
                    {pageNumber}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => changePage(page + 1)}
              disabled={page >= maxPage || items.length < PAGE_SIZE}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-pink-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#191919] px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-pink-500/60"
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
