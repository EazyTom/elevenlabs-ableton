/**
 * Extension UI theme tokens.
 *
 * All modal colors flow from here → `buildThemeStylesheet()` in ui-branding.ts.
 * To retheme the extension, edit ACTIVE_UI_THEME or add a new preset below.
 *
 * Modals use CSS variables `--c-*` (see ui/modal-base.css). Do not hardcode colors in HTML.
 */

/** Live Extension Host UI font (Ableton Sans Small Bold). */
export const UI_FONT_FAMILY = '"Ableton Sans Small Bold", "AbletonSansSmallBold", sans-serif';

export interface ExtensionUiTheme {
  readonly id: string;
  readonly label: string;
  /** Page / modal background */
  readonly bg: string;
  readonly surface: string;
  readonly inputBg: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly border: string;
  readonly buttonBg: string;
  /** Primary accent (cyan) — primary actions, focus, controls */
  readonly accent: string;
  /** Secondary accent (Ableton orange) — subtitles, highlights */
  readonly accentSecondary: string;
  /** Text on filled accent buttons */
  readonly accentOn: string;
  readonly focus: string;
  readonly error: string;
  readonly scrollbarThumb: string;
}

/** Cyan + Ableton orange on neutral grey (default). */
export const CYAN_LIME_THEME: ExtensionUiTheme = {
  id: "cyan-lime",
  label: "Cyan & orange",
  bg: "#31343e",
  surface: "hsl(196, 18%, 15%)",
  inputBg: "hsl(196, 20%, 8%)",
  text: "hsl(180, 12%, 78%)",
  textSecondary: "hsl(196, 10%, 52%)",
  border: "hsl(196, 25%, 20%)",
  buttonBg: "hsl(196, 18%, 14%)",
  accent: "hsl(187, 90%, 48%)",
  accentSecondary: "hsl(31, 100%, 67%)",
  accentOn: "hsl(196, 30%, 8%)",
  focus: "hsl(187, 90%, 48%)",
  error: "hsl(0, 72%, 65%)",
  scrollbarThumb: "hsl(196, 28%, 30%)",
};

/** Previous Ableton-orange accent on neutral grey (reference / fallback). */
export const CLASSIC_DARK_THEME: ExtensionUiTheme = {
  id: "classic-dark",
  label: "Classic dark",
  bg: "hsl(0, 0%, 21%)",
  surface: "hsl(0, 0%, 16%)",
  inputBg: "hsl(0, 0%, 12%)",
  text: "hsl(0, 0%, 71%)",
  textSecondary: "hsl(0, 0%, 41%)",
  border: "hsl(0, 0%, 7%)",
  buttonBg: "hsl(0, 0%, 16%)",
  accent: "hsl(31, 100%, 67%)",
  accentSecondary: "hsl(31, 100%, 67%)",
  accentOn: "hsl(0, 0%, 9%)",
  focus: "hsl(31, 100%, 67%)",
  error: "hsl(0, 72%, 65%)",
  scrollbarThumb: "hsl(0, 0%, 28%)",
};

/** Change this export to switch the entire extension UI palette. */
export const ACTIVE_UI_THEME: ExtensionUiTheme = CYAN_LIME_THEME;

export const UI_THEME_PRESETS: readonly ExtensionUiTheme[] = [
  CYAN_LIME_THEME,
  CLASSIC_DARK_THEME,
] as const;

/** `:root` custom properties injected into every modal. */
export function buildThemeCssVariables(theme: ExtensionUiTheme = ACTIVE_UI_THEME): string {
  return `:root {
  --c-font-family: ${UI_FONT_FAMILY};
  --c-bg: ${theme.bg};
  --c-surface: ${theme.surface};
  --c-input-bg: ${theme.inputBg};
  --c-text: ${theme.text};
  --c-text-secondary: ${theme.textSecondary};
  --c-border: ${theme.border};
  --c-button-bg: ${theme.buttonBg};
  --c-accent: ${theme.accent};
  --c-accent-secondary: ${theme.accentSecondary};
  --c-accent-on: ${theme.accentOn};
  --c-focus: ${theme.focus};
  --c-error: ${theme.error};
  --c-scrollbar-thumb: ${theme.scrollbarThumb};
}`;
}
