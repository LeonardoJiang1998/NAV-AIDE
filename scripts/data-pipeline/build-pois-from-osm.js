#!/usr/bin/env node
/**
 * Build the POI seed JSON from an OpenStreetMap Overpass API dump.
 *
 * Input: scripts/data-pipeline/tfl-source/london-pois-osm.json
 *   (result of an Overpass QL query across Greater London — see
 *    overpass-query.txt for the exact query).
 * Output: scripts/data-pipeline/seeds/pois.seed.json (regenerated)
 *
 * Filtering rules (conservative, tourist-focused):
 *   - must have a name (OSM `name` or `name:en`).
 *   - tourism=museum | gallery | attraction | viewpoint | zoo | aquarium | theme_park
 *   - historic=castle | palace | cathedral | monument (famous only via name heuristic)
 *   - amenity=theatre | arts_centre
 *   - leisure=park (named, skip gardens because they're too granular)
 *   - skip memorials entirely — too noisy (2,300+ in Greater London)
 *
 * Zone is derived by nearest-station fallback. We don't have neighbourhood
 * data here, so we leave zone undefined and let the renderer omit it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, 'tfl-source', 'london-pois-osm.json');
const OUTPUT_SEED = path.join(__dirname, 'seeds', 'pois.seed.json');
const TUBE_GRAPH = path.join(__dirname, '..', '..', 'assets', 'tubeGraph.json');

// Minimum one-word names are allowed but must not be tag-like (e.g. "Gallery").
const BANNED_NAME_SET = new Set(['Gallery', 'Museum', 'Park', 'Theatre', 'Memorial', 'Monument']);

const KEEP = {
    tourism: new Set(['museum', 'gallery', 'attraction', 'viewpoint', 'zoo', 'aquarium', 'theme_park']),
    historic: new Set(['castle', 'palace', 'cathedral', 'monument']),
    amenity: new Set(['theatre', 'arts_centre']),
    leisure: new Set(['park']),
};

// Load OSM data
const osm = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const elements = osm.elements || [];
console.error(`[osm] ${elements.length} raw elements`);

// Load tube graph for nearest-station approximation
const tubeGraph = JSON.parse(fs.readFileSync(TUBE_GRAPH, 'utf8'));
const stationsWithCoords = tubeGraph.nodes.filter((n) => typeof n.lat === 'number' && typeof n.lon === 'number');

// ---- filter ----
const chosen = [];
for (const el of elements) {
    const tags = el.tags || {};
    const name = (tags.name || tags['name:en'] || '').trim();
    if (!name) continue;
    if (BANNED_NAME_SET.has(name)) continue;
    if (name.length < 3) continue;

    const { category, primaryTag } = classify(tags);
    if (!category) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    // Nearest station for a zone approximation
    const nearest = nearestStation(lat, lon, stationsWithCoords);

    chosen.push({
        id: slugify(name),
        canonicalName: name,
        category,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6)),
        zone: nearest?.zone,
        nearestStation: nearest?.name,
        searchTerms: searchTerms(name, tags, category, nearest),
        osm: {
            tag: primaryTag,
            id: el.id,
        },
    });
}

// Dedupe by slug id — if two different OSM elements produce the same slug,
// keep the one whose name is shorter (more canonical) and drop duplicates
// that are obvious subsidiaries.
const byId = new Map();
for (const p of chosen) {
    const existing = byId.get(p.id);
    if (!existing) {
        byId.set(p.id, p);
    } else if (p.canonicalName.length < existing.canonicalName.length) {
        byId.set(p.id, p);
    }
}

const pois = [...byId.values()].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
console.error(`[osm] ${pois.length} POIs after filter/dedupe`);

// Write seed
fs.writeFileSync(
    OUTPUT_SEED,
    `${JSON.stringify({ pois }, null, 4)}\n`,
);

// Summary
const byCategory = new Map();
for (const p of pois) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);

process.stdout.write(
    `${JSON.stringify(
        {
            outputSeed: OUTPUT_SEED,
            count: pois.length,
            categoryBreakdown: Object.fromEntries([...byCategory.entries()].sort()),
            sample: pois.slice(0, 5).map((p) => ({ name: p.canonicalName, category: p.category, nearestStation: p.nearestStation })),
        },
        null,
        2,
    )}\n`,
);

// ---------- helpers ----------

function classify(tags) {
    for (const key of ['tourism', 'historic', 'amenity', 'leisure']) {
        const value = tags[key];
        if (!value) continue;
        const keep = KEEP[key];
        if (!keep || !keep.has(value)) continue;

        // Normalise to a single-word category for the renderer.
        const categoryMap = {
            // tourism
            museum: 'museum', gallery: 'gallery', attraction: 'landmark',
            viewpoint: 'viewpoint', zoo: 'zoo', aquarium: 'aquarium', theme_park: 'attraction',
            // historic
            castle: 'landmark', palace: 'landmark', cathedral: 'landmark', monument: 'landmark',
            // amenity
            theatre: 'theatre', arts_centre: 'arts_centre',
            // leisure
            park: 'park',
        };
        return { category: categoryMap[value] ?? value, primaryTag: `${key}=${value}` };
    }
    return { category: null, primaryTag: null };
}

function nearestStation(lat, lon, stations) {
    let best = null;
    let bestDist = Infinity;
    for (const s of stations) {
        const d = haversineMeters(lat, lon, s.lat, s.lon);
        if (d < bestDist) {
            bestDist = d;
            best = s;
        }
    }
    return best ? { name: best.name, zone: best.zone, distanceMeters: Math.round(bestDist) } : null;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function searchTerms(name, tags, category, nearest) {
    const set = new Set();
    set.add(name);
    set.add(category);
    const aliases = tags.alt_name || tags.old_name || tags['name:en'];
    if (aliases && aliases !== name) set.add(aliases);
    if (nearest?.name) set.add(nearest.name);
    // Split long names so FTS can match substrings
    for (const word of name.split(/[\s,'-]+/)) {
        if (word.length > 3) set.add(word);
    }
    return [...set];
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
