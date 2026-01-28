<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, toRaw } from 'vue';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { useDataStore } from '../../stores/dataStore';
import { generateVoronoiFeatures } from '../../services/voronoiService';

const store = useDataStore();

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;
let voronoiLayer: L.GeoJSON | null = null;
let voronoiPasLayer: L.GeoJSON | null = null;
let circLayer: L.GeoJSON | null = null;
let boundaryLayer: L.GeoJSON | null = null;

// Store marker references for quick access
const markers: Record<string, L.CircleMarker> = {};

const stringToColor = (str: string) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h) % 360}, 65%, 60%)`;
};

const initMap = () => {
    // ... (rest of init map code same as before until markersLayer)
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value, { 
    zoomControl: false,
    center: [48.6, 7.5],
    zoom: 9 
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & CartoDB'
  }).addTo(map);

  // KML Sectors layer (from file)
  voronoiLayer = L.geoJSON(null as any, {
    style: (feature) => {
        const pas = feature?.properties?.pas;
        const color = pas ? stringToColor(pas) : '#ccc';
        return {
            fillColor: color,
            weight: 1,
            opacity: 0.5,
            color: 'white',
            fillOpacity: 0.2
        };
    },
    onEachFeature: (feature, layer) => {
        if (feature.properties?.pas) {
             layer.bindTooltip(`${feature.properties.name} (${feature.properties.pas})`, { sticky: true });
        }
        layer.on('click', () => {
             if (feature.properties?.pas) {
                 store.selectPas(feature.properties.pas);
             }
        });
    }
  }).addTo(map);
  
  // Voronoi PAS layer (calculated from school positions)
  voronoiPasLayer = L.geoJSON(null as any, {
    style: (feature) => {
        const pas = feature?.properties?.pas;
        const color = pas ? stringToColor(pas) : '#ccc';
        return {
            fillColor: color,
            weight: 1,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.4  // Like V1 for visibility
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
  
  // Circonscription boundaries layer
  circLayer = L.geoJSON(null as any, {
    style: () => ({
        fillOpacity: 0,
        weight: 3,
        opacity: 1,
        color: '#000',
        dashArray: '5, 5'
    }),
    onEachFeature: (feature, layer) => {
        if (feature.properties?.circ) {
             layer.bindTooltip(`Circonscription: ${feature.properties.circ}`, { sticky: true });
        }
    }
  }).addTo(map);
  
  // Debug Boundary Layer
  boundaryLayer = L.geoJSON(null as any).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
};

// Map KML sectors to PAS
const updateSectors = () => {
    if (!map || !voronoiLayer || !store.sectorsGeoJson) return;

    // Clone geojson to avoid mutating store deeply if not needed
    // const geojson = JSON.parse(JSON.stringify(store.sectorsGeoJson));
    // Better: just process distinct features
    
    // We assume Feature Name (from KML) matches a School Name (College usually)
    // Or we need fuzzy matching? Let's try direct first. 
    // And attach the PAS to the feature properties.
    
    // Create a map of School Name -> PAS
    const schoolPasMap = new Map<string, string>();
    store.schools.forEach(s => {
        if (s['Nom du PAS']) {
            schoolPasMap.set(s['Nom complet'].toLowerCase(), s['Nom du PAS']);
            if (s.Commune) {
                schoolPasMap.set(s.Commune.toLowerCase(), s['Nom du PAS']); // Fallback
            }
        }
    });

    const enrichedFeatures: any[] = [];
    
    // Iterate features in sectorsGeoJson
    turf.flattenEach(store.sectorsGeoJson, (feature) => {
         const name = feature.properties?.name;
         if (name) {
             // Try to find matching PAS
             // KML names might be "Secteur de COLLEGE MOLIERE" or just "COLLEGE MOLIERE"
             // transform to lower for match
             const lowerName = name.toLowerCase();
             
             // Simple contains check
             let foundPas: string | undefined;
             for (const [key, val] of schoolPasMap.entries()) {
                 if (lowerName.includes(key)) {
                     foundPas = val;
                     break;
                 }
             }
             
             if (foundPas && feature.properties) {
                 feature.properties.pas = foundPas;
                 enrichedFeatures.push(feature);
             } else {
                 // Push anyway as grey?
                 enrichedFeatures.push(feature);
             }
         }
    });

    if (enrichedFeatures.length > 0) {
        voronoiLayer.clearLayers();
        voronoiLayer.addData(turf.featureCollection(enrichedFeatures));
    }
};

// Generate Voronoi polygons for PAS (based on ALL school points, like V1)
// Generate Voronoi Polygons (PAS) and Circonscriptions (Dissolved)
const updateVoronoiPas = () => {
    try {
        if (!map || !voronoiPasLayer || !circLayer || !store.sectorsGeoJson || store.schools.length === 0) {
            return;
        }

        // 1. Generate robust Voronoi features using the Service
        const { features, mask } = generateVoronoiFeatures(
            toRaw(store.schools),
            toRaw(store.sectorsGeoJson),
            toRaw(store.filteredPasNames)
        );
        
        // 2. Visualize the department boundary (Black and Thin)
        if (boundaryLayer) {
             boundaryLayer.clearLayers();
             if (mask) {
                 boundaryLayer.addData(mask);
                 boundaryLayer.setStyle({
                     color: '#000000',
                     dashArray: '5, 5',
                     weight: 2,
                     fill: false
                 });
             }
        }
        
        // 3. Update PAS Voronoi Layer
        voronoiPasLayer.clearLayers();
        if (features.length > 0) {
            const fc = turf.featureCollection(features as any);
            voronoiPasLayer.addData(fc);
            voronoiPasLayer.bringToBack(); 
            
            // 4. Update Circonscription Layer (Dissolve PAS features)
            try {
                // @ts-ignore - Flatten before dissolve ensures v7 compatibility
                const flattened = turf.flatten(fc);
                const dissolved = turf.dissolve(flattened, { propertyName: 'circo' });
                
                circLayer.clearLayers();
                if (dissolved && dissolved.features.length > 0) {
                    circLayer.addData(dissolved as any);
                    circLayer.setStyle({
                        color: '#333333',
                        weight: 3,
                        opacity: 1,
                        fill: false
                    });
                    circLayer.bringToFront();
                }
            } catch (e) {
                console.error('[Voronoi] Dissolve error:', e);
            }
        } else {
             circLayer.clearLayers();
        }

    } catch (error) {
        console.error('[Voronoi] Error in updateVoronoiPas:', error);
    }
};

// Deprecated: Logic merged into updateVoronoiPas for efficiency and consistency
const updateCirconscriptions = () => {
    // No-op
};


const updateMarkers = () => {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();
  
  // clear dict references, but we are rebuilding so it's fine
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

watch(() => store.filteredSchools, () => {
    updateMarkers();
    updateSectors();
}, { deep: true });

watch(() => store.schools, () => {
    updateVoronoiPas();
    updateCirconscriptions();
}, { deep: true });

watch(() => store.sectorsGeoJson, () => {
    updateSectors();
    updateVoronoiPas();
});

// CRITICAL: Watch filteredPasNames to update Voronoi when filters change
watch(() => store.filteredPasNames, () => {
    updateVoronoiPas();
    updateCirconscriptions();
}, { deep: true });

// Watchers for Interaction
watch(() => store.selectedSchool, (newVal) => {
    // Redraw normal markers to update selected style (borders etc)
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
    // Reset old
    if (oldUai && markers[oldUai]) {
        const s = store.schools.find(x => x.UAI === oldUai);
        const isCollege = s && s['Degré'] === '2nd degré';
        const isSelected = store.selectedSchool?.UAI === oldUai;
        
        markers[oldUai].setRadius(isSelected ? 8 : (isCollege ? 6 : 4));
        // Reset z-index implicitly by logic or explicitly? 
        // Leaflet Markers use standard DOM z-index, CircleMarkers are SVG paths usually order matters.
        // But for path layers bringToFront works.
    }
    
    // Highlight new
    if (newUai && markers[newUai]) {
        markers[newUai].bringToFront();
        markers[newUai].setRadius(10);
    }
});

onMounted(() => {
  initMap();
  setTimeout(() => {
      updateMarkers();
      updateSectors();
      updateVoronoiPas();
      updateCirconscriptions();
      map?.invalidateSize();
  }, 100);
});

onUnmounted(() => {
  map?.remove();
});
</script>

<template>
  <div ref="mapContainer" class="w-full h-full bg-slate-100 z-0"></div>
</template>

<style>
/* Leaflet fixes if needed */
.leaflet-container {
  background: transparent;
}
</style>
