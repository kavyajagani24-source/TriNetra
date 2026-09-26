/**
 * TriNetra — Pedestrian Movement Hotspots Data
 * Geospatial coordinates across Mumbai bus corridors (Dadar, Bandra, Kurla, CST, Andheri, Sion, etc.)
 */

import type { PedestrianHotspot } from "@/types/safetyHotspots";
import type { SafetyIncident } from "@/types/safety";

export const MUMBAI_SAFETY_HOTSPOTS: PedestrianHotspot[] = [
  // ── High Pedestrian Movement Corridors (Red) ────────────────────────────────
  {
    id: "hotspot_dadar_school",
    name: "Dadar West — Shardashram School Crossing",
    zone_type: "school_zone",
    movement_density: "high",
    risk_level: "high",
    coordinates: [72.8435, 19.0182],
    pedestrians_per_hour: 1680,
    near_miss_count: 14,
    peak_hours: "07:15 - 09:30 & 13:45 - 15:30",
    active_school_zone: true,
    bus_routes_affected: ["302-EXP", "C-40", "A-115"],
    conflict_types: [
      "School corridor crosswalk spillover",
      "Abrupt road entry during dispersal",
      "Bus curb buffer conflict",
    ],
    recommended_action:
      "Install raised pedestrian table (speed table), mandate 25 km/h transit lane restriction, and activate optical crossing beacons.",
    description:
      "Extremely dense morning & afternoon school corridor. Heavy student foot traffic crossing multi-lane bus transit path.",
  },
  {
    id: "hotspot_cst_plaza",
    name: "CST Terminus South — D.N. Road Crosswalk",
    zone_type: "transit_hub",
    movement_density: "high",
    risk_level: "high",
    coordinates: [72.8354, 18.9405],
    pedestrians_per_hour: 1950,
    near_miss_count: 19,
    peak_hours: "08:00 - 11:00 & 17:00 - 20:30",
    active_school_zone: false,
    bus_routes_affected: ["104", "11-LTD", "C-51"],
    conflict_types: [
      "Suburban rail commuter surge",
      "Jaywalking across bus turnaround bay",
      "Blind-spot crossing behind parked double-deckers",
    ],
    recommended_action:
      "Construct automated pedestrian barrier gate synced with bus bay arrival signals and extend yellow zig-zag safety markings.",
    description:
      "Suburban rail commuter interchange with continuous multi-directional pedestrian stream intersecting bus exit bay.",
  },
  {
    id: "hotspot_bandra_college",
    name: "Bandra Linking Road — National College Crossing",
    zone_type: "school_zone",
    movement_density: "high",
    risk_level: "high",
    coordinates: [72.8368, 19.0592],
    pedestrians_per_hour: 1420,
    near_miss_count: 11,
    peak_hours: "08:30 - 11:30 & 15:00 - 18:00",
    active_school_zone: true,
    bus_routes_affected: ["C-40", "220", "83"],
    conflict_types: [
      "College student curb clustering",
      "Crossing between slow-moving transit vehicles",
    ],
    recommended_action:
      "Extend curb refuge island by 1.8 meters and deploy automated radar VRU warning signs for oncoming bus drivers.",
    description:
      "High youth and pedestrian density along commercial retail and college strip with continuous mid-block crossings.",
  },
  {
    id: "hotspot_andheri_station",
    name: "Andheri Station East — SV Road Transit Concourse",
    zone_type: "transit_hub",
    movement_density: "high",
    risk_level: "high",
    coordinates: [72.8472, 19.1197],
    pedestrians_per_hour: 1810,
    near_miss_count: 16,
    peak_hours: "08:00 - 10:30 & 17:30 - 20:30",
    active_school_zone: false,
    bus_routes_affected: ["302", "339", "A-25"],
    conflict_types: [
      "Metro line 1 transfer footfall",
      "Narrow sidewalk encroachment forcing pedestrians onto road",
    ],
    recommended_action:
      "Reclaim transit right-of-way by clearing sidewalk bottlenecks and installing bollard-protected pedestrian lanes.",
    description:
      "Critical transit multimodal interchange between Metro Line 1, Western Railway, and BEST feeder bus terminus.",
  },
  {
    id: "hotspot_kurla_lbs",
    name: "Kurla West — LBS Marg & Station Access",
    zone_type: "arterial_crossing",
    movement_density: "high",
    risk_level: "high",
    coordinates: [72.8875, 19.0682],
    pedestrians_per_hour: 1540,
    near_miss_count: 13,
    peak_hours: "08:30 - 10:30 & 18:00 - 21:00",
    active_school_zone: false,
    bus_routes_affected: ["302-EXP", "37", "A-30"],
    conflict_types: [
      "Market vendor obstruction forcing road entry",
      "Unregulated mid-block pedestrian crossing",
    ],
    recommended_action:
      "Implement dedicated high-visibility pedestrian refuge corridor and synchronize pedestrian phase at LBS intersection.",
    description:
      "Heavy commercial pedestrian market with frequent sudden roadway ingress in front of decelerating buses.",
  },

  // ── Medium Pedestrian Movement Corridors (Amber) ────────────────────────────
  {
    id: "hotspot_bkc_bourse",
    name: "BKC — Diamond Bourse & ICICI Junction",
    zone_type: "commercial_market",
    movement_density: "medium",
    risk_level: "medium",
    coordinates: [72.8682, 19.0654],
    pedestrians_per_hour: 880,
    near_miss_count: 6,
    peak_hours: "09:00 - 10:30 & 17:30 - 19:30",
    active_school_zone: false,
    bus_routes_affected: ["A-115", "BKC-1", "BKC-2"],
    conflict_types: [
      "Office crowd crosswalk crossing during lunch/evening",
      "Fast-moving bus transit lane conflicts",
    ],
    recommended_action:
      "Repaint high-contrast optical zebra markings and install smart LED in-pavement crossing studs.",
    description:
      "Wide arterial boulevard with periodic heavy corporate pedestrian surges across dedicated bus lanes.",
  },
  {
    id: "hotspot_sion_circle",
    name: "Sion Circle — Transit Hub Approach",
    zone_type: "transit_hub",
    movement_density: "medium",
    risk_level: "medium",
    coordinates: [72.8615, 19.0402],
    pedestrians_per_hour: 790,
    near_miss_count: 5,
    peak_hours: "08:00 - 10:00 & 18:00 - 20:00",
    active_school_zone: false,
    bus_routes_affected: ["302-EXP", "C-40", "25-LTD"],
    conflict_types: [
      "Pedestrian underpass bypass by commuters",
      "Bus deceleration queue conflicts",
    ],
    recommended_action:
      "Enhance signage for grade-separated pedestrian underpass and install 1.2m anti-cross fences along central median.",
    description:
      "Major eastern-western transit rotary with steady pedestrian transfer traffic between rail and bus lines.",
  },
  {
    id: "hotspot_lower_parel",
    name: "Lower Parel — High Street Phoenix & Railway Crossing",
    zone_type: "crosswalk",
    movement_density: "medium",
    risk_level: "medium",
    coordinates: [72.8295, 18.9954],
    pedestrians_per_hour: 920,
    near_miss_count: 7,
    peak_hours: "12:30 - 15:00 & 18:30 - 22:00",
    active_school_zone: false,
    bus_routes_affected: ["C-40", "83", "A-1"],
    conflict_types: [
      "Weekend retail shopper crossing surges",
      "Nighttime pedestrian visibility limitations",
    ],
    recommended_action:
      "Upgrade street illumination over crosswalks to 50 lux and install solar overhead flashing amber beacon.",
    description:
      "Retail, dining, and IT corporate corridor with high pedestrian volume extending into late evening hours.",
  },
  {
    id: "hotspot_chembur_interchange",
    name: "Chembur Naka — Monorail & Eastern Freeway Access",
    zone_type: "transit_hub",
    movement_density: "medium",
    risk_level: "medium",
    coordinates: [72.9015, 19.0585],
    pedestrians_per_hour: 680,
    near_miss_count: 4,
    peak_hours: "08:30 - 10:00 & 17:30 - 19:30",
    active_school_zone: false,
    bus_routes_affected: ["104", "382", "C-54"],
    conflict_types: [
      "Monorail stairs discharge directly toward transit lane",
      "Crossing near freeway off-ramp",
    ],
    recommended_action:
      "Channelize pedestrian stair discharge with guide railings away from bus deceleration zone.",
    description:
      "Interchange linking Monorail passengers with feeder buses on high-speed arterial perimeter.",
  },

  // ── Low Pedestrian Movement Corridors (Emerald/Blue) ─────────────────────────
  {
    id: "hotspot_worli_seaface",
    name: "Worli Sea Face — Promenade Coastal Crossing",
    zone_type: "crosswalk",
    movement_density: "low",
    risk_level: "low",
    coordinates: [72.8142, 19.0085],
    pedestrians_per_hour: 310,
    near_miss_count: 2,
    peak_hours: "06:00 - 08:30 & 17:30 - 20:00",
    active_school_zone: false,
    bus_routes_affected: ["83", "84-LTD"],
    conflict_types: [
      "Morning jogger crossing",
      "Recreational pedestrian movements",
    ],
    recommended_action:
      "Maintain zebra crossing paint reflectivity and verify speed camera calibration.",
    description:
      "Wide coastal boulevard with organized, low-conflict pedestrian crossings during recreational morning hours.",
  },
  {
    id: "hotspot_bandra_bandstand",
    name: "Bandra Bandstand — Promenade Transit Turnaround",
    zone_type: "crosswalk",
    movement_density: "low",
    risk_level: "low",
    coordinates: [72.8198, 19.0482],
    pedestrians_per_hour: 280,
    near_miss_count: 1,
    peak_hours: "17:00 - 20:30",
    active_school_zone: false,
    bus_routes_affected: ["211", "214"],
    conflict_types: ["Evening leisure crossing"],
    recommended_action: "Regular crosswalk maintenance and curb illumination.",
    description:
      "Low speed terminus loop with well-segregated pedestrian footpath and low bus approach velocities.",
  },
  {
    id: "hotspot_nariman_point",
    name: "Nariman Point — NCPA Transit Loop",
    zone_type: "commercial_market",
    movement_density: "low",
    risk_level: "low",
    coordinates: [72.8225, 18.9268],
    pedestrians_per_hour: 240,
    near_miss_count: 1,
    peak_hours: "09:30 - 10:30 & 17:30 - 18:30",
    active_school_zone: false,
    bus_routes_affected: ["104", "138"],
    conflict_types: ["Executive office crossing"],
    recommended_action: "Standard periodic traffic audit.",
    description:
      "Spacious corporate cul-de-sac with controlled vehicular traffic and high driver compliance.",
  },
];

/**
 * Build GeoJSON FeatureCollection for Mapbox Heatmap layer.
 * Generates continuous thermal weight points around each hotspot.
 */
export function buildHeatmapGeoJSON(
  hotspots: PedestrianHotspot[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const h of hotspots) {
    const weight =
      h.movement_density === "high" ? 1.0 : h.movement_density === "medium" ? 0.6 : 0.25;

    // Center point
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: h.coordinates },
      properties: {
        id: h.id,
        weight: weight * 1.2,
        density: h.movement_density,
        peds_per_hour: h.pedestrians_per_hour,
      },
    });

    // Sub-cluster points around the hotspot to give realistic thermal spread
    const spreadCount = h.movement_density === "high" ? 8 : h.movement_density === "medium" ? 4 : 2;
    for (let i = 0; i < spreadCount; i++) {
      const angle = (i / spreadCount) * Math.PI * 2;
      const radius = 0.0018 + (i % 3) * 0.0008; // ~150-250m jitter
      const jitterLng = h.coordinates[0] + Math.cos(angle) * radius;
      const jitterLat = h.coordinates[1] + Math.sin(angle) * radius;

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [jitterLng, jitterLat] },
        properties: {
          id: `${h.id}_sub_${i}`,
          weight: weight * (0.6 + (i % 2) * 0.3),
          density: h.movement_density,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

/**
 * Build GeoJSON FeatureCollection for point markers
 */
export function buildHotspotPointsGeoJSON(
  hotspots: PedestrianHotspot[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: hotspots.map((h) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: h.coordinates },
      properties: {
        id: h.id,
        name: h.name,
        zone_type: h.zone_type,
        movement_density: h.movement_density,
        risk_level: h.risk_level,
        pedestrians_per_hour: h.pedestrians_per_hour,
        near_miss_count: h.near_miss_count,
        active_school_zone: h.active_school_zone,
        recommended_action: h.recommended_action,
      },
    })),
  };
}

/**
 * Anchor the active run's safety incidents onto Mumbai coordinates
 * if they lack GPS, or attach them to Dadar-CST corridor so they can be pinpointed on map.
 */
export function anchorIncidentsToGeo(
  incidents: SafetyIncident[],
  baseHotspot: PedestrianHotspot = MUMBAI_SAFETY_HOTSPOTS[0]
): (SafetyIncident & { coordinates: [number, number] })[] {
  return incidents.map((inc, idx) => {
    // If event has valid GPS, use it
    if (
      inc.primary_event.longitude != null &&
      inc.primary_event.latitude != null &&
      !isNaN(inc.primary_event.longitude) &&
      !isNaN(inc.primary_event.latitude)
    ) {
      return {
        ...inc,
        coordinates: [inc.primary_event.longitude, inc.primary_event.latitude] as [number, number],
      };
    }

    // Otherwise, anchor along the Dadar School Corridor with slight offsets
    const offsetLng = (idx % 4) * 0.0007 - 0.001;
    const offsetLat = Math.floor(idx / 4) * 0.0005 - 0.0005;
    return {
      ...inc,
      coordinates: [
        baseHotspot.coordinates[0] + offsetLng,
        baseHotspot.coordinates[1] + offsetLat,
      ] as [number, number],
    };
  });
}
