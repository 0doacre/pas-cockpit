<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, toRaw } from 'vue';
import L from 'leaflet';
import { useDataStore } from '../../stores/dataStore';
import { sectorService } from '../../services/sectorService';
import { generatePasPolygons } from '../../services/voronoiService';

const store = useDataStore();

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;
let pasPolygonLayer: L.GeoJSON | null = null;  // PAS dissolved polygons
let circLayer: L.GeoJSON | null = null;        // Circonscription outlines

const markers: Record<string, L.CircleMarker> = {};

const stringToColor = (str: string) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h) % 360}, 65%, 60%)`;
};

const initMap = () => {
  if (map) return;
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value, { 
    zoomControl: false,
    center: [48.6, 7.5],
    zoom: 9 
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & CartoDB'
  }).addTo(map);

  // 1. PAS Polygon Layer (Main visual)
  pasPolygonLayer = L.geoJSON(null as any, {
    style: (feature) => {
        const pas = feature?.properties?.pas;
        const color = pas ? stringToColor(pas) : '#ccc';
        return {
            fillColor: color,
            weight: 2,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.5
        };
    },
    onEachFeature: (feature, layer) => {
        if (feature.properties?.pas) {
             layer.bindTooltip(`PAS: ${feature.properties.pas}`, { sticky: true });
        }
        layer.on('click', () => {
             if (feature.properties?.pas) {
                 store.selectPas(feature.properties.pas);
             }
        });
    }
  }).addTo(map);
  
  // 2. Circonscription boundaries layer (Context)
  circLayer = L.geoJSON(null as any, {
    style: () => ({
        fillOpacity: 0,
        weight: 3,
        opacity: 0.8,
        color: '#1e293b',
        dashArray: '8, 4'
    }),
    onEachFeature: (feature, layer) => {
        if (feature.properties?.circo_nom) {
             layer.bindTooltip(`Circonscription: ${feature.properties.circo_nom}`, { sticky: true });
        }
    }
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
};

// Update PAS Polygons
const updatePasPolygons = () => {
    try {
        if (!map || !pasPolygonLayer || store.schools.length === 0) return;
        
        const maskGeoJson = sectorService.getAllCircoSectors();
        
        const pasGeoJson = generatePasPolygons(
            toRaw(store.schools),
            maskGeoJson,
            toRaw(store.filteredPasNames)
        );
        
        pasPolygonLayer.clearLayers();
        if (pasGeoJson.features.length > 0) {
            pasPolygonLayer.addData(pasGeoJson as any);
        }
    } catch (e) {
        console.error('Error updating PAS polygons:', e);
    }
};

const updateCirconscriptions = () => {
    try {
        if (!map || !circLayer) return;
        
        const circoFc = sectorService.getAllCircoSectors();
        circLayer.clearLayers();
        
        if (circoFc?.features?.length > 0) {
            circLayer.addData(circoFc);
            circLayer.bringToFront();
        }
    } catch (e) {
        console.error('Error updating circonscriptions:', e);
    }
};

const updateMarkers = () => {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();
  
  for (const k in markers) delete markers[k];

  store.filteredSchools.forEach(school => {
    if (school.Latitude && school.Longitude) {
      const isCollege = school['Degré'] === '2nd degré';
      const color = isCollege ? '#1e293b' : '#ffffff';
      const borderColor = isCollege ? '#3b82f6' : '#10b981';
      const isSelected = store.selectedSchool?.UAI === school.UAI;

      const marker = L.circleMarker([school.Latitude, school.Longitude], {
        radius: isSelected ? 8 : (isCollege ? 6 : 4),
        fillColor: color,
        color: isSelected ? '#ef4444' : borderColor,
        weight: isSelected ? 3 : 2,
        fillOpacity: 1
      });

      marker.bindPopup(`
        <div class="font-bold text-sm text-slate-800">${school['Nom complet']}</div>
        <div class="text-xs text-slate-500">${school['Nom du PAS']}</div>
      `);
      
      marker.on('click', () => {
         store.selectSchool(school.UAI);
      });
      
      marker.on('mouseover', () => {
          store.setHoveredSchool(school.UAI);
      });
      
      marker.on('mouseout', () => {
          store.setHoveredSchool(null);
      });
      
      markersLayer?.addLayer(marker);
      markers[school.UAI] = marker;
    }
  });
};

// Watchers
watch(() => store.filteredSchools, () => {
    updateMarkers();
}, { deep: true });

watch(() => store.schools, () => {
    updatePasPolygons();
}, { deep: true });

watch(() => store.filteredPasNames, () => {
    updatePasPolygons();
}, { deep: true });

watch(() => store.selectedSchool, (newVal) => {
    updateMarkers(); 
    if (newVal && map) {
        const m = markers[newVal.UAI];
        if (m) {
            map.flyTo(m.getLatLng(), 11, { duration: 1.5 });
            m.openPopup();
        }
    }
});

watch(() => store.hoveredSchoolUai, (newUai, oldUai) => {
    if (oldUai && markers[oldUai]) {
        const s = store.schools.find(x => x.UAI === oldUai);
        const isCollege = s && s['Degré'] === '2nd degré';
        const isSelected = store.selectedSchool?.UAI === oldUai;
        markers[oldUai].setRadius(isSelected ? 8 : (isCollege ? 6 : 4));
    }
    if (newUai && markers[newUai]) {
        markers[newUai].bringToFront();
        markers[newUai].setRadius(10);
    }
});

onMounted(() => {
  initMap();
  setTimeout(() => {
      updateMarkers();
      updatePasPolygons();
      updateCirconscriptions();
      map?.invalidateSize();
  }, 200);
});

onUnmounted(() => {
  map?.remove();
});
</script>

<template>
  <div ref="mapContainer" class="w-full h-full bg-slate-100 z-0"></div>
</template>

<style>
.leaflet-container {
  background: transparent;
}
</style>
