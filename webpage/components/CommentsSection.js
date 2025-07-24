// webpage/components/CommentsSection.js
// Renders threaded comments for a post or as standalone

window.CommentsSection = function CommentsSection({ comments, postId }) {
  const formatTimestamp = window.formatTimestamp;

  // Get comments for a specific postId (or all if no postId)
  function getCommentsForPost(comments, postId) {
    if (!comments || !comments.items || !Array.isArray(comments.items)) return [];
    if (!postId) return comments.items;
    return comments.items.filter(comment => comment && comment.inReplyTo === postId);
  }

  // Get replies to a specific commentId
  function getRepliesToComment(comments, commentId) {
    if (!comments || !comments.items || !Array.isArray(comments.items)) return [];
    return comments.items.filter(comment => comment && comment.inReplyTo === commentId);
  }

  // Render a single comment and its replies recursively
  function renderComment(comments, comment, depth = 0) {
    if (!comment || !comment.id) return null;
    const replies = getRepliesToComment(comments, comment.id);
    const maxDepth = 3;
    const indentLevel = Math.min(depth, maxDepth);

    return (
      <div
        key={comment.id}
        className={`comment depth-${indentLevel}`}
        style={{ marginLeft: `${indentLevel * 15}px`, marginBottom: "12px" }}
      >
        <div className="comment-header" style={{ marginBottom: "6px" }}>
          <span className="comment-author" style={{ color: "#58a6ff", fontWeight: "bold" }}>
            {(comment.attributedTo && (typeof comment.attributedTo === "string"
              ? comment.attributedTo
              : comment.attributedTo.name || comment.attributedTo.preferredUsername)) || "Anonymous"}
          </span>
          <span className="comment-timestamp" style={{ color: "#8b949e", marginLeft: "10px" }}>
            {formatTimestamp(comment.published)}
          </span>
        </div>
        <div className="comment-content" style={{ marginBottom: "6px" }}>
          {typeof comment.content === "string"
            ? <div dangerouslySetInnerHTML={{ __html: comment.content }} />
            : JSON.stringify(comment.content)}
        </div>
        {replies.length > 0 && depth < maxDepth && (
          <div className="comment-replies" style={{ marginTop: "8px", paddingLeft: "10px" }}>
            {replies.map(reply => renderComment(comments, reply, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const postComments = getCommentsForPost(comments, postId);
  if (!postComments.length) return null;

  return (
    <div className="comments-section" style={{ marginTop: "18px" }}>
      <h3 className="comments-title" style={{ color: "#58a6ff", marginBottom: "10px" }}>
        Comments ({postComments.length})
      </h3>
      <div className="comments-list">
        {postComments.map(comment => renderComment(comments, comment, 0))}
      </div>
    </div>
  );
};