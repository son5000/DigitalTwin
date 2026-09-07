import { useState } from "react";

const FALLBACK_SOURCE = "/assets/object-thumbnails/_fallback.png";

const CATEGORY_THUMBNAIL_SOURCES = Object.freeze({
  BUILDING: "/assets/object-thumbnails/BUILDING.png",
  INDUSTRIAL_BUILDING: "/assets/object-thumbnails/FACTORY_GENERAL.png",
  VEHICLE: "/assets/object-thumbnails/CAR.png",
  TRAFFIC_FACILITY: "/assets/object-thumbnails/TRAFFIC_LIGHT.png",
  ROAD_FACILITY: "/assets/object-thumbnails/ROAD.png",
  ENVIRONMENT: "/assets/object-thumbnails/GRASS.png",
  LANDSCAPING: "/assets/object-thumbnails/STREET_TREE.png",
  EQUIPMENT: "/assets/object-thumbnails/SITE_PUMP.png",
  LOGISTICS: "/assets/object-thumbnails/FORKLIFT.png",
  PARKING_FACILITY: "/assets/object-thumbnails/PARKING.png",
  ELECTRICAL: "/assets/object-thumbnails/SITE_TRANSFORMER.png",
  HVAC: "/assets/object-thumbnails/OUT_COOLING_TOWER_PACKAGE.png",
  PIPE_WATER: "/assets/object-thumbnails/OUT_TANK_VERTICAL_WELDED.png",
  FIRE_SAFETY: "/assets/object-thumbnails/FIRE_HYDRANT.png",
  COMM_SECURITY: "/assets/object-thumbnails/OUT_CCTV_PTZ.png",
  ENERGY_ENVIRONMENT: "/assets/object-thumbnails/OUT_SOLAR_FIXED.png",
  GENERAL: "/assets/object-thumbnails/SITE_PUMP.png",
  SPACE: "/assets/object-thumbnails/FLOOR_REGION.png",
  STRUCTURE: "/assets/object-thumbnails/WALL.png",
  FLOOR: "/assets/object-thumbnails/EXTERIOR_FLOOR.png",
  OPENING: "/assets/object-thumbnails/DOOR.png",
  BOUNDARY: "/assets/object-thumbnails/GUARDRAIL.png",
  VERTICAL: "/assets/object-thumbnails/STAIR.png",
  FURNITURE: "/assets/object-thumbnails/DESK.png",
  CUSTOM: "/assets/object-thumbnails/CUSTOM_STRUCTURE.png",
});

export default function CatalogCategoryThumbnail({ categoryId }) {
  const requestedSource = CATEGORY_THUMBNAIL_SOURCES[categoryId] ?? FALLBACK_SOURCE;
  const [failedSource, setFailedSource] = useState(null);
  const source = failedSource === requestedSource ? FALLBACK_SOURCE : requestedSource;

  return (
    <img
      src={source}
      alt=""
      draggable="false"
      onError={() => source !== FALLBACK_SOURCE && setFailedSource(requestedSource)}
    />
  );
}
