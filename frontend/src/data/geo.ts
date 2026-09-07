import type { BusRoute, LatLng, RoadCondition, RoadSegment } from "@/types";

/**
 * Mumbai working extent — covers major transport corridors:
 * Bandra-Kurla Complex, Andheri, Worli, Lower Parel, Dadar, Kurla
 */
export const CITY_BOUNDS = {
  minLng: 72.77,
  maxLng: 72.97,
  minLat: 18.89,
  maxLat: 19.12,
};

/** Mumbai city center (Bandra-Kurla Complex) */
export const CITY_CENTER: LatLng = { lat: 19.065, lng: 72.868 };

const p = (lat: number, lng: number): LatLng => ({ lat, lng });

/**
 * Named arterial geometry — Mumbai's major road network (demo data, hand-placed).
 */
export const ARTERIALS: { road: string; path: LatLng[] }[] = [
  {
    road: "Western Express Highway",
    path: [
      p(19.115, 72.865),
      p(19.1, 72.863),
      p(19.085, 72.861),
      p(19.075, 72.858),
      p(19.065, 72.857),
      p(19.05, 72.853),
      p(19.035, 72.852),
      p(19.02, 72.85),
      p(18.995, 72.845),
      p(18.975, 72.838),
    ],
  },
  {
    road: "Eastern Express Highway",
    path: [
      p(19.105, 72.91),
      p(19.085, 72.9),
      p(19.065, 72.89),
      p(19.045, 72.882),
      p(19.025, 72.875),
      p(19.005, 72.868),
      p(18.985, 72.862),
      p(18.965, 72.855),
    ],
  },
  {
    road: "Linking Road, Bandra",
    path: [
      p(19.059, 72.836),
      p(19.057, 72.842),
      p(19.056, 72.851),
      p(19.054, 72.861),
    ],
  },
  {
    road: "SV Road",
    path: [
      p(19.115, 72.847),
      p(19.098, 72.845),
      p(19.082, 72.843),
      p(19.067, 72.84),
      p(19.055, 72.837),
      p(19.04, 72.834),
    ],
  },
  {
    road: "LBS Marg",
    path: [
      p(19.09, 72.93),
      p(19.073, 72.918),
      p(19.059, 72.907),
      p(19.044, 72.898),
      p(19.028, 72.888),
    ],
  },
  {
    road: "BKC (Bandra-Kurla Complex)",
    path: [
      p(19.069, 72.868),
      p(19.065, 72.876),
      p(19.062, 72.865),
      p(19.06, 72.858),
      p(19.058, 72.868),
    ],
  },
  {
    road: "Sion-Panvel Expressway",
    path: [
      p(19.043, 72.875),
      p(19.034, 72.889),
      p(19.025, 72.902),
      p(19.01, 72.915),
    ],
  },
  {
    road: "Worli Sea Link approach",
    path: [
      p(19.017, 72.813),
      p(19.022, 72.818),
      p(19.028, 72.826),
      p(19.033, 72.833),
    ],
  },
  {
    road: "Andheri-Kurla Road",
    path: [
      p(19.12, 72.86),
      p(19.108, 72.868),
      p(19.099, 72.877),
      p(19.09, 72.889),
      p(19.081, 72.9),
    ],
  },
  {
    road: "Jogeshwari-Vikhroli Link Road",
    path: [
      p(19.128, 72.862),
      p(19.12, 72.875),
      p(19.112, 72.888),
      p(19.103, 72.9),
      p(19.095, 72.912),
    ],
  },
  {
    road: "Mahim Causeway",
    path: [
      p(19.044, 72.845),
      p(19.04, 72.847),
      p(19.037, 72.845),
    ],
  },
  {
    road: "Cadell Road – Dadar",
    path: [
      p(19.022, 72.832),
      p(19.025, 72.838),
      p(19.027, 72.844),
      p(19.03, 72.85),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Deterministic minor street grid — visual basemap texture.            */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MINOR_STREETS: LatLng[][] = (() => {
  const rand = mulberry32(20260907);
  const out: LatLng[][] = [];
  const { minLat, maxLat, minLng, maxLng } = CITY_BOUNDS;
  for (let i = 0; i < 190; i++) {
    const startLat = minLat + rand() * (maxLat - minLat);
    const startLng = minLng + rand() * (maxLng - minLng);
    const horizontal = rand() > 0.5;
    const len = 0.004 + rand() * 0.03;
    const jitter = () => (rand() - 0.5) * 0.002;
    const steps = 3 + Math.floor(rand() * 4);
    const path: LatLng[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * len;
      path.push(
        horizontal
          ? p(startLat + jitter() * 0.6, startLng + t)
          : p(startLat + t * 0.75, startLng + jitter() * 0.6),
      );
    }
    out.push(path);
  }
  return out;
})();

/* ------------------------------------------------------------------ */
/* Road condition segmentation                                          */
/* ------------------------------------------------------------------ */

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Split every arterial into surveyed segments carrying a condition level. */
export const ROAD_SEGMENTS: RoadSegment[] = (() => {
  const rand = mulberry32(451);
  const segments: RoadSegment[] = [];
  let n = 400;
  for (const arterial of ARTERIALS) {
    for (let i = 0; i < arterial.path.length - 1; i++) {
      const a = arterial.path[i]!;
      const b = arterial.path[i + 1]!;
      const parts = 3;
      for (let s = 0; s < parts; s++) {
        const from = lerp(a, b, s / parts);
        const to = lerp(a, b, (s + 1) / parts);
        const roll = rand();
        const condition: RoadCondition =
          roll > 0.985 ? 3 : roll > 0.93 ? 2 : roll > 0.5 ? 1 : 0;
        segments.push({
          id: `SEG-${n++}`,
          road: arterial.road,
          condition,
          path: [from, to],
          lengthKm: Number(haversineKm(from, to).toFixed(2)),
        });
      }
    }
  }
  return segments;
})();

export const SURVEYED_DISTANCE_KM = Number(
  ROAD_SEGMENTS.reduce((sum, s) => sum + s.lengthKm, 0).toFixed(2),
);

export const CONDITION_COLORS: Record<RoadCondition, string> = {
  0: "#3fb27f",
  1: "#c9c53f",
  2: "#e08b3c",
  3: "#dc4b3e",
  4: "#a32a20",
};

/** Mumbai BEST bus routes (demo) */
export const BUS_ROUTES: BusRoute[] = [
  {
    id: "B1",
    name: "Route B1 · Andheri ↔ Churchgate",
    delayMin: 12,
    coverage: 86,
    path: [
      p(19.119, 72.847),
      p(19.1,   72.844),
      p(19.082, 72.842),
      p(19.065, 72.84),
      p(19.047, 72.837),
      p(19.032, 72.834),
      p(19.018, 72.831),
    ],
  },
  {
    id: "B2",
    name: "Route B2 · Bandra ↔ Kurla (BEST)",
    delayMin: 8,
    coverage: 79,
    path: [
      p(19.054, 72.836),
      p(19.057, 72.845),
      p(19.061, 72.858),
      p(19.065, 72.869),
      p(19.068, 72.879),
      p(19.072, 72.889),
    ],
  },
  {
    id: "B3",
    name: "Route B3 · Dadar ↔ LBS Marg",
    delayMin: 18,
    coverage: 71,
    path: [
      p(19.022, 72.844),
      p(19.031, 72.856),
      p(19.042, 72.868),
      p(19.053, 72.879),
      p(19.062, 72.891),
    ],
  },
  {
    id: "B4",
    name: "Route B4 · WEH Express · Borivali ↔ BKC",
    delayMin: 5,
    coverage: 91,
    path: [
      p(19.23, 72.858),
      p(19.2,  72.857),
      p(19.165, 72.856),
      p(19.13, 72.854),
      p(19.1,  72.85),
      p(19.075, 72.847),
      p(19.065, 72.868),
    ],
  },
];
