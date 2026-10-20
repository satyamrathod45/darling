import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Search,
  UserRound,
  X,
  LoaderCircle,
  Star,
  House,
  TrendingUp,
  Menu,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const TENRAI_API = "https://api.tenrai.org/v1";

const navLinks = [
  { label: "Home", to: "/home" },
  { label: "Trending", to: "/trending" },
  { label: "Top Rated", to: "/top-rated" },
];

function getAnimeImage(anime) {
  return (
    anime?.images?.webp?.large_image_url ||
    anime?.images?.jpg?.large_image_url ||
    anime?.images?.webp?.image_url ||
    anime?.images?.jpg?.image_url ||
    anime?.image ||
    ""
  );
}

function getAnimeTitle(anime) {
  return anime?.title_english || anime?.title || "Unknown Anime";
}

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function loadUser(sessionUser) {
      if (!active) return;

      setUser(sessionUser);

      if (!sessionUser) {
        setAvatarUrl("");
        setAuthLoading(false);
        return;
      }

      const metadata = sessionUser.user_metadata || {};

      let imageUrl =
        metadata.avatar_url ||
        metadata.picture ||
        "";

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", sessionUser.id)
          .maybeSingle();

        if (!error && data?.avatar_url) {
          imageUrl = data.avatar_url;
        }
      } catch (err) {
        console.error("Unable to load profile image:", err);
      }

      if (!active) return;

      setAvatarUrl(imageUrl);
      setAuthLoading(false);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Unable to check session:", error);
        if (active) setAuthLoading(false);
        return;
      }

      loadUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (!term) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          q: term,
          limit: "6",
          sfw: "true",
        });

        const response = await fetch(
          `${TENRAI_API}/anime?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 429
              ? "Too many requests. Try again shortly."
              : "Unable to load anime results."
          );
        }

        const json = await response.json();

        const animeList = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.results)
              ? json.results
              : [];

        setResults(animeList.slice(0, 6));

        if (animeList.length === 0) {
          setError("No anime found. Try another title.");
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setResults([]);
          setError(err.message || "Something went wrong.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  function submitSearch(event) {
    event.preventDefault();

    const term = query.trim();

    if (!term) return;

    setSearchOpen(false);
    setMobileOpen(false);

    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  function openAnime(anime) {
    const id = anime?.mal_id ?? anime?.id;

    if (!id) return;

    setSearchOpen(false);
    setQuery("");

    navigate(`/anime/${id}`);
  }

  function renderResults() {
    if (loading && results.length === 0) {
      return (
        <div className="flex items-center justify-center gap-3 px-4 py-8 text-sm text-zinc-400">
          <LoaderCircle
            size={18}
            className="animate-spin text-pink-400"
          />
          Finding anime...
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <div className="px-5 py-8 text-center">
          <Search size={22} className="mx-auto text-zinc-600" />

          <p className="mt-3 text-sm font-medium text-zinc-300">
            {error || "Search for your favourite anime"}
          </p>

          <p className="mt-1 text-xs text-zinc-600">
            Try a different title or spelling.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="max-h-[360px] overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {results.map((anime, index) => {
            const title = getAnimeTitle(anime);
            const image = getAnimeImage(anime);
            const id = anime?.mal_id ?? anime?.id;

            return (
              <button
                type="button"
                key={id ?? `${title}-${index}`}
                onClick={() => openAnime(anime)}
                className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors duration-200 hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none"
              >
                <div className="h-[66px] w-[49px] shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/10">
                  {image ? (
                    <img
                      src={image}
                      alt={title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[10px] text-zinc-500">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 py-1">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-zinc-200 transition-colors group-hover:text-pink-300">
                    {title}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-500">
                    {anime?.type && <span>{anime.type}</span>}
                    {anime?.year && <span>{anime.year}</span>}

                    {anime?.episodes && (
                      <span>{anime.episodes} episodes</span>
                    )}

                    {anime?.score != null && (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Star size={10} fill="currentColor" />
                        {anime.score}
                      </span>
                    )}
                  </div>
                </div>

                <span className="mr-1 shrink-0 text-xs text-zinc-600 transition-colors group-hover:text-pink-400">
                  View
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={submitSearch}
          className="flex w-full items-center justify-center gap-2 border-t border-white/[0.07] px-3 py-3 text-xs font-semibold text-pink-300 transition-colors hover:bg-pink-500/[0.07]"
        >
          <Search size={14} />
          See all results
        </button>
      </>
    );
  }

  function renderProfileLink(mobile = false) {
    if (authLoading) return null;

    if (user) {
      return (
        <Link
          to="/profile"
          onClick={() => {
            if (mobile) setMobileOpen(false);
          }}
          aria-label="Your profile"
          title="Your profile"
          className={
            mobile
              ? "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
              : "hidden size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.09] bg-white/[0.035] text-zinc-300 transition-colors hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-pink-300 sm:flex"
          }
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={mobile ? "" : "Your profile"}
              referrerPolicy="no-referrer"
              className={
                mobile
                  ? "size-7 shrink-0 rounded-full object-cover"
                  : "h-full w-full object-cover"
              }
              onError={() => setAvatarUrl("")}
            />
          ) : (
            <UserRound
              size={mobile ? 17 : 19}
              className={mobile ? "shrink-0" : ""}
            />
          )}

          {mobile && "Profile"}
        </Link>
      );
    }

    return (
      <Link
        to="/login"
        onClick={() => {
          if (mobile) setMobileOpen(false);
        }}
        className={
          mobile
            ? "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-pink-300 transition-colors hover:bg-pink-500/10"
            : "hidden items-center justify-center rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-400 sm:flex"
        }
      >
        <UserRound size={mobile ? 17 : 16} />
        Login
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#08070b]/95 text-white shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-10">
        <Link
          to="/home"
          className="group flex shrink-0 items-center"
          aria-label="DARLING home"
        >
          <img
            src="/logo.png"
            alt="DARLING"
            className="h-10 w-auto max-w-[150px] object-contain transition-transform duration-300 group-hover:scale-[1.03] sm:h-12"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              event.currentTarget.nextElementSibling?.classList.remove(
                "hidden"
              );
            }}
          />

          <span className="hidden text-2xl font-black tracking-[0.14em]">
            D<span className="text-pink-500">ARLING</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  isActive
                    ? "bg-pink-500/10 text-pink-300"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <div
          ref={searchRef}
          className="relative hidden w-full max-w-[390px] sm:block"
        >
          <form
            onSubmit={submitSearch}
            className={`flex h-11 items-center rounded-2xl border transition-colors ${
              searchOpen
                ? "border-pink-500/50 bg-[#17121c] shadow-[0_0_0_3px_rgba(236,72,153,0.08)]"
                : "border-white/[0.09] bg-white/[0.035] hover:border-white/[0.16]"
            }`}
          >
            <Search
              size={18}
              className={`ml-3.5 shrink-0 ${
                searchOpen ? "text-pink-400" : "text-zinc-500"
              }`}
            />

            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search your next obsession..."
              aria-label="Search anime"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-zinc-600"
            />

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setError("");
                  setSearchOpen(true);
                }}
                aria-label="Clear search"
                className="mr-1 grid size-8 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-white/[0.07] hover:text-white"
              >
                <X size={15} />
              </button>
            )}

            <button
              type="submit"
              aria-label="Submit search"
              className="mr-1.5 grid size-8 shrink-0 place-items-center rounded-xl bg-pink-500 text-white transition-colors hover:bg-pink-400"
            >
              <Search size={15} />
            </button>
          </form>

          {searchOpen && query.trim() && (
            <div className="absolute left-0 right-0 top-[calc(100%+12px)] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#100d15] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Anime search
                </span>

                {results.length > 0 && (
                  <span className="rounded-full bg-pink-500/10 px-2 py-1 text-[10px] font-semibold text-pink-300">
                    {results.length} results
                  </span>
                )}
              </div>

              {renderResults()}
            </div>
          )}
        </div>

        {renderProfileLink()}

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.09] text-zinc-300 transition-colors hover:border-pink-500/40 hover:text-pink-300 sm:hidden"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="border-t border-white/[0.05] px-4 py-3 sm:hidden">
        <div className="relative">
          <form
            onSubmit={submitSearch}
            className="flex h-11 items-center rounded-xl border border-white/[0.09] bg-white/[0.035]"
          >
            <Search size={17} className="ml-3.5 shrink-0 text-zinc-500" />

            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search anime..."
              aria-label="Search anime"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600"
            />

            <button
              type="submit"
              aria-label="Submit search"
              className="mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg bg-pink-500 text-white"
            >
              <Search size={15} />
            </button>
          </form>

          {searchOpen && query.trim() && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#100d15] shadow-2xl">
              {renderResults()}
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.07] bg-[#0b090e] px-4 py-3 sm:hidden">
          <nav className="grid gap-1">
            {navLinks.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                    isActive
                      ? "bg-pink-500/10 text-pink-300"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                  }`
                }
              >
                {label === "Home" && <House size={17} />}
                {label === "Trending" && <TrendingUp size={17} />}
                {label === "Top Rated" && <Star size={17} />}
                {label}
              </NavLink>
            ))}

            {renderProfileLink(true)}
          </nav>
        </div>
      )}
    </header>
  );
}