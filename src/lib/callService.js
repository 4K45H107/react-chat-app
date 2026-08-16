import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { syncSidebarPreview } from "./chatService";
import { formatAudioClock } from "./audioRecord";

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

/**
 * Human-readable call history line for the chat thread / sidebar.
 * @param {{ type: "voice"|"video", status: string, durationSec?: number|null }} params
 */
export const formatCallHistoryText = ({ type, status, durationSec }) => {
  const kind = type === "video" ? "Video call" : "Voice call";
  if (status === "missed") return `Missed ${kind.toLowerCase()}`;
  if (status === "declined") return `Declined ${kind.toLowerCase()}`;
  if (typeof durationSec === "number" && durationSec > 0) {
    return `${kind} · ${formatAudioClock(durationSec)}`;
  }
  return kind;
};

/**
 * Write a single call-history message into the chat thread.
 * Uses callId as the message id so both peers can safely attempt the write.
 */
export const postCallHistoryMessage = async ({
  chatId,
  callId,
  senderId,
  type,
  status,
  durationSec,
}) => {
  if (!chatId || !callId || !senderId || !type || !status) return false;

  const messageRef = doc(db, "chats", chatId, "messages", callId);
  const existing = await getDoc(messageRef);
  if (existing.exists()) return false;

  const text = formatCallHistoryText({ type, status, durationSec });
  /** @type {Record<string, unknown>} */
  const callMeta = { type, status, callId };
  if (typeof durationSec === "number" && durationSec >= 0) {
    callMeta.durationSec = durationSec;
  }

  try {
    await setDoc(messageRef, {
      id: callId,
      senderId,
      text,
      call: callMeta,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Another peer may have won the create race
    if (error?.code === "already-exists" || error?.code === "permission-denied") {
      return false;
    }
    throw error;
  }

  await syncSidebarPreview({
    chatId,
    currentUserId: senderId,
    preview: text,
  });

  return true;
};
