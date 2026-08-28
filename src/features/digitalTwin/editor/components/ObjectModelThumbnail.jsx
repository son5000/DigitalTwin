const FAMILY_PATHS = Object.freeze({
  DESK: ["M4 15h24v3H4z", "M7 18h3v10H7zm15 0h3v10h-3z"],
  CHAIR: ["M8 14h15v4H8z", "M8 4h4v10H8z", "M10 18v10m11-10v10"],
  TABLE: ["M4 13h24v4H4z", "M7 17v11m18-11v11"],
  SOFA: ["M5 13h22v11H5z", "M3 10h5v16H3zm24 0h3v16h-3z", "M8 8h19v8H8z"],
  STORAGE: ["M7 3h18v26H7z", "M7 10h18M7 17h18M7 24h18"],
  LIGHTING: ["M16 3v8", "M10 17l3-6h6l3 6z", "M12 22h8"],
  APPLIANCE: ["M8 3h16v26H8z", "M8 12h16", "M20 7h1"],
  SANITARY: ["M8 13h16c0 7-3 12-8 12s-8-5-8-12z", "M12 25v4h8v-4"],
  PLANT: ["M16 29V13", "M16 15c-8-1-9-7-9-9 7 0 10 4 9 9", "M16 18c8-1 9-7 9-9-7 0-10 4-9 9", "M11 29h10"],
  DOOR: ["M7 3h18v26H7z", "M21 16h1"],
  WINDOW: ["M4 6h24v20H4z", "M16 6v20M4 16h24"],
  CABINET: ["M7 3h18v26H7z", "M16 3v26", "M13 16h1m4 0h1"],
  MACHINE: ["M5 21h22v6H5z", "M8 11h16v10H8z", "M12 11V7h8v4"],
  HVAC: ["M4 9h24v18H4z", "M8 13h16M8 17h16M8 21h16"],
  PIPE: ["M3 16h10c4 0 4-7 8-7h8", "M3 12v8m26-15v8"],
  DUCT: ["M3 10h18v12H3z", "M21 14h8v12h-8"],
  TANK: ["M9 5h14v22H9z", "M9 9c0-3 14-3 14 0M9 23c0 3 14 3 14 0"],
  SAFETY: ["M5 8v21m22-21v21", "M5 13h22M5 22h22"],
  SENSOR: ["M8 9h16v16H8z", "M16 17m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0"],
  UTILITY: ["M4 9h24v14H4z", "M8 9v14m5-14v14m5-14v14m5-14v14"],
});

export default function ObjectModelThumbnail({ familyId, title }) {
  const paths = FAMILY_PATHS[familyId] ?? ["M5 5h22v22H5z"];
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={`${title} 모델 미리보기`} focusable="false">
      {paths.map((path) => <path key={path} d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
