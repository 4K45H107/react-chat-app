import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * @typedef {"voice"|"video"} CallMediaType
 * @typedef {"ringing"|"active"|"ended"|"declined"|"missed"} CallStatus
 */

/**
 * Create a ringing call doc (caller writes offer after this, or with it).
 * @param {{
 *   chatId: string,
 *   callerId: string,
 *   calleeId: string,
 *   callerName?: string,
 *   calleeName?: string,
 *   type: CallMediaType,
 *   offer: RTCSessionDescriptionInit,
 * }} params
 */
export const createCall = async ({
  chatId,
  callerId,
  calleeId,
  callerName = "",
  calleeName = "",
  type,
  offer,
}) => {
  const callRef = doc(collection(db, "calls"));
  await setDoc(callRef, {
    id: callRef.id,
    chatId,
    callerId,
    calleeId,
    callerName,
    calleeName,
    type,
    status: "ringing",
    offer,
    answer: null,
    createdAt: serverTimestamp(),
    endedAt: null,
    endedBy: null,
  });
  return callRef.id;
};

export const setCallAnswer = async (callId, answer) => {
  await updateDoc(doc(db, "calls", callId), {
    answer,
    status: "active",
  });
};

export const updateCallStatus = async (
  callId,
  status,
  { endedBy } = {}
) => {
  /** @type {Record<string, unknown>} */
  const patch = { status };
  if (
    status === "ended" ||
    status === "declined" ||
    status === "missed"
  ) {
    patch.endedAt = serverTimestamp();
    if (endedBy) patch.endedBy = endedBy;
  }
  await updateDoc(doc(db, "calls", callId), patch);
};

export const addIceCandidate = async (callId, fromUid, candidate) => {
  if (!candidate) return;
  await addDoc(collection(db, "calls", callId, "iceCandidates"), {
    from: fromUid,
    candidate: candidate.toJSON ? candidate.toJSON() : candidate,
    createdAt: Date.now(),
  });
};

export const listenCall = (callId, { onData, onError }) => {
  return onSnapshot(
    doc(db, "calls", callId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() });
    },
    onError
  );
};

export const listenIceCandidates = (callId, fromUid, { onCandidate, onError }) => {
  const q = query(
    collection(db, "calls", callId, "iceCandidates"),
    where("from", "==", fromUid)
  );

  return onSnapshot(
    q,
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const data = change.doc.data();
        if (data?.candidate) onCandidate(data.candidate);
      });
    },
    onError
  );
};

/** Incoming ringing calls for this user (single-field query; filter client-side). */
export const listenIncomingCalls = (userId, { onData, onError }) => {
  const q = query(
    collection(db, "calls"),
    where("calleeId", "==", userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const ringing = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((call) => call.status === "ringing")
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
          const bMs = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
          return bMs - aMs;
        });
      onData(ringing[0] ?? null);
    },
    onError
  );
};
