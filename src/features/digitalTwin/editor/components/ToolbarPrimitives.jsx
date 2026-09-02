import { getToolbarAction } from "./toolbarActionDefinitions";
import { applyToolbarIconFallback, getToolbarIconSources } from "./toolbarIconRegistry";
import styles from "./EditorToolbar.module.css";

const TOOLBAR_ICON_SIZES = Object.freeze({
  sm: 20,
  md: 24,
  lg: 28,
});

export function ToolbarIcon({ iconKey, size = "md" }) {
  const normalizedSize = Object.hasOwn(TOOLBAR_ICON_SIZES, size) ? size : "md";
  const sources = getToolbarIconSources(iconKey);

  return (
    <span className={`${styles.icon} ${styles[`icon${normalizedSize.toUpperCase()}`]}`} aria-hidden="true">
      <img className={styles.iconLight} src={sources.light} alt="" width={TOOLBAR_ICON_SIZES[normalizedSize]} height={TOOLBAR_ICON_SIZES[normalizedSize]} loading="eager" decoding="sync" data-icon-key={iconKey} data-theme-icon="light" onError={(event) => applyToolbarIconFallback(event, "light")} />
      <img className={styles.iconDark} src={sources.dark} alt="" width={TOOLBAR_ICON_SIZES[normalizedSize]} height={TOOLBAR_ICON_SIZES[normalizedSize]} loading="eager" decoding="sync" data-icon-key={iconKey} data-theme-icon="dark" onError={(event) => applyToolbarIconFallback(event, "dark")} />
    </span>
  );
}

export function ToolbarButton({
  actionId,
  iconKey,
  label,
  shortcut,
  badge,
  active = false,
  pressed,
  menuItem = false,
  showLabel = false,
  iconSize = "md",
  disabledReason = "",
  className = "",
  ...buttonProps
}) {
  const definition = getToolbarAction(actionId);
  const resolvedIconKey = iconKey ?? definition?.iconKey;
  const resolvedLabel = label ?? definition?.label ?? "도구";
  const resolvedShortcut = shortcut ?? definition?.shortcut;
  const tooltip = buttonProps.disabled && disabledReason
    ? disabledReason
    : resolvedShortcut ? `${resolvedLabel} · ${resolvedShortcut}` : resolvedLabel;
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ""} ${menuItem ? styles.menuItem : ""} ${showLabel ? styles.labeledButton : ""} ${className}`}
      aria-label={resolvedLabel}
      title={tooltip}
      data-tooltip={tooltip}
      aria-pressed={pressed}
      {...buttonProps}
    >
      <ToolbarIcon iconKey={resolvedIconKey} size={iconSize} />
      {badge ? <span className={styles.badge} aria-hidden="true">{badge}</span> : null}
      {menuItem || showLabel ? <span className={styles.menuLabel}>{resolvedLabel}</span> : null}
      {menuItem && resolvedShortcut ? <kbd>{resolvedShortcut}</kbd> : null}
    </button>
  );
}

export function ToolbarGroup({ label, className = "", children }) {
  return <div className={`${styles.group} ${className}`} role="group" aria-label={label}>{children}</div>;
}

export function ToolbarDivider() {
  return <span className={styles.divider} aria-hidden="true" />;
}
