// webpage/components/FileLoader.js
// React component for loading .ansybl files via file picker, drag-and-drop, or URL

window.FileLoader = function FileLoader({ onStreamsLoaded, onError }) {
  const { useRef, useState } = React;
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle file input change
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    await processFiles(files);
  };

  // Handle drag-and-drop
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  // Process files and parse as ansybl
  const processFiles = async (files) => {
    setLoading(true);
    let loadedStreams = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const { data, error } = window.parseAnsyblFile(text);
        if (error) {
          onError && onError(`File "${file.name}": ${error}`);
        } else {
          loadedStreams.push({ data, source: file.name });
        }
      } catch (err) {
        onError && onError(`File "${file.name}": ${err.message}`);
      }
    }
    if (loadedStreams.length > 0) {
      onStreamsLoaded(loadedStreams);
    }
    setLoading(false);
  };

  // Handle URL load
  const handleUrlLoad = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const response = await fetch(url);
      const text = await response.text();
      const { data, error } = window.parseAnsyblFile(text);
      if (error) {
        onError && onError(`URL "${url}": ${error}`);
      } else {
        onStreamsLoaded([{ data, source: url }]);
      }
    } catch (err) {
      onError && onError(`URL "${url}": ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div>
      <div
        className={`input-container${dragActive ? " drag-active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: dragActive ? "2px dashed #58a6ff" : "2px dashed #30363d",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "16px",
          background: dragActive ? "rgba(88,166,255,0.08)" : "transparent",
          transition: "background 0.2s"
        }}
      >
        <input
          type="file"
          accept=".ansybl,.json,application/json"
          multiple
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={loading}
        >
          {loading ? "Loading..." : "Select .ansybl or .json Files"}
        </button>
        <span style={{ marginLeft: "12px", color: "#8b949e" }}>
          or drag & drop files here
        </span>
      </div>
      <div className="input-container">
        <input
          type="text"
          placeholder="Enter .ansybl or .json URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
        />
        <button type="button" onClick={handleUrlLoad} disabled={loading || !url}>
          {loading ? "Loading..." : "Add from URL"}
        </button>
      </div>
    </div>
  );
};