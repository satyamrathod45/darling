import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  Film,
  Heart,
  LogOut,
  Pencil,
  Save,
  UserRound,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import {
  getAnimeDetails,
  getAnimeImage,
  getAnimeTitle,
} from "../lib/tenrai";

function formatDate(date) {
  if (!date) return "Member";
  return new Date(date).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getAnimeId(anime) {
  return anime?.mal_id ?? anime?.id;
}

function AnimeTile({ anime, onRemove, removing = false }) {
  const id = getAnimeId(anime);
  const image = getAnimeImage(anime);
  const title = getAnimeTitle(anime);

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#111116] transition hover:border-pink-500/40">
      <Link to={`/anime/${id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
          {image ? (
            <img
              src={image}
              alt={title || "Anime"}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600">
              <Film size={30} />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="truncate text-sm font-semibold text-zinc-100">
            {title || "Unknown anime"}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">View details</p>
        </div>
      </Link>

      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(id)}
          disabled={removing}
          aria-label={`Remove ${title} from favourites`}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/75 text-pink-400 transition hover:bg-pink-500 hover:text-white disabled:opacity-50"
        >
          <Heart size={16} fill="currentColor" />
        </button>
      )}
    </article>
  );
}

function AnimeGrid({ anime, emptyTitle, emptyText, icon: Icon }) {
  if (!anime.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
        <Icon className="mx-auto text-zinc-600" size={28} />
        <h3 className="mt-3 font-semibold text-zinc-200">{emptyTitle}</h3>
        <p className="mt-1 text-sm text-zinc-500">{emptyText}</p>
        <Link
          to="/trending"
          className="mt-4 inline-flex rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-400"
        >
          Explore anime
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {anime.map((item) => (
        <AnimeTile key={getAnimeId(item)} anime={item} />
      ))}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [favourites, setFavourites] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      setUser(currentUser);

      const [
        { data: profileData, error: profileError },
        { data: favouriteData, error: favouriteError },
        { data: historyData, error: historyError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("favourites")
          .select("mal_id")
          .eq("user_id", currentUser.id),
        supabase
          .from("watch_history")
          .select("mal_id")
          .eq("user_id", currentUser.id),
      ]);

      if (profileError) throw profileError;
      if (favouriteError) throw favouriteError;
      if (historyError) throw historyError;

      const profileInfo = profileData || {
        username:
          currentUser.user_metadata?.username ||
          currentUser.email?.split("@")[0] ||
          "Anime Fan",
        avatar_url: currentUser.user_metadata?.avatar_url || "",
        created_at: currentUser.created_at,
      };

      setProfile(profileInfo);
      setUsername(profileInfo.username || "");
      setAvatarUrl(profileInfo.avatar_url || "");

      const favouriteIds = [
        ...new Set((favouriteData || []).map((item) => item.mal_id).filter(Boolean)),
      ];
      const historyIds = [
        ...new Set((historyData || []).map((item) => item.mal_id).filter(Boolean)),
      ];

      const fetchAnime = async (ids) => {
        const results = await Promise.allSettled(
          ids.map((id) => getAnimeDetails(id))
        );
        return results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .filter(Boolean);
      };

      const [favouriteAnime, historyAnime] = await Promise.all([
        fetchAnime(favouriteIds),
        fetchAnime(historyIds),
      ]);

      setFavourites(favouriteAnime);
      setHistory(historyAnime);
    } catch (err) {
      console.error("Failed to load profile:", err);
      setError(err?.message || "Couldn't load your profile.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const updatedProfile = {
        id: user.id,
        username: username.trim(),
        avatar_url: avatarUrl.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from("profiles")
        .upsert(updatedProfile, { onConflict: "id" });

      if (saveError) throw saveError;

      setProfile((previous) => ({ ...previous, ...updatedProfile }));
      setEditing(false);
      setNotice("Profile updated successfully.");
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError(err?.message || "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function removeFavourite(animeId) {
    if (!user || !animeId) return;

    setRemovingId(animeId);
    setError("");
    setNotice("");

    try {
      const { error: removeError } = await supabase
        .from("favourites")
        .delete()
        .eq("user_id", user.id)
        .eq("mal_id", animeId);

      if (removeError) throw removeError;

      setFavourites((previous) =>
        previous.filter((anime) => String(getAnimeId(anime)) !== String(animeId))
      );
      setNotice("Anime removed from favourites.");
    } catch (err) {
      console.error("Failed to remove favourite:", err);
      setError(err?.message || "Couldn't remove this anime.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError("");

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Sign-out failed:", err);
      setError(err?.message || "Couldn't sign out.");
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-pink-500/20 border-t-pink-500" />
          <p className="mt-4 text-sm text-zinc-400">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const displayName =
    profile?.username || user.email?.split("@")[0] || "Anime Fan";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-[#08080d] text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <Link
            to="/home"
            aria-label="Go to home"
            className="inline-flex items-center rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <img
              src="/logo.png"
              alt="DARLING"
              className="h-12 w-auto max-w-[180px] object-contain"
            />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/home"
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:border-pink-500/40 hover:text-white disabled:opacity-50"
            >
              <LogOut size={15} />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-pink-500/20 bg-pink-500/[0.06] px-4 py-3 text-sm text-pink-200">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}

        <section className="mt-7 rounded-2xl border border-white/10 bg-[#101015] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-pink-500/10 text-2xl font-bold text-pink-300">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`${displayName}'s avatar`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-pink-400">
                  Your profile
                </p>
                <h1 className="mt-1 truncate text-2xl font-bold text-white">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-sm text-zinc-500">{user.email}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                  <CalendarDays size={13} />
                  Joined {formatDate(profile?.created_at || user.created_at)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditing((previous) => !previous);
                setError("");
                setNotice("");
                setUsername(profile?.username || "");
                setAvatarUrl(profile?.avatar_url || "");
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-pink-500/40 hover:text-pink-300 sm:self-center"
            >
              {editing ? <X size={15} /> : <Pencil size={15} />}
              {editing ? "Cancel" : "Edit profile"}
            </button>
          </div>

          {editing && (
            <form
              onSubmit={saveProfile}
              className="mt-6 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2"
            >
              <label className="block">
                <span className="mb-2 block text-sm text-zinc-400">Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={40}
                  required
                  placeholder="Your username"
                  className="w-full rounded-lg border border-white/10 bg-[#09090d] px-3.5 py-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-pink-500/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-zinc-400">Avatar image URL</span>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-lg border border-white/10 bg-[#09090d] px-3.5 py-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-pink-500/60"
                />
              </label>
              <div className="flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setUsername(profile?.username || "");
                    setAvatarUrl(profile?.avatar_url || "");
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#101015] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Heart size={16} className="text-pink-400" />
              Favourites
            </div>
            <p className="mt-3 text-2xl font-bold text-white">{favourites.length}</p>
            <p className="mt-1 text-xs text-zinc-500">Saved anime</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#101015] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Clock3 size={16} className="text-pink-400" />
              Watch history
            </div>
            <p className="mt-3 text-2xl font-bold text-white">{history.length}</p>
            <p className="mt-1 text-xs text-zinc-500">Anime watched</p>
          </div>
          <div className="col-span-2 rounded-xl border border-white/10 bg-[#101015] p-4 sm:col-span-1 sm:p-5">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <UserRound size={16} className="text-pink-400" />
              Account
            </div>
            <p className="mt-3 truncate text-base font-semibold text-white">Anime enthusiast</p>
            <p className="mt-1 text-xs text-zinc-500">Member since {formatDate(profile?.created_at || user.created_at)}</p>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Heart size={18} className="text-pink-400" />
                Your favourites
              </h2>
              <p className="mt-1 text-sm text-zinc-500">Anime you've saved.</p>
            </div>
            <span className="text-sm text-zinc-500">{favourites.length} saved</span>
          </div>

          {favourites.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {favourites.map((anime) => {
                const id = getAnimeId(anime);
                return (
                  <AnimeTile
                    key={id}
                    anime={anime}
                    onRemove={removeFavourite}
                    removing={String(removingId) === String(id)}
                  />
                );
              })}
            </div>
          ) : (
            <AnimeGrid
              anime={favourites}
              emptyTitle="No favourites yet"
              emptyText="Explore anime and save your favourites here."
              icon={Heart}
            />
          )}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Clock3 size={18} className="text-pink-400" />
                Recently watched
              </h2>
              <p className="mt-1 text-sm text-zinc-500">Continue exploring your anime history.</p>
            </div>
            <span className="text-sm text-zinc-500">{history.length} titles</span>
          </div>
          <AnimeGrid
            anime={history}
            emptyTitle="No watch history yet"
            emptyText="Start watching anime and your history will appear here."
            icon={Clock3}
          />
        </section>
      </div>
    </main>
  );
}
