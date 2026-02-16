<script setup lang="ts">
import { ref } from 'vue';

const isSidebarOpen = ref(true);
const isRightPanelOpen = ref(true);
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 text-slate-800">
    <!-- Header -->
    <header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <span class="text-blue-600">🚀</span> Cockpit PAS 67 <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">V2</span>
        </h1>
        <button 
          @click="isSidebarOpen = !isSidebarOpen" 
          class="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
          :class="{ 'bg-blue-50 text-blue-600': !isSidebarOpen }"
          title="Afficher/masquer les filtres"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 3v18"/></svg>
        </button>
        <div class="h-6 w-px bg-slate-200 mx-2"></div>
        <slot name="header-center" />
      </div>
      
      <div class="flex items-center gap-3">
        <slot name="header-actions" />
        <!-- Right panel toggle (visible when closed) -->
        <button 
          v-if="!isRightPanelOpen"
          @click="isRightPanelOpen = true" 
          class="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          title="Afficher le panneau détails"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M15 3v18"/></svg>
        </button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar Left -->
      <aside 
        class="bg-white border-r border-slate-200 flex-shrink-0 transition-all duration-300 ease-in-out relative z-10"
        :class="isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden'"
      >
        <div class="h-full overflow-y-auto p-4">
          <slot name="sidebar" />
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 relative min-w-0 bg-slate-100 overflow-hidden flex flex-col">
        <slot name="main" />
      </main>

      <!-- Sidebar Right -->
      <aside 
        class="bg-white border-l border-slate-200 flex-shrink-0 transition-all duration-300 ease-in-out z-10"
        :class="isRightPanelOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full opacity-0 overflow-hidden'"
      >
        <div class="h-full flex flex-col">
          <div class="p-2 border-b border-slate-100 flex justify-between items-center">
            <span class="text-xs font-bold uppercase text-slate-400">Détails</span>
            <button 
              @click="isRightPanelOpen = false" 
              class="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Masquer ce panneau"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 text-sm">
             <slot name="right-panel" />
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
