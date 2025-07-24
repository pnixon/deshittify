// webpage/components/PodcastPlayer.js
// Displays a podcast (audio/video) stream

window.PodcastPlayer = function PodcastPlayer({ podcast }) {
  const items = podcast.items || podcast.orderedItems || [];
  if (!Array.isArray(items) || items.length === 0) return null;

  const extractUrl = window.extractUrl;
  const formatDuration = window.formatDuration;
  const formatTimestamp = window.formatTimestamp;

  return (
    <div className="podcast-player" style={{
      margin: "32px 0",
      background: "#181c22",
      borderRadius: "10px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
      padding: "24px"
    }}>
      <h2 style={{ color: "#58a6ff", marginBottom: "18px" }}>
        {podcast.name || podcast.summary || "Podcast"}
      </h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((item, idx) => {
          const url = extractUrl(item.url);
          return (
            <li key={item.id || idx} style={{
              marginBottom: "24px",
              borderBottom: "1px solid #30363d",
              paddingBottom: "16px"
            }}>
              <div style={{ fontWeight: "bold", color: "#f0f6fc" }}>
                {item.name || `Episode ${idx + 1}`}
              </div>
              {item.published && (
                <div style={{ color: "#8b949e", fontSize: "0.9em" }}>
                  {formatTimestamp(item.published)}
                </div>
              )}
              {item.summary && (
                <div style={{ color: "#8b949e", fontStyle: "italic", marginBottom: "6px" }}>
                  {item.summary}
                </div>
              )}
              {item.type === "Audio" && url && (
                <audio controls src={url} style={{ width: "100%", margin: "10px 0" }} />
              )}
              {item.type === "Video" && url && (
                <video controls src={url} style={{ width: "100%", margin: "10px 0" }} />
              )}
              {item.duration && (
                <div style={{ color: "#8b949e", fontSize: "0.9em" }}>
                  Duration: {formatDuration(item.duration)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};