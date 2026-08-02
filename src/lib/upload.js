import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebase";

const upload = async (file) => {
  if (!file) return null;

  const date = new Date();

  const storageRef = ref(storage, `images/${date + file.name}`);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      () => {},
      (error) => {
        console.error(
          "[upload] Avatar upload failed:",
          error.code,
          error.message,
          error
        );
        reject("Something went wrong! " + error.message);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then(resolve)
          .catch(reject);
      }
    );
  });
};

export default upload;
