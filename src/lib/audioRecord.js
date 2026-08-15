/**
 * Pick a MediaRecorder MIME type the browser can actually record.
 * @returns {string}
 */
export const pickAudioMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }

  return "";
};

/**
 * @param {string} mimeType
 * @returns {string}
 */
export const extensionForAudioMime = (mimeType = "") => {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
};

/**
 * Format recording / duration seconds as m:ss
 * @param {number} totalSeconds
 */
export const formatAudioClock = (totalSeconds = 0) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
