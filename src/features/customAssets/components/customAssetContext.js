import { createContext, useContext } from "react";

export const CustomAssetContext = createContext(null);

export function useCustomAssets() {
  const value = useContext(CustomAssetContext);
  if (!value) throw new Error("useCustomAssets는 CustomAssetProvider 안에서 사용해야 합니다.");
  return value;
}

