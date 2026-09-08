import { useEffect, useState } from "react";

import CustomBuildingEditorPage from "@/features/customAssets/building/CustomBuildingEditorPage";
import "@/features/customAssets/building/registerBuildingAssetType";
import CustomEquipmentEditorPage from "@/features/customAssets/equipment/CustomEquipmentEditorPage";
import "@/features/customAssets/equipment/registerEquipmentAssetType";
import { CustomAssetProvider } from "@/features/customAssets/components/CustomAssetProvider";
import { useCustomAssets } from "@/features/customAssets/components/customAssetContext";
import CustomWorkshopPage from "@/features/customAssets/components/CustomWorkshopPage";
import DigitalTwinEditorPage from "@/features/digitalTwin/editor/DigitalTwinEditorPage";
import LandingPage from "@/features/portal/landing/LandingPage";
import ObservationPage from "@/features/portal/viewer/ObservationPage";
import ProjectsPage from "@/features/portal/projects/ProjectsPage";
import ProjectViewerPage from "@/features/portal/projects/ProjectViewerPage";

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const handleNavigation = () => setPathname(window.location.pathname + window.location.search);
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);
  return pathname;
}

function AppRoute() {
  const location = usePathname();
  const [pathname, search = ""] = location.split("?");
  const { revision } = useCustomAssets();
  if (pathname === "/") return <LandingPage />;
  if (pathname === "/projects" || pathname === "/projects/") return <ProjectsPage />;
  if (pathname === "/viewer" || pathname === "/viewer/") {
    const projectId = new URLSearchParams(search).get("project");
    return projectId ? <ProjectViewerPage key={projectId} projectId={projectId} /> : <ObservationPage />;
  }
  if (pathname === "/custom" || pathname === "/custom/" || pathname === "/custom/buildings" || pathname === "/custom/buildings/" || pathname === "/custom/equipment" || pathname === "/custom/equipment/") return <CustomWorkshopPage />;
  if (pathname === "/custom/buildings/new") return <CustomBuildingEditorPage />;
  const editMatch = pathname.match(/^\/custom\/buildings\/([^/]+)\/edit\/?$/);
  if (editMatch) return <CustomBuildingEditorPage assetId={decodeURIComponent(editMatch[1])} />;
  if (pathname === "/custom/equipment/new") return <CustomEquipmentEditorPage />;
  const equipmentEditMatch = pathname.match(/^\/custom\/equipment\/([^/]+)\/edit\/?$/);
  if (equipmentEditMatch) return <CustomEquipmentEditorPage assetId={decodeURIComponent(equipmentEditMatch[1])} />;
  if (pathname === "/editor" || pathname === "/editor/") return <DigitalTwinEditorPage customAssetRevision={revision} />;
  return <DigitalTwinEditorPage customAssetRevision={revision} />;
}

function App() {
  return <CustomAssetProvider><AppRoute /></CustomAssetProvider>;
}

export default App;
