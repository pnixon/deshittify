// webpage/components/CarouselViewer.js
// Displays a set of images as a carousel

window.CarouselViewer = function CarouselViewer({ images, title }) {
  const { useState } = React;
  const [current, setCurrent] = useState(0);
  if (!Array.isArray(images) || images.length === 0) return null;

  const goTo = idx => setCurrent((idx + images.length) % images.length);
  const prev = () => goTo(current - 1);
  const next = () => goTo(current + 1);

  const img = images[current];
  const url = window.extractUrl(img.url);

  return (
    <div className="carousel-viewer" style={{
      margin: "32px 0",
      background: "#181c22",
      borderRadius: "10px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
      padding: "24px",
      textAlign: "center"
    }}>
      {title && <h2 style={{ color: "#58a6ff", marginBottom: "18px" }}>{title}</h2>}
      <div style={{ position: "relative", minHeight: "320px" }}>
        <button onClick={prev} style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          fontSize: "2em", background: "none", border: "none", color: "#58a6ff", cursor: "pointer"
        }} aria-label="Previous">&#8592;</button>
        {url && (
          <img
            src={url}
            alt={img.name || "Image"}
            style={{
              maxWidth: "80%",
              maxHeight: "320px",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
            }}
          />
        )}
        <button onClick={next} style={{
          position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
          fontSize: "2em", background: "none", border: "none", color: "#58a6ff", cursor: "pointer"
        }} aria-label="Next">&#8594;</button>
      </div>
      <div style={{ marginTop: "12px", color: "#8b949e" }}>
        {img.name && <span>{img.name}</span>}
        <span style={{ marginLeft: "16px" }}>
          {current + 1} / {images.length}
        </span>
      </div>
      <div style={{ marginTop: "10px" }}>
        {images.map((im, idx) => {
          const thumbUrl = window.extractUrl(im.url);
          return (
            <img
              key={idx}
              src={thumbUrl}
              alt={im.name || `Image ${idx + 1}`}
              style={{
                width: "48px",
                height: "48px",
                objectFit: "cover",
                borderRadius: "6px",
                margin: "0 4px",
                border: idx === current ? "2px solid #58a6ff" : "2px solid transparent",
                cursor: "pointer",
                opacity: idx === current ? 1 : 0.7
              }}
              onClick={() => goTo(idx)}
            />
          );
        })}
      </div>
    </div>
  );
};