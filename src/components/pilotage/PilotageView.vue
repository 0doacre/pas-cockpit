<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../../stores/dataStore';

const store = useDataStore();

const rankedPas = computed(() => {
    const list: any[] = [];
    const allM = store.pasMetrics;
    const names = Object.keys(allM);
    
    if (names.length === 0) return [];

    // Find Max/Min for normalization
    let maxEff = 0, maxDist = 0, minIps = 200, maxIps = 0, maxRep = 0, maxInc = 0;
    
    names.forEach(name => {
        const m = allM[name];
        if (m.effectif > maxEff) maxEff = m.effectif;
        const d = parseFloat(m.dist);
        if (d > maxDist) maxDist = d;
        const ips = parseFloat(m.ips) || 100;
        if (ips > maxIps) maxIps = ips;
        if (ips < minIps && ips > 0) minIps = ips;
        const repTotal = (m.repCount || 0) + (m.repPlusCount || 0);
        if (repTotal > maxRep) maxRep = repTotal;
        if (m.ulisCount > maxInc) maxInc = m.ulisCount;
    });

    names.forEach(name => {
        const m = allM[name];
        const ips = parseFloat(m.ips) || 100;
        const dist = parseFloat(m.dist);
        const repTotal = (m.repCount || 0) + (m.repPlusCount || 0);

        // Normalize 0-10
        const s_ips = (maxIps - ips) / (maxIps - minIps || 1) * 10;
        const s_rep = maxRep ? (repTotal / maxRep) * 10 : 0;
        const s_inc = maxInc ? (m.ulisCount / maxInc) * 10 : 0;
        const s_dist = maxDist ? (dist / maxDist) * 10 : 0;
        const s_eff = maxEff ? (m.effectif / maxEff) * 10 : 0;

        const score = (s_ips * store.simulConfig.weights.ips) + 
                      (s_rep * store.simulConfig.weights.rep) + 
                      (s_inc * store.simulConfig.weights.inclusion) + 
                      (s_dist * store.simulConfig.weights.dist) + 
                      (s_eff * store.simulConfig.weights.eff);

        list.push({ 
            name, 
            metrics: m, 
            score,
            normalized: { ips: s_ips, rep: s_rep, inc: s_inc, dist: s_dist, eff: s_eff }
        });
    });

    return list.sort((a, b) => b.score - a.score);
});

const weights = store.simulConfig.weights;
</script>

<template>
  <div class="h-full flex overflow-hidden bg-slate-50">
    <!-- Sidebar: Controls -->
    <div class="w-80 bg-white border-r border-slate-200 p-6 flex flex-col shadow-sm">
      <h2 class="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span class="material-icons text-blue-600">tune</span>
        Simulation
      </h2>

      <!-- Target Count -->
      <div class="bg-blue-50 p-4 rounded-xl mb-8 border border-blue-100">
        <label class="block text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-2">Cible PAS Renforcés</label>
        <div class="flex items-center gap-3">
            <input 
                type="number" 
                v-model.number="store.simulConfig.targetCount" 
                class="w-20 bg-white p-2 rounded-lg border border-blue-200 font-bold text-center text-blue-900 focus:ring-2 focus:ring-blue-400 outline-none"
            >
            <span class="text-xs text-blue-600 font-medium">secteurs prioritaires</span>
        </div>
      </div>

      <!-- Weights -->
      <div class="flex-1 space-y-8 overflow-y-auto pr-2">
        <div v-for="(val, key) in weights" :key="key" class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{{ key }}</span>
            <span class="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono font-bold text-slate-700">{{ val }}</span>
          </div>
          <input 
            type="range" 
            v-model.number="store.simulConfig.weights[key]" 
            min="0" 
            max="10" 
            step="0.5" 
            class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          >
        </div>
      </div>

      <div class="mt-8 pt-4 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed italic">
        Le score est calculé en normalisant chaque indicateur sur une échelle de 0 à 10, puis en appliquant les coefficients ci-dessus.
      </div>
    </div>

    <!-- Main Content: Results -->
    <div class="flex-1 p-8 overflow-y-auto">
      <div class="max-w-5xl mx-auto">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-2xl font-black text-slate-900 leading-tight">Classement des PAS</h1>
                <p class="text-slate-500">Basé sur les indicateurs de précarité, d'éloignement et d'inclusion.</p>
            </div>
            <div class="text-right">
                <span class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total secteurs</span>
                <span class="text-2xl font-bold text-slate-800">{{ rankedPas.length }}</span>
            </div>
        </div>

        <div class="overflow-hidden rounded-2xl border border-slate-200 shadow-xl bg-white">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-slate-800 text-white text-left uppercase text-[10px] tracking-wider font-bold">
                <th class="p-4 w-16 text-center">Rang</th>
                <th class="p-4">Secteur PAS</th>
                <th class="p-4 text-center">Score</th>
                <th class="p-4 text-center">IPS</th>
                <th class="p-4 text-center">Dist.</th>
                <th class="p-4 text-center">EP (%)</th>
                <th class="p-4 text-center">Inc.</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(p, i) in rankedPas" 
                :key="p.name"
                class="border-b border-slate-100 transition-colors hover:bg-slate-50 group"
                :class="{'bg-blue-50/50': i < store.simulConfig.targetCount}"
              >
                <td class="p-4 text-center">
                  <span 
                    class="inline-flex items-center justify-center w-8 h-8 rounded-full font-black"
                    :class="i < store.simulConfig.targetCount ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'"
                  >
                    {{ i + 1 }}
                  </span>
                </td>
                <td class="p-4">
                  <div class="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{{ p.name }}</div>
                  <div class="text-[10px] text-slate-400">{{ p.metrics.dominantCirc || 'Non défini' }}</div>
                </td>
                <td class="p-4 text-center font-mono font-bold text-blue-700 bg-blue-50/20">
                  {{ p.score.toFixed(1) }}
                </td>
                <td class="p-4 text-center">
                  <div class="font-medium">{{ p.metrics.ips }}</div>
                  <div class="w-12 mx-auto bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                    <div class="bg-green-500 h-full" :style="{ width: p.normalized.ips * 10 + '%' }"></div>
                  </div>
                </td>
                <td class="p-4 text-center font-medium">{{ p.metrics.dist }}</td>
                <td class="p-4 text-center">
                  <div class="font-medium">{{ (p.metrics.repRatio * 100).toFixed(0) }}%</div>
                  <div class="text-[8px] text-slate-400 uppercase mt-0.5">{{ p.metrics.repCount + p.metrics.repPlusCount }} étab.</div>
                </td>
                <td class="p-4 text-center font-medium text-purple-600">{{ p.metrics.ulisCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  border: 2px solid white;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
</style>
