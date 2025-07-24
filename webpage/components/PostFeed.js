// webpage/components/PostFeed.js
// Displays a feed of posts, articles, notes, or mixed collections

window.PostFeed = function PostFeed({ feed, comments }) {
  const items = feed.items || feed.orderedItems || [];
  if (!Array.isArray(items) || items.length === 0) return null;

  function renderMedia(item) {
    const url = window.extractUrl(item.url);
    if (!url) return null;
    if (item.type === "Image") {
      return <img src={url} alt={item.name || "Image"} style={{
        maxWidth: "100%", borderRadius: "8px", margin: "12px 0"
      }} />;
    }
    if (item.type === "Audio") {
      return <audio controls src={url} style={{ width: "100%", margin: "12px 0" }} />;
    }
    if (item.type === "Video") {
      return <video controls src={url} style={{ width: "100%", margin: "12px 0" }} />;
    }
    return <a href={url} target="_blank" rel="noopener noreferrer">{item.name || url}</a>;
  }

  const formatTimestamp = window.formatTimestamp;
  const CommentsSection = window.CommentsSection;

  return (
    <div className="post-feed">
      <h1 style={{ color: "#58a6ff", marginBottom: "24px" }}>
        {feed.name || feed.summary || "ActivityStreams Feed"}
      </h1>
      {items.map((item, idx) => (
        <div key={item.id || idx} className="post" style={{
          border: "1px solid #30363d",
          borderRadius: "8px",
          background: "#181c22",
          marginBottom: "28px",
          padding: "22px"
        }}>
          <div className="post-header" style={{ marginBottom: "10px" }}>
            <h2 className="post-title" style={{ color: "#f0f6fc", margin: 0 }}>
              {item.name || item.summary || `${item.type} Post`}
            </h2>
            <span className="post-type" style={{
              background: "#238636",
              color: "#fff",
              borderRadius: "20px",
              padding: "4px 12px",
              fontSize: "0.95em"
            }}>
              {item.type}
            </span>
          </div>
          {item.published && (
            <div className="post-timestamp" style={{ color: "#8b949e", fontSize: "0.9em" }}>
              Published: {formatTimestamp(item.published)}
            </div>
          )}
          {item.summary && item.name && (
            <div className="collection-summary" style={{
              color: "#8b949e", fontStyle: "italic", marginBottom: "10px"
            }}>
              {item.summary}
            </div>
          )}
          {item.content && (
            <div className="post-content" style={{ margin: "12px 0" }}>
              {typeof item.content === "string"
                ? <div dangerouslySetInnerHTML={{ __html: item.content }} />
                : JSON.stringify(item.content)}
            </div>
          )}
          {renderMedia(item)}
          {item.attachment && (Array.isArray(item.attachment) ? item.attachment : [item.attachment]).map((att, i) =>
            <div key={i}>{renderMedia(att)}</div>
          )}
          {item.image && renderMedia(typeof item.image === "string" ? { type: "Image", url: item.image } : item.image)}
          {item.icon && renderMedia(typeof item.icon === "string" ? { type: "Image", url: item.icon } : item.icon)}
          {item.id && comments && (
            <CommentsSection comments={comments} postId={item.id} />
          )}
        </div>
      ))}
    </div>
  );
};