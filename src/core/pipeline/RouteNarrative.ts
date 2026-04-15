import type { TubeSegment } from './TubeGraphTransforms';

const LINE_DISPLAY_NAMES: Record<string, string> = {
    bakerloo: 'Bakerloo line',
    central: 'Central line',
    circle: 'Circle line',
    district: 'District line',
    'hammersmith-city': 'Hammersmith & City line',
    jubilee: 'Jubilee line',
    metropolitan: 'Metropolitan line',
    northern: 'Northern line',
    piccadilly: 'Piccadilly line',
    victoria: 'Victoria line',
    'waterloo-city': 'Waterloo & City line',
    dlr: 'DLR',
    elizabeth: 'Elizabeth line',
    liberty: 'Liberty line',
    lioness: 'Lioness line',
    mildmay: 'Mildmay line',
    suffragette: 'Suffragette line',
    weaver: 'Weaver line',
    windrush: 'Windrush line',
    'walking-transfer': 'walking transfer',
    unknown: 'unknown line',
};

export function displayNameForLine(lineId: string): string {
    return LINE_DISPLAY_NAMES[lineId] ?? `${lineId} line`;
}

/**
 * Build a rich, multi-line journey narrative for the LLM render prompt.
 * Example output:
 *   Take the Jubilee line 4 stops from Waterloo to Baker Street, via
 *   Westminster, Green Park, Bond Street.
 * For multi-segment journeys:
 *   Start at Stratford. Take the Elizabeth line 3 stops to Liverpool Street,
 *   then change to the Central line for 2 stops to Tottenham Court Road,
 *   then change to the District line for 14 stops to Wimbledon.
 *   Total travel time: 38 minutes.
 */
export function buildRouteNarrative(
    originName: string,
    destinationName: string,
    tubeSegments: TubeSegment[],
    totalMinutes: number,
): string {
    if (originName === destinationName) {
        return `You're already at ${originName}.`;
    }

    if (tubeSegments.length === 0) {
        return `No tube route was found from ${originName} to ${destinationName}.`;
    }

    const parts: string[] = [];

    if (tubeSegments.length === 1) {
        const seg = tubeSegments[0];
        const hops = Math.max(0, seg.stations.length - 1);
        const intermediate = seg.stations.slice(1, -1);
        parts.push(
            `Take the ${displayNameForLine(seg.lineId)} ${formatHops(hops)} from ${originName} to ${destinationName}.`,
        );
        if (intermediate.length > 0 && intermediate.length <= 8) {
            parts.push(`Stops on the way: ${intermediate.join(', ')}.`);
        } else if (intermediate.length > 8) {
            parts.push(
                `Stops on the way (${intermediate.length}): ${intermediate.slice(0, 3).join(', ')}, …, ${intermediate
                    .slice(-2)
                    .join(', ')}.`,
            );
        }
    } else {
        parts.push(`Start at ${originName}.`);
        for (let i = 0; i < tubeSegments.length; i += 1) {
            const seg = tubeSegments[i];
            const hops = Math.max(0, seg.stations.length - 1);
            const endStation = seg.stations[seg.stations.length - 1];
            if (i === 0) {
                parts.push(
                    `Take the ${displayNameForLine(seg.lineId)} ${formatHops(hops)} to ${endStation}.`,
                );
            } else {
                parts.push(
                    `Change to the ${displayNameForLine(seg.lineId)} and ride ${formatHops(hops)} to ${endStation}.`,
                );
            }
        }
    }

    parts.push(`Total travel time: ${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}.`);

    return parts.join(' ');
}

function formatHops(hops: number): string {
    if (hops <= 0) return '0 stops';
    if (hops === 1) return '1 stop';
    return `${hops} stops`;
}
