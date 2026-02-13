
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ChessDuet - Master the Board',
    short_name: 'ChessDuet',
    description: 'A clean, modern chess experience for parents and children.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: 'https://picsum.photos/seed/chess-pro/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/chess-pro/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
