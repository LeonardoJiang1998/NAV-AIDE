/**
 * NAV AiDE theme system.
 *
 * Neutral design tokens for the shell, plus canonical Transport for London
 * line colours so every line chip matches the official TfL colour standard.
 */

export const colors = {
    ink: '#11211d',
    inkMuted: '#4b5b57',
    paper: '#f7f2e8',
    paperRaised: '#fffaf1',
    paperSunken: '#f0eadf',
    accent: '#006a52',
    accentSoft: '#cfe8de',
    rail: '#183a37',
    warning: '#8e4b10',
    danger: '#b0322d',
    success: '#1f7a55',
    line: '#d6cdc0',
    overlay: 'rgba(17, 33, 29, 0.08)',
};

/**
 * Official TfL line colours (issue 04 corporate palette, April 2026).
 * Keys match the `lineId` strings produced by build-tube-graph-from-tfl.js.
 *
 * `ink` is the preferred on-colour foreground for each line (use this for
 * the line name label printed on top of the colour chip).
 */
export interface TubeLineStyle {
    hex: string;
    ink: string;
    displayName: string;
}

export const TUBE_LINE_STYLES: Record<string, TubeLineStyle> = {
    bakerloo: { hex: '#B36305', ink: '#ffffff', displayName: 'Bakerloo' },
    central: { hex: '#E32017', ink: '#ffffff', displayName: 'Central' },
    circle: { hex: '#FFD300', ink: '#11211d', displayName: 'Circle' },
    district: { hex: '#00782A', ink: '#ffffff', displayName: 'District' },
    'hammersmith-city': { hex: '#F3A9BB', ink: '#11211d', displayName: 'Hammersmith & City' },
    jubilee: { hex: '#A0A5A9', ink: '#ffffff', displayName: 'Jubilee' },
    metropolitan: { hex: '#9B0056', ink: '#ffffff', displayName: 'Metropolitan' },
    northern: { hex: '#000000', ink: '#ffffff', displayName: 'Northern' },
    piccadilly: { hex: '#003688', ink: '#ffffff', displayName: 'Piccadilly' },
    victoria: { hex: '#0098D4', ink: '#ffffff', displayName: 'Victoria' },
    'waterloo-city': { hex: '#95CDBA', ink: '#11211d', displayName: 'Waterloo & City' },
    dlr: { hex: '#00A4A7', ink: '#ffffff', displayName: 'DLR' },
    elizabeth: { hex: '#7156A5', ink: '#ffffff', displayName: 'Elizabeth' },
    liberty: { hex: '#5D6061', ink: '#ffffff', displayName: 'Liberty' },
    lioness: { hex: '#FAA61A', ink: '#11211d', displayName: 'Lioness' },
    mildmay: { hex: '#006FE6', ink: '#ffffff', displayName: 'Mildmay' },
    suffragette: { hex: '#76D0BD', ink: '#11211d', displayName: 'Suffragette' },
    weaver: { hex: '#A45A2A', ink: '#ffffff', displayName: 'Weaver' },
    windrush: { hex: '#EE2E24', ink: '#ffffff', displayName: 'Windrush' },
    'walking-transfer': { hex: '#4b5b57', ink: '#ffffff', displayName: 'Walk' },
    unknown: { hex: '#808080', ink: '#ffffff', displayName: 'Line' },
};

export function getTubeLineStyle(lineId: string): TubeLineStyle {
    return TUBE_LINE_STYLES[lineId] ?? TUBE_LINE_STYLES.unknown;
}
