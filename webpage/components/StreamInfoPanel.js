// webpage/components/StreamInfoPanel.js
// Displays loaded streams, stats, and errors

window.StreamInfoPanel = function StreamInfoPanel({ loadedStreams, error }) {
  if ((!loadedStreams || loadedStreams.length === 0) && !error) return null;

  return (
    <div className="loaded-streams-info" style={{
      background: "rgba(88,166,255,0.1)",
      border: "1px solid rgba(88,166,255,0.3)",
      borderRadius: "6px",
      padding: "15px",
      marginBottom: "20px"
    }}>
      <h3 style={{ color: "#58a6ff", marginTop: 0, marginBottom: "10px" }}>
        Loaded Streams {loadedStreams && loadedStreams.length > 0 && `(${loadedStreams.length})`}
      </h3>
      {loadedStreams && loadedStreams.length > 0 && (
        <div style={{ fontSize: "0.95em", color: "#8b949e" }}>
          {loadedStreams.map((stream, idx) => (
            <div key={idx} style={{ marginBottom: "5px" }}>
              {idx + 1}. {stream.source} - {stream.data && (stream.data.type || "unknown")}
              {stream.data && (stream.data.items || stream.data.orderedItems)
                ? ` (${(stream.data.items || stream.data.orderedItems).length} items)`
                : ""}
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="error" style={{
          color: "#f85149",
          background: "rgba(248,81,73,0.1)",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid rgba(248,81,73,0.3)",
          marginTop: "10px"
        }}>
          {error}
        </div>
      )}
    </div>
  );
};