export default function ChatHeader({
  isGroup,
  groupName,
  groupAvatar,
  user,
  partnerTyping,
  partnerOnline,
  participantCount,
  threadSearchOpen,
  canCall,
  onBack,
  onToggleSearch,
  onStartVoiceCall,
  onStartVideoCall,
  onToggleDetails,
}) {
  return (
    <div className="top">
      <button
        type="button"
        className="backButton"
        onClick={onBack}
        aria-label="Back to chat list"
      >
        ←
      </button>
      <div className="user">
        {isGroup ? (
          groupAvatar ? (
            <img src={groupAvatar} alt={groupName || "Group"} />
          ) : (
            <div className="groupAvatarHeader" aria-hidden="true">
              {(groupName || "G").slice(0, 1).toUpperCase()}
            </div>
          )
        ) : (
          <img
            src={user?.avatar || "./avatar.png"}
            alt={user?.username ?? "Chat partner"}
          />
        )}
        <div className="texts">
          <span>
            {isGroup ? groupName || "Group" : user?.username ?? "Unknown user"}
          </span>
          <p className={partnerTyping ? "typingStatus" : undefined}>
            {partnerTyping
              ? isGroup
                ? "Someone is typing…"
                : "typing…"
              : isGroup
                ? `${participantCount} members`
                : partnerOnline
                  ? "Online"
                  : (user?.email ?? "Offline")}
          </p>
        </div>
      </div>
      <div className="icons">
        <button
          type="button"
          className="iconButton"
          onClick={onToggleSearch}
          aria-label={
            threadSearchOpen ? "Close message search" : "Search in chat"
          }
          aria-pressed={threadSearchOpen}
        >
          <svg
            className="chromeIcon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="16"
              y1="16"
              x2="20.5"
              y2="20.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="iconButton"
          onClick={onStartVoiceCall}
          disabled={!canCall}
          aria-label="Start voice call"
          title={isGroup ? "Voice calls are 1:1 only" : "Voice call"}
        >
          <img src="./phone.png" alt="" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="iconButton"
          onClick={onStartVideoCall}
          disabled={!canCall}
          aria-label="Start video call"
          title={isGroup ? "Video calls are 1:1 only" : "Video call"}
        >
          <img src="./video.png" alt="" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="iconButton"
          onClick={onToggleDetails}
          aria-label="Toggle chat details"
        >
          <img src="./info.png" alt="" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
