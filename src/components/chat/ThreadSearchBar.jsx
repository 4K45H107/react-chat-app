export default function ThreadSearchBar({
  threadSearch,
  onThreadSearchChange,
  searchQuery,
  matchCount,
  activeMatchIndex,
  onPrev,
  onNext,
}) {
  return (
    <div className="threadSearch" role="search">
      <input
        type="text"
        value={threadSearch}
        onChange={(e) => onThreadSearchChange(e.target.value)}
        placeholder="Search in this chat…"
        aria-label="Search messages in this chat"
        autoFocus
      />
      <span className="matchCount" aria-live="polite">
        {searchQuery
          ? matchCount
            ? `${activeMatchIndex + 1}/${matchCount}`
            : "0 matches"
          : "—"}
      </span>
      <button
        type="button"
        className="searchNav"
        disabled={!matchCount}
        onClick={onPrev}
        aria-label="Previous match"
      >
        ↑
      </button>
      <button
        type="button"
        className="searchNav"
        disabled={!matchCount}
        onClick={onNext}
        aria-label="Next match"
      >
        ↓
      </button>
    </div>
  );
}
