import MessageBubble from "./MessageBubble";

export default function MessageList({
  messages,
  isLoadingOlder,
  hasMore,
  isChatBlocked,
  isCurrentUserBlocked,
  currentUserId,
  isGroup,
  memberNameById,
  editingMessageId,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  matchIds,
  activeMatchIndex,
  messageNodeRefs,
  centerRef,
  endRef,
  onScroll,
}) {
  return (
    <div
      className="center"
      ref={centerRef}
      onScroll={onScroll}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Message thread"
    >
      {isLoadingOlder && (
        <p className="loadOlderHint">Loading earlier messages…</p>
      )}
      {!hasMore && messages.length > 0 && (
        <p className="loadOlderHint">Beginning of conversation</p>
      )}
      {isChatBlocked && (
        <p className="blockedNotice">
          {isCurrentUserBlocked
            ? "You can't message this user — you've been blocked."
            : "You blocked this user."}
        </p>
      )}
      {!messages.length && !isChatBlocked && (
        <p className="emptyMessages">
          No messages yet. Say hello to start the conversation.
        </p>
      )}
      {messages.map((message, index) => {
        const isEditing = editingMessageId === message.id;
        const isMatch = Boolean(message.id) && matchIds.includes(message.id);
        const isActiveMatch =
          isMatch && matchIds[activeMatchIndex] === message.id;

        return (
          <MessageBubble
            key={message.id ?? `${message.senderId}-${index}`}
            message={message}
            currentUserId={currentUserId}
            isGroup={isGroup}
            memberNameById={memberNameById}
            isEditing={isEditing}
            editText={editText}
            onEditTextChange={onEditTextChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onStartEdit={onStartEdit}
            onDelete={onDelete}
            isMatch={isMatch}
            isActiveMatch={isActiveMatch}
            registerNode={(id, node) => {
              if (!id) return;
              if (node) messageNodeRefs.current.set(id, node);
              else messageNodeRefs.current.delete(id);
            }}
          />
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
