import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import { useCallStore } from "../../lib/callStore";
import {
  addIceCandidate,
  createCall,
  listenCall,
  listenIceCandidates,
  listenIncomingCalls,
  postCallHistoryMessage,
  setCallAnswer,
  updateCallStatus,
} from "../../lib/callService";
import {
  CALL_RING_TIMEOUT_MS,
  RTC_CONFIGURATION,
} from "../../lib/webrtcConfig";
import "./CallOverlay.css";

const CONNECT_FAIL_MS = 25_000;

const stopStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const logCall = (...args) => {
  console.log("[Call]", ...args);
};

const CallOverlay = () => {
  const { currentUser } = useUserStore();
  const {
    callType,
    phase,
    remoteUser,
    muted,
    cameraOff,
    resetCall,
    setOutgoing,
    setIncoming,
    setPhase,
    setMuted,
    setCameraOff,
  } = useCallStore();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const unsubsRef = useRef([]);
  const endingRef = useRef(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const activeSinceRef = useRef(null);
  const pendingRemoteIceRef = useRef([]);
  const remoteDescReadyRef = useRef(false);
  const callIdRef = useRef(null);
  const myUidRef = useRef(null);
  const pendingLocalIceRef = useRef([]);

  const clearListeners = () => {
    unsubsRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    });
    unsubsRef.current = [];
  };

  const cleanupMedia = useCallback(() => {
    clearListeners();
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    pendingRemoteIceRef.current = [];
    pendingLocalIceRef.current = [];
    remoteDescReadyRef.current = false;
    callIdRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const uploadLocalIce = async (candidate) => {
    const callId = callIdRef.current;
    const uid = myUidRef.current;
    if (!candidate || !callId || !uid) {
      pendingLocalIceRef.current.push(candidate);
      return;
    }
    try {
      await addIceCandidate(callId, uid, candidate);
      logCall("ICE uploaded");
    } catch (error) {
      console.warn("[Call] ICE upload failed:", error.code, error.message);
    }
  };

  const flushPendingLocalIce = async () => {
    const queued = pendingLocalIceRef.current.filter(Boolean);
    pendingLocalIceRef.current = [];
    for (const candidate of queued) {
      await uploadLocalIce(candidate);
    }
  };

  const flushPendingRemoteIce = async (pc) => {
    const queued = pendingRemoteIceRef.current;
    pendingRemoteIceRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        logCall("queued remote ICE applied");
      } catch (error) {
        console.warn("[Call] queued ICE failed:", error.message);
      }
    }
  };

  const finishCall = useCallback(
    async (status = "ended") => {
      if (endingRef.current) return;
      endingRef.current = true;

      const state = useCallStore.getState();
      const id = state.callId;
      const me = currentUser?.id;
      const durationSec = activeSinceRef.current
        ? Math.max(0, Math.round((Date.now() - activeSinceRef.current) / 1000))
        : 0;

      if (id && me && state.chatId && state.callType) {
        try {
          await postCallHistoryMessage({
            chatId: state.chatId,
            callId: id,
            senderId: me,
            type: state.callType,
            status,
            durationSec: status === "ended" ? durationSec : undefined,
          });
        } catch (error) {
          console.warn(
            "[Call] Failed to post call history:",
            error.code,
            error.message
          );
        }
      }

      cleanupMedia();
      if (id && me) {
        try {
          await updateCallStatus(id, status, { endedBy: me });
        } catch (error) {
          console.warn(
            "[Call] Failed to update status:",
            error.code,
            error.message
          );
        }
      }
      resetCall();
      endingRef.current = false;
      activeSinceRef.current = null;
      setElapsedSec(0);
    },
    [cleanupMedia, currentUser?.id, resetCall]
  );

  // Incoming call listener
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsub = listenIncomingCalls(currentUser.id, {
      onData: (call) => {
        const { phase: p, callId: activeId } = useCallStore.getState();
        if (!call) return;
        if (p !== "idle") return;
        if (activeId === call.id) return;
        setIncoming(call);
      },
      onError: (error) => {
        console.warn(
          "[Call] Incoming listener failed:",
          error.code,
          error.message
        );
      },
    });

    return () => unsub();
  }, [currentUser?.id, setIncoming]);

  // Attach streams to media elements
  useEffect(() => {
    const video = localVideoRef.current;
    if (!video || !localStream) return;
    if (video.srcObject !== localStream) {
      video.srcObject = localStream;
    }
    const playAttempt = video.play();
    if (playAttempt?.catch) playAttempt.catch(() => {});
  }, [localStream, phase, cameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      const playAttempt = remoteAudioRef.current.play();
      if (playAttempt?.catch) playAttempt.catch(() => {});
    }
  }, [remoteStream, phase]);

  // Call duration timer
  useEffect(() => {
    if (phase !== "active") return;
    if (!activeSinceRef.current) activeSinceRef.current = Date.now();
    const id = setInterval(() => {
      setElapsedSec(
        Math.floor((Date.now() - (activeSinceRef.current || Date.now())) / 1000)
      );
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Ring timeout
  useEffect(() => {
    if (phase !== "ringing-out" && phase !== "ringing-in") return;
    const timer = setTimeout(() => {
      const { phase: livePhase, role: liveRole } = useCallStore.getState();
      if (livePhase !== "ringing-out" && livePhase !== "ringing-in") return;
      const status = liveRole === "caller" ? "missed" : "declined";
      finishCall(status).catch(() => {});
      if (liveRole === "caller") toast.info("No answer");
    }, CALL_RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, finishCall]);

  // Connecting timeout → failed UI (don't vanish)
  useEffect(() => {
    if (phase !== "connecting") return;
    const timer = setTimeout(() => {
      if (useCallStore.getState().phase !== "connecting") return;
      setPhase("failed");
      toast.error(
        "Call is taking too long to connect. End and try again (same Wi‑Fi works best)."
      );
    }, CONNECT_FAIL_MS);
    return () => clearTimeout(timer);
  }, [phase, setPhase]);

  const markConnected = () => {
    if (endingRef.current) return;
    if (useCallStore.getState().phase === "active") return;
    logCall("markConnected");
    setPhase("active");
    useCallStore.getState().setError(null);
    if (!activeSinceRef.current) activeSinceRef.current = Date.now();
  };

  const createPeer = (stream) => {
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    pcRef.current = pc;

    // IMPORTANT: attach before setLocalDescription so early ICE is not lost
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        logCall("ICE gathering complete");
        return;
      }
      uploadLocalIce(event.candidate);
    };

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      logCall("local track", track.kind);
    });

    const inbound = new MediaStream();
    setRemoteStream(inbound);

    pc.ontrack = (event) => {
      logCall("ontrack", event.track.kind);
      event.track && inbound.addTrack(event.track);
      event.streams[0]?.getTracks().forEach((track) => {
        if (!inbound.getTracks().includes(track)) inbound.addTrack(track);
      });
      setRemoteStream(new MediaStream(inbound.getTracks()));
      // Receiving media is a strong signal the call is up
      markConnected();
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      logCall("iceConnectionState:", state);
      if (state === "connected" || state === "completed") markConnected();
      if (state === "failed") {
        setPhase("failed");
        toast.error("ICE failed. End and redial.");
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      logCall("connectionState:", state);
      if (endingRef.current) return;
      if (state === "connected") markConnected();
      if (state === "failed") {
        setPhase("failed");
        toast.error(
          "Could not connect the call. Try again on the same network."
        );
      }
    };

    return pc;
  };

  const listenRemoteIce = (activeCallId, remoteUid) => {
    const unsubIce = listenIceCandidates(activeCallId, remoteUid, {
      onCandidate: async (candidate) => {
        const pc = pcRef.current;
        if (!pc) return;
        if (!remoteDescReadyRef.current) {
          pendingRemoteIceRef.current.push(candidate);
          logCall("remote ICE queued");
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          logCall("remote ICE applied");
        } catch (error) {
          console.warn("[Call] addIceCandidate failed:", error.message);
        }
      },
      onError: (error) => {
        console.warn("[Call] ICE listen failed:", error.code, error.message);
      },
    });
    unsubsRef.current.push(unsubIce);
  };

  const listenCallDoc = (activeCallId) => {
    const unsubCall = listenCall(activeCallId, {
      onData: async (call) => {
        if (!call) return;
        if (
          call.status === "ended" ||
          call.status === "declined" ||
          call.status === "missed"
        ) {
          logCall("remote status →", call.status);
          if (!endingRef.current) {
            endingRef.current = true;
            const state = useCallStore.getState();
            const me = myUidRef.current || useUserStore.getState().currentUser?.id;
            const durationSec = activeSinceRef.current
              ? Math.max(
                  0,
                  Math.round((Date.now() - activeSinceRef.current) / 1000)
                )
              : 0;
            if (me && state.chatId && state.callType && state.callId) {
              postCallHistoryMessage({
                chatId: state.chatId,
                callId: state.callId,
                senderId: me,
                type: state.callType,
                status: call.status,
                durationSec:
                  call.status === "ended" ? durationSec : undefined,
              }).catch((error) => {
                console.warn(
                  "[Call] Failed to post call history:",
                  error.code,
                  error.message
                );
              });
            }
            cleanupMedia();
            resetCall();
            endingRef.current = false;
            activeSinceRef.current = null;
            setElapsedSec(0);
          }
          return;
        }

        const pc = pcRef.current;
        if (
          useCallStore.getState().role === "caller" &&
          call.answer &&
          pc &&
          !remoteDescReadyRef.current
        ) {
          try {
            logCall("caller got answer");
            await pc.setRemoteDescription(call.answer);
            remoteDescReadyRef.current = true;
            await flushPendingRemoteIce(pc);
            setPhase("connecting");
          } catch (error) {
            console.error("[Call] setRemoteDescription(answer) failed:", error);
          }
        }
      },
      onError: (error) => {
        console.warn("[Call] Call doc listen failed:", error.code, error.message);
      },
    });
    unsubsRef.current.push(unsubCall);
  };

  const startOutgoing = useCallback(
    async ({ type, partner, activeChatId }) => {
      if (!currentUser?.id || !partner?.id) return;
      if (useCallStore.getState().phase !== "idle") {
        toast.warn("You're already in a call.");
        return;
      }

      endingRef.current = false;
      myUidRef.current = currentUser.id;
      pendingLocalIceRef.current = [];
      pendingRemoteIceRef.current = [];
      remoteDescReadyRef.current = false;
      callIdRef.current = null;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === "video",
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPeer(stream);
        const offer = await pc.createOffer();
        // ICE gathering starts here — onicecandidate already attached
        await pc.setLocalDescription(offer);

        const newCallId = await createCall({
          chatId: activeChatId,
          callerId: currentUser.id,
          calleeId: partner.id,
          callerName: currentUser.username || "",
          calleeName: partner.username || "",
          type,
          offer: { type: offer.type, sdp: offer.sdp },
        });

        callIdRef.current = newCallId;
        await flushPendingLocalIce();

        setOutgoing({
          callId: newCallId,
          callType: type,
          remoteUser: {
            id: partner.id,
            username: partner.username,
            avatar: partner.avatar,
          },
          chatId: activeChatId,
        });

        listenRemoteIce(newCallId, partner.id);
        listenCallDoc(newCallId);
        logCall("outgoing call created", newCallId);
      } catch (error) {
        console.error("[Call] startOutgoing failed:", error);
        cleanupMedia();
        resetCall();
        if (error?.name === "NotAllowedError") {
          toast.error("Microphone/camera permission is required for calls.");
        } else {
          toast.error("Could not start the call. Please try again.");
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, cleanupMedia, resetCall, setOutgoing]
  );

  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail;
      if (!detail) return;
      startOutgoing(detail);
    };
    window.addEventListener("rca:start-call", handler);
    return () => window.removeEventListener("rca:start-call", handler);
  }, [startOutgoing]);

  const acceptIncoming = async () => {
    const state = useCallStore.getState();
    if (!state.callId || !currentUser?.id || state.phase !== "ringing-in") {
      return;
    }

    endingRef.current = false;
    myUidRef.current = currentUser.id;
    pendingLocalIceRef.current = [];
    pendingRemoteIceRef.current = [];
    remoteDescReadyRef.current = false;
    callIdRef.current = state.callId;
    setPhase("connecting");

    try {
      const callSnap = await getDoc(doc(db, "calls", state.callId));
      if (!callSnap.exists()) {
        toast.error("Call no longer available.");
        resetCall();
        return;
      }
      const call = { id: callSnap.id, ...callSnap.data() };
      if (call.status !== "ringing" || !call.offer) {
        toast.error("Call already ended.");
        resetCall();
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", call.callerId));
        if (userSnap.exists()) {
          useCallStore.setState({
            remoteUser: {
              id: call.callerId,
              username: userSnap.data().username || call.callerName || "Caller",
              avatar: userSnap.data().avatar || null,
            },
          });
        }
      } catch {
        /* ignore */
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.type === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeer(stream);

      // Listen for caller ICE before/while applying remote description
      listenRemoteIce(call.id, call.callerId);
      listenCallDoc(call.id);

      await pc.setRemoteDescription(call.offer);
      remoteDescReadyRef.current = true;
      await flushPendingRemoteIce(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await flushPendingLocalIce();
      await setCallAnswer(call.id, { type: answer.type, sdp: answer.sdp });

      logCall("incoming accepted", call.id);
      setPhase("connecting");
    } catch (error) {
      console.error("[Call] acceptIncoming failed:", error);
      await finishCall("declined");
      if (error?.name === "NotAllowedError") {
        toast.error("Microphone/camera permission is required for calls.");
      } else {
        toast.error("Could not answer the call.");
      }
    }
  };

  const declineIncoming = () => {
    finishCall("declined").catch(() => {});
  };

  const hangUp = () => {
    finishCall("ended").catch(() => {});
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  const toggleCamera = () => {
    if (callType !== "video") return;
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  };

  useEffect(() => {
    if (currentUser?.id) return;
    cleanupMedia();
    resetCall();
  }, [currentUser?.id, cleanupMedia, resetCall]);

  if (phase === "idle") return null;

  const title =
    phase === "ringing-in"
      ? `Incoming ${callType === "video" ? "video" : "voice"} call`
      : phase === "ringing-out"
        ? `Calling ${remoteUser?.username || "…"}`
        : phase === "connecting"
          ? "Connecting…"
          : phase === "failed"
            ? "Connection failed"
            : remoteUser?.username || "In call";

  const formatElapsed = () => {
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return createPortal(
    <div
      className={`callOverlay${callType === "video" ? " isVideo" : " isVoice"}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="callStage">
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {callType === "video" && remoteStream ? (
          <video
            ref={remoteVideoRef}
            className="remoteVideo"
            autoPlay
            playsInline
          />
        ) : (
          <div className="voiceStage">
            <img
              src={remoteUser?.avatar || "./avatar.png"}
              alt=""
              className="remoteAvatar"
            />
            <p className="remoteName">{remoteUser?.username || "User"}</p>
          </div>
        )}

        {callType === "video" && localStream ? (
          <video
            ref={localVideoRef}
            className={`localVideo${cameraOff ? " isOff" : ""}`}
            autoPlay
            playsInline
            muted
          />
        ) : null}

        <div className="callHud">
          <p className="callTitle">{title}</p>
          {phase === "active" ? (
            <p className="callTimer">{formatElapsed()}</p>
          ) : (
            <p className="callHint">
              {phase === "ringing-in"
                ? "Answer to connect"
                : phase === "ringing-out"
                  ? "Waiting for answer…"
                  : phase === "failed"
                    ? "WebRTC could not connect. End and try again."
                    : "Exchanging connection info…"}
            </p>
          )}
        </div>

        <div className="callActions">
          {phase === "ringing-in" ? (
            <>
              <button
                type="button"
                className="callBtn decline"
                onClick={declineIncoming}
              >
                Decline
              </button>
              <button
                type="button"
                className="callBtn accept"
                onClick={acceptIncoming}
              >
                Accept
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`callBtn secondary${muted ? " active" : ""}`}
                onClick={toggleMute}
                aria-pressed={muted}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
              {callType === "video" ? (
                <button
                  type="button"
                  className={`callBtn secondary${cameraOff ? " active" : ""}`}
                  onClick={toggleCamera}
                  aria-pressed={cameraOff}
                >
                  {cameraOff ? "Camera on" : "Camera off"}
                </button>
              ) : null}
              <button type="button" className="callBtn hangup" onClick={hangUp}>
                End
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CallOverlay;

export const requestStartCall = ({ type, partner, activeChatId }) => {
  window.dispatchEvent(
    new CustomEvent("rca:start-call", {
      detail: { type, partner, activeChatId },
    })
  );
};
