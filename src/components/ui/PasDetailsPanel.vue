<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../../stores/dataStore';

const store = useDataStore();

const pasStats = computed(() => {
  if (!store.selectedPas || !store.pasMetrics[store.selectedPas]) return null;
  
  const metrics = store.pasMetrics[store.selectedPas];
  const schools = store.schools
    .filter(s => s['Nom du PAS'] === store.selectedPas)
    .sort((a, b) => a['Nom complet'].localeCompare(b['Nom complet']));
  
  return {
    ...metrics,
    schools
  };
});

const ipsColor = computed(() => {
  if (!pasStats.value) return 'text-slate-400';
  const val = parseFloat(pasStats.value.ips as string);
  if (isNaN(val)) return 'text-slate-400';
  if (val >= 110) return 'text-green-600';
  if (val >= 95) return 'text-blue-600';
  return 'text-red-500';
});

const rhInfo = computed(() => {
  if (!store.selectedPas) return null;
  return store.rhData.get(store.selectedPas) || null;
});
</script>

<template>
  <div v-if="pasStats" class="space-y-4">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-lg shadow-lg">
      <h2 class="text-lg font-bold mb-1">{{ pasStats.name }}</h2>
      <p class="text-sm opacity-90">Pôle d'Appui à la Scolarité</p>
    </div>
    
    <!-- Stats Grid -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-white p-3 rounded-lg border border-slate-200 text-center">
        <div class="text-2xl font-bold text-slate-700">{{ pasStats.schoolCount }}</div>
        <div class="text-[10px] text-slate-500 uppercase font-bold">Établissements</div>
      </div>
      
      <div class="bg-white p-3 rounded-lg border border-slate-200 text-center">
        <div class="text-2xl font-bold text-slate-700">{{ pasStats.effectif }}</div>
        <div class="text-[10px] text-slate-500 uppercase font-bold">Élèves</div>
      </div>
      
      <div class="bg-white p-3 rounded-lg border border-slate-200 text-center">
        <div class="text-2xl font-bold" :class="ipsColor">{{ pasStats.ips }}</div>
        <div class="text-[10px] text-slate-500 uppercase font-bold">IPS Moyen</div>
      </div>
      
      <div class="bg-white p-3 rounded-lg border border-slate-200 text-center">
        <div class="text-2xl font-bold text-red-600">{{ pasStats.repCount + pasStats.repPlusCount }}</div>
        <div class="text-[10px] text-slate-500 uppercase font-bold">REP/REP+</div>
      </div>
    </div>
    
    <!-- Breakdown -->
    <div class="bg-slate-50 p-3 rounded-lg border border-slate-200">
      <h3 class="text-xs font-bold text-slate-600 uppercase mb-2">Répartition</h3>
      <div class="space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-600">Collèges</span>
          <span class="font-bold text-blue-600">{{ pasStats.collegeCount }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">Écoles primaires</span>
          <span class="font-bold text-teal-600">{{ pasStats.primaireCount }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">REP+</span>
          <span class="font-bold text-red-700">{{ pasStats.repPlusCount }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-600">REP</span>
          <span class="font-bold text-red-500">{{ pasStats.repCount }}</span>
        </div>
      </div>
    </div>
    
    <!-- School List -->
    <div class="bg-white p-3 rounded-lg border border-slate-200">
      <h3 class="text-xs font-bold text-slate-600 uppercase mb-2">Établissements ({{ pasStats.schools.length }})</h3>
      <div class="max-h-64 overflow-y-auto space-y-1">
        <div 
          v-for="school in pasStats.schools" 
          :key="school.UAI"
          class="text-xs p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors"
          :class="school['Degré'] === '2nd degré' ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-teal-400'"
          @click="store.selectSchool(school.UAI)"
        >
          <div class="font-semibold text-slate-700">{{ school['Nom complet'] }}</div>
          <div class="text-slate-500 flex justify-between mt-0.5">
            <span>{{ school.Commune }}</span>
            <span class="font-mono">{{ school['Effectifs (Archipel)'] }} él.</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Team Info -->
    <div v-if="rhInfo" class="space-y-3">
      <!-- Équipe de Proximité -->
      <div class="bg-white p-3 rounded-lg border border-slate-200">
        <h3 class="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center gap-1">
          <span class="material-icons text-sm">diversity_1</span>
          Équipe de Proximité
        </h3>
        <div class="space-y-2 text-xs">
          <div v-if="rhInfo.coord" class="flex justify-between items-start">
            <span class="text-slate-600">Coordonnateur</span>
            <div class="text-right">
              <div class="font-bold text-slate-800">{{ rhInfo.coord }}</div>
              <div v-if="rhInfo.phone" class="text-[10px] text-slate-500">{{ rhInfo.phone }}</div>
            </div>
          </div>
          <div v-if="rhInfo.educ" class="flex justify-between">
            <span class="text-slate-600">Éducateur spé</span>
            <span class="font-bold text-slate-800">{{ rhInfo.educ }}</span>
          </div>
          <div v-if="rhInfo.aesh" class="flex justify-between">
            <span class="text-slate-600">AESH référent</span>
            <span class="font-bold text-slate-800">{{ rhInfo.aesh }}</span>
          </div>
          <div v-if="rhInfo.dacs" class="flex justify-between">
            <span class="text-slate-600">DACS</span>
            <span class="font-bold text-slate-800">{{ rhInfo.dacs }}</span>
          </div>
        </div>
      </div>
      
      <!-- Pilotage & Partenariat -->
      <div class="bg-white p-3 rounded-lg border border-slate-200">
        <h3 class="text-xs font-bold text-orange-600 uppercase mb-2 flex items-center gap-1">
          <span class="material-icons text-sm">admin_panel_settings</span>
          Pilotage & Partenariat
        </h3>
        <div class="space-y-2 text-xs">
          <div v-if="rhInfo.pilot2d" class="flex justify-between">
            <span class="text-slate-600">Pilote 2D</span>
            <span class="font-bold text-slate-800">{{ rhInfo.pilot2d }}</span>
          </div>
          <div v-if="rhInfo.pilot1d" class="flex justify-between">
            <span class="text-slate-600">Pilote 1D</span>
            <span class="font-bold text-slate-800">{{ rhInfo.pilot1d }}</span>
          </div>
          <div v-if="rhInfo.pilotEsms && rhInfo.pilotEsms !== 'A définir'" class="flex justify-between">
            <span class="text-slate-600">Pilote ESMS</span>
            <span class="font-bold text-slate-800">{{ rhInfo.pilotEsms }}</span>
          </div>
          <div v-if="rhInfo.partner && rhInfo.partner !== 'A définir'" class="flex justify-between">
            <span class="text-slate-600">Porteur projet</span>
            <span class="font-bold text-slate-800">{{ rhInfo.partner }}</span>
          </div>
        </div>
      </div>
      
      <!-- Contact -->
      <div v-if="rhInfo.location || rhInfo.mail" class="bg-slate-50 p-3 rounded-lg border border-slate-200">
        <h3 class="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
          <span class="material-icons text-sm">place</span>
          Contact
        </h3>
        <div class="space-y-1 text-xs">
          <div v-if="rhInfo.location" class="text-slate-700">{{ rhInfo.location }}</div>
          <div v-if="rhInfo.mail">
            <a :href="'mailto:' + rhInfo.mail" class="text-blue-600 hover:underline">{{ rhInfo.mail }}</a>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Placeholder if no RH data -->
    <div v-else class="bg-amber-50 border border-amber-200 p-3 rounded-lg">
      <h3 class="text-xs font-bold text-amber-800 uppercase mb-1">📋 Équipes</h3>
      <p class="text-xs text-amber-700">
        Aucune donnée RH disponible pour ce PAS.
      </p>
    </div>
  </div>
</template>
