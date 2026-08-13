import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

/** Consider a user online if lastActive is within this window. */
export const ONLINE_THRESHOLD_MS = 60_000;

export const isUserOnline = (lastActive) => {
  if (lastActive == null) return false;
  const ms = lastActive?.toMillis
    ? lastActive.toMillis()
    : lastActive instanceof Date
      ? lastActive.getTime()
      : new Date(lastActive).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms < ONLINE_THRESHOLD_MS;
};

export const bumpLastActive = async (uid) => {
  if (!uid) return;
  await updateDoc(doc(db, "users", uid), {
    lastActive: serverTimestamp(),
  });
};

export const listenUserPresence = (uid, { onData, onError }) => {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      onData(snap.data()?.lastActive ?? null);
    },
    onError
  );
};
