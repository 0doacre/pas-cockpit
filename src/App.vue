<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useDataStore } from './stores/dataStore';
import { parseDataCsv } from './services/dataLoader';
import { loadRhData } from './services/rhLoader';
import { sectorService } from './services/sectorService';
import { downloadCsv } from './utils/exportUtils';
import AppLayout from './components/layout/AppLayout.vue';
import LeafletMap from './components/map/LeafletMap.vue';
import PasBoard from './components/kanban/PasBoard.vue';
import SchoolCard from './components/ui/SchoolCard.vue';
import StatsPanel from './components/ui/StatsPanel.vue';
import PasDetailsPanel from './components/ui/PasDetailsPanel.vue';
import PilotageView from './components/pilotage/PilotageView.vue';

const store = useDataStore();

// Panel visibility state
const isMapVisible = ref(true);
const isKanbanVisible = ref(true);

const handleExport = () => {
    if (typeof store.exportToCsv === 'function') {
        store.exportToCsv();
    } else {
        downloadCsv(store.schools, `data.csv`);
    }
};

const handleSave = async () => {
    if (typeof store.saveData !== 'function') {
        console.error('Store actions check:', Object.keys(store).filter(k => typeof (store as any)[k] === 'function'));
        alert('⚠️ Erreur Critique : La fonction d\'enregistrement manque dans le store. Veuillez rafraîchir la page (Ctrl+F5).');
        return;
    }
    const success = await store.saveData();
    if (success) {
        alert('✅ Modifications enregistrées avec succès !');
    } else {
        alert('❌ Erreur lors de l\'enregistrement.');
    }
};

const handleReset = () => {
    if (typeof store.resetData !== 'function') {
        alert('⚠️ Fonction de réinitialisation manquante. Veuillez rafraîchir la page.');
        return;
    }
    if (confirm('⚠️ Voulez-vous vraiment réinitialiser toutes les données ? \n\nCela supprimera vos modifications et rechargera le fichier CSV d\'origine.')) {
        store.resetData();
    }
};

onMounted(async () => {
  try {
    // 1. Try loading from local storage first
    const hasSavedData = await store.loadFromStorage();
    
    if (!hasSavedData) {
        // 2. Fallback to CSV if no saved data
        const response = await fetch(`${import.meta.env.BASE_URL}data/data.csv`);
        if (response.ok) {
            const csvText = await response.text();
            const data = await parseDataCsv(csvText);
            store.setSchools(data);
        }
    }
    
    // Load Sectors (Colleges and Circo)
    await sectorService.loadSectors();
    // Set College Sectors into store for map usage
    store.setSectorsGeoJson(sectorService.getAllCollegeSectors());
    
    // Load RH data
    const rhMap = await loadRhData();
    store.setRhData(rhMap);
  } catch (e) {
    console.error("Failed to load data", e);
  }
});
</script>

<template>
  <AppLayout>
    <template #header-center>
      <div class="flex gap-1 bg-slate-100 p-1 rounded-lg">
        <button 
          @click="store.setView('MAP')" 
          class="px-3 py-1 text-xs font-bold rounded transition-all flex items-center gap-1.5"
          :class="store.currentView === 'MAP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
          Carte
        </button>
        <button 
          @click="store.setView('PILOTAGE')" 
          class="px-3 py-1 text-xs font-bold rounded transition-all flex items-center gap-1.5"
          :class="store.currentView === 'PILOTAGE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          Pilotage
        </button>
      </div>
    </template>

    <template #header-actions>
      <div v-if="store.hasUnsavedChanges" class="animate-pulse bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-300">
         ⚠️ Modifications non enregistrées
      </div>
      <button 
        @click="handleSave"
        class="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold shadow hover:bg-green-700 transition-colors flex items-center gap-2"
        title="Enregistrer les modifications dans la base locale"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
        <span>Enregistrer</span>
      </button>
      <button 
        @click="handleExport"
        class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-bold shadow hover:bg-blue-700 transition-colors flex items-center gap-2"
        title="Télécharger le fichier CSV (data.csv) pour mise à jour sur GitHub"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        <span>Télécharger CSV</span>
      </button>
      <div class="h-6 w-px bg-slate-200 mx-1"></div>
      <button 
        @click="handleReset"
        class="text-slate-400 hover:text-red-500 transition-colors p-1.5"
        title="Réinitialiser l'application (supprimer les modifications)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </button>
    </template>

    <template #sidebar v-if="store.currentView === 'MAP'">
      <div class="space-y-6">
        <div>
           <div class="relative mb-4">
              <span class="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input 
                  type="text" 
                  :value="store.searchQuery"
                  @input="store.setSearchQuery(($event.target as HTMLInputElement).value)"
                  placeholder="Recherche (Nom, Ville, UAI)..." 
                  class="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 rounded shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
           </div>
        
          <h3 class="font-bold text-xs uppercase text-slate-400 mb-2">Filtres Géographiques</h3>
          
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Bassin</label>
              <select 
                :value="store.filters.bassin" 
                @change="store.setFilter('bassin', ($event.target as HTMLSelectElement).value)"
                class="w-full text-sm border-slate-300 rounded shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="TOUS">Tous les bassins</option>
                <option v-for="b in store.availableBassins" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Circonscription</label>
              <select 
                :value="store.filters.circ" 
                @change="store.setFilter('circ', ($event.target as HTMLSelectElement).value)"
                class="w-full text-sm border-slate-300 rounded shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="TOUTES">Toutes les circonscriptions</option>
                <option v-for="c in store.availableCircs" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <div v-if="store.filters.circ !== 'TOUTES' || store.filters.bassin !== 'TOUS' || true">
              <label class="block text-xs font-bold text-slate-700 mb-1">PAS</label>
              <select 
                :value="store.filters.pas" 
                @change="store.setFilter('pas', ($event.target as HTMLSelectElement).value)"
                class="w-full text-sm border-slate-300 rounded shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="TOUS">Tous les PAS</option>
                <option v-for="p in store.availableFilterPas" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 class="font-bold text-xs uppercase text-slate-400 mb-2">Statistiques</h3>
          <StatsPanel />
        </div>
      </div>
    </template>

    <template #main>
      <div v-if="store.currentView === 'MAP'" class="w-full h-full flex flex-col">
        <!-- Top: Map (collapsible) -->
        <div 
          class="relative transition-all duration-300 ease-in-out border-b border-slate-300"
          :class="isMapVisible ? 'flex-1 min-h-[200px]' : 'h-10'"
        >
          <!-- Map Toggle Header -->
          <div 
            class="absolute top-0 left-0 right-0 h-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 z-[500] cursor-pointer"
            @click="isMapVisible = !isMapVisible"
          >
            <span class="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
              Carte
            </span>
            <button class="p-1 rounded hover:bg-slate-200 text-slate-400">
              <svg 
                xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                :class="isMapVisible ? 'rotate-180' : ''"
                class="transition-transform"
              ><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
          <div v-show="isMapVisible" class="h-full pt-10">
            <LeafletMap />
          </div>
          <div v-show="isMapVisible" class="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded shadow text-xs font-bold z-[400]">
            {{ store.filteredSchools.length }} écoles
          </div>
        </div>
        
        <!-- Bottom: Kanban (collapsible) -->
        <div 
          class="bg-slate-100 overflow-hidden transition-all duration-300 ease-in-out"
          :class="isKanbanVisible ? 'flex-1 min-h-[200px]' : 'h-10'"
        >
          <!-- Kanban Toggle Header -->
          <div 
            class="h-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 cursor-pointer"
            @click="isKanbanVisible = !isKanbanVisible"
          >
            <span class="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              Liste des PAS
            </span>
            <button class="p-1 rounded hover:bg-slate-200 text-slate-400">
              <svg 
                xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                :class="isKanbanVisible ? '' : 'rotate-180'"
                class="transition-transform"
              ><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
          <div v-show="isKanbanVisible" class="h-[calc(100%-40px)]">
            <PasBoard />
          </div>
        </div>
      </div>
      <div v-else class="w-full h-full bg-white">
        <PilotageView />
      </div>
    </template>

    <template #right-panel v-if="store.currentView === 'MAP'">
      <!-- PAS Details -->
      <div v-if="store.selectedPas && !store.selectedSchool">
        <PasDetailsPanel />
      </div>
      
      <!-- School Details -->
      <div v-else-if="store.selectedSchool">
        <SchoolCard :school="store.selectedSchool" />
        <!-- More details here -->
        <div class="mt-4 p-4 bg-slate-50 rounded border border-slate-200">
            <h4 class="font-bold text-sm mb-2">Informations</h4>
            <div class="text-xs space-y-1">
                <p><strong>UAI:</strong> {{ store.selectedSchool.UAI }}</p>
                <p><strong>Commune:</strong> {{ store.selectedSchool.Commune }}</p>
                <p><strong>Circonscription:</strong> {{ store.selectedSchool.Circonscription }}</p>
            </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-else class="text-slate-500 italic text-center mt-10">
        Sélectionnez une école ou un PAS pour voir les détails.
      </div>
    </template>
  </AppLayout>
</template>
