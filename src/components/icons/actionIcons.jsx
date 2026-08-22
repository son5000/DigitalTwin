import { IconBase } from "./IconBase";

export function AddIcon(props) { return <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>; }
export function CloseIcon(props) { return <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>; }
export function CheckIcon(props) { return <IconBase {...props}><path d="m5 12 4 4L19 6" /></IconBase>; }
export function EditIcon(props) { return <IconBase {...props}><path d="m14 5 5 5M4 20l1.5-5.5L15.5 4.5a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-10 10L4 20Z" /></IconBase>; }
export function ChevronDownIcon(props) { return <IconBase {...props}><path d="m7 9.5 5 5 5-5" /></IconBase>; }
export function ChevronRightIcon(props) { return <IconBase {...props}><path d="m9.5 7 5 5-5 5" /></IconBase>; }
export function ArrowLeftIcon(props) { return <IconBase {...props}><path d="M19 12H5M10 7l-5 5 5 5" /></IconBase>; }
export function ArrowRightIcon(props) { return <IconBase {...props}><path d="M5 12h14M14 7l5 5-5 5" /></IconBase>; }
export function SearchIcon(props) { return <IconBase {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></IconBase>; }
export function GridViewIcon(props) { return <IconBase {...props}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></IconBase>; }
export function ListViewIcon(props) { return <IconBase {...props}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" /></IconBase>; }
export function StarIcon({ filled = false, ...props }) { return <IconBase {...props} fill={filled ? "currentColor" : "none"}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></IconBase>; }
export function EnterIcon(props) { return <IconBase {...props}><path d="M13 5h6v14h-6M16 12H5M9 8l-4 4 4 4" /></IconBase>; }
export function ThemeIcon(props) { return <IconBase {...props}><path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" /></IconBase>; }
export const MoonIcon = ThemeIcon;
export function SunIcon(props) { return <IconBase {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></IconBase>; }
