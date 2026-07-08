# WT-004 Media Pipeline ADR

Status: accepted for MVP foundation.

Date: 2026-07-08.

## Context

WT-001 proved the core media path:

```text
host local MP4 -> HTMLVideoElement -> captureStream()
-> LiveKit audio/video tracks -> guest browser
```

WT-002 fixed the supported browser and codec boundary. WT-003 recorded the first quality baseline and known scale checks still required before a public quality promise.

This ADR closes the P0 decision needed before starting the P1 foundation work.

## Decision

Use browser-native playback plus `HTMLMediaElement.captureStream()` as the primary MVP media pipeline for local files.

Use LiveKit as the media plane for WebRTC publish, SFU fan-out, subscription, and future TURN/TLS deployment.

Keep Spring Boot outside the media byte path. The future backend owns rooms, access, roles, room state, tokens, presence, TTL, audit, and telemetry. It must not proxy, store, or transcode movie bytes in the MVP.

## Supported MVP Boundary

| Area | Decision |
|---|---|
| Host browser | Desktop Chrome / Edge |
| Guest browser | Desktop Chrome / Edge |
| File source | Local file selected through browser file picker |
| Primary format | MP4, H.264/AVC video, AAC audio |
| Media transport | WebRTC through LiveKit |
| Backend media storage | None |
| Server-side transcoding | None |
| Mobile, Safari, Firefox | Research only, not an MVP guarantee |
| MKV, HEVC, DTS, DRM | Out of MVP scope |

## Product State Boundary

Media tracks and product state are separate.

LiveKit carries audio/video tracks. WT-004 also adds a small data-channel prototype, `wt.playback-state.v1`, so guest can see and react to host `playing`, `paused`, and `ended` state.

This data-channel layer is useful PoC evidence, but it is not the final authoritative room-state system. In the MVP architecture, Spring Boot WebSocket snapshots/events remain the source of truth for room state, permissions, stale event handling, reconnect snapshots, and versioning.

## Fallback Strategy

Primary fallback for unsupported files is a clear file/browser error, not silent upload or server transcoding.

`getDisplayMedia()` remains a possible later fallback for screen/tab sharing, but it is not part of the current accepted MVP file pipeline. A desktop helper or local transcoding may be considered only after beta demand justifies broader file support.

## Known Consequences

- Guest receives a live WebRTC stream, not the original VOD file.
- Host seek is visible to guest as a live-stream jump; precise VOD timeline sync is not solved in P0.
- Host pause is represented both by the media stream behavior and by WT-004 playback-state messages.
- The current baseline showed source/capture at `1920x1080`, while guest decoded `1280x720`; this does not block P1.
- Multi-guest and degraded-network metrics are still required before a public quality or scale promise.
- Browser support remains intentionally narrow until compatibility evidence changes.

## GO / ADJUST

Decision: GO to P1 foundation.

Continue with the accepted Chrome/Edge + MP4 H.264/AAC + LiveKit path.

Adjust before beta:

- run 2-guest and 3-guest quality checks;
- run controlled network checks if MVP promises resilience under VPN, UDP blocking, or weak uplink;
- decide whether 1080p one-to-one delivery is a product requirement;
- move authoritative room/product state from LiveKit-only PoC messages into backend-owned WebSocket state.

## Acceptance Evidence

- WT-001 confirmed local MP4 preview, capture, publish, guest video/audio, Chrome long-run, Edge smoke, and no backend file upload.
- WT-002 documented MVP browser/codec boundaries.
- WT-003 documented first-frame, bitrate, packet loss, jitter, dropped frames, and resolution observations.
- WT-004 data-channel prototype confirmed that host playback state can reach guest without introducing backend media upload.
