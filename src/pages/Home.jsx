
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Flame,
  Star,
  Sparkles,
  Search,
  Heart,
  CalendarDays,
} from "lucide-react";

import HeroBanner from "../components/home/HeroBanner";
import AnimeSection from "../components/home/AnimeSection";

import {
  getTrendingAnime,
  getPopularAnime,
  getTopRatedAnime,
  getAnimeImage,
  getAnimeTitle,
} from "../lib/tenrai";
import Navbar from "../components/Navbar";

const API = "https://api.tenrai.org/v1";

async function fetchAnimeList(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Anime API request failed (${response.status})`);
  }

  const json = await response.json();

  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.results)) return json.results;

  return [];
}

function getAnimeId(anime) {
  return anime?.mal_id ?? anime?.id;
}

function getGenres(anime) {
  return (anime?.genres ?? [])
    .map((genre) => typeof genre === "string" ? genre : genre?.name)
    .filter(Boolean);
}

function DiscoveryCard({ anime, label }) {
  const id = getAnimeId(anime);
  const title = getAnimeTitle(anime) || "Discover Anime";
  const image = getAnimeImage(anime);
  const score = Number(anime?.score ?? anime?.mean ?? 0);
  const year =
    anime?.year ??
    anime?.season_year ??
    anime?.aired?.prop?.from?.year ??
    "";

  return (
    <Link
      to={`/anime/${id}`}
      className="group relative block aspect-[3/4.2] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111] transition duration-300 hover:-translate-y-1 hover:border-pink-500/40 hover:shadow-[0_15px_40px_rgba(236,72,153,0.12)]"
    >
      {image ? (
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-600">
          Image unavailable
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-pink-300 backdrop-blur">
        {label}
      </span>

      {score > 0 && (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1.5 text-xs font-bold text-amber-300 backdrop-blur">
          <Star size={12} fill="currentColor" />
          {score.toFixed(1)}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white transition group-hover:text-pink-300 sm:text-base">
          {title}
        </h3>

        <p className="mt-1.5 text-xs text-zinc-400">
          {year || anime?.type || "Anime"}
        </p>

        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-pink-400 opacity-0 transition group-hover:opacity-100">
          Explore anime <ArrowRight size={13} />
        </div>
      </div>
    </Link>
  );
}

function DiscoverySection({
  title,
  subtitle,
  icon: Icon,
  anime,
  loading,
  label,
}) {
  if (!loading && anime.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-pink-400">
            <Icon size={15} />
            Curated for you
          </p>

          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {subtitle}
          </p>
        </div>

        <Link
          to="/search"
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-zinc-400 transition hover:text-pink-400 sm:flex"
        >
          Explore <ArrowRight size={15} />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[3/4.2] animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {anime.slice(0, 4).map((item, index) => (
            <DiscoveryCard
              key={getAnimeId(item) ?? `${title}-${index}`}
              anime={item}
              label={label}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [airing, setAiring] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadHomePage() {
      const tasks = [
        ["trending", getTrendingAnime, setTrending],
        ["popular", getPopularAnime, setPopular],
        ["topRated", getTopRatedAnime, setTopRated],
        [
          "airing",
          (signal) =>
            fetchAnimeList(
              `${API}/top/anime?filter=airing&limit=24&page=1&sfw`,
              signal
            ),
          setAiring,
        ],
        [
          "upcoming",
          (signal) =>
            fetchAnimeList(
              `${API}/top/anime?filter=upcoming&limit=24&page=1&sfw`,
              signal
            ),
          setUpcoming,
        ],
      ];

      const results = await Promise.allSettled(
        tasks.map(async ([key, fetcher, setter]) => {
          const data = await fetcher(controller.signal);

          if (!controller.signal.aborted) {
            setter(data);
          }

          return [key, data];
        })
      );

      if (controller.signal.aborted) return;

      const nextErrors = {};

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          nextErrors[tasks[index][0]] =
            result.reason?.message || "Unable to load this section.";
        }
      });

      setErrors(nextErrors);
      setLoading(false);
    }

    loadHomePage();

    return () => controller.abort();
  }, []);

  const allAnime = useMemo(() => {
    const seen = new Set();

    return [...trending, ...popular, ...topRated, ...airing, ...upcoming].filter(
      (anime) => {
        const id = getAnimeId(anime);

        if (id == null || seen.has(id)) return false;

        seen.add(id);
        return true;
      }
    );
  }, [trending, popular, topRated, airing, upcoming]);

  const romanceAnime = useMemo(
    () =>
      allAnime.filter((anime) =>
        getGenres(anime).some((genre) =>
          genre.toLowerCase().includes("romance")
        )
      ),
    [allAnime]
  );

  const actionAnime = useMemo(
    () =>
      allAnime.filter((anime) =>
        getGenres(anime).some((genre) =>
          genre.toLowerCase().includes("action")
        )
      ),
    [allAnime]
  );

  const hiddenGems = useMemo(
    () =>
      allAnime
        .filter((anime) => {
          const score = Number(anime?.score ?? anime?.mean ?? 0);
          const members = Number(anime?.members ?? Infinity);

          return score >= 7.5 && members < 100000;
        })
        .sort(
          (a, b) =>
            Number(b?.score ?? b?.mean ?? 0) -
            Number(a?.score ?? a?.mean ?? 0)
        )
        .slice(0, 4),
    [allAnime]
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-[#09080c] text-white">
        <Navbar />
      <main>
        <HeroBanner anime={trending} loading={loading} />

        <div className="mx-auto max-w-[1600px] px-5 pb-16 sm:px-8 lg:px-12">
          <AnimeSection
            title="Trending This Week"
            subtitle="The anime everyone's talking about."
            anime={trending}
            loading={loading}
            error={errors.trending}
            viewAllTo="/trending"
          />

          <AnimeSection
            title="Popular Anime"
            subtitle="Fan favourites worth adding to your list."
            anime={popular}
            loading={loading}
            error={errors.popular}
            viewAllTo="/popular"
          />

          <DiscoverySection
            title="Hidden Gems"
            subtitle="Highly rated anime that deserve more attention."
            icon={Sparkles}
            anime={hiddenGems}
            loading={loading}
            label="Hidden Gem"
          />

          <DiscoverySection
            title="Romance & Feelings"
            subtitle="Stories full of chemistry, heart, and unforgettable moments."
            icon={Heart}
            anime={romanceAnime}
            loading={loading}
            label="Romance"
          />

          <DiscoverySection
            title="Action & Adventure"
            subtitle="Big battles, intense journeys, and legendary rivals."
            icon={Flame}
            anime={actionAnime}
            loading={loading}
            label="Action"
          />

          <AnimeSection
            title="Top Rated Anime"
            subtitle="Highly rated stories from the anime world."
            anime={topRated}
            loading={loading}
            error={errors.topRated}
            viewAllTo="/top-rated"
          />

          <AnimeSection
            title="Currently Airing"
            subtitle="Follow the series airing right now."
            anime={airing}
            loading={loading}
            error={errors.airing}
            viewAllTo="/trending"
          />

          <DiscoverySection
            title="Coming Soon"
            subtitle="Keep an eye on upcoming anime releases."
            icon={CalendarDays}
            anime={upcoming}
            loading={loading}
            label="Upcoming"
          />

          <section className="mt-14 overflow-hidden rounded-2xl border border-pink-500/20 bg-gradient-to-r from-pink-950/30 via-[#151016] to-[#101014]">
            <div className="flex flex-col justify-between gap-6 p-6 sm:p-9 md:flex-row md:items-center">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-pink-400">
                  Your next obsession awaits
                </p>

                <h2 className="text-2xl font-black sm:text-3xl">
                  Can't decide what to watch?
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                  Explore new genres, discover hidden favourites, and find your next unforgettable anime.
                </p>
              </div>

              <Link
                to="/search"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-3.5 text-sm font-bold transition hover:bg-pink-500"
              >
                <Search size={16} />
                Explore Anime
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
