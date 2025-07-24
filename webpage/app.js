
// webpage/app.js
const Blogs = {
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Collection",
  "name": "Sample Blog Articles",
  "totalItems": 4,
  "items": [
    {
      "type": "Article",
      "id": "https://example.org/blogs/1",
      "name": "How to Build a Stream Dashboard",
      "summary": "A quick guide to building a dashboard for ActivityStreams data.",
      "published": "2024-06-01T10:00:00Z",
      "url": "https://example.org/blogs/1"
    },
    {
      "type": "Article",
      "id": "https://example.org/blogs/2",
      "name": "Understanding ActivityStreams Collections",
      "summary": "An introduction to the ActivityStreams Collection type and its uses.",
      "published": "2024-06-05T12:30:00Z",
      "url": "https://example.org/blogs/2"
    },
    {
      "type": "Article",
      "id": "https://example.org/blogs/3",
      "name": "Fake News: The Rise of Stand-in Content",
      "summary": "Exploring the importance of placeholder data in web development.",
      "published": "2024-06-10T09:15:00Z",
      "url": "https://example.org/blogs/3"
    },
    {
      "type": "Article",
      "id": "https://example.org/blogs/4",
      "name": "Why Podcasts Belong in Your App",
      "summary": "A look at integrating podcast streams into modern web applications.",
      "published": "2024-06-15T14:45:00Z",
      "url": "https://example.org/blogs/4"
    }
  ]
};

const Images = {
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Collection",
  "name": "Sample Images",
  "totalItems": 6,
  "items": [
    {
      "type": "Image",
      "id": "https://example.org/images/1",
      "name": "Sunset Over Lake",
      "url": "https://placehold.co/600x400?text=Sunset"
    },
    {
      "type": "Image",
      "id": "https://example.org/images/2",
      "name": "City Skyline",
      "url": "https://placehold.co/600x400?text=City"
    },
    {
      "type": "Image",
      "id": "https://example.org/images/3",
      "name": "Forest Path",
      "url": "https://placehold.co/600x400?text=Forest"
    },
    {
      "type": "Image",
      "id": "https://example.org/images/4",
      "name": "Mountain Range",
      "url": "https://placehold.co/600x400?text=Mountains"
    },
    {
      "type": "Image",
      "id": "https://example.org/images/5",
      "name": "Desert Dunes",
      "url": "https://placehold.co/600x400?text=Desert"
    },
    {
      "type": "Image",
      "id": "https://example.org/images/6",
      "name": "Ocean Waves",
      "url": "https://placehold.co/600x400?text=Ocean"
    }
  ]
};

const Podcasts = {
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Collection",
  "name": "Sample Podcasts",
  "totalItems": 3,
  "items": [
    {
      "type": "Collection",
      "name": "Episode 1: The Stream Awakens",
      "totalItems": 1,
      "items": [
        {
          "type": "Audio",
          "id": "https://example.org/podcasts/1",
          "name": "The Stream Awakens",
          "summary": "Kickoff episode introducing the world of ActivityStreams.",
          "published": "2024-07-01T08:00:00Z",
          "url": "https://example.org/podcasts/1.mp3",
          "duration": "PT32M"
        }
      ]
    },
    {
      "type": "Collection",
      "name": "Episode 2: Collections Unleashed",
      "totalItems": 1,
      "items": [
        {
          "type": "Audio",
          "id": "https://example.org/podcasts/2",
          "name": "Collections Unleashed",
          "summary": "Deep dive into the Collection type and its applications.",
          "published": "2024-07-08T08:00:00Z",
          "url": "https://example.org/podcasts/2.mp3",
          "duration": "PT28M"
        }
      ]
    },
    {
      "type": "Collection",
      "name": "Episode 3: Fake Data, Real Impact",
      "totalItems": 1,
      "items": [
        {
          "type": "Audio",
          "id": "https://example.org/podcasts/3",
          "name": "Fake Data, Real Impact",
          "summary": "How stand-in content helps developers build better apps.",
          "published": "2024-07-15T08:00:00Z",
          "url": "https://example.org/podcasts/3.mp3",
          "duration": "PT35M"
        }
      ]
    }
  ]
};

// Main entry point: integrates all components for in-browser Babel

function App() {
  const React = window.React;
  const { useState } = React;
  const CarouselViewer = window.CarouselViewer;
  const PodcastPlayer = window.PodcastPlayer;

  // Use imported streams as the source of truth
  const loadedStreams = [
    { ...Images, name: "Images" },
    { ...Blogs, name: "Blogs" },
    { ...Podcasts, name: "Podcasts" }
  ];

  // Helper: get stream by name
  function getStreamByName(name) {
    return loadedStreams.find(s => s.name === name);
  }

  // Images
  const imagesStream = getStreamByName("Images");
  const images = imagesStream && Array.isArray(imagesStream.items)
    ? imagesStream.items
    : [];

  // Blogs
  const blogsStream = getStreamByName("Blogs");
  const blogs = blogsStream && Array.isArray(blogsStream.items)
    ? blogsStream.items
    : [];

  // Podcasts
  const podcastsStream = getStreamByName("Podcasts");
  const podcasts = podcastsStream && Array.isArray(podcastsStream.items)
    ? podcastsStream.items
    : [];

  // Carousel for Blogs
  function BlogsCarousel({ articles }) {
    const { useState } = React;
    const [current, setCurrent] = useState(0);
    if (!Array.isArray(articles) || articles.length === 0) return null;

    const goTo = idx => setCurrent((idx + articles.length) % articles.length);
    const prev = () => goTo(current - 1);
    const next = () => goTo(current + 1);

    const article = articles[current];

    return (
      <div className="carousel-viewer" style={{
        margin: "32px 0",
        background: "#181c22",
        borderRadius: "10px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        padding: "24px",
        textAlign: "center"
      }}>
        <h2 style={{ color: "#58a6ff", marginBottom: "18px" }}>Blogs</h2>
        <div style={{ position: "relative", minHeight: "220px" }}>
          <button onClick={prev} style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            fontSize: "2em", background: "none", border: "none", color: "#58a6ff", cursor: "pointer"
          }} aria-label="Previous">&#8592;</button>
          <div style={{
            display: "inline-block",
            width: "80%",
            background: "#22272e",
            borderRadius: "8px",
            padding: "20px",
            minHeight: "180px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}>
            <div style={{ fontWeight: "bold", fontSize: "1.3em", color: "#f0f6fc" }}>{article.name}</div>
            <div style={{ margin: "12px 0", color: "#c9d1d9" }}>{article.content}</div>
            <div style={{ color: "#8b949e", fontSize: "0.95em" }}>
              By {article.attributedTo} &middot; {article.published && (new Date(article.published)).toLocaleDateString()}
            </div>
          </div>
          <button onClick={next} style={{
            position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
            fontSize: "2em", background: "none", border: "none", color: "#58a6ff", cursor: "pointer"
          }} aria-label="Next">&#8594;</button>
        </div>
        <div style={{ marginTop: "12px", color: "#8b949e" }}>
          <span>{current + 1} / {articles.length}</span>
        </div>
        <div style={{ marginTop: "10px" }}>
          {articles.map((a, idx) => (
            <span
              key={a.id || idx}
              onClick={() => goTo(idx)}
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: idx === current ? "#58a6ff" : "#30363d",
                margin: "0 4px",
                cursor: "pointer",
                border: idx === current ? "2px solid #58a6ff" : "2px solid transparent"
              }}
              title={a.name}
            />
          ))}
        </div>
      </div>
    );
  }

  // Carousel for Podcasts (each slide = episode)
  function PodcastsCarousel({ episodes }) {
    const { useState } = React;
    const [current, setCurrent] = useState(0);
    if (!Array.isArray(episodes) || episodes.length === 0) return null;

    const goTo = idx => setCurrent((idx + episodes.length) % episodes.length);
    const prev = () => goTo(current - 1);
    const next = () => goTo(current + 1);

    const episode = episodes[current];
    // Find show notes and audio
    let showNotes = null, audio = null;
    if (episode && Array.isArray(episode.items)) {
      showNotes = episode.items.find(i => i.type === "Article");
      audio = episode.items.find(i => i.type === "Audio");
    }

    return (
      <div className="carousel-viewer" style={{
        margin: "32px 0",
        background: "#181c22",
        borderRadius: "10px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        padding: "24px",
        textAlign: "center"
      }}>
        <h2 style={{ color: "#58a6ff", marginBottom: "18px" }}>Podcasts</h2>
        <div style={{ position: "relative", minHeight: "220px" }}>
          <button onClick={prev} style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            fontSize: "2em", background: "none", border: "none", color: "#58a6ff", cursor: "pointer"
          }} aria-label="Previous">&#8592;</button>
          <div style={{
            display: "inline-block",
            width: "80%",
            background: "#22272e",
            borderRadius: "8px",
            padding: "20px",
            minHeight: "180px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}>
            <div style={{ fontWeight: "bold", fontSize: "1.2em", color: "#f0f6fc" }}>{episode && episode.name}</div>
            {showNotes && (
              <div style={{ margin: "12px 0", color: "#c9d1d9" }}>
                <div style={{ fontWeight: "bold", fontSize: "1em", marginBottom: "4px" }}>{showNotes.name}</div>
                <div>{showNotes.content}</div>
              </div>
            )}
            {audio && audio.url && (
              <audio controls src={window.extractUrl(audio.url)} style={{ width: "100%", margin: "10px 0" }} />
            )}
          </div>
          <button onClick={next} style={{
            position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
            fontSize: "2em", background: "none", border: "none", color: "#58a6ff", cursor: "pointer"
          }} aria-label="Next">&#8594;</button>
        </div>
        <div style={{ marginTop: "12px", color: "#8b949e" }}>
          <span>{current + 1} / {episodes.length}</span>
        </div>
        <div style={{ marginTop: "10px" }}>
          {episodes.map((ep, idx) => (
            <span
              key={ep.id || idx}
              onClick={() => goTo(idx)}
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: idx === current ? "#58a6ff" : "#30363d",
                margin: "0 4px",
                cursor: "pointer",
                border: idx === current ? "2px solid #58a6ff" : "2px solid transparent"
              }}
              title={ep.name}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        <CarouselViewer images={images} title="Images" />
        <BlogsCarousel articles={blogs} />
        <PodcastsCarousel episodes={podcasts} />
      </div>
    </div>
  );
}

// Attach App to window for global access
window.App = App;

// Babel/UMD compatibility for index.html
if (typeof window !== "undefined" && window.ReactDOM && document.getElementById("root")) {
  window.ReactDOM.render(window.React.createElement(App), document.getElementById("root"));
}