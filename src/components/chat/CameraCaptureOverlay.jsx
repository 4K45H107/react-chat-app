export default function CameraCaptureOverlay({
  capturedPhotoUrl,
  isCameraStarting,
  isSending,
  videoRef,
  onClose,
  onRetake,
  onSend,
  onCapture,
}) {
  return (
    <div
      className="cameraOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo"
    >
      <div className="cameraStage">
        {capturedPhotoUrl ? (
          <img src={capturedPhotoUrl} alt="Captured photo preview" />
        ) : isCameraStarting ? (
          <p className="cameraStatus">Starting camera…</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Camera preview"
          />
        )}
      </div>
      <div className="cameraActions">
        <button
          type="button"
          className="cameraCancel"
          onClick={onClose}
          disabled={isSending}
        >
          Cancel
        </button>
        {capturedPhotoUrl ? (
          <>
            <button
              type="button"
              className="cameraCancel"
              onClick={onRetake}
              disabled={isSending}
            >
              Retake
            </button>
            <button
              type="button"
              className="cameraSend"
              onClick={onSend}
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="cameraSend"
            onClick={onCapture}
            disabled={isSending || isCameraStarting}
          >
            Capture
          </button>
        )}
      </div>
    </div>
  );
}
