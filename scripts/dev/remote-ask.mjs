#!/usr/bin/env node
/**
 * NAV AiDE remote-control CLI.
 *
 * Sends a query to the running app (simulator or device) via the Metro
 * debugger, prints the resulting journey narrative, and exits.
 *
 * Usage:
 *   node scripts/dev/remote-ask.mjs "How do I get from Waterloo to Baker Street?"
 *   node scripts/dev/remote-ask.mjs --device iPhone "Stratford to Wimbledon"
 *   node scripts/dev/remote-ask.mjs --json "Find the British Museum"
 *
 * Prerequisites: Metro running on localhost:8081, the app running in DEV
 * (__DEV__ exposes globalThis.__NAVAIDE_PIPELINE).
 */

import WebSocket from '../../node_modules/ws/index.js';

const args = parseArgs(process.argv.slice(2));

if (!args.query) {
    console.error('usage: remote-ask.mjs [--device iPhone|iPhone 16 Pro] [--json] "<query>"');
    process.exit(1);
}

const metroList = await fetch('http://localhost:8081/json/list').then((res) => res.json());
const target = metroList.find((entry) => {
    if (args.device) return entry.deviceName === args.device;
    return entry.deviceName.includes('iPhone 16 Pro') || entry.deviceName === 'iPhone';
});
if (!target) {
    console.error('No matching Metro target. Available devices:');
    for (const entry of metroList) console.error(`  - ${entry.deviceName}`);
    process.exit(1);
}

console.error(`[remote-ask] asking ${target.deviceName}: ${args.query}`);
const ws = new WebSocket(target.webSocketDebuggerUrl, {
    headers: { Origin: 'http://localhost:8081', 'User-Agent': 'ChromeDevTools' },
});

let msgId = 0;
const pending = new Map();
function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
        setTimeout(() => {
            if (pending.has(id)) {
                pending.delete(id);
                reject(new Error(`Timeout for ${method}`));
            }
        }, 30000);
    });
}
async function evalExpr(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

ws.on('open', async () => {
    try {
        await send('Runtime.enable');
        const pipelineReady = await evalExpr(`Boolean(globalThis.__NAVAIDE_PIPELINE)`);
        if (!pipelineReady) {
            console.error('[remote-ask] pipeline not exposed. Ensure the app is running in __DEV__.');
            process.exit(2);
        }

        await evalExpr(`
            globalThis.__ASK_RESULT = undefined;
            globalThis.__ASK_START = Date.now();
            (async () => {
                try {
                    const p = globalThis.__NAVAIDE_PIPELINE;
                    const r = await p.queryPipeline.execute(${JSON.stringify(args.query)}, p.knownStations);
                    globalThis.__ASK_RESULT = JSON.stringify({
                        query: ${JSON.stringify(args.query)},
                        elapsedMs: Date.now() - globalThis.__ASK_START,
                        status: r.status,
                        intent: r.extraction && r.extraction.intent,
                        origin: r.extraction && r.extraction.origin,
                        destination: r.extraction && r.extraction.destination,
                        poiQuery: r.extraction && r.extraction.poiQuery,
                        routeCost: r.route && r.route.cost,
                        routePath: r.route && r.route.path,
                        rendered: r.rendered && r.rendered.text,
                    });
                } catch (e) {
                    globalThis.__ASK_RESULT = JSON.stringify({ error: e.message });
                }
            })();
            'started'
        `);

        const deadline = Date.now() + 180000;
        while (Date.now() < deadline) {
            await sleep(2000);
            const value = await evalExpr('globalThis.__ASK_RESULT || null');
            if (value) {
                const parsed = JSON.parse(value);
                if (args.json) {
                    console.log(JSON.stringify(parsed, null, 2));
                } else {
                    formatPretty(parsed);
                }
                ws.close();
                process.exit(0);
            }
            process.stderr.write('.');
        }
        console.error('\n[remote-ask] timeout after 180s');
        ws.close();
        process.exit(3);
    } catch (error) {
        console.error('[remote-ask] error:', error.message);
        process.exit(1);
    }
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
    }
});
ws.on('error', (err) => {
    console.error('[remote-ask] websocket error:', err.message);
    process.exit(1);
});

function parseArgs(argv) {
    const out = { device: null, json: false, query: null };
    const rest = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--json') out.json = true;
        else if (a === '--device') {
            out.device = argv[++i];
        } else rest.push(a);
    }
    out.query = rest.join(' ');
    return out;
}

function formatPretty(res) {
    if (res.error) {
        console.log(`\n❌ Error: ${res.error}`);
        return;
    }
    console.log();
    console.log(`🧭  ${res.query}`);
    console.log(`   status: ${res.status}  ·  intent: ${res.intent}  ·  ${(res.elapsedMs / 1000).toFixed(1)}s`);
    if (res.origin) console.log(`   origin: ${res.origin}`);
    if (res.destination) console.log(`   destination: ${res.destination}`);
    if (res.poiQuery) console.log(`   poi: ${res.poiQuery}`);
    if (res.routeCost !== undefined) console.log(`   cost: ${res.routeCost} min, ${res.routePath?.length ?? 0} stations`);
    if (res.rendered) {
        console.log();
        console.log(`   ${res.rendered}`);
    }
}
