import { useContext } from "react";
import { createPortal } from "react-dom";
import { ViewerOverlayContext } from "./viewerOverlayContext";

export default function ViewerOverlaySlot({ name, children }) {
  const hosts = useContext(ViewerOverlayContext);
  if (!hosts) return children;
  return hosts[name] ? createPortal(children, hosts[name]) : null;
}
