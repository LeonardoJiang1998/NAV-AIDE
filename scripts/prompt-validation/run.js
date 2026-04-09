#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const seedsPath = path.join(baseDir, 'seeds.json');
const stationsPath = path.join(baseDir, 'fixtures', 'stations.json');
const promptTemplatePath = path.join(baseDir, 'intent-extraction.prompt.md');
const schemaPath = path.join(baseDir, 'intent-schema.json');
const resultsDir = path.join(baseDir, 'results');

const allowedLanguages = new Set(['English', 'Mandarin', 'Spanish', 'French', 'Arabic', 'Other']);
const allowedIntents = new Set(['route', 'nearest_station', 'poi_lookup', 'lost_help', 'fare', 'unknown']);

function parseArgs(argv) {
    const options = {
        runner: 'mock',
        command: process.env.NAV_AIDE_PHASE0_COMMAND || '',
        model: process.env.NAV_AIDE_PHASE0_MODEL || 'gemma4:e2b',
        ollamaUrl: process.env.NAV_AIDE_PHASE0_OLLAMA_URL || 'http://127.0.0.1:11434',
        failFast: false,
    };

    for (let index = 2; index < argv.length; index += 1) {
        const value = argv[index];

        if (value === '--runner' && argv[index + 1]) {
            options.runner = argv[index + 1];
            index += 1;
            continue;
        }

        if (value === '--command' && argv[index + 1]) {
            options.command = argv[index + 1];
            index += 1;
            continue;
        }

        if (value === '--model' && argv[index + 1]) {
            options.model = argv[index + 1];
            index += 1;
            continue;
        }

        if (value === '--ollama-url' && argv[index + 1]) {
            options.ollamaUrl = argv[index + 1];
            index += 1;
            continue;
        }

        if (value === '--fail-fast') {
            options.failFast = true;
            continue;
        }
    }

    return options;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildPrompt(template, stations, seed) {
    return template
        .replace('{{STATION_FIXTURE_JSON}}', JSON.stringify(stations, null, 2))
        .replace('{{USER_QUERY}}', seed.query);
}

function ensureResultsDir() {
    fs.mkdirSync(resultsDir, { recursive: true });
}

function writeResults(summary, details) {
    ensureResultsDir();
    fs.writeFileSync(path.join(resultsDir, 'latest-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(path.join(resultsDir, 'latest-details.json'), `${JSON.stringify(details, null, 2)}\n`);
}

function mockModel(seed) {
    return {
        detectedLanguage: seed.expected.detectedLanguage,
        intent: seed.expected.intent,
        origin: seed.expected.origin,
        destination: seed.expected.destination,
        poiQuery: seed.expected.poiQuery,
        requiresDisambiguation: seed.expected.requiresDisambiguation,
        rawQuery: seed.query,
    };
}

function commandModel(prompt, command) {
    if (!command) {
        throw new Error('No command provided. Pass --command or set NAV_AIDE_PHASE0_COMMAND.');
    }

    const result = spawnSync(command, {
        input: prompt,
        shell: true,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || `Command failed with exit code ${result.status}.`);
    }

    const output = result.stdout.trim();

    if (!output) {
        throw new Error('Model command returned empty output.');
    }

    return JSON.parse(output);
}

function postJson(targetUrl, payload) {
    const url = new URL(targetUrl);
    const client = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const request = client.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: `${url.pathname}${url.search}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (response) => {
                let responseBody = '';

                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    responseBody += chunk;
                });
                response.on('end', () => {
                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error(`Ollama API returned ${response.statusCode}: ${responseBody}`));
                        return;
                    }

                    try {
                        resolve(JSON.parse(responseBody));
                    } catch (error) {
                        reject(new Error(`Failed to parse Ollama API response: ${error.message}`));
                    }
                });
            }
        );

        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

async function ollamaModel(prompt, schema, options) {
    const response = await postJson(`${options.ollamaUrl}/api/generate`, {
        model: options.model,
        prompt,
        stream: false,
        format: schema,
        options: {
            temperature: 0,
        },
    });

    if (!response || typeof response.response !== 'string' || response.response.trim().length === 0) {
        throw new Error('Ollama API returned an empty response field.');
    }

    return JSON.parse(response.response);
}

function validateShape(candidate) {
    const errors = [];

    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return ['Response must be a JSON object.'];
    }

    if (!allowedLanguages.has(candidate.detectedLanguage)) {
        errors.push('detectedLanguage must be one of the allowed values.');
    }

    if (!allowedIntents.has(candidate.intent)) {
        errors.push('intent must be one of the allowed values.');
    }

    for (const field of ['origin', 'destination', 'poiQuery']) {
        const value = candidate[field];
        const valid = value === null || typeof value === 'string';
        if (!valid) {
            errors.push(`${field} must be a string or null.`);
        }
    }

    if (typeof candidate.requiresDisambiguation !== 'boolean') {
        errors.push('requiresDisambiguation must be a boolean.');
    }

    if (typeof candidate.rawQuery !== 'string' || candidate.rawQuery.trim().length === 0) {
        errors.push('rawQuery must be a non-empty string.');
    }

    return errors;
}

function validateAgainstSeed(candidate, seed) {
    const errors = [];
    const expected = seed.expected;

    if (candidate.detectedLanguage !== expected.detectedLanguage) {
        errors.push(`detectedLanguage mismatch: expected ${expected.detectedLanguage}, received ${candidate.detectedLanguage}.`);
    }

    if (candidate.intent !== expected.intent) {
        errors.push(`intent mismatch: expected ${expected.intent}, received ${candidate.intent}.`);
    }

    if (candidate.origin !== expected.origin) {
        errors.push(`origin mismatch: expected ${JSON.stringify(expected.origin)}, received ${JSON.stringify(candidate.origin)}.`);
    }

    if (candidate.destination !== expected.destination) {
        errors.push(`destination mismatch: expected ${JSON.stringify(expected.destination)}, received ${JSON.stringify(candidate.destination)}.`);
    }

    if (candidate.poiQuery !== expected.poiQuery) {
        errors.push(`poiQuery mismatch: expected ${JSON.stringify(expected.poiQuery)}, received ${JSON.stringify(candidate.poiQuery)}.`);
    }

    if (candidate.requiresDisambiguation !== expected.requiresDisambiguation) {
        errors.push(
            `requiresDisambiguation mismatch: expected ${expected.requiresDisambiguation}, received ${candidate.requiresDisambiguation}.`
        );
    }

    return errors;
}

async function main() {
    const options = parseArgs(process.argv);
    const seeds = readJson(seedsPath);
    const stations = readJson(stationsPath);
    const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf8');
    const schema = readJson(schemaPath);

    if (!Array.isArray(seeds) || seeds.length < 30) {
        throw new Error('Expected at least 30 seed inputs in seeds.json.');
    }

    if (!schema.required || !Array.isArray(schema.required)) {
        throw new Error('intent-schema.json must expose a required array.');
    }

    let passed = 0;
    const failures = [];
    const details = [];

    for (const seed of seeds) {
        const prompt = buildPrompt(promptTemplate, stations, seed);
        let response;

        try {
            if (options.runner === 'command') {
                response = commandModel(prompt, options.command);
            } else if (options.runner === 'ollama') {
                response = await ollamaModel(prompt, schema, options);
            } else {
                response = mockModel(seed);
            }
        } catch (error) {
            failures.push({ id: seed.id, query: seed.query, errors: [error.message] });
            details.push({
                id: seed.id,
                query: seed.query,
                expected: seed.expected,
                response: null,
                errors: [error.message],
            });
            if (options.failFast) {
                break;
            }
            continue;
        }

        const shapeErrors = validateShape(response);
        const semanticErrors = validateAgainstSeed(response, seed);
        const errors = [...shapeErrors, ...semanticErrors];

        if (errors.length > 0) {
            failures.push({ id: seed.id, query: seed.query, errors });
            details.push({
                id: seed.id,
                query: seed.query,
                expected: seed.expected,
                response,
                errors,
            });
            if (options.failFast) {
                break;
            }
            continue;
        }

        details.push({
            id: seed.id,
            query: seed.query,
            expected: seed.expected,
            response,
            errors: [],
        });
        passed += 1;
    }

    const summary = {
        runner: options.runner,
        model: options.runner === 'ollama' ? options.model : null,
        totalSeeds: seeds.length,
        passed,
        failed: failures.length,
        schemaTitle: schema.title || null,
        stationsLoaded: Array.isArray(stations.stations) ? stations.stations.length : 0,
        failures,
    };

    writeResults(summary, details);

    const output = failures.length === 0 ? process.stdout : process.stderr;
    output.write(`${JSON.stringify(summary, null, 2)}\n`);

    process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});