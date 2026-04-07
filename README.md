# NAV-AIDE

NAV-AIDE is an offline-first London travel assistant designed to help tourists and visitors navigate public transport without relying on mobile data.

The project combines local maps, local routing data, voice input and output, and on-device AI intent handling so users can ask for help naturally, even in low-signal environments such as Underground stations.

## What It Does

- Provides London-focused public transport navigation for visitors.
- Supports text and voice search for travel questions.
- Uses offline maps and local routing assets for core navigation.
- Resolves stations, points of interest, and aliases locally before routing.
- Offers a "LOST?" helper flow for situations where a user needs to identify nearby signs, stations, or directions.
- Supports multilingual travel queries as part of the MVP design.
- Avoids cloud AI APIs for core navigation, search, voice, and LLM inference.

## MVP Scope

NAV-AIDE is planned as a React Native mobile app with:

- A GO flow for route search, transport selection, map display, route cards, and TTS playback.
- A LOST? flow for resolving location clues and guiding users when they are unsure where they are.
- Offline map support using MBTiles and MapLibre integration points.
- Local route and POI data, including Tube graph data, bus route data, POI data, location aliases, and Valhalla routing tiles.
- On-device speech-to-text and text-to-speech using OS capabilities.
- On-device LLM inference using Gemma through `llama.rn`.
- A simple GitHub Pages marketing site in `docs/`.

## Architecture Principles

- Offline-first: core routing, map rendering, POI search, voice I/O, and local AI inference must not depend on the network.
- Local resolution first: the app resolves entities such as stations and POIs before routing or rendering responses.
- No cloud AI for the MVP: AI features are intended to run on-device.
- Phased delivery: prompt validation, data pipeline, core Node.js logic, React Native shell, and feature integration are developed separately.

## Repository Contents

- `nav-aide-copilot-kit/` contains Copilot and agent instructions for building NAV-AIDE in phases.
- `nav-aide-copilot-kit/docs/` contains the current static GitHub Pages marketing site.
- `LICENSE` contains the project license.

## Status

This repository is currently in early planning and scaffolding. The existing files define the product direction, implementation phases, and initial documentation/site structure.
