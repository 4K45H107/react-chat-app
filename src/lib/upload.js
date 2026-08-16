import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebase";
import { assertRateLimit } from "./rateLimit";

/**
 * Upload a file to Firebase Storage.
 * Prefer paths under {folder}/{uid}/... so Storage rules can require ownership.
 * @param {File|Blob} file
 * @param {{ uid?: string, folder?: "images"|"audio", fileName?: string }} [options]
 */
const upload = async (file, { uid, folder = "images", fileName } = {}) => {
  if (!file) return null;

  assertRateLimit(uid, "upload");

  const safeFolder = folder === "audio" ? "audio" : "images";
  const rawName =
    fileName || file.name || (safeFolder === "audio" ? "voice.webm" : "image");
  const safeName = String(rawName).replace(/[^\w.\-]+/g, "_");
  const path = uid
    ? `${safeFolder}/${uid}/${Date.now()}_${safeName}`
    : `${safeFolder}/${Date.now()}_${safeName}`;

  const storageRef = ref(storage, path);
  const metadata =
    file.type && typeof file.type === "string"
      ? { contentType: file.type }
      : undefined;
  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      () => {},
      (error) => {
        console.error(
          "[upload] Upload failed:",
          error.code,
          error.message,
          error
        );
        reject("Something went wrong! " + error.message);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
      }
    );
  });
};

export default upload;
