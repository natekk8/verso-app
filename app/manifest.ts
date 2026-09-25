import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Verso Tournament Manager',
    short_name: 'Verso',
    description: 'Najlepsza platforma do zarządzania turniejami na żywo.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b', // zinc-950
    theme_color: '#09090b',
  }
}
