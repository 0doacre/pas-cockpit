<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue';
import { useDataStore } from '../../stores/dataStore';
import SchoolCard from '../ui/SchoolCard.vue';
import type { School } from '../../types';

const store = useDataStore();

// Grouping logic: PAS -> Sector -> Schools
const pasContents = computed(() => {
    const contents: Record<string, Record<string, School[]>> = {};
    
    store.filteredPasNames.forEach(pas => {
        const pasSchools = store.schools.filter(s => s['Nom du PAS'] === pas);
        const pasGroup: Record<string, School[]> = {};
        
        pasSchools.forEach(s => {
            const sector = s['PAS.1.Collège de rattachement'] || 'Hors Secteur';
            if (!pasGroup[sector]) pasGroup[sector] = [];
            pasGroup[sector].push(s);
        });
        
        // Sort schools within sectors (Colleges first)
        Object.keys(pasGroup).forEach(sector => {
            pasGroup[sector]!.sort((a, _b) => (a['Degré'] === '2nd degré' ? -1 : 1));
        });

        contents[pas] = pasGroup;
    });
    
    return contents;
});

// Renaming State
const editingPas = ref<string | null>(null);
const tempPasName = ref('');

const startRename = (pas: string) => {
    editingPas.value = pas;
    tempPasName.value = pas;
    nextTick(() => {
        const input = document.getElementById('edit-input-' + pas) as HTMLInputElement;
        if (input) input.focus();
    });
};

const confirmRename = (oldName: string) => {
    if (tempPasName.value.trim() && tempPasName.value !== oldName) {
        store.renamePas(oldName, tempPasName.value);
    }
    editingPas.value = null;
};

const cancelRename = () => {
    editingPas.value = null;
};

// Drag and Drop
const onDragStartSchool = (e: DragEvent, school: School) => {
    if (e.dataTransfer) {
        e.dataTransfer.setData('type', 'SCHOOL');
        e.dataTransfer.setData('uai', school.UAI);
        e.dataTransfer.effectAllowed = 'move';
    }
};

const onDragStartSector = (e: DragEvent, sectorName: string, sourcePas: string) => {
    if (e.dataTransfer) {
        e.dataTransfer.setData('type', 'SECTOR');
        e.dataTransfer.setData('sector', sectorName);
        e.dataTransfer.setData('sourcePas', sourcePas);
        e.dataTransfer.effectAllowed = 'move';
    }
};

const onDropOnPas = (e: DragEvent, targetPas: string) => {
    const type = e.dataTransfer?.getData('type');
    if (type === 'SCHOOL') {
        const uai = e.dataTransfer?.getData('uai');
        if (uai) store.updateSchoolPas(uai, targetPas);
    } else if (type === 'SECTOR') {
        const sectorName = e.dataTransfer?.getData('sector');
        if (sectorName) store.updateSectorPas(sectorName, targetPas);
    }
};

const onDropOnSector = (e: DragEvent, targetSector: string, targetPas: string) => {
    const type = e.dataTransfer?.getData('type');
    if (type === 'SCHOOL') {
        const uai = e.dataTransfer?.getData('uai');
        if (uai) store.updateSchoolSector(uai, targetSector, targetPas);
    }
};

// Utilities
const stringToColor = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = str.charCodeAt(i) + ((h << 5) - h);
    }
    return `hsl(${Math.abs(h) % 360}, 65%, 60%)`;
};

// Auto-scroll
watch(() => store.selectedSchool, async (newVal) => {
    if (newVal) {
        await nextTick();
        const el = document.getElementById('card-' + newVal.UAI);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});
</script>

<template>
  <div class="flex h-full overflow-x-auto gap-4 p-4 items-start bg-slate-100">
    <div 
      v-for="pas in store.filteredPasNames" 
      :key="pas"
      class="flex-shrink-0 w-72 bg-slate-200 rounded-lg flex flex-col max-h-full border-t-4 shadow-md transition-all"
      :style="{ borderTopColor: stringToColor(pas) }"
      :class="{ 'ring-2 ring-blue-500 ring-offset-2': store.selectedPas === pas }"
      @dragover.prevent
      @drop="onDropOnPas($event, pas)"
      @click="store.selectPas(pas)"
    >
      <!-- PAS Header -->
      <div class="p-3 bg-white rounded-t shadow-sm sticky top-0 z-10 space-y-2">
        <div v-if="editingPas === pas">
          <input 
            :id="'edit-input-' + pas"
            v-model="tempPasName"
            class="w-full px-2 py-1 text-sm font-bold border-2 border-blue-500 rounded outline-none"
            @blur="confirmRename(pas)"
            @keyup.enter="confirmRename(pas)"
            @keyup.esc="cancelRename"
          >
        </div>
        <div v-else class="flex justify-between items-center group">
          <h3 
            class="font-extrabold text-sm text-slate-800 truncate cursor-text"
            @dblclick.stop="startRename(pas)"
          >
            {{ pas }}
          </h3>
          <button 
            @click.stop="startRename(pas)"
            class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
        </div>

        <!-- PAS Metrics -->
        <div class="flex justify-between items-center text-[10px] bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
            <div class="flex flex-col">
                <span class="text-slate-400 uppercase text-[8px]">IPS</span>
                <span class="font-bold text-slate-700">{{ store.pasMetrics[pas]?.ips }}</span>
            </div>
            <div class="flex flex-col text-right">
                <span class="text-slate-400 uppercase text-[8px]">Distance</span>
                <span class="font-bold text-slate-700">{{ store.pasMetrics[pas]?.dist }}</span>
            </div>
            <div class="flex flex-col text-right">
                <span class="text-slate-400 uppercase text-[8px]">Effectif</span>
                <span class="font-bold text-slate-700">{{ store.pasMetrics[pas]?.effectif }}</span>
            </div>
        </div>
      </div>

      <!-- Sector List -->
      <div class="p-2 overflow-y-auto flex-1 min-h-[100px] space-y-4 pb-12">
        <div 
          v-for="(schoolsInSector, sectorName) in pasContents[pas]" 
          :key="sectorName"
          class="bg-slate-300/50 rounded-md overflow-hidden border border-slate-300/50"
          @dragover.prevent
          @drop.stop="onDropOnSector($event, sectorName, pas)"
        >
          <!-- Sector Header (Draggable) -->
          <div 
            class="bg-slate-600 text-white px-2 py-1 text-[10px] font-bold flex justify-between items-center cursor-move hover:bg-slate-700 active:cursor-grabbing"
            draggable="true"
            @dragstart="onDragStartSector($event, sectorName, pas)"
          >
            <div class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><path d="M5 9h14"/><path d="M5 15h14"/></svg>
                <span class="truncate max-w-[180px]">{{ sectorName }}</span>
            </div>
            <span class="bg-slate-800/50 px-1.5 rounded text-[9px]">{{ schoolsInSector.length }}</span>
          </div>

          <!-- Schools in Sector -->
          <div class="p-1 space-y-1.5">
            <SchoolCard 
              v-for="school in schoolsInSector" 
              :key="school.UAI" 
              :school="school"
              draggable="true"
              @dragstart="onDragStartSchool($event, school)"
              @click.stop="store.selectSchool(school.UAI)"
              class="transform transition-transform active:scale-95"
              :class="{'ring-2 ring-blue-500': store.selectedSchool?.UAI === school.UAI}"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
