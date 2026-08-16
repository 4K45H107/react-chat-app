import { create } from "zustand";

const emptyCallState = {
  callId: null,
  role: null, // "caller" | "callee"
  callType: null, // "voice" | "video"
  phase: "idle", // idle | ringing-out | ringing-in | connecting | active | ended
  remoteUser: null, // { id, username, avatar }
  chatId: null,
  muted: false,
  cameraOff: false,
  error: null,
};

export const useCallStore = create((set, get) => ({
  ...emptyCallState,

  resetCall: () => set({ ...emptyCallState }),

  setOutgoing: ({ callId, callType, remoteUser, chatId }) =>
    set({
      callId,
      role: "caller",
      callType,
      phase: "ringing-out",
      remoteUser,
      chatId,
      muted: false,
      cameraOff: callType === "voice",
      error: null,
    }),

  setIncoming: (call) => {
    if (!call || get().phase !== "idle") return;
    set({
      callId: call.id,
      role: "callee",
      callType: call.type,
      phase: "ringing-in",
      remoteUser: {
        id: call.callerId,
        username: call.callerName || "Caller",
        avatar: null,
      },
      chatId: call.chatId,
      muted: false,
      cameraOff: call.type === "voice",
      error: null,
    });
  },

  setPhase: (phase) => set({ phase }),
  setMuted: (muted) => set({ muted }),
  setCameraOff: (cameraOff) => set({ cameraOff }),
  setError: (error) => set({ error }),
}));

// phases: idle | ringing-out | ringing-in | connecting | active | failed | ended
