<script setup lang="ts">
import { computed } from 'vue';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';
import { Bar } from 'vue-chartjs';
import { useDataStore } from '../../stores/dataStore';
import type { School } from '../../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const store = useDataStore();

const chartData = computed(() => {
  const schools = store.filteredSchools;
  const buckets = { 
    'High (>120)': 0, 
    'Sup (>105)': 0, 
    'Moy (90-105)': 0, 
    'Low (<90)': 0 
  };
  
  schools.forEach((s: School) => {
    // Ensure IPS is a number
    const ips = typeof s.IPS === 'string' ? parseFloat(s.IPS) : s.IPS;
    
    if (!ips) return;

    if (ips > 120) buckets['High (>120)']++;
    else if (ips > 105) buckets['Sup (>105)']++;
    else if (ips > 90) buckets['Moy (90-105)']++;
    else buckets['Low (<90)']++;
  });

  return {
    labels: ['>120', '105-120', '90-105', '<90'],
    datasets: [{
      label: "Nb d'écoles",
      data: [
        buckets['High (>120)'], 
        buckets['Sup (>105)'], 
        buckets['Moy (90-105)'], 
        buckets['Low (<90)']
      ],
      backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
      borderRadius: 4
    }]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { 
        backgroundColor: '#1e293b',
        padding: 10,
        cornerRadius: 4
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        display: true,
        color: '#f1f5f9'
      },
      ticks: {
          stepSize: 1
      }
    },
    x: {
      grid: { display: false }
    }
  }
};
</script>

<template>
  <div class="h-40 w-full mt-4 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
    <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Répartition IPS</h3>
    <div class="h-32">
        <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
