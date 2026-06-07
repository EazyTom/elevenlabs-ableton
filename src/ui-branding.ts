import logoDataUrl from "../ui/assets/elevenapi-logo.png";

/** Display size for logo in modal headers (asset is 342×86; scaled for UI). */
export const LOGO_WIDTH_PX = 140;
export const LOGO_HEIGHT_PX = 35;

/** Extra height for header bar: logo + padding + border below header. */
export const MODAL_HEADER_EXTRA_HEIGHT = LOGO_HEIGHT_PX + 20;

const BRANDING_STYLES = `<style id="el-branding">
  :root {
    --c-bg: hsl(0, 0%, 20%);
    --c-surface: hsl(0, 0%, 16%);
    --c-input-bg: hsl(0, 0%, 13%);
    --c-text: hsl(0, 0%, 78%);
    --c-text-secondary: hsl(0, 0%, 48%);
    --c-border: hsl(0, 0%, 9%);
    --c-button-bg: hsl(0, 0%, 17%);
    --c-accent: hsl(31, 100%, 67%);
  }

  html, body {
    background: var(--c-bg);
  }

  select {
    background: var(--c-input-bg);
    color: var(--c-text);
    border: 1px solid var(--c-border);
  }

  select:focus {
    outline: 2px solid var(--c-text-secondary);
  }

  option {
    background: var(--c-input-bg);
    color: var(--c-text);
  }

  .el-modal-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.6em;
    padding-bottom: 0.6em;
    margin-bottom: 0.25em;
    border-bottom: 1px solid var(--c-border);
  }

  .el-modal-header img {
    width: ${LOGO_WIDTH_PX}px;
    height: ${LOGO_HEIGHT_PX}px;
    max-width: none;
    flex-shrink: 0;
    display: block;
    filter: invert(1) brightness(1.05);
  }

  .el-modal-header .el-modal-subtitle {
    font-size: 0.95em;
    color: var(--c-text-secondary);
    margin: 0;
    font-weight: normal;
  }

  body > h1:first-of-type {
    font-size: 0.95em;
    font-weight: normal;
    color: var(--c-text-secondary);
    margin: 0;
  }
</style>`;

function buildModalHeader(subtitle?: string): string {
  const subtitleHtml = subtitle
    ? `<p class="el-modal-subtitle">${subtitle}</p>`
    : "";
  return `<header class="el-modal-header"><img src="${logoDataUrl}" alt="ElevenLabs API" width="${LOGO_WIDTH_PX}" height="${LOGO_HEIGHT_PX}" />${subtitleHtml}</header>`;
}

/**
 * Injects shared dark-grey branding and logo header into modal HTML.
 * Modals are loaded via data: URLs, so the logo must be inlined as a data URL at build time.
 */
export function prepareModalHtml(html: string, subtitle?: string): string {
  const header = buildModalHeader(subtitle);
  return html
    .replace("</head>", `${BRANDING_STYLES}</head>`)
    .replace("<body>", `<body>${header}`);
}
