<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../../stores/dataStore';
import IpsChart from './IpsChart.vue';


const store = useDataStore();

const stats = computed(() => {
  if (store.selectedPas && store.pasMetrics[store.selectedPas]) {
      return store.pasMetrics[store.selectedPas];
  }
  return store.departmentMetrics;
});

const ipsColor = computed(() => {
  const val = parseFloat(stats.value.ips as string);
  if (isNaN(val)) return 'text-slate-400';
  if (val >= 110) return 'text-green-600';
  if (val >= 95) return 'text-blue-600'; // Average
  return 'text-red-500'; // Low
});
</script>

<template>
  <div class="grid grid-cols-1 gap-3">
    <!-- IPS Card -->
    <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">IPS Moyen</h3>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-bold" :class="ipsColor">{{ stats.ips }}</span>
        <span class="text-xs text-slate-400">Pondéré</span>
      </div>
       <div class="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
        <div 
            class="h-full transition-all duration-500" 
            :class="ipsColor.replace('text', 'bg')" 
            :style="{ width: Math.min((parseFloat(stats.ips as string) || 0) / 150 * 100, 100) + '%' }"
        ></div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
        <!-- Effectifs -->
        <div class="bg-slate-50 p-3 rounded border border-slate-200 text-center">
            <div class="text-lg font-bold text-slate-700">{{ stats.effectif }}</div>
            <div class="text-[9px] text-slate-400 uppercase font-bold">Élèves</div>
        </div>
        <!-- REP -->
        <div class="bg-slate-50 p-3 rounded border border-slate-200 text-center">
            <div class="text-lg font-bold text-slate-700">{{ stats.repCount }}</div>
            <div class="text-[9px] text-slate-400 uppercase font-bold">Établ. EP</div>
        </div>
    </div>
    
    <IpsChart />
  </div>
</template>
