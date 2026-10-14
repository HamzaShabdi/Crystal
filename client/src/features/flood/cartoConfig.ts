export const CARTO_DEFAULT_API_KEY = 'cb1_4fjh_1_f853ed4703ba9c3847c3138d';

export type CartoBasemapStyleId = 'dark_all' | 'light_all' | 'voyager';

export interface CartoBasemapStyle {
  id: CartoBasemapStyleId;
  name: string;
  description: string;
  thumbnailColor: string;
}

export const CARTO_BASEMAP_STYLES: CartoBasemapStyle[] = [
  {
    id: 'dark_all',
    name: 'Dark Matter',
    description: 'Cartographic mission control (high contrast for flood signals)',
    thumbnailColor: '#16242F',
  },
  {
    id: 'light_all',
    name: 'Positron',
    description: 'Daylight field operations & paper export clarity',
    thumbnailColor: '#F5F1EA',
  },
  {
    id: 'voyager',
    name: 'Voyager',
    description: 'Detailed topography & physical road corridor context',
    thumbnailColor: '#2A4356',
  },
];

export function getCartoApiKey(): string {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('floodone_carto_api_key');
    if (customKey && customKey.trim().length > 0) {
      return customKey.trim();
    }
  }
  return import.meta.env.VITE_CARTO_API_KEY || CARTO_DEFAULT_API_KEY;
}

export function setCartoApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('floodone_carto_api_key', key.trim());
    } else {
      localStorage.removeItem('floodone_carto_api_key');
    }
  }
}

   export function getCartoTileUrls(_style: CartoBasemapStyleId = 'dark_all'): string[] {
     return ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
   }

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';
