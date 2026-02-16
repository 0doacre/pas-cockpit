import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import localforage from 'localforage';
import type { School, DataFilters } from '../types';
import type { RhData } from '../services/rhLoader';
import { downloadCsv } from '../utils/exportUtils';

// Configure localforage
localforage.config({
    name: 'PAS-Cockpit',
    storeName: 'pas_data'
});

export const useDataStore = defineStore('data', () => {
    // State
    const schools = ref<School[]>([]);
    const sectorsGeoJson = ref<any>(null); // GeoJSON from KML
    const rhData = ref<Map<string, RhData>>(new Map());
    const filters = ref<DataFilters>({ bassin: 'TOUS', circ: 'TOUTES', pas: 'TOUS' });
    const searchQuery = ref('');
    const selectedPas = ref<string | null>(null);
    const selectedSchool = ref<School | null>(null);
    const isComputing = ref(false);
    const hasUnsavedChanges = ref(false);
    const hoveredSchoolUai = ref<string | null>(null);

    // New State for V34 features
    const currentView = ref<'MAP' | 'PILOTAGE'>('MAP');
    const simulConfig = ref({
        targetCount: 12,
        weights: { ips: 10, rep: 10, inclusion: 8, dist: 4, eff: 2 }
    });

    // Getters
    const availableBassins = computed(() => [...new Set(schools.value.map(s => s.Bassin).filter(Boolean))].sort());

    const availableCircs = computed(() => {
        let list = schools.value;
        if (filters.value.bassin !== 'TOUS') {
            list = list.filter(s => s.Bassin === filters.value.bassin);
        }
        return [...new Set(list.map(s => s.Circonscription).filter(Boolean))].sort();
    });

    const availableFilterPas = computed(() => {
        let list = schools.value;
        if (filters.value.bassin !== 'TOUS') {
            list = list.filter(s => s.Bassin === filters.value.bassin);
        }
        if (filters.value.circ !== 'TOUTES') {
            list = list.filter(s => s.Circonscription === filters.value.circ);
        }
        return [...new Set(list.map(s => s['Nom du PAS']).filter(Boolean))].sort();
    });

    const filteredSchools = computed(() => {
        return schools.value.filter(s => {
            // 1. Text Search
            if (searchQuery.value) {
                const q = searchQuery.value.toLowerCase();
                const matches =
                    (s['Nom complet'] || '').toLowerCase().includes(q) ||
                    (s.Commune || '').toLowerCase().includes(q) ||
                    (s.UAI || '').toLowerCase().includes(q);
                if (!matches) return false;
            }

            // 2. Filters
            if (filters.value.bassin !== 'TOUS' && s.Bassin !== filters.value.bassin) return false;
            if (filters.value.circ !== 'TOUTES' && s.Circonscription !== filters.value.circ) return false;
            if (filters.value.pas !== 'TOUS' && s['Nom du PAS'] !== filters.value.pas) return false;

            return true;
        });
    });

    const allPasNames = computed(() => [...new Set(schools.value.map(s => s['Nom du PAS']))].sort());

    // Only PAS explicitly in the current filtered view
    const filteredPasNames = computed(() => {
        const names = new Set(filteredSchools.value.map(s => s['Nom du PAS']));
        return [...names].sort();
    });

    // Detailed Metrics Calculation (Matching V1 Logic)
    const pasMetrics = computed(() => {
        const metrics: Record<string, any> = {};
        allPasNames.value.forEach(p => {
            const sList = schools.value.filter(s => s['Nom du PAS'] === p);
            let eff = 0, wIps = 0, ipsEffSum = 0, dist = 0, repCount = 0, repPlusCount = 0, ulisCount = 0;
            let collegeCount = 0, primaireCount = 0;
            const circs: Record<string, number> = {};

            sList.forEach(s => {
                const sEff = s['Effectifs (Archipel)'] || 0;
                eff += sEff;
                if (s.IPS > 0) {
                    wIps += s.IPS * sEff;
                    ipsEffSum += sEff;
                }
                dist += (s["Indice d'éloignement"] || 0);

                if (s['Degré'] === '2nd degré') collegeCount++;
                else primaireCount++;

                const ep = s['Education prioritaire (Archipel)'];
                const ter = s['Territoire'];

                if (ep?.includes('REP+')) repPlusCount++;
                else if (ep?.includes('REP') || (ter && (ter.includes('CLA') || ter.includes('TER')))) {
                    repCount++;
                }

                ulisCount += (s.ULIS || 0);
                if (s.Circonscription) {
                    circs[s.Circonscription] = (circs[s.Circonscription] || 0) + 1;
                }
            });

            const keys = Object.keys(circs);
            const dominantCirc = keys.length > 0 ? keys.reduce((a, b) => (circs[a] ?? 0) > (circs[b] ?? 0) ? a : b) : '';

            metrics[p] = {
                name: p,
                schoolCount: sList.length,
                collegeCount,
                primaireCount,
                effectif: eff,
                ips: ipsEffSum ? (wIps / ipsEffSum).toFixed(1) : '-',
                dist: sList.length ? (dist / sList.length).toFixed(2) : 0,
                dominantCirc,
                repCount,
                repPlusCount,
                ulisCount
            };
        });
        return metrics;
    });

    const departmentMetrics = computed(() => {
        const visiblePas = filteredPasNames.value;
        const subset = schools.value.filter(s => visiblePas.includes(s['Nom du PAS']));
        let eff = 0, wIps = 0, ipsEff = 0, rep = 0;

        subset.forEach(s => {
            eff += (s['Effectifs (Archipel)'] || 0);
            if (s.IPS > 0) {
                wIps += s.IPS * s['Effectifs (Archipel)'];
                ipsEff += s['Effectifs (Archipel)'];
            }
            const ep = s['Education prioritaire (Archipel)'];
            const ter = s['Territoire'];
            if ((ep && (ep.includes('REP+') || ep.includes('REP'))) ||
                (ter && (ter.includes('CLA') || ter.includes('TER')))) {
                rep++;
            }
        });

        return {
            ips: ipsEff ? (wIps / ipsEff).toFixed(1) : '-',
            effectif: eff,
            repCount: rep
        };
    });

    // Actions
    // Persistence Actions
    async function saveData() {
        try {
            isComputing.value = true;
            await localforage.setItem('schools_v2', JSON.parse(JSON.stringify(schools.value)));
            hasUnsavedChanges.value = false;
            return true;
        } catch (e) {
            console.error('Failed to save data:', e);
            return false;
        } finally {
            isComputing.value = false;
        }
    }

    async function loadFromStorage() {
        try {
            const savedData = await localforage.getItem<School[]>('schools_v2');
            if (savedData && Array.isArray(savedData) && savedData.length > 0) {
                schools.value = savedData;
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to load data from storage:', e);
            return false;
        }
    }

    async function resetData() {
        try {
            await localforage.removeItem('schools_v2');
            window.location.reload();
        } catch (e) {
            console.error('Failed to reset data:', e);
        }
    }

    function setSchools(data: School[]) {
        schools.value = data;
    }

    function setSectorsGeoJson(geojson: any) {
        sectorsGeoJson.value = geojson;
    }

    function updateSchoolPas(uai: string, newPas: string) {
        const school = schools.value.find(s => s.UAI === uai);
        if (school && school['Nom du PAS'] !== newPas) {
            school['Nom du PAS'] = newPas;
            hasUnsavedChanges.value = true;
        }
    }

    // New Actions
    function renamePas(oldName: string, newName: string) {
        if (!newName.trim() || oldName === newName) return;
        schools.value.forEach(s => {
            if (s['Nom du PAS'] === oldName) {
                s['Nom du PAS'] = newName;
            }
        });
        hasUnsavedChanges.value = true;
        if (selectedPas.value === oldName) selectedPas.value = newName;
    }

    function renameSchool(uai: string, newName: string) {
        const school = schools.value.find(s => s.UAI === uai);
        if (school && newName.trim() && school['Nom complet'] !== newName) {
            school['Nom complet'] = newName;
            hasUnsavedChanges.value = true;
        }
    }

    function updateSectorPas(sectorName: string, targetPas: string) {
        schools.value.forEach(s => {
            if (s['PAS.1.Collège de rattachement'] === sectorName) {
                s['Nom du PAS'] = targetPas;
            }
        });
        hasUnsavedChanges.value = true;
    }

    function updateSchoolSector(uai: string, newSector: string, newPas?: string) {
        const school = schools.value.find(s => s.UAI === uai);
        if (school) {
            school['PAS.1.Collège de rattachement'] = newSector;
            if (newPas) school['Nom du PAS'] = newPas;
            hasUnsavedChanges.value = true;
        }
    }

    function setView(view: 'MAP' | 'PILOTAGE') {
        currentView.value = view;
    }

    function setSearchQuery(q: string) {
        searchQuery.value = q;
    }

    function setFilter(key: keyof DataFilters, value: string) {
        filters.value[key] = value;
        // Reset selection if filter changes to avoid confusion
        if (key === 'bassin') {
            filters.value.circ = 'TOUTES';
            filters.value.pas = 'TOUS';
        }
        if (key === 'circ') {
            filters.value.pas = 'TOUS';
        }
        selectedPas.value = null;
        selectedSchool.value = null;
    }

    function selectPas(pasName: string | null) {
        selectedPas.value = pasName;
        selectedSchool.value = null;
    }

    function selectSchool(uai: string | null) {
        if (!uai) {
            selectedSchool.value = null;
            return;
        }
        const s = schools.value.find(x => x.UAI === uai);
        selectedSchool.value = s || null;
        if (s) {
            selectedPas.value = s['Nom du PAS'];
        }
    }

    function setHoveredSchool(uai: string | null) {
        hoveredSchoolUai.value = uai;
    }

    function setRhData(data: Map<string, RhData>) {
        rhData.value = data;
    }

    function exportToCsv() {
        downloadCsv(schools.value, 'data.csv');
    }

    return {
        schools,
        sectorsGeoJson,
        rhData,
        filters,
        searchQuery,
        selectedPas,
        selectedSchool,
        isComputing,
        hasUnsavedChanges,
        hoveredSchoolUai,
        currentView,
        simulConfig,
        availableBassins,
        availableCircs,
        filteredSchools,
        allPasNames,
        filteredPasNames,
        pasMetrics,
        departmentMetrics,
        setSchools,
        setSectorsGeoJson,
        setRhData,
        updateSchoolPas,
        renamePas,
        updateSectorPas,
        updateSchoolSector,
        setView,
        setSearchQuery,
        setFilter,
        selectPas,
        selectSchool,
        setHoveredSchool,
        saveData,
        loadFromStorage,
        resetData,
        renameSchool,
        exportToCsv,
        availableFilterPas
    };
});
