/**
 * Open the device camera (rear camera when available).
 * @returns {Promise<MediaStream>}
 */
export const startCameraStream = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("Camera is not supported in this browser.");
    error.name = "NotSupportedError";
    throw error;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  } catch (error) {
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
      throw error;
    }
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
};

/**
 * Grab the current video frame as a JPEG blob.
 * @param {HTMLVideoElement} video
 * @param {{ type?: string, quality?: number, maxEdge?: number }} [options]
 * @returns {Promise<Blob>}
 */
export const captureVideoFrame = (
  video,
  { type = "image/jpeg", quality = 0.9, maxEdge = 1600 } = {}
) => {
  const srcW = video?.videoWidth ?? 0;
  const srcH = video?.videoHeight ?? 0;
  if (!srcW || !srcH) {
    return Promise.reject(new Error("Camera is not ready yet."));
  }

  let width = srcW;
  let height = srcH;
  if (Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Could not capture photo."));
  }

  ctx.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error("Could not capture photo."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
};
