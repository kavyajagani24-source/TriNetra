/**
 * Andheri Road Intelligence Processor
 * 
 * Takes real OSM road GeoJSON (andheri-roads.geojson) and:
 * 1. Splits longer roads into segments
 * 2. Assigns deterministic intelligence attributes to a subset
 * 3. Generates observation points along those segments
 * 4. Outputs andheri-intelligence.geojson and andheri-observations.geojson
 * 
 * SOURCE: OSM via Overpass API (real geometry, not fabricated)
 * INTELLIGENCE: Demo/synthetic attributes only
 */

const fs = require("fs");

const INPUT  = "C:\\Users\\USER\\TriNetra\\frontend\\public\\andheri-roads.geojson";
const OUT_INTEL = "C:\\Users\\USER\\TriNetra\\frontend\\public\\andheri-intelligence.geojson";
const OUT_OBS   = "C:\\Users\\USER\\TriNetra\\frontend\\public\\andheri-observations.geojson";

// Roads we want to assign intelligence to (must match OSM name or highway type)
const INTELLIGENCE_TARGETS = [
  { match: "Western Express Highway",       condition: "WATCH",    score: 72 },
  { match: "Swami Vivekananda Road",        condition: "HEALTHY",  score: 88 },
  { match: "S.V. Road",                     condition: "HEALTHY",  score: 85 },
  { match: "Jogeshwari",                    condition: "POOR",     score: 48 },
  { match: "JVLR",                          condition: "POOR",     score: 45 },
  { match: "Andheri-Kurla Road",            condition: "CRITICAL", score: 31 },
  { match: "Link Road",                     condition: "WATCH",    score: 65 },
  { match: "Mahakali",                      condition: "POOR",     score: 44 },
  { match: "Four Bungalows",               condition: "HEALTHY",  score: 91 },
  { match: "Versova",                       condition: "HEALTHY",  score: 82 },
  { match: "Gilbert Hill",                  condition: "WATCH",    score: 70 },
  { match: "New Link Road",                 condition: "WATCH",    score: 68 },
  { match: "Lokhandwala",                   condition: "WATCH",    score: 74 },
  { match: "Oshiwara",                      condition: "POOR",     score: 52 },
  { match: "Sahar",                         condition: "HEALTHY",  score: 80 },
  { match: "Airport",                       condition: "HEALTHY",  score: 85 },
  // highway type fallback: mark a portion of primary/secondary roads
  { hwType: "primary",    condition: "WATCH",    score: 70 },
  { hwType: "secondary",  condition: "POOR",     score: 50 },
  { hwType: "trunk",      condition: "WATCH",    score: 75 },
  { hwType: "motorway",   condition: "HEALTHY",  score: 90 },
];

const CONDITIONS = ["HEALTHY", "WATCH", "POOR", "CRITICAL"];
const COLORS = {
  HEALTHY:  "#22c55e",
  WATCH:    "#eab308",
  POOR:     "#f97316",
  CRITICAL: "#ef4444",
};

// Deterministic hash for reproducible pseudo-randomness (NOT Math.random)
function hashId(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
  return Math.abs(h);
}

function getIntelligence(feature) {
  const name = feature.properties.name || "";
  const highway = feature.properties.highway || "";
  
  // Check name-based targets first
  for (const target of INTELLIGENCE_TARGETS) {
    if (target.match && name.toLowerCase().includes(target.match.toLowerCase())) {
      return { condition: target.condition, score: target.score };
    }
  }
  
  // Check highway-type targets
  for (const target of INTELLIGENCE_TARGETS) {
    if (target.hwType && target.hwType === highway) {
      // Use hash to vary score slightly
      const h = hashId(feature.properties.osm_id);
      const variance = (h % 20) - 10;
      const score = Math.max(10, Math.min(99, target.score + variance));
      // Also vary condition based on score
      let condition = target.condition;
      if (score < 35) condition = "CRITICAL";
      else if (score < 55) condition = "POOR";
      else if (score < 75) condition = "WATCH";
      else condition = "HEALTHY";
      return { condition, score };
    }
  }
  
  return null; // Not an intelligence road
}

// Interpolate points along a LineString at regular intervals
function interpolatePoints(coords, intervalMeters) {
  const R = 6371000;
  const points = [];
  
  function dist(a, b) {
    const dLat = (b[1]-a[1]) * Math.PI/180;
    const dLon = (b[0]-a[0]) * Math.PI/180;
    const sinDLat = Math.sin(dLat/2);
    const sinDLon = Math.sin(dLon/2);
    const aa = sinDLat*sinDLat + Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*sinDLon*sinDLon;
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  }
  
  function lerp(a, b, t) {
    return [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t];
  }
  
  let accumulated = 0;
  points.push(coords[0]);
  
  for (let i = 0; i < coords.length - 1; i++) {
    const segLen = dist(coords[i], coords[i+1]);
    let pos = 0;
    while (pos + (intervalMeters - accumulated) <= segLen) {
      pos += intervalMeters - accumulated;
      const t = pos / segLen;
      points.push(lerp(coords[i], coords[i+1], t));
      accumulated = 0;
    }
    accumulated += segLen - pos;
  }
  
  points.push(coords[coords.length - 1]);
  return points;
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("Input file not found:", INPUT);
    process.exit(1);
  }
  
  const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  console.log("Input:", raw.features.length, "features");
  
  const intelFeatures = [];
  const obsFeatures = [];
  let segId = 0;
  
  for (const feature of raw.features) {
    const intel = getIntelligence(feature);
    if (!intel) continue;
    
    const id = "SEG-" + (++segId);
    const coords = feature.geometry.coordinates;
    const name = feature.properties.name || feature.properties.highway;
    const issueCount = intel.condition === "CRITICAL" ? 3 + (hashId(feature.properties.osm_id) % 5)
                     : intel.condition === "POOR" ? 1 + (hashId(feature.properties.osm_id) % 4)
                     : intel.condition === "WATCH" ? (hashId(feature.properties.osm_id) % 3)
                     : 0;
    
    intelFeatures.push({
      type: "Feature",
      id: id,
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        segment_id: id,
        osm_id: feature.properties.osm_id,
        name: name,
        highway: feature.properties.highway,
        condition: intel.condition,
        condition_score: intel.score,
        color: COLORS[intel.condition],
        issue_count: issueCount,
        observation_count: Math.max(5, Math.round(coords.length * 3)),
        last_observed: ["1 min ago","3 min ago","7 min ago","12 min ago","18 min ago"][hashId(id) % 5],
        priority: intel.condition === "CRITICAL" ? "P1" : intel.condition === "POOR" ? "P2" : intel.condition === "WATCH" ? "P3" : null,
        status: intel.condition === "CRITICAL" ? "Under Review" : intel.condition === "POOR" ? "Repair Scheduled" : "Monitored",
      },
    });
    
    // Generate observation points along this segment
    const pts = interpolatePoints(coords, 40); // every ~40m
    for (let i = 0; i < pts.length; i++) {
      obsFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: pts[i] },
        properties: {
          segment_id: id,
          condition: intel.condition,
          color: COLORS[intel.condition],
          obs_index: i,
        },
      });
    }
  }
  
  const intelGeoJSON = { type: "FeatureCollection", features: intelFeatures,
    metadata: { source: "OSM geometry + demo intelligence", region: "Andheri Mumbai", count: intelFeatures.length } };
  const obsGeoJSON = { type: "FeatureCollection", features: obsFeatures,
    metadata: { source: "Interpolated along OSM road geometry", count: obsFeatures.length } };
  
  fs.writeFileSync(OUT_INTEL, JSON.stringify(intelGeoJSON), "utf8");
  fs.writeFileSync(OUT_OBS, JSON.stringify(obsGeoJSON), "utf8");
  
  console.log("Intelligence segments:", intelFeatures.length);
  console.log("Observation points:", obsFeatures.length);
  const bk = {};
  for (const f of intelFeatures) { const c = f.properties.condition; bk[c]=(bk[c]||0)+1; }
  console.log("Condition breakdown:", JSON.stringify(bk));
}
main();
