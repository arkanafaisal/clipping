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
        throw new Error('Video Not Found (404)');
      }
      if (response.status === 429) {
        throw new Error('Rate Limit Exceeded (429)');
      }
      if (response.status === 500) {
        throw new Error('Internal Server Error (500)');
      }
      throw new Error(`HTTP Error ${response.status}`);
    }

    const data = await response.json();
    return data.stream_url;
  } catch (error) {
    console.error(`[API Service] Failed to fetch stream for ${videoId}:`, error);
    throw error;
  }
}
