import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useFlood } from '../../features/flood/store';
import { LayerPanel } from '../flood/LayerPanel';
import { Legend } from './Legend';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, Compass } from 'lucide-react';

import { getCartoTileUrls, CARTO_ATTRIBUTION } from '../../features/flood/cartoConfig';

export const FloodMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { state, dispatch } = useFlood();
  const { vectors, result, layerVisibility, selectedCommunityId, cartoStyle } = state;
  const [mapLoaded, setMapLoaded] = useState(false);

  // Compute map center and bounds
  const centerLng = vectors.communities[0]?.geometry.coordinates[0] ?? 75.32;
  const centerLat = vectors.communities[0]?.geometry.coordinates[1] ?? 19.85;

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialTiles = getCartoTileUrls(cartoStyle);

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-basemap': {
            type: 'raster',
            tiles: initialTiles,
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
          },
        },
        layers: [
          {
            id: 'basemap-tiles',
            type: 'raster',
            source: 'carto-basemap',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [centerLng, centerLat],
      zoom: 11.5,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Dynamically update CARTO basemap when style changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      if (map.getLayer('basemap-tiles')) {
        map.removeLayer('basemap-tiles');
      }
      if (map.getSource('carto-basemap')) {
        map.removeSource('carto-basemap');
      }

      map.addSource('carto-basemap', {
        type: 'raster',
        tiles: getCartoTileUrls(cartoStyle),
        tileSize: 256,
        attribution: '© OpenStreetMap contributors, © CARTO',
      });

      // Insert at the bottom beneath vector layers
      const layers = map.getStyle().layers;
      const firstLayerId = layers && layers.length > 0 ? layers[0].id : undefined;

      map.addLayer(
        {
          id: 'basemap-tiles',
          type: 'raster',
          source: 'carto-basemap',
          minzoom: 0,
          maxzoom: 19,
        },
        firstLayerId
      );
    } catch (err) {
      console.warn('Error updating CARTO basemap style:', err);
    }
  }, [cartoStyle, mapLoaded]);

  // Update sources and layers whenever analysis result or vectors update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const impassableSet = new Set(result?.impassableRoadIds ?? []);
    const impactsMap = new Map(result?.impacts.map((i) => [i.communityId, i]) ?? []);

    // 1. Flood Mask Image Overlay
    if (result?.mask) {
      const { width, height, bbox, data } = result.mask;
      const [minX, minY, maxX, maxY] = bbox;

      // Render flood mask onto offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const imgData = ctx.createImageData(width, height);
        const buf = imgData.data;

        for (let i = 0; i < width * height; i++) {
          const p = i * 4;
          if (data[i] === 1) {
            // Flood signal: Glacier Cyan (#22D3EE) with semi-transparency
            buf[p] = 34;      // R
            buf[p + 1] = 211;  // G
            buf[p + 2] = 238;  // B
            buf[p + 3] = 160;  // Alpha (~62%)
          } else {
            buf[p + 3] = 0;    // Transparent
          }
        }
        ctx.putImageData(imgData, 0, 0);

        const dataUrl = canvas.toDataURL();
        const maskCoordinates: [[number, number], [number, number], [number, number], [number, number]] = [
          [minX, maxY], // Top-Left
          [maxX, maxY], // Top-Right
          [maxX, minY], // Bottom-Right
          [minX, minY], // Bottom-Left
        ];

        if (map.getSource('flood-mask-source')) {
          (map.getSource('flood-mask-source') as maplibregl.ImageSource).updateImage({
            url: dataUrl,
            coordinates: maskCoordinates,
          });
        } else {
          map.addSource('flood-mask-source', {
            type: 'image',
            url: dataUrl,
            coordinates: maskCoordinates,
          });

          map.addLayer({
            id: 'flood-mask-layer',
            type: 'raster',
            source: 'flood-mask-source',
            paint: {
              'raster-opacity': 0.85,
              'raster-fade-duration': 150,
            },
          });
        }
      }
    }

    // 2. Roads GeoJSON source
    const roadsGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: vectors.roads.map((r) => ({
        type: 'Feature',
        geometry: r.geometry,
        properties: {
          id: r.id,
          isCut: impassableSet.has(r.id),
          lengthM: r.lengthM,
          highway: r.highway,
        },
      })),
    };

    if (map.getSource('roads-source')) {
      (map.getSource('roads-source') as maplibregl.GeoJSONSource).setData(roadsGeoJSON);
    } else {
      map.addSource('roads-source', { type: 'geojson', data: roadsGeoJSON });

      // Passable roads
      map.addLayer({
        id: 'roads-passable-layer',
        type: 'line',
        source: 'roads-source',
        filter: ['==', 'isCut', false],
        paint: {
          'line-color': '#64748b',
          'line-width': 2.5,
          'line-opacity': 0.8,
        },
      });

      // Impassable roads (vermilion, highlighted)
      map.addLayer({
        id: 'roads-cut-layer',
        type: 'line',
        source: 'roads-source',
        filter: ['==', 'isCut', true],
        paint: {
          'line-color': '#E5484D',
          'line-width': 4.5,
          'line-opacity': 0.95,
        },
      });

      // Interactive popup for cut roads (safe DOM textContent per C-XSS-1)
      map.on('click', 'roads-cut-layer', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const len = feature.properties?.lengthM ? Math.round(Number(feature.properties.lengthM)) : 0;
        const div = document.createElement('div');
        div.className = 'font-sans text-xs space-y-1 p-1';
        const header = document.createElement('div');
        header.className = 'font-bold text-urgent flex items-center gap-1';
        header.textContent = '⚠ Impassable Road Segment';
        const desc = document.createElement('div');
        desc.className = 'text-paper text-[11px]';
        desc.textContent = `Segment: ${feature.properties?.id ?? 'Road'} (${len}m). Overlaps candidate flood signal beyond passability threshold.`;
        div.appendChild(header);
        div.appendChild(desc);

        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setDOMContent(div)
          .addTo(map);
      });

      map.on('mouseenter', 'roads-cut-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'roads-cut-layer', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // 3. Communities GeoJSON source
    const communitiesGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: vectors.communities.map((c) => {
        const impact = impactsMap.get(c.id);
        return {
          type: 'Feature',
          geometry: c.geometry,
          properties: {
            id: c.id,
            name: c.name,
            population: c.population ?? 0,
            urgency: c.urgency ?? 3,
            isolated: impact?.isolated ?? false,
            rank: impact?.rank ?? 0,
            score: impact?.score ?? 0,
          },
        };
      }),
    };

    if (map.getSource('communities-source')) {
      (map.getSource('communities-source') as maplibregl.GeoJSONSource).setData(communitiesGeoJSON);
    } else {
      map.addSource('communities-source', { type: 'geojson', data: communitiesGeoJSON });

      // Outer halo for selected or hovered
      map.addLayer({
        id: 'communities-halo-layer',
        type: 'circle',
        source: 'communities-source',
        paint: {
          'circle-radius': 14,
          'circle-color': [
            'case',
            ['get', 'isolated'],
            '#E5484D',
            '#22D3EE',
          ],
          'circle-opacity': 0.25,
        },
      });

      // Main community marker dot
      map.addLayer({
        id: 'communities-layer',
        type: 'circle',
        source: 'communities-source',
        paint: {
          'circle-radius': 7.5,
          'circle-color': [
            'case',
            ['get', 'isolated'],
            '#E5484D', // Urgent vermilion
            '#22D3EE', // Signal cyan
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#F5F1EA',
        },
      });

      // Community labels
      map.addLayer({
        id: 'communities-labels',
        type: 'symbol',
        source: 'communities-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#F5F1EA',
          'text-halo-color': '#0F1A24',
          'text-halo-width': 1.5,
        },
      });

      // Click to select community
      map.on('click', 'communities-layer', (e) => {
        const feature = e.features?.[0];
        if (feature?.properties?.id) {
          dispatch({ type: 'SELECT_COMMUNITY', payload: String(feature.properties.id) });
        }
      });

      map.on('mouseenter', 'communities-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'communities-layer', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // 4. Facilities GeoJSON source
    const facilitiesGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: vectors.facilities.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: f.id,
          name: f.name,
          kind: f.kind,
          icon: f.kind === 'hospital' ? '🏥' : '⛺',
        },
      })),
    };

    if (map.getSource('facilities-source')) {
      (map.getSource('facilities-source') as maplibregl.GeoJSONSource).setData(facilitiesGeoJSON);
    } else {
      map.addSource('facilities-source', { type: 'geojson', data: facilitiesGeoJSON });

      map.addLayer({
        id: 'facilities-layer',
        type: 'circle',
        source: 'facilities-source',
        paint: {
          'circle-radius': 9,
          'circle-color': '#16242F',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#3FB68B',
        },
      });

      map.addLayer({
        id: 'facilities-labels',
        type: 'symbol',
        source: 'facilities-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#3FB68B',
          'text-halo-color': '#0F1A24',
          'text-halo-width': 1.5,
        },
      });

      // Interactive popup for emergency facilities (safe DOM textContent per C-XSS-1)
      map.on('click', 'facilities-layer', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const kind = String(feature.properties?.kind ?? 'facility');
        const name = String(feature.properties?.name ?? 'Emergency Facility');
        const div = document.createElement('div');
        div.className = 'font-sans text-xs space-y-1 p-1';
        const header = document.createElement('div');
        header.className = 'font-bold text-ok flex items-center gap-1';
        header.textContent = kind === 'hospital' ? '🏥 Regional Hospital' : '⛺ Relief Shelter';
        const desc = document.createElement('div');
        desc.className = 'text-paper text-[11px] font-medium';
        desc.textContent = name;
        const hint = document.createElement('div');
        hint.className = 'text-muted text-[10px]';
        hint.textContent = 'Designated emergency destination for graph reachability analysis.';
        div.appendChild(header);
        div.appendChild(desc);
        div.appendChild(hint);

        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setDOMContent(div)
          .addTo(map);
      });

      map.on('mouseenter', 'facilities-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'facilities-layer', () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }, [mapLoaded, vectors, result]);

  // Handle Layer Visibility Toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('flood-mask-layer')) {
      map.setLayoutProperty(
        'flood-mask-layer',
        'visibility',
        layerVisibility.flood ? 'visible' : 'none'
      );
    }
    if (map.getLayer('roads-passable-layer')) {
      map.setLayoutProperty(
        'roads-passable-layer',
        'visibility',
        layerVisibility.roads ? 'visible' : 'none'
      );
    }
    if (map.getLayer('roads-cut-layer')) {
      map.setLayoutProperty(
        'roads-cut-layer',
        'visibility',
        layerVisibility.cutRoads ? 'visible' : 'none'
      );
    }
    if (map.getLayer('communities-layer')) {
      map.setLayoutProperty(
        'communities-layer',
        'visibility',
        layerVisibility.communities ? 'visible' : 'none'
      );
      map.setLayoutProperty(
        'communities-halo-layer',
        'visibility',
        layerVisibility.communities ? 'visible' : 'none'
      );
      map.setLayoutProperty(
        'communities-labels',
        'visibility',
        layerVisibility.communities ? 'visible' : 'none'
      );
    }
    if (map.getLayer('facilities-layer')) {
      map.setLayoutProperty(
        'facilities-layer',
        'visibility',
        layerVisibility.facilities ? 'visible' : 'none'
      );
      map.setLayoutProperty(
        'facilities-labels',
        'visibility',
        layerVisibility.facilities ? 'visible' : 'none'
      );
    }
  }, [mapLoaded, layerVisibility]);

  // Center/Fly to selected community
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCommunityId) return;

    const comm = vectors.communities.find((c) => c.id === selectedCommunityId);
    if (comm) {
      const coords = comm.geometry.coordinates as [number, number];
      map.easeTo({
        center: coords,
        zoom: Math.max(map.getZoom(), 12.2),
        duration: 800,
      });
    }
  }, [selectedCommunityId]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg">
      <div ref={mapContainer} className="w-full h-full" id="flood-map-canvas" />

      {/* Floating Layer Panel (Top Left) */}
      <div className="absolute top-3 left-3 z-10">
        <LayerPanel />
      </div>

      {/* Floating Legend (Bottom Left) */}
      <div className="absolute bottom-6 left-3 z-10">
        <Legend />
      </div>
    </div>
  );
};
