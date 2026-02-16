export interface School {
    UAI: string;
    "Nom complet": string;
    "Type d'établissement": string;
    "Degré": "1er degré" | "2nd degré";
    "Public / Privé": string;
    Adresse: string;
    "Code postal": string;
    Commune: string;
    IPS: number;
    "Effectifs (Archipel)": number;
    Latitude: number;
    Longitude: number;
    "Nom du PAS": string;
    "PAS.1.Collège de rattachement": string;
    Bassin: string;
    Circonscription: string;
    "Education prioritaire (Archipel)"?: string;
    "Territoire"?: string;
    "Indice d'éloignement": number;
    ULIS: number;
}

export interface PasMetric {
    name: string;
    ips: number;
    effectif: number;
    repCount: number;
    repRatio: number;
    dist: number;
    dominantCirc: string;
}

export interface DataFilters {
    bassin: string;
    circ: string;
    pas: string;
}

export interface SimulationConfig {
    targetCount: number;
    weights: {
        ips: number;
        rep: number;
        inclusion: number;
        dist: number;
        eff: number;
    };
}
