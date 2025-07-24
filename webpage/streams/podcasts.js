export const Podcasts = {
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
