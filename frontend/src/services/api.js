// Secara otomatis menggunakan IP/Host yang sedang diakses (misal: 192.168.x.x jika di HP)
const API_BASE_URL = `http://${window.location.hostname}:8000`;

/**
 * Fetches the direct stream URL for a given YouTube video ID.
 * Maps HTTP errors to clean Error objects for the frontend to handle.
 * 
 * @param {string} videoId - The YouTube Video ID
 * @returns {Promise<string>} The direct stream URL
 */
export async function fetchStreamUrl(videoId) {
  try {
    const response = await fetch(`${API_BASE_URL}/stream/${videoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      // Mapping status codes to clear error messages
      if (response.status === 404) {
        throw new Error("Video tidak ditemukan atau dibatasi (Private/Age-restricted).");
      } else if (response.status === 429) {
        throw new Error("Terlalu banyak request ke YouTube (Rate Limit). Coba lagi nanti.");
      } else if (response.status >= 500) {
        throw new Error("Terjadi kesalahan pada server saat mengekstrak stream.");
      } else {
        throw new Error(`Error tidak dikenal (Status: ${response.status})`);
      }
    }

    const data = await response.json();
    return data.stream_url;

  } catch (error) {
    // Re-throw the error so the component can catch and display it
    throw error;
  }
}

/**
 * Fetches the heatmap data for a given YouTube video ID.
 * 
 * @param {string} videoId - The YouTube Video ID
 * @param {number} numClips - The number of clips to fetch (default 5)
 * @param {number} offset - The offset in seconds (default 5)
 * @returns {Promise<object>} The title and array of clips
 */
export async function fetchHeatmap(videoId, numClips = 5, offset = 5) {
  try {
    const response = await fetch(`${API_BASE_URL}/heatmap/${videoId}?num_clips=${numClips}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Video tidak memiliki data heatmap (Most Replayed).");
      } else {
        throw new Error(`Gagal mengambil heatmap (Status: ${response.status})`);
      }
    }

    const data = await response.json();
    return data;

  } catch (error) {
    throw error;
  }
}
