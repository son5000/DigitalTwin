import { IconBase } from "./IconBase";

export function WorldIcon(props) {
  return <IconBase {...props}><circle cx="12" cy="12" r="8.5" /><path d="M3.8 9h16.4M3.8 15h16.4M12 3.5c2.2 2.3 3.4 5.1 3.4 8.5S14.2 18.2 12 20.5M12 3.5C9.8 5.8 8.6 8.6 8.6 12s1.2 6.2 3.4 8.5" /></IconBase>;
}

export function SiteIcon(props) {
  return <IconBase {...props}><path d="M4 18.5 12 21l8-2.5V6L12 3 4 6v12.5Z" /><path d="m4 6 8 2.5L20 6M12 8.5V21M7 13l2-1 2 1-2 1-2-1Zm6 3 2-1 2 1-2 1-2-1Z" /></IconBase>;
}

export function BuildingIcon(props) {
  return <IconBase {...props}><path d="M4 21V6.5L14 3v18M14 9h6v12M2.5 21h19" /><path d="M7.5 8h2M7.5 12h2M7.5 16h2M17 12h1M17 16h1" /></IconBase>;
}

export function FloorIcon(props) {
  return <IconBase {...props}><path d="m4 7 8-3 8 3-8 3-8-3Z" /><path d="m4 12 8 3 8-3M4 17l8 3 8-3" /></IconBase>;
}

export function SpaceIcon(props) {
  return <IconBase {...props}><path d="M4 4h16v16H4zM9 4v6h11M9 10v10" /><path d="M12 15h5" /></IconBase>;
}

export function EquipmentIcon(props) {
  return <IconBase {...props}><path d="M5 7h14v10H5zM8 4v3M16 4v3M8 17v3M16 17v3" /><circle cx="9" cy="12" r="1.5" /><path d="M13 10h3M13 13h3" /></IconBase>;
}

export function ComponentIcon(props) {
  return <IconBase {...props}><path d="m12 3 7.5 4.3v8.7L12 21l-7.5-5V7.3L12 3Z" /><path d="m4.5 7.3 7.5 4.4 7.5-4.4M12 11.7V21" /></IconBase>;
}
