# PJJ Automated Test Plan

## Unit

- Token policy matrix per role: join, publish sources, subscribe, data, admin, max room config.
- Runtime validator data packet: malformed, spoofed identity/name/role, privileged command, size limit, unknown version.
- Lifecycle reducer: every legal/illegal transition; reconnect remains same Room.
- Error taxonomy and public-message mapping.
- Attendance duration/event ordering/idempotency.
- Chat dedupe/order/status and whiteboard snapshot/delta reducer.
- Logger schema and secret/JWT/PII redaction.

## Integration (API + disposable database)

- Authenticated/unauthenticated/unauthorized token issuance.
- Token request does not mark online.
- Webhook signature invalid, duplicate, retry after injected failure, concurrent duplicate, aborted connection, joined/left, stale event.
- Atomic capacity race at last slot.
- Moderator cannot act outside assigned room; student cannot moderate.
- Cancel live room invokes LiveKit service adapter.
- Questions count/pagination >100; chat persistence/replay >5,000.

LiveKit server SDK/RoomService harus dibungkus adapter dan difake pada integration test. Satu nightly suite dapat memakai real LiveKit test project dengan credential dari CI secret store.

## Web component

- Lobby permission matrix and track cleanup.
- Exactly one Room/connect for one join; rerender/tab changes do not reconnect.
- Reconnecting/reconnected/degraded/disconnected UI.
- Autoplay blocked -> visible recovery -> audio playing.
- Track published before/after participant, subscribed/unsubscribed/replaced after reconnect.
- Device switch/unplug does not create duplicate local publication.
- Participant/attendance/chat list virtualization and render budget.

## Flutter

- Delayed connect then dispose cleans the local Room.
- Rapid retry remains single-flight.
- Lobby preferences are honored.
- Permission denied by kind; app background/foreground; room events and track replacement.
- ParticipantTile detaches old listener and renderer after participant/track change.

## E2E multi-browser

Gunakan Playwright dengan 2-8 isolated browser contexts, fake media devices, dan test LiveKit project:

1. teacher + student join/leave;
2. mic/camera toggle and device switch;
3. teacher screen share; student screen share rejected;
4. participant late join and leave;
5. chat send/ack/replay/dedupe;
6. question and moderation authorization;
7. reconnect without a second Room/token request;
8. cancel/end disconnects all participants with correct reason;
9. repeated 50 join/leave loop with heap/WebRTC resource check.

Assertions harus memeriksa media (`inbound-rtp` bytes/packets/audioLevel or synthetic tone/frame), bukan hanya participant tile.

## Chaos

- Offline 1-3s, 5-10s, 30s; restore.
- WiFi/mobile handoff proxy simulation and physical-device pass.
- Latency 100/300/800ms, jitter 30/100/300ms, packet loss 1/5/15%, bandwidth step-down.
- WebSocket/signaling interruption versus media path interruption.
- Rapid join/leave, 20x mute, camera, device switch.
- Sleep/wake, tab background/foreground, app background/foreground.

Use browser network controls for HTTP/signaling where possible and OS proxy/network conditioner (for example Toxiproxy/Chrome DevTools/`tc` in Linux CI) for media-aware scenarios. Document limitations: Playwright `setOffline` alone does not reliably model UDP/WebRTC packet loss.

## Performance gates

- No duplicate event listeners after 50 mounts.
- No live `MediaStreamTrack`/RTCPeerConnection after leave and settle.
- Heap growth <=10% after GC relative to steady baseline.
- Chat 5k: no long task >200ms; p95 interaction <100ms.
- Participant state event does not rerender every visible tile unless that row changed.

## Baseline audit result

- `tsc --noEmit`: PASS on 11 Aug 2026.
- Flutter `analyze`: dependency resolution completed but analyzer did not finish after several minutes and was interrupted; status INCONCLUSIVE, not PASS.
- Existing automated PJJ suites: none.

