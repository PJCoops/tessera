import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: "https://www.tesserapuzzle.com",
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://www.tesserapuzzle.com/hard",
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://www.tesserapuzzle.com/es",
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: "https://www.tesserapuzzle.com/es/hard",
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ]
}
