import ViewerOperationsPage from "./ViewerOperationsPage";
import { mergeOperationsAssets } from "./operationsModel.js";

export default function ViewerServicePanel({ active, initialRecord = null, onNavigate, onClose, operations, directory, onLocate, projectName, operatorName = "운영자", theme, onThemeChange, onReset, movementEnabled, onMovementToggle, viewMode, onViewModeChange }) {
  if (!active) return null;
  const assets = mergeOperationsAssets(directory.assets, operations.data.assets);
  const settings = { theme, onThemeChange, onReset, movementEnabled, onMovementToggle, viewMode, onViewModeChange };
  return <ViewerOperationsPage key={active} active={active} initialRecord={initialRecord} onNavigate={onNavigate} onClose={onClose}
    operations={operations} assets={assets} locations={directory.locations} projectName={projectName} operatorName={operatorName}
    settings={settings} onLocate={onLocate ? (key) => { onLocate(key); onClose(); } : undefined} />;
}
