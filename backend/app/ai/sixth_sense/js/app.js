/**
 * The Sixth Sense — Command Center (Phase F)
 * Consumes ONLY outputs/sih_demo/ artifacts via /data/ proxy.
 * No fake data. No invented metrics.
 */

const DATA = {
  geojson: "/data/08_demo_summary/issue_map.geojson",
  queue: "/data/08_demo_summary/action_queue.json",
  summary: "/data/08_demo_summary/demo_summary.json",
  workItems: "/data/05_work_items/work_items.json",
  evidenceChains: "/data/05_work_items/evidence_chain.json",
  lifecycle: "/data/06_verification/lifecycle_evidence.json",
  verification: "/data/06_verification/verification_events.json",
  issuesAfter: "/data/03_persistent_issues/issues_after_verification.json",
  corroboration: "/data/04_corroboration/corroboration_summary.json",
  trafficSummary: "/traffic-data/traffic_summary.json",
  trafficWindows: "/traffic-data/traffic_observations.json",
  trafficPatterns: "/traffic-data/traffic_patterns.json",
};

let state = {
  geojson: null,
  queue: null,
  summary: null,
  workItems: {},
  evidenceByIssue: {},
  lifecycleByIssue: {},
  verificationByIssue: {},
  issuesAfter: {},
  roadLabels: {},
  selectedIssueId: null,
  trafficSummary: null,
  trafficWindows: [],
  trafficPatterns: [],
};

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

function buildRoadLabels(queue) {
  const labels = {};
  (queue.queue || []).forEach((item, i) => {
    if (item.event_type === "ROAD_CRACK") {
      labels[item.issue_id] = `P${String(i + 1).padStart(3, "0")}`;
    }
  });
  return labels;
}

function issueCode(issueId) {
  return state.roadLabels[issueId] || issueId.replace("issue_", "").slice(0, 6).toUpperCase();
}

function classLabel(className, eventType) {
  if (className === "D00") return "D00 · Longitudinal crack";
  return `${className || eventType}`;
}

function closureBadge(status) {
  const s = (status || "OPEN").toUpperCase();
  if (s === "REOPENED") return `<span class="badge badge-reopened">REOPENED</span>`;
  if (s === "RESOLVED") return `<span class="badge badge-verified">VERIFIED</span>`;
  return `<span class="badge badge-open">OPEN</span>`;
}

function priorityBadge(band) {
  const b = (band || "").toUpperCase();
  if (b === "HIGH" || b === "CRITICAL") return `<span class="badge badge-high">${b}</span>`;
  return `<span class="badge">${b || "—"}</span>`;
}

function computeStats(geojson, summary) {
  let high = 0, verified = 0, reopened = 0;
  for (const f of geojson.features) {
    const p = f.properties;
    if (p.priority_band === "HIGH") high++;
    const c = (p.closure_status || "OPEN").toUpperCase();
    if (c === "RESOLVED") verified++;
    if (c === "REOPENED") reopened++;
  }
  const openTasks = summary?.counts?.work_items ?? geojson.features.filter(
    (f) => (f.properties.closure_status || "OPEN").toUpperCase() === "OPEN"
  ).length;
  return { high, open: openTasks, verified, reopened };
}

function trafficValue(counts, klass) {
  return counts?.[klass] ?? 0;
}

function renderTraffic() {
  const target = document.getElementById("traffic-content");
  const summary = state.trafficSummary;
  if (!summary) {
    target.textContent = "Traffic artifacts unavailable. Run: python run_traffic_demo.py";
    return;
  }
  const counts = summary.class_counts || {};
  const windows = state.trafficWindows;
  const bottlenecks = summary.persistent_bottlenecks ?? 0;
  const windowCards = windows.map((window) => `
    <div class="traffic-window-card">
      <span>WINDOW ${window.traffic_window_id}</span>
      <strong>${window.unique_vehicle_count} observation-level vehicle proxies</strong>
      <div>Relative traffic intensity: <b>${window.density_level}</b></div>
      <div>Congestion: <b>${window.congestion_state}</b></div>
    </div>`).join("");
  target.innerHTML = `
    <div class="traffic-summary-grid">
      <div class="traffic-metric"><span>VEHICLE PROXIES</span><strong>${summary.vehicles_observed}</strong></div>
      <div class="traffic-metric"><span>CARS</span><strong>${trafficValue(counts, "car")}</strong></div>
      <div class="traffic-metric"><span>TRUCKS</span><strong>${trafficValue(counts, "truck")}</strong></div>
      <div class="traffic-metric"><span>BUSES</span><strong>${trafficValue(counts, "bus")}</strong></div>
      <div class="traffic-metric"><span>PEAK INTENSITY</span><strong>${summary.peak_density}</strong></div>
      <div class="traffic-metric"><span>PEAK FLOW</span><strong>${summary.peak_congestion}</strong></div>
      <div class="traffic-metric bottleneck"><span>PERSISTENT BOTTLENECKS</span><strong>${bottlenecks}</strong><em>Requires repeated congestion windows</em></div>
    </div>
    <div class="traffic-window-list">${windowCards}</div>`;
}

function initMap(geojson) {
  const target = document.getElementById("map");
  const features = geojson.features || [];
  if (!features.length) {
    target.innerHTML = '<div class="map-fallback">No GIS issue points available.</div>';
    return;
  }
  const coordinates = features.map((f) => f.geometry.coordinates);
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const lonRange = maxLon - minLon || 0.001;
  const latRange = maxLat - minLat || 0.001;
  const points = features.map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const p = feature.properties;
    const x = 8 + ((lon - minLon) / lonRange) * 84;
    const y = 90 - ((lat - minLat) / latRange) * 76;
    const code = issueCode(p.issue_id);
    return `<button class="gis-point ${p.event_type === "ROAD_CRACK" ? "road-point" : ""}"
      style="left:${x}%;top:${y}%;--point:${p.marker_color || "#1E88E5"}"
      data-issue-id="${p.issue_id}" aria-label="${code} ${p.event_type}">
      <i></i><span>${p.event_type === "ROAD_CRACK" ? code : ""}</span>
    </button>`;
  }).join("");
  target.innerHTML = `<div class="gis-map" role="img" aria-label="GIS issue map from real artifact coordinates">
    <div class="gis-grid"></div><div class="gis-title">GIS ISSUE MAP <small>Artifact coordinates · no external basemap</small></div>${points}
  </div>`;
  target.querySelectorAll("[data-issue-id]").forEach((point) => {
    point.addEventListener("click", () => selectIssue(point.dataset.issueId));
  });
}

function renderQueue() {
  const ul = document.getElementById("action-queue");
  ul.innerHTML = "";
  (state.queue.queue || []).forEach((item) => {
    const li = document.createElement("li");
    li.className = "queue-item" + (state.selectedIssueId === item.issue_id ? " active" : "");
    li.innerHTML = `
      <div class="queue-rank">#${item.rank} · ${issueCode(item.issue_id)}</div>
      <div class="queue-title">${item.event_type} · ${item.class_name || ""}</div>
      <div class="queue-meta">
        ${priorityBadge(item.priority_band)} Score ${item.priority_score}<br/>
        ${item.department}
      </div>
    `;
    li.onclick = () => selectIssue(item.issue_id);
    ul.appendChild(li);
  });
}

function buildLifecycleSteps(issueId, lifecycleChain) {
  const steps = [
    { key: "detected", label: "DETECTED", done: true },
    { key: "corroborated", label: "CORROBORATED", done: false },
    { key: "prioritized", label: "PRIORITIZED", done: false },
    { key: "routed", label: "ROUTED", done: false },
    { key: "repair", label: "REPAIR CLAIMED", done: false },
    { key: "reobs", label: "RE-OBSERVED", done: false },
    { key: "verify", label: "VERIFICATION", done: false },
  ];

  const ev = state.evidenceByIssue[issueId];
  const lc = lifecycleChain;
  const ver = state.verificationByIssue[issueId];
  const issue = state.issuesAfter[issueId];

  if (ev && ev.bus_count >= 2) steps.find((s) => s.key === "corroborated").done = true;
  if (ev && ev.priority_decision) steps.find((s) => s.key === "prioritized").done = true;
  if (ev && ev.routing_decision) steps.find((s) => s.key === "routed").done = true;
  if (lc && lc.repair_claim) steps.find((s) => s.key === "repair").done = true;
  if (lc && lc.follow_up_pass) steps.find((s) => s.key === "reobs").done = true;

  const verifyStep = steps.find((s) => s.key === "verify");
  if (ver) {
    verifyStep.done = true;
    if (ver.verification_result === "REOPENED") {
      verifyStep.warn = true;
      verifyStep.label = "VERIFICATION DISCREPANCY";
    } else if (ver.verification_result === "VERIFIED_REPAIRED") {
      verifyStep.label = "VERIFIED REPAIRED";
    } else {
      verifyStep.label = ver.verification_result;
    }
  }

  if (issue && issue.status === "REOPENED") {
    steps.push({ key: "reopened", label: "REOPENED", fail: true, done: true });
  }

  return steps.map((s) => {
    let cls = "lifecycle-step";
    if (s.fail) cls += " fail";
    else if (s.warn) cls += " warn";
    else if (s.done) cls += " done";
    const icon = s.fail ? "⚠" : s.done ? "✓" : "○";
    return `<div class="${cls}">${icon} ${s.label}</div>`;
  }).join("");
}

function renderEvidenceCards(ev, lc, max = 4) {
  const observations = ev?.observations || lc?.observations || [];
  if (!observations.length) {
    return `<p class="panel-hint">No observation records in evidence chain.</p>`;
  }
  const byBus = {};
  observations.forEach((o) => {
    if (!byBus[o.bus_id]) byBus[o.bus_id] = o;
  });
  const cards = Object.values(byBus).slice(0, max).map((o) => `
    <div class="evidence-card">
      <div class="evidence-placeholder">${o.evidence_ref ? `<img src="/data/${o.evidence_ref.replace(/^outputs[/\\]sih_demo[/\\]/, "")}" alt="Frame evidence" />` : `<span>${o.class_name}<br/>conf ${o.confidence.toFixed(2)}</span>`}</div>
      <strong>${o.bus_id}</strong>
      ${o.class_name} · conf ${o.confidence.toFixed(2)}<br/>
      GPS ${o.gps?.status || "—"} · ${o.detection_count} frames
    </div>
  `).join("");

  const busCount = ev?.bus_count ?? lc?.bus_count ?? Object.keys(byBus).length;
  const obsCount = ev?.observation_count ?? lc?.observation_count ?? observations.length;
  const issueId = ev?.issue_id || lc?.issue_id;
  const funnel = busCount >= 2 ? `
    <div class="corroboration-funnel">
      <div class="funnel-arrow">↓</div>
      <div class="funnel-merge">SAME PHYSICAL ISSUE</div>
      <div class="funnel-arrow">↓</div>
      <div class="funnel-result">${issueCode(issueId)} · ${busCount} buses · ${obsCount} observations</div>
    </div>` : "";

  return `<div class="evidence-grid">${cards}</div>${funnel}`;
}

function busIdList(issueId, ev, lc, issue) {
  const ids = ev?.bus_ids || lc?.bus_ids || issue?.bus_ids;
  if (ids?.length) return ids.join("<br/>");
  return `${issue?.bus_count ?? ev?.bus_count ?? lc?.bus_count ?? 0} buses`;
}

function renderVerificationFlow(lifecycle) {
  if (!lifecycle || !lifecycle.verification_decision) return "";
  const vd = lifecycle.verification_decision;
  const rc = lifecycle.repair_claim;
  const fu = lifecycle.follow_up_pass;
  const isReopen = vd.verification_result === "REOPENED";

  return `
    <div class="flow-diagram">
      REPAIR CLAIM (${rc?.claimed_by || "—"})<br/>
      ↓<br/>
      ${fu?.bus_id || "NEXT BUS"} follow-up pass<br/>
      ↓<br/>
      ${isReopen
        ? '<span class="highlight">D00 detected again</span><br/>↓<br/><span class="highlight">VERIFICATION DISCREPANCY</span><br/>↓<br/><span class="highlight">REOPENED (same issue ID)</span>'
        : "No corresponding defect detected<br/>↓<br/>VERIFIED REPAIRED (qualified)"}
    </div>
  `;
}

function selectIssue(issueId) {
  state.selectedIssueId = issueId;
  renderQueue();

  const feature = state.geoFeature(issueId);
  const wi = state.workItems[issueId];
  const ev = state.evidenceByIssue[issueId];
  const lc = state.lifecycleByIssue[issueId];
  const issue = state.issuesAfter[issueId] || {};
  const p = feature?.properties || {};

  const panel = document.getElementById("detail-panel");
  panel.innerHTML = `
    <div class="issue-header">
      <div class="issue-code">${issueCode(issueId)} — ${p.event_type || issue.event_type || "ISSUE"}</div>
      <div class="issue-type">${classLabel(p.class_name || issue.class_name, p.event_type)}</div>
      ${p.class_name === "D00" ? '<div class="class-note">D00 is a longitudinal crack — not automatically a pothole</div>' : ""}
    </div>

    <div class="priority-block">
      ${priorityBadge(p.priority_band || wi?.priority_band)}
      <div class="priority-score">${(p.priority_score ?? wi?.priority_score ?? 0).toFixed(1)} / 100</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span>LOCATION</span>${p.closure_status ? "" : ""}${(p.closure_status && feature) ? `${feature.geometry.coordinates[1].toFixed(5)}, ${feature.geometry.coordinates[0].toFixed(5)}` : "—"}</div>
      <div class="meta-item"><span>GPS</span>${p.gps_status || "—"} ±${p.uncertainty_m || "?"}m</div>
      <div class="meta-item"><span>OBSERVED</span>${p.observation_count ?? issue.observation_count ?? "—"} times</div>
      <div class="meta-item"><span>BUSES</span>${busIdList(issueId, ev, lc, issue)}</div>
      <div class="meta-item"><span>DEPARTMENT</span>${p.department || wi?.department_display || "—"}</div>
      <div class="meta-item"><span>STATUS</span>${closureBadge(p.closure_status || issue.status)}</div>
    </div>

    <div class="meta-item" style="margin-bottom:0.5rem"><span>ISSUE ID (City Memory)</span><code style="font-size:0.7rem">${issueId}</code></div>

    <div class="lifecycle">
      <h3>LIFECYCLE</h3>
      ${buildLifecycleSteps(issueId, lc)}
    </div>

    <div class="evidence-section">
      <h3>CORROBORATION EVIDENCE</h3>
      ${renderEvidenceCards(ev, lc)}
    </div>

    ${lc ? `
    <div class="evidence-section">
      <h3>PROOF-OF-CLOSURE</h3>
      ${renderVerificationFlow(lc)}
      ${lc.verification_observation ? `<div class="evidence-card" style="margin-top:0.5rem">
        <strong>Follow-up: ${lc.verification_observation.bus_id}</strong>
        conf ${lc.verification_observation.confidence} · ${lc.verification_observation.obs_id}
      </div>` : ""}
    </div>` : ""}
  `;

}

state.geoFeature = function (issueId) {
  return (state.geojson.features || []).find((f) => f.properties.issue_id === issueId);
};

async function init() {
  const results = await Promise.allSettled([
    loadJson(DATA.geojson), loadJson(DATA.queue), loadJson(DATA.summary),
    loadJson(DATA.workItems), loadJson(DATA.evidenceChains), loadJson(DATA.lifecycle),
    loadJson(DATA.verification), loadJson(DATA.issuesAfter), loadJson(DATA.trafficSummary),
    loadJson(DATA.trafficWindows), loadJson(DATA.trafficPatterns),
  ]);
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) document.getElementById("provenance-banner").textContent = `${failed} artifact source(s) unavailable — showing available local evidence.`;
  const value = (index, fallback) => results[index].status === "fulfilled" ? results[index].value : fallback;
  try {
    const geojson = value(0, {features: []});
    const queue = value(1, {queue: []});
    const summary = value(2, {counts: {}, data_provenance: {}});
    const workItemsRaw = value(3, {work_items: []});
    const evidenceRaw = value(4, {chains: []});
    const lifecycleRaw = value(5, {chains: []});
    const verificationRaw = value(6, {events: []});
    const issuesAfterRaw = value(7, {issues: []});
    const trafficSummary = value(8, null);
    const trafficWindowsRaw = value(9, {windows: []});
    const trafficPatternsRaw = value(10, {patterns: []});

    state.geojson = geojson;
    state.queue = queue;
    state.summary = summary;
    state.trafficSummary = trafficSummary;
    state.trafficWindows = trafficWindowsRaw.windows || [];
    state.trafficPatterns = trafficPatternsRaw.patterns || [];

    (workItemsRaw.work_items || []).forEach((w) => { state.workItems[w.issue_id] = w; });
    (evidenceRaw.chains || []).forEach((c) => { state.evidenceByIssue[c.issue_id] = c; });
    (lifecycleRaw.chains || []).forEach((c) => { state.lifecycleByIssue[c.issue_id] = c; });
    (verificationRaw.events || []).forEach((e) => { state.verificationByIssue[e.issue_id] = e; });
    (issuesAfterRaw.issues || []).forEach((i) => { state.issuesAfter[i.issue_id] = i; });

    state.roadLabels = buildRoadLabels(queue);

    const stats = computeStats(geojson, summary);
    document.getElementById("stat-high").textContent = stats.high;
    document.getElementById("stat-open").textContent = stats.open;
    document.getElementById("stat-verified").textContent = stats.verified;
    document.getElementById("stat-reopened").textContent = stats.reopened;

    if (!failed) document.getElementById("provenance-banner").textContent =
      summary.data_provenance?.detections_and_observations || "Local pipeline artifacts";

    document.getElementById("footer-mode").textContent = `Mode: ${summary.execution_mode || "—"}`;
    document.getElementById("footer-generated").textContent = `Generated: ${summary.generated_at || "—"}`;

    initMap(geojson);
    renderQueue();
    renderTraffic();

    const defaultRoad = queue.queue?.find((q) => q.event_type === "ROAD_CRACK" && q.issue_id === "issue_a26809d544")
      || queue.queue?.find((q) => q.event_type === "ROAD_CRACK");
    if (defaultRoad) selectIssue(defaultRoad.issue_id);

  } catch (err) {
    document.getElementById("provenance-banner").textContent =
      `Dashboard initialization error: ${err.message}. Local evidence remains available after refresh.`;
    console.error(err);
  }
}

let liveRunPoll = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function renderLiveRun(run) {
  const status = document.getElementById("live-run-status");
  const results = document.getElementById("live-run-results");
  const button = document.getElementById("live-run-button");
  const isRunning = run.status === "queued" || run.status === "running";
  status.className = `live-run-status ${run.status || "idle"}`;
  status.textContent = run.message || "Choose a road-facing video to begin.";
  button.disabled = isRunning || !document.getElementById("live-video-input").files.length;

  if (isRunning) {
    if (!liveRunPoll) liveRunPoll = window.setInterval(refreshLiveRunStatus, 2000);
    return;
  }
  if (liveRunPoll) {
    window.clearInterval(liveRunPoll);
    liveRunPoll = null;
  }
  if (run.status !== "complete" || !run.report) {
    results.hidden = true;
    return;
  }

  const report = run.report;
  const detections = report.detections || {};
  const config = report.configuration || {};
  const frameProcessing = report.frame_processing || {};
  const roadModel = (config.models || []).some((model) => /RDD|road/i.test(model));
  results.hidden = false;
  results.innerHTML = `
    <div class="live-result-header"><span>LIVE RESULT</span><strong>${escapeHtml(run.filename)}</strong></div>
    <div class="live-result-grid">
      <div><span>TOTAL DETECTIONS</span><strong>${detections.total ?? 0}</strong></div>
      <div><span>VEHICLE DETECTIONS</span><strong>${detections.vehicle ?? 0}</strong></div>
      <div><span>ROAD-DAMAGE DETECTIONS</span><strong>${detections.road_damage ?? 0}</strong></div>
      <div><span>CONFIRMED OBSERVATIONS</span><strong>${run.observation_count ?? 0}</strong></div>
      <div><span>PERSISTENT ISSUES</span><strong>${run.issue_count ?? 0}</strong></div>
      <div><span>FRAMES ANALYSED</span><strong>${frameProcessing.frames_processed ?? 0}</strong></div>
    </div>
    <p class="live-result-method">Device: ${escapeHtml(config.device || "unknown")} · Profile: ${escapeHtml(config.profile || "unknown")} · RDD2022 loaded: ${roadModel ? "yes" : "no"}</p>
    ${run.annotated_video ? `<video class="live-result-video" controls preload="metadata" src="${encodeURI(run.annotated_video)}"></video>` : ""}
    <div class="live-result-links">
      ${run.report_url ? `<a href="${encodeURI(run.report_url)}" target="_blank" rel="noopener">Metrics JSON</a>` : ""}
      ${run.observations_url ? `<a href="${encodeURI(run.observations_url)}" target="_blank" rel="noopener">Observations JSON</a>` : ""}
      ${run.issues_url ? `<a href="${encodeURI(run.issues_url)}" target="_blank" rel="noopener">Issues JSON</a>` : ""}
    </div>`;
}

async function refreshLiveRunStatus() {
  try {
    const response = await fetch("/api/live-run/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`status ${response.status}`);
    renderLiveRun(await response.json());
  } catch (error) {
    document.getElementById("live-run-status").textContent = `Live-test status unavailable: ${error.message}`;
  }
}

function initLiveTest() {
  const input = document.getElementById("live-video-input");
  const button = document.getElementById("live-run-button");
  const name = document.getElementById("live-video-name");
  input.addEventListener("change", () => {
    const file = input.files[0];
    name.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "No video selected";
    button.disabled = !file;
  });
  button.addEventListener("click", async () => {
    const file = input.files[0];
    if (!file) return;
    button.disabled = true;
    document.getElementById("live-run-results").hidden = true;
    document.getElementById("live-run-status").textContent = `Uploading ${file.name} locally…`;
    try {
      const response = await fetch("/api/live-run", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-Upload-Filename": encodeURIComponent(file.name) },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `upload ${response.status}`);
      renderLiveRun(result);
    } catch (error) {
      renderLiveRun({ status: "failed", message: `Live test could not start: ${error.message}` });
    }
  });
  refreshLiveRunStatus();
}

init();
initLiveTest();
