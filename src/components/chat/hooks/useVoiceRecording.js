import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  extensionForAudioMime,
  pickAudioMimeType,
} from "../../../lib/audioRecord";
import { sendMessage, syncSidebarPreview } from "../../../lib/chatService";
import { rateLimitToastMessage } from "../../../lib/rateLimit";
import upload from "../../../lib/upload";
import { MAX_VOICE_SECONDS } from "../chatConstants";

export function useVoiceRecording({
  chatId,
  currentUserId,
  canSend,
  isChatBlocked,
  isSending,
  setIsSending,
  shouldStickToBottomRef,
  clearOwnTyping,
  onBeforeStart,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordStartedAtRef = useRef(0);
  const recordMimeRef = useRef("");
  const shouldSendRecordingRef = useRef(false);

  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const clearRecordTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    shouldSendRecordingRef.current = false;
    clearRecordTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    stopMediaTracks();
    setIsRecording(false);
    setRecordSeconds(0);
  };

  useEffect(() => {
    return () => {
      cancelRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
  }, []);

  useEffect(() => {
    if (!chatId) return;
    cancelRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on chat switch
  }, [chatId]);

  const startRecording = async () => {
    if (
      isChatBlocked ||
      isSending ||
      isRecording ||
      !canSend ||
      typeof MediaRecorder === "undefined"
    ) {
      if (typeof MediaRecorder === "undefined") {
        toast.warn("Voice messages are not supported in this browser.");
      }
      return;
    }

    onBeforeStart?.();

    const mimeType = pickAudioMimeType();
    if (!mimeType) {
      toast.warn("Voice recording is not supported in this browser.");
      return;
    }

    try {
      await clearOwnTyping();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      recordMimeRef.current = mimeType;
      shouldSendRecordingRef.current = false;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        clearRecordTimer();
        stopMediaTracks();
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);

        const shouldSend = shouldSendRecordingRef.current;
        shouldSendRecordingRef.current = false;
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - recordStartedAtRef.current) / 1000)
        );
        setRecordSeconds(0);

        if (!shouldSend || !chunks.length) return;

        const blob = new Blob(chunks, {
          type: recordMimeRef.current || "audio/webm",
        });
        if (blob.size < 200) {
          toast.warn("Recording was too short. Try again.");
          return;
        }

        setIsSending(true);
        shouldStickToBottomRef.current = true;
        try {
          const ext = extensionForAudioMime(blob.type);
          const file = new File([blob], `voice.${ext}`, {
            type: blob.type || "audio/webm",
          });
          let audioUrl;
          try {
            audioUrl = await upload(file, {
              uid: currentUserId,
              folder: "audio",
              fileName: `voice.${ext}`,
            });
          } catch (uploadError) {
            const limited = rateLimitToastMessage(uploadError);
            if (limited) {
              toast.warn(limited);
              return;
            }
            console.error(
              "[Chat] Voice upload failed:",
              uploadError.code || uploadError,
              uploadError.message || uploadError
            );
            if (
              String(uploadError.code || uploadError).includes("permission") ||
              String(uploadError).includes("permission")
            ) {
              toast.error(
                "Voice upload blocked. Deploy Storage rules (audio path)."
              );
            } else {
              toast.error("Failed to upload voice message. Please try again.");
            }
            return;
          }

          if (!audioUrl) {
            toast.error("Failed to upload voice message. Please try again.");
            return;
          }

          try {
            await sendMessage({
              chatId,
              senderId: currentUserId,
              text: "",
              audio: audioUrl,
              audioDuration: Math.min(durationSec, MAX_VOICE_SECONDS),
            });
          } catch (sendError) {
            const limited = rateLimitToastMessage(sendError);
            if (limited) {
              toast.warn(limited);
              return;
            }
            console.error(
              "[Chat] Voice message write failed:",
              sendError.code || sendError,
              sendError.message || sendError
            );
            if (sendError.code === "permission-denied") {
              toast.error(
                "Voice message blocked. Deploy updated Firestore rules."
              );
            } else {
              toast.error("Failed to send voice message. Please try again.");
            }
            return;
          }

          await syncSidebarPreview({
            chatId,
            currentUserId,
            preview: "Voice message",
          });
        } catch (error) {
          console.error(
            "[Chat] Failed to send voice message:",
            error.code || error,
            error.message || error
          );
          toast.error("Failed to send voice message. Please try again.");
        } finally {
          setIsSending(false);
        }
      };

      recorder.start(250);
      recordStartedAtRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);
      clearRecordTimer();
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordStartedAtRef.current) / 1000
        );
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_VOICE_SECONDS) {
          shouldSendRecordingRef.current = true;
          if (mediaRecorderRef.current?.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        }
      }, 250);
    } catch (error) {
      console.error(
        "[Chat] Microphone permission / start failed:",
        error.name,
        error.message
      );
      stopMediaTracks();
      setIsRecording(false);
      if (error?.name === "NotAllowedError") {
        toast.error("Microphone permission is required for voice messages.");
      } else {
        toast.error("Could not start recording. Please try again.");
      }
    }
  };

  const sendRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    shouldSendRecordingRef.current = true;
    clearRecordTimer();
    try {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.warn("[Chat] Failed to stop recorder:", error);
      cancelRecording();
    }
  };

  return {
    isRecording,
    recordSeconds,
    startRecording,
    sendRecording,
    cancelRecording,
  };
}
