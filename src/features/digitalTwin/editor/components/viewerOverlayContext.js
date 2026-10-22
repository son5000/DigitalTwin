import { createContext } from "react";

// The saved viewer owns its chrome; embedded editor scenes keep local controls.
export const ViewerOverlayContext = createContext(null);
