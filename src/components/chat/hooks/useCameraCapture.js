import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { captureVideoFrame, startCameraStream } from "../../../lib/cameraCapture";

export function useCameraCapture({
  chatId,
  canSend,
  isChatBlocked,
  isSending,
  clearOwnTyping,
  onBeforeOpen,
  sendImageFile,
}) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);

  const cameraStreamRef = useRef(null);
  const cameraSessionRef = useRef(0);
  const videoRef = useRef(null);
  const capturedBlobRef = useRef(null);
  const capturedUrlRef = useRef(null);

  const stopCameraTracks = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const revokeCapturedPhoto = () => {
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
    capturedBlobRef.current = null;
    setCapturedPhotoUrl(null);
  };

  const closeCamera = () => {
    cameraSessionRef.current += 1;
    stopCameraTracks();
    revokeCapturedPhoto();
    setIsCameraOpen(false);
    setIsCameraStarting(false);
  };

  useEffect(() => {
    return () => {
      closeCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
  }, []);

  useEffect(() => {
    if (!chatId) return;
    closeCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on chat switch
  }, [chatId]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!isCameraOpen || capturedPhotoUrl || !video || !stream) return;

    video.srcObject = stream;
    const playAttempt = video.play();
    if (playAttempt?.catch) playAttempt.catch(() => {});
  }, [isCameraOpen, capturedPhotoUrl, isCameraStarting]);

  useEffect(() => {
    if (!isCameraOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isSending) closeCamera();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // closeCamera is stable enough for Escape; recreating the listener each render
    // would be noisier than matching the prior Chat.jsx behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraOpen, isSending]);

  const openCamera = async () => {
    if (isChatBlocked || isSending || isCameraOpen || !canSend) return;

    onBeforeOpen?.();
    await clearOwnTyping();

    setIsCameraOpen(true);
    setIsCameraStarting(true);
    revokeCapturedPhoto();
    const session = ++cameraSessionRef.current;

    try {
      const stream = await startCameraStream();
      if (cameraSessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const playAttempt = videoRef.current.play();
        if (playAttempt?.catch) playAttempt.catch(() => {});
      }
      setIsCameraStarting(false);
    } catch (error) {
      if (cameraSessionRef.current !== session) return;
      console.error(
        "[Chat] Camera permission / start failed:",
        error.name,
        error.message
      );
      closeCamera();
      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        toast.error("Camera permission is required to take a photo.");
      } else if (error?.name === "NotFoundError") {
        toast.error("No camera was found on this device.");
      } else if (error?.name === "NotSupportedError") {
        toast.warn("Camera is not supported in this browser.");
      } else {
        toast.error("Could not open the camera. Please try again.");
      }
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || isSending || isCameraStarting) return;

    try {
      const blob = await captureVideoFrame(video);
      revokeCapturedPhoto();
      capturedBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      capturedUrlRef.current = url;
      setCapturedPhotoUrl(url);
    } catch (error) {
      console.error("[Chat] Failed to capture photo:", error.message || error);
      toast.error("Could not capture photo. Please try again.");
    }
  };

  const retakePhoto = () => {
    if (isSending) return;
    revokeCapturedPhoto();
  };

  const sendCapturedPhoto = async () => {
    const blob = capturedBlobRef.current;
    if (!blob || isSending) return;

    const file = new File([blob], `photo-${Date.now()}.jpg`, {
      type: blob.type || "image/jpeg",
    });
    const sent = await sendImageFile(file);
    if (sent) closeCamera();
  };

  return {
    isCameraOpen,
    isCameraStarting,
    capturedPhotoUrl,
    videoRef,
    openCamera,
    closeCamera,
    capturePhoto,
    retakePhoto,
    sendCapturedPhoto,
  };
}
