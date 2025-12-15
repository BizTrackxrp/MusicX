export interface Track {
  id: string;
  title: string;
  audioUrl: string;
  audioCid: string;
  duration?: number;
  nftTokenId?: string;
}

export interface Release {
  id: string;
  type: 'single' | 'album';
  title: string;
  description: string;
  artistAddress: string;
  artistName?: string;
  coverUrl: string;
  coverCid: string;
  tracks: Track[];
  songPrice: number;
  albumPrice?: number;
  totalEditions: number;
  soldEditions: number;
  createdAt: string;
  metadataCid: string;
  txHash?: string;
}

const RELEASES_KEY = 'xrpmusic_releases';

export function getAllReleases(): Release[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(RELEASES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getReleasesByArtist(artistAddress: string): Release[] {
  return getAllReleases().filter(
    (r) => r.artistAddress.toLowerCase() === artistAddress.toLowerCase()
  );
}

export function getReleaseById(id: string): Release | null {
  const releases = getAllReleases();
  return releases.find((r) => r.id === id) || null;
}

export function saveRelease(release: Release): void {
  const releases = getAllReleases();
  releases.unshift(release);
  localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
}

export function updateRelease(id: string, updates: Partial<Release>): void {
  const releases = getAllReleases();
  const index = releases.findIndex((r) => r.id === id);
  if (index !== -1) {
    releases[index] = { ...releases[index], ...updates };
    localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
  }
}

export function deleteRelease(id: string): void {
  const releases = getAllReleases().filter((r) => r.id !== id);
  localStorage.setItem(RELEASES_KEY, JSON.stringify(releases));
}

export function getFeaturedReleases(limit: number = 10): Release[] {
  return getAllReleases().slice(0, limit);
}

export function getAvailableReleases(): Release[] {
  return getAllReleases().filter((r) => r.soldEditions < r.totalEditions);
}

export function searchReleases(query: string): Release[] {
  const lowerQuery = query.toLowerCase();
  return getAllReleases().filter(
    (r) =>
      r.title.toLowerCase().includes(lowerQuery) ||
      r.artistName?.toLowerCase().includes(lowerQuery) ||
      r.artistAddress.toLowerCase().includes(lowerQuery)
  );
}
