// Secara otomatis menggunakan IP/Host yang sedang diakses
// Saat production (diserve oleh FastAPI), gunakan relative path agar mengikuti reverse proxy / port
const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : `http://${window.location.hostname}:3006/api`;

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
 * @param {number} numClips - The number of clips to fetch (default 100)
 * @param {number} offset - The offset in seconds (default 5)
 * @returns {Promise<object>} The title and array of clips
 */
export async function fetchHeatmap(videoId, numClips = 100, offset = 5) {
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

/**
 * Downloads a specific clip by sending a request to the backend.
 * 
 * @param {string} videoId 
 * @param {number} start 
 * @param {number} end 
 */
export async function downloadClip(videoId, start, end) {
  const url = `${API_BASE_URL}/download_clip/${videoId}?start=${start}&end=${end}`;
  
  const response = await fetch(url, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(`Gagal mendownload klip (Status: ${response.status})`);
  }
  
  // Convert response to blob for seamless download
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${videoId}_clip_${Math.floor(start)}s_to_${Math.floor(end)}s.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
