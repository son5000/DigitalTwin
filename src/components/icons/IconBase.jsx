/** @typedef {import("./types").IconProps} IconProps */

export const ICON_VIEW_BOX = "0 0 24 24";
export const ICON_STROKE_WIDTH = 1.75;

/** @param {IconProps & import("react").SVGProps<SVGSVGElement>} props */
export function IconBase({ size = 20, className, title, children, ...props }) {
  return (
    <svg
      viewBox={ICON_VIEW_BOX}
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
