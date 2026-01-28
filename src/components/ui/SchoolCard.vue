<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useDataStore } from '../../stores/dataStore';
import type { School } from '../../types';

const store = useDataStore();

const props = defineProps<{
  school: School;
}>();

const isEditing = ref(false);
const tempName = ref('');

const startEdit = () => {
    isEditing.value = true;
    tempName.value = props.school['Nom complet'];
    nextTick(() => {
        const input = document.getElementById('edit-school-' + props.school.UAI) as HTMLInputElement;
        if (input) input.focus();
    });
};

const confirmEdit = () => {
    if (tempName.value.trim() && tempName.value !== props.school['Nom complet']) {
        store.renameSchool(props.school.UAI, tempName.value);
    }
    isEditing.value = false;
};

const cancelEdit = () => {
    isEditing.value = false;
};
</script>

<template>
  <div 
    :id="'card-' + school.UAI"
    class="bg-white p-3 rounded shadow-sm border-l-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200"
    :class="[
      school['Degré'] === '2nd degré' ? 'border-l-blue-500' : 'border-l-teal-400',
      (store.selectedSchool?.UAI === school.UAI || store.hoveredSchoolUai === school.UAI) ? 'ring-2 ring-blue-500 bg-blue-50/50 scale-[1.02]' : ''
    ]"
    draggable="true"
    @mouseenter="store.setHoveredSchool(school.UAI)"
    @mouseleave="store.setHoveredSchool(null)"
  >
    <div class="flex justify-between items-start mb-1">
      <div v-if="isEditing" class="w-full">
        <input 
          :id="'edit-school-' + school.UAI"
          v-model="tempName"
          class="w-full px-1 py-0.5 text-xs font-bold border-2 border-blue-400 rounded outline-none"
          @blur="confirmEdit"
          @keyup.enter="confirmEdit"
          @keyup.esc="cancelEdit"
          @click.stop
        >
      </div>
      <h4 
        v-else 
        class="font-bold text-xs text-slate-800 leading-tight w-3/4 cursor-text"
        @dblclick.stop="startEdit"
      >
        {{ school['Nom complet'] }}
      </h4>
      <div v-if="!isEditing" class="flex gap-1 flex-wrap justify-end w-1/4">
         <span v-if="school['Education prioritaire (Archipel)']?.includes('REP')" class="px-1 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">REP</span>
         <span v-if="school['Education prioritaire (Archipel)']?.includes('CLA')" class="px-1 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded">CLA</span>
         <span v-if="school['Territoire'] === 'OUI'" class="px-1 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded">TER</span>
      </div>
    </div>
    
    <div class="flex justify-between items-center text-xs text-slate-500 mt-2">
      <div class="flex gap-2">
        <span class="font-mono bg-slate-100 px-1 rounded">{{ school['Effectifs (Archipel)'] }} élèves</span>
      </div>
      <div class="flex items-center gap-1" :title="'IPS: ' + school.IPS">
        <div class="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500" :style="{width: Math.min(school.IPS/150*100, 100) + '%'}"></div>
        </div>
        <span class="font-bold text-[10px]">{{ school.IPS }}</span>
      </div>
    </div>
    
    <div class="mt-1 text-[10px] text-slate-400 truncate">
      {{ school.Commune }}
    </div>
  </div>
</template>
