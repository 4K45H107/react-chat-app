import { formatAudioClock } from "../../lib/audioRecord";
import { formatMessageTime } from "../../lib/formatTime";

export default function MessageBubble({
  message,
  currentUserId,
  isGroup,
  memberNameById,
  isEditing,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  isMatch,
  isActiveMatch,
  registerNode,
}) {
  const isCallLog = Boolean(message.call) && !message.deleted;

  return (
    <div
      className={`message ${
        isCallLog
          ? "callLog"
          : message.senderId === currentUserId
            ? "own"
            : ""
      }${message.deleted ? " deleted" : ""}${isMatch ? " searchMatch" : ""}${
        isActiveMatch ? " searchMatchActive" : ""
      }`}
      ref={(node) => registerNode?.(message.id, node)}
    >
      <div className="texts">
        {isGroup &&
          !message.deleted &&
          !isCallLog &&
          message.senderId !== currentUserId && (
            <span className="senderName">
              {memberNameById.get(message.senderId) || "Member"}
            </span>
          )}
        {message.deleted ? (
          <p className="deletedText">Message deleted</p>
        ) : isEditing ? (
          <div className="editComposer">
            <input
              type="text"
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveEdit(message);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              maxLength={2000}
              aria-label="Edit message"
              autoFocus
            />
            <div className="editActions">
              <button type="button" onClick={onCancelEdit}>
                Cancel
              </button>
              <button type="button" onClick={() => onSaveEdit(message)}>
                Save
              </button>
            </div>
          </div>
        ) : isCallLog ? (
          <p className="callLogText">
            <span className="callLogIcon" aria-hidden="true">
              {message.call?.type === "video" ? "▣" : "☎"}
            </span>
            {message.text || "Call"}
          </p>
        ) : (
          <>
            {message.img ? (
              <a
                className="messageImageLink"
                href={message.img}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  className="messageImage"
                  src={message.img}
                  alt={message.text || "Shared image"}
                />
              </a>
            ) : null}
            {message.audio ? (
              <div className="voiceMessage">
                <audio
                  controls
                  preload="metadata"
                  src={message.audio}
                  aria-label="Voice message"
                />
                {typeof message.audioDuration === "number" ? (
                  <span className="voiceDuration">
                    {formatAudioClock(message.audioDuration)}
                  </span>
                ) : null}
              </div>
            ) : null}
            {message.text ? <p>{message.text}</p> : null}
          </>
        )}
        <div className="messageMeta">
          <span>
            {formatMessageTime(message.createdAt)}
            {message.edited && !message.deleted ? " · edited" : ""}
          </span>
          {message.senderId === currentUserId &&
            !message.deleted &&
            !isEditing &&
            !isCallLog && (
              <>
                {message.text ? (
                  <button
                    type="button"
                    className="editMessage"
                    onClick={() => onStartEdit(message)}
                    aria-label="Edit message"
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  className="deleteMessage"
                  onClick={() => onDelete(message)}
                  aria-label="Delete message"
                >
                  Delete
                </button>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
