#!/usr/bin/env node
/**
 * Build the canonical tube graph from TfL Line Sequence API responses.
 *
 * Inputs: scripts/data-pipeline/tfl-source/sequences/<line>.json
 *   where <line> is any tube / DLR / Elizabeth / Overground line id (19 lines total).
 * Output: scripts/data-pipeline/seeds/tubeGraph.seed.json (regenerated)
 *   which is then picked up by build-tube-graph.js and copied to assets/tubeGraph.json.
 *
 * Node id format: short kebab-case derived from station name (e.g. "baker-street").
 *   We prefer this over raw NaPTAN ATCO codes because EntityResolver and the
 *   rendering layer match on names. A separate `naptanId` field preserves the
 *   TfL identifier for debugging.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEQUENCES_DIR = path.join(__dirname, 'tfl-source', 'sequences');
const OUTPUT_SEED = path.join(__dirname, 'seeds', 'tubeGraph.seed.json');

// Default travel time per inter-station hop. TfL's API does not expose
// per-edge travel minutes; the Journey Planner integrates live timetables.
// For the offline routing layer we use ~2 min per stop as a reasonable fixture
// that scales well with station count. Tuned downstream once real timetables
// are integrated.
const DEFAULT_TRAVEL_MINUTES = 2;

// --- load ---
const sequenceFiles = fs.readdirSync(SEQUENCES_DIR).filter((f) => f.endsWith('.json'));
if (sequenceFiles.length === 0) {
    throw new Error(`No sequence files found in ${SEQUENCES_DIR}`);
}

const nodes = new Map(); // id -> node object
const edgeSet = new Set(); // dedupe key
const edges = [];

for (const file of sequenceFiles) {
    const lineSlug = path.basename(file, '.json');
    const payload = JSON.parse(fs.readFileSync(path.join(SEQUENCES_DIR, file), 'utf8'));
    processLine(lineSlug, payload);
}

// --- write seed ---
const nodeList = [...nodes.values()].sort((a, b) => a.name.localeCompare(b.name));
const edgeList = edges.sort((a, b) => (a.from + a.to + a.lineId).localeCompare(b.from + b.to + b.lineId));

const seed = {
    schemaVersion: 2,
    assetType: 'tube-graph',
    generatedBy: 'scripts/data-pipeline/build-tube-graph-from-tfl.js',
    sourceCount: {
        lineSequences: sequenceFiles.length,
    },
    nodes: nodeList,
    edges: edgeList,
};

fs.writeFileSync(OUTPUT_SEED, `${JSON.stringify(seed, null, 4)}\n`);

const lineSummary = new Map();
for (const e of edges) lineSummary.set(e.lineId, (lineSummary.get(e.lineId) ?? 0) + 1);

process.stdout.write(`${JSON.stringify(
    {
        outputSeed: OUTPUT_SEED,
        nodes: nodeList.length,
        edges: edgeList.length,
        linesProcessed: sequenceFiles.length,
        edgesPerLine: Object.fromEntries([...lineSummary.entries()].sort()),
    },
    null,
    2,
)}\n`);

// ---------- helpers ----------

function processLine(lineSlug, payload) {
    const lineId = payload.lineId || lineSlug;

    // The `stations` array contains rolled-up hub IDs (e.g. HUBCHX) for
    // interchange stations; the `stopPointSequences[].stopPoint` arrays
    // contain the individual stop points (940GZZLU*) whose IDs match the
    // naptanIds in orderedLineRoutes. We use the latter as our source of
    // truth for nodes so edges can resolve correctly.
    const stopIndex = new Map();
    for (const sps of payload.stopPointSequences || []) {
        for (const sp of sps.stopPoint || []) {
            if (sp.id) stopIndex.set(sp.id, sp);
        }
    }
    // Also seed from the stations list so any stop that only appears in
    // `stations` still becomes a node.
    for (const s of payload.stations || []) {
        if (s.id && !stopIndex.has(s.id)) stopIndex.set(s.id, s);
    }

    for (const station of stopIndex.values()) {
        addOrMergeNode(station, lineId);
    }

    // Build edges from orderedLineRoutes. Each route's naptanIds is an ordered
    // sequence; adjacent pairs are edges on this line.
    for (const route of payload.orderedLineRoutes || []) {
        const seq = route.naptanIds || [];
        for (let i = 0; i < seq.length - 1; i += 1) {
            const aRaw = stopIndex.get(seq[i]);
            const bRaw = stopIndex.get(seq[i + 1]);
            if (!aRaw || !bRaw) continue;
            const a = nodeIdForStation(aRaw);
            const b = nodeIdForStation(bRaw);
            if (a === b) continue;
            const key = a < b ? `${a}::${b}::${lineId}` : `${b}::${a}::${lineId}`;
            if (edgeSet.has(key)) continue;
            edgeSet.add(key);
            edges.push({
                from: a,
                to: b,
                lineId,
                travelMinutes: DEFAULT_TRAVEL_MINUTES,
            });
        }
    }
}

function addOrMergeNode(station, lineId) {
    const id = nodeIdForStation(station);
    const name = cleanStationName(station.name);

    let node = nodes.get(id);
    if (!node) {
        node = {
            id,
            name,
            naptanId: station.id,
            lat: station.lat,
            lon: station.lon,
            zone: parseZone(station.zone),
            lines: [],
        };
        nodes.set(id, node);
    }
    if (!node.lines.includes(lineId)) node.lines.push(lineId);
    // Prefer the most central zone value if multiple are reported across lines.
    if (typeof node.zone === 'number' && typeof parseZone(station.zone) === 'number') {
        node.zone = Math.min(node.zone, parseZone(station.zone));
    }
}

function nodeIdForStation(station) {
    return slugify(cleanStationName(station.name));
}

function cleanStationName(name) {
    // Strip suffixes like "Underground Station", "DLR Station", "Rail Station"
    return String(name)
        .replace(/\s+(Underground|DLR|Rail)\s+Station$/i, '')
        .replace(/\s+Station$/i, '')
        .trim();
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function parseZone(raw) {
    if (!raw) return undefined;
    // TfL returns "1", "1/2", "2/3", "9" etc. Take the lowest zone.
    const parts = String(raw).split('/').map((p) => Number(p.trim()));
    const nums = parts.filter((n) => Number.isFinite(n));
    return nums.length > 0 ? Math.min(...nums) : undefined;
}
