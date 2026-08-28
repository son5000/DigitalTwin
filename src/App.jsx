import { useEffect, useState } from "react";

import CustomBuildingEditorPage from "@/features/customAssets/building/CustomBuildingEditorPage";
import "@/features/customAssets/building/registerBuildingAssetType";
import { CustomAssetProvider } from "@/features/customAssets/components/CustomAssetProvider";
import { useCustomAssets } from "@/features/customAssets/components/customAssetContext";
import CustomWorkshopPage from "@/features/customAssets/components/CustomWorkshopPage";
import DigitalTwinEditorPage from "@/features/digitalTwin/editor/DigitalTwinEditorPage";

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const handleNavigation = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);
  return pathname;
}

function AppRoute() {
  const pathname = usePathname();
  const { revision } = useCustomAssets();
  if (pathname === "/custom" || pathname === "/custom/buildings") return <CustomWorkshopPage />;
  if (pathname === "/custom/buildings/new") return <CustomBuildingEditorPage />;
  const editMatch = pathname.match(/^\/custom\/buildings\/([^/]+)\/edit\/?$/);
  if (editMatch) return <CustomBuildingEditorPage assetId={decodeURIComponent(editMatch[1])} />;
  return <DigitalTwinEditorPage customAssetRevision={revision} />;
}

function App() {
  return <CustomAssetProvider><AppRoute /></CustomAssetProvider>;
}

export default App;
