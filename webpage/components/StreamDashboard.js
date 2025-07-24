// webpage/components/StreamDashboard.js
// Main controller: manages loaded streams, routes to correct viewer

window.StreamDashboard = function StreamDashboard({ loadedStreams }) {
  const React = window.React;
  const { useState, useEffect } = React;

  // Helper: determine stream type
  function detectStreamType(data) {
    if (!data) return "unknown";
    const items = data.items || data.orderedItems || [];
    if (!Array.isArray(items) || items.length === 0) return "unknown";
    if (items.every(item => item && item.type === "Image")) return "carousel";
    if (items.every(item => item && (item.type === "Audio" || item.type === "Video"))) return "podcast";
    if (items.every(item => item && typeof item.inReplyTo !== "undefined")) return "comments";
    if (items.some(item => item && (item.type === "Note" || item.type === "Article" || item.type === "Post"))) return "postfeed";
    return "postfeed";
  }

  // Find the default stream id (prefer "Basic Post Feed")
  const defaultStream = loadedStreams.find(
    s => (s.name || (s.data && s.data.name)) === "Basic Post Feed"
      || (s.data && s.data.name === "Basic Post Feed")
  ) || loadedStreams[0];

  const defaultStreamId = defaultStream
    ? (defaultStream.id || (defaultStream.data && defaultStream.data.id))
    : null;

  // State: selected stream id
  const [selectedStreamId, setSelectedStreamId] = useState(defaultStreamId);

  // If loadedStreams changes and selected stream is missing, reset to default
  useEffect(() => {
    if (!loadedStreams.some(
      s => (s.id || (s.data && s.data.id)) === selectedStreamId
    )) {
      setSelectedStreamId(defaultStreamId);
    }
  }, [loadedStreams, selectedStreamId, defaultStreamId]);

  // Find the selected stream object
  const selectedStream = loadedStreams.find(
    s => (s.id || (s.data && s.data.id)) === selectedStreamId
  ) || defaultStream;

  // Get stream data and type
  const streamData = selectedStream && (selectedStream.data || selectedStream);
  const streamType = detectStreamType(streamData);

  const StreamInfoPanel = window.StreamInfoPanel;
  const PostFeed = window.PostFeed;
  const CarouselViewer = window.CarouselViewer;
  const PodcastPlayer = window.PodcastPlayer;
  const CommentsSection = window.CommentsSection;

  // UI: Stream selection bar
  function renderStreamSelector() {
    return (
      <div style={{
        display: "flex",
        gap: "12px",
        marginBottom: "18px",
        flexWrap: "wrap"
      }}>
        {loadedStreams.map((s, idx) => {
          const sData = s.data || s;
          const sId = s.id || sData.id;
          const sName = s.name || sData.name || `Stream ${idx + 1}`;
          return (
            <button
              key={sId || idx}
              onClick={() => setSelectedStreamId(sId)}
              style={{
                padding: "8px 18px",
                borderRadius: "6px",
                border: sId === selectedStreamId ? "2px solid #58a6ff" : "1px solid #30363d",
                background: sId === selectedStreamId ? "#21262d" : "#181c22",
                color: "#f0f6fc",
                fontWeight: sId === selectedStreamId ? "bold" : "normal",
                cursor: "pointer",
                outline: "none",
                boxShadow: sId === selectedStreamId ? "0 0 6px #58a6ff55" : "none",
                transition: "all 0.15s"
              }}
            >
              {sName}
            </button>
          );
        })}
      </div>
    );
  }

  // Render the selected stream's main view
  function renderSelectedStream() {
    if (!streamData) return <div style={{ color: "#f85149" }}>No stream selected.</div>;
    if (streamType === "postfeed") {
      return <PostFeed feed={streamData} />;
    }
    if (streamType === "carousel") {
      return <CarouselViewer images={streamData.items || streamData.orderedItems} title={streamData.name || "Image Carousel"} />;
    }
    if (streamType === "podcast") {
      return <PodcastPlayer podcast={streamData} />;
    }
    if (streamType === "comments") {
      return <CommentsSection comments={streamData} />;
    }
    return <div style={{ color: "#8b949e" }}>Unknown stream type.</div>;
  }

  return (
    <div>
      <StreamInfoPanel loadedStreams={loadedStreams} />
      {renderStreamSelector()}
      {renderSelectedStream()}
    </div>
  );
};