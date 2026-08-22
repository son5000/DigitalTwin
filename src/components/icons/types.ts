import type { SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number | string;
  title?: string;
};
