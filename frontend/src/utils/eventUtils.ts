/**
 * UrbanEye AI — Event Display Utilities & Mapping
 */

export const EVENT_TYPE_LABELS: Record<string, string> = {
  POTHOLE: "Pothole",
  ROAD_DAMAGE: "Road Damage",
  WATERLOGGING: "Waterlogging",
  ROAD_OBSTACLE: "Road Obstacle",
  DEBRIS: "Debris on Road",
  POTHOLE_CLUSTER: "Pothole Cluster",
  TRAFFIC_SIGN: "Traffic Sign",
  ZEBRA_CROSSING: "Zebra Crossing",
  ROAD_MARKING: "Road Marking",
  DIVIDER: "Road Divider",
  PEDESTRIAN_RISK: "Pedestrian Risk",
  JAYWALKING: "Jaywalking / Lane Intrusion",
  UNSAFE_CROSSING: "Unsafe Crossing",
  NEAR_MISS: "Near-Miss Hazard",
  RASH_DRIVING: "Potential Rash Driving",
  SUDDEN_BRAKING: "Sudden Braking",
  WRONG_WAY: "Wrong-Way Vehicle",
  SPEEDING: "Speeding Outlier",
  ABNORMAL_STOP: "Abnormal Road Stop",
  ACCIDENT: "Traffic Accident",
  CONGESTION_INCIDENT: "Severe Congestion",
  QUEUE_BUILDUP: "Queue Buildup",
  UNKNOWN: "Unknown Event",
};

export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  HAZARD: "Road Hazard",
  INFRASTRUCTURE: "Infrastructure",
  SAFETY: "Pedestrian Safety",
  BEHAVIOR: "Vehicle Behavior",
  INCIDENT: "Traffic Incident",
};

export function getEventTypeLabel(type?: string | null): string {
  if (!type) return "Unknown Event";
  return EVENT_TYPE_LABELS[type.toUpperCase()] || type.replace(/_/g, " ");
}

export function getEventCategoryLabel(category?: string | null): string {
  if (!category) return "Incident";
  return EVENT_CATEGORY_LABELS[category.toUpperCase()] || category;
}

export function getSeverityClasses(severity?: string | null): {
  badge: string;
  dot: string;
  border: string;
} {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return {
        badge: "bg-red-950/70 text-red-400 border border-red-800/80",
        dot: "bg-red-500 animate-pulse",
        border: "border-l-red-500",
      };
    case "HIGH":
      return {
        badge: "bg-orange-950/70 text-orange-400 border border-orange-800/80",
        dot: "bg-orange-500",
        border: "border-l-orange-500",
      };
    case "MEDIUM":
      return {
        badge: "bg-amber-950/70 text-amber-400 border border-amber-800/80",
        dot: "bg-amber-500",
        border: "border-l-amber-500",
      };
    case "LOW":
    default:
      return {
        badge: "bg-emerald-950/70 text-emerald-400 border border-emerald-800/80",
        dot: "bg-emerald-500",
        border: "border-l-emerald-500",
      };
  }
}

export function getCategoryClasses(category?: string | null): string {
  switch (category?.toUpperCase()) {
    case "HAZARD":
      return "bg-amber-950/50 text-amber-300 border-amber-800/60";
    case "INFRASTRUCTURE":
      return "bg-blue-950/50 text-blue-300 border-blue-800/60";
    case "SAFETY":
      return "bg-purple-950/50 text-purple-300 border-purple-800/60";
    case "BEHAVIOR":
      return "bg-rose-950/50 text-rose-300 border-rose-800/60";
    case "INCIDENT":
    default:
      return "bg-cyan-950/50 text-cyan-300 border-cyan-800/60";
  }
}
