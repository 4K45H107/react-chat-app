/** Format a Firestore Timestamp, Date, or ms value for chat bubbles. */
export const formatMessageTime = (createdAt) => {
  if (createdAt == null) return "";

  const date = createdAt?.toDate
    ? createdAt.toDate()
    : createdAt instanceof Date
      ? createdAt
      : new Date(createdAt);

  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
