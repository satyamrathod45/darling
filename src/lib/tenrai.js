const API_BASE = "https://api.tenrai.org/v1";

async function request(endpoint, signal) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Tenrai API error: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  return json?.data ?? json;
}

function getAnimeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.anime)) return data.anime;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export function getAnimeImage(anime) {
  return (
    anime?.images?.webp?.large_image_url ||
    anime?.images?.webp?.image_url ||
    anime?.images?.jpg?.large_image_url ||
    anime?.images?.jpg?.image_url ||
    anime?.coverImage ||
    anime?.cover_image ||
    anime?.image ||
    anime?.image_url ||
    anime?.poster ||
    anime?.poster_url ||
    ""
  );
}

export function getAnimeTitle(anime) {
  return (
    anime?.title_english ||
    anime?.title ||
    anime?.name ||
    anime?.title_japanese ||
    "Unknown Anime"
  );
}

export async function getTrendingAnime(signal) {
  const data = await request("/top/anime?limit=12&sfw=true", signal);
  return getAnimeList(data);
}

export async function getPopularAnime(signal) {
  const data = await request(
    "/anime?limit=24&order_by=popularity",
    signal
  );

  return getAnimeList(data);
}

export async function getTopRatedAnime(signal) {
  const data = await request("/top/anime?limit=24&sfw=true", signal);

  return getAnimeList(data).sort(
    (a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0)
  );
}

export async function getAnimeDetails(id, signal) {
  if (!id) throw new Error("Anime ID is required.");

  return request(`/anime/${encodeURIComponent(id)}/full`, signal);
}

export async function getAnimeVideos(id, signal) {
  if (!id) throw new Error("Anime ID is required.");

  return request(`/anime/${encodeURIComponent(id)}/videos`, signal);
}

export async function getAnimeEpisodes(id, page = 1, signal) {
  if (!id) throw new Error("Anime ID is required.");

  const response = await fetch(
    `${API_BASE}/anime/${encodeURIComponent(id)}/episodes?page=${page}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Tenrai API error: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  // Keep pagination metadata even when the API places it outside "data".
  const payload = json?.data ?? json;

  const episodes = getAnimeList(payload);

  const pagination =
    payload?.pagination ??
    json?.pagination ??
    payload?.data?.pagination ??
    {};

  return {
    episodes,
    pagination,
  };
}

export function getYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return "";

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1);
    }

    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") || "";
      }

      const parts = parsed.pathname.split("/");
      const index = parts.findIndex((part) =>
        ["embed", "shorts", "live"].includes(part)
      );

      if (index !== -1) return parts[index + 1] || "";
    }
  } catch {
    return "";
  }

  return "";
}