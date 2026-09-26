const fs = require("fs");
const BBOX = "19.095,72.820,19.150,72.905";
const query = `[out:json][timeout:90];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street"](` + BBOX + `);
);
out body;
>;
out skel qt;
`;

const servers = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function tryServer(url) {
  console.log("Trying:", url);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "TriNetra-Demo/1.0",
    },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
  return res.json();
}

async function main() {
  let data;
  for (const srv of servers) {
    try { data = await tryServer(srv); break; }
    catch(e) { console.log("Failed:", e.message); }
  }
  if (!data) { console.error("All servers failed"); process.exit(1); }
  
  console.log("Elements:", data.elements.length);
  const nodes = new Map();
  for (const el of data.elements) {
    if (el.type === "node") nodes.set(el.id, [el.lon, el.lat]);
  }
  const features = [];
  for (const el of data.elements) {
    if (el.type !== "way") continue;
    const coords = [];
    let valid = true;
    for (const nodeId of el.nodes) {
      const pos = nodes.get(nodeId);
      if (!pos) { valid = false; break; }
      coords.push(pos);
    }
    if (!valid || coords.length < 2) continue;
    const tags = el.tags || {};
    features.push({
      type: "Feature", id: el.id,
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        osm_id: el.id,
        highway: tags.highway || "unclassified",
        name: tags.name || tags["name:en"] || null,
        oneway: tags.oneway || "no",
      },
    });
  }
  const geojson = {
    type: "FeatureCollection", features,
    metadata: { source: "OpenStreetMap via Overpass API", query_date: new Date().toISOString(), bbox: BBOX, region: "Andheri Mumbai", count: features.length },
  };
  fs.writeFileSync("C:\\Users\\USER\\TriNetra\\frontend\\public\\andheri-roads.geojson", JSON.stringify(geojson), "utf8");
  console.log("SUCCESS:", features.length, "features");
  const bk = {}; for (const f of features) { const h = f.properties.highway; bk[h]=(bk[h]||0)+1; }
  console.log("Breakdown:", JSON.stringify(bk));
}
main().catch(e => { console.error(e.message); process.exit(1); });
