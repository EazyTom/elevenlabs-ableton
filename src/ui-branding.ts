import logoDataUrl from "../ui/assets/elevenapi-logo.png";
import modalBaseCss from "../ui/modal-base.css";
import {
  ACTIVE_UI_THEME,
  buildThemeCssVariables,
  type ExtensionUiTheme,
} from "./ui-theme.js";

/** Display size for logo in modal headers (asset is 342×86; scaled for UI). */
export const LOGO_WIDTH_PX = 140;
export const LOGO_HEIGHT_PX = 35;

/** Extra height for header bar: logo + padding + border below header. */
export const MODAL_HEADER_EXTRA_HEIGHT = LOGO_HEIGHT_PX + 20;

/** @deprecated Use ACTIVE_UI_THEME.bg from ui-theme.ts */
export const MODAL_BG = ACTIVE_UI_THEME.bg;

function buildShellStyles(theme: ExtensionUiTheme): string {
  return `<style id="el-theme">
${buildThemeCssVariables(theme)}

  html {
    color-scheme: dark only;
    font-family: var(--c-font-family);
    background-color: var(--c-bg) !important;
    min-height: 100%;
  }

  body {
    font-family: var(--c-font-family);
    background-color: var(--c-bg) !important;
    min-height: 100%;
    color: var(--c-text);
  }

  fieldset {
    background-color: transparent;
    border-color: var(--c-border);
  }

  dialog {
    background-color: var(--c-bg);
    color: var(--c-text);
    border-color: var(--c-border);
  }

  input,
  textarea,
  select,
  button {
    color-scheme: dark;
  }

  input[type="checkbox"],
  input[type="radio"],
  input[type="range"] {
    accent-color: var(--c-accent);
  }

  select {
    background: var(--c-input-bg);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    padding: 0.4em 0.5em;
    width: 100%;
    outline: none;
  }

  select:focus {
    outline: 2px solid var(--c-focus);
    outline-offset: 1px;
  }

  option {
    background: var(--c-input-bg);
    color: var(--c-text);
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
    background: var(--c-bg);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--c-scrollbar-thumb);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-corner {
    background: var(--c-bg);
  }

  .el-modal-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.6em;
    padding-bottom: 0.6em;
    margin-bottom: 0.25em;
    border-bottom: 1px solid var(--c-border);
    background: var(--c-bg);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--c-accent) 30%, transparent);
  }

  .el-modal-header img {
    width: ${LOGO_WIDTH_PX}px;
    height: ${LOGO_HEIGHT_PX}px;
    max-width: none;
    flex-shrink: 0;
    display: block;
    background: transparent;
    filter: invert(1) hue-rotate(165deg) saturate(1.2) brightness(1.05);
  }

  .el-modal-header .el-modal-subtitle {
    font-size: 0.95em;
    color: var(--c-accent-secondary);
    margin: 0;
    font-weight: normal;
  }

  body > h1:first-of-type {
    font-size: 0.95em;
    font-weight: normal;
    color: var(--c-text-secondary);
    margin: 0;
  }
</style>
<style id="el-modal-base">
${modalBaseCss}
</style>`;
}

const COLOR_SCHEME_META = `<meta name="color-scheme" content="dark" />`;

function buildModalHeader(subtitle?: string): string {
  const subtitleHtml = subtitle
    ? `<p class="el-modal-subtitle">${subtitle}</p>`
    : "";
  return `<header class="el-modal-header"><img src="${logoDataUrl}" alt="" width="${LOGO_WIDTH_PX}" height="${LOGO_HEIGHT_PX}" />${subtitleHtml}</header>`;
}

function injectColorSchemeMeta(html: string): string {
  if (/name=["']color-scheme["']/i.test(html)) return html;
  if (/<meta charset/i.test(html)) {
    return html.replace(/(<meta charset="UTF-8"\s*\/?>)/i, `$1\n  ${COLOR_SCHEME_META}`);
  }
  return html.replace(/<head>/i, `<head>\n  ${COLOR_SCHEME_META}`);
}

/**
 * Injects theme CSS, shared modal base styles, and logo header into modal HTML.
 * Theme tokens: src/ui-theme.ts · shared components: ui/modal-base.css
 */
export function prepareModalHtml(
  html: string,
  subtitle?: string,
  theme: ExtensionUiTheme = ACTIVE_UI_THEME,
): string {
  const header = buildModalHeader(subtitle);
  return injectColorSchemeMeta(html)
    .replace("</head>", `${buildShellStyles(theme)}</head>`)
    .replace("<body>", `<body>${header}`);
}
