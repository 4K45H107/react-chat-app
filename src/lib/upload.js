import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload an image to Firebase Storage.
 * Prefer path images/{uid}/... so Storage rules can require ownership.
 */
const upload = async (file, { uid } = {}) => {
  if (!file) return null;

  const safeName = String(file.name || "image").replace(/[^\w.\-]+/g, "_");
  const path = uid
    ? `images/${uid}/${Date.now()}_${safeName}`
    : `images/${Date.now()}_${safeName}`;

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      () => {},
      (error) => {
        console.error(
          "[upload] Image upload failed:",
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
