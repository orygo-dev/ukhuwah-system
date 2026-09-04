# Arsitektur PJJ GenPro (as-is)

Tanggal audit: 11 Agustus 2026

## Scope dan versi

- Web: Next.js 15.5.19, React 19, `livekit-client` 2.21.0, `@livekit/components-react` 2.9.23.
- Server: Next.js route handlers, Prisma 6, `livekit-server-sdk` 2.17.0.
- Mobile: Flutter, `livekit_client` 2.3.1+hotfix.1.
- Provider dapat dikonfigurasi sebagai LiveKit Cloud atau self-hosted melalui platform setting; request menyebut Cloud, tetapi source masih mendukung keduanya.

## Diagram aktual

```text
GenPro Web / Flutter Client
  -> cookie/session authentication (NextAuth)
  -> Next.js page/API authorization
  -> POST /api/livekit/token { liveSessionId }
     -> getLiveSessionAccess()
     -> Prisma: LiveClassSession/ClassRoom/assignment/enrollment
     -> liveClassParticipant.upsert() [saat ini dilakukan sebelum koneksi media]
     -> AccessToken (identity user:<userId>, room, grants, metadata role)
  -> LiveKit Cloud WebSocket URL + JWT
  -> LiveKit Room (roomName tersimpan di LiveClassSession)
  -> Local/Remote Participants
  -> Track publications/subscriptions
     -> web: LiveKitRoom + VideoConference + RoomAudioRenderer
     -> mobile: Room + VideoTrackRenderer
  -> UI video/audio/control/chat/whiteboard/question/attendance

LiveKit Cloud
  -> POST /api/livekit/webhook
  -> WebhookReceiver signature validation
  -> LiveKitWebhookEvent deduplication row
  -> LiveClassSession / LiveClassParticipant / AttendanceRecord
```

## Frontend web

Entry point room adalah `src/app/pjj/room/[sessionId]/page.tsx`. Server component mengautentikasi user, memanggil `getLiveSessionAccess`, lalu merender `LiveClassRoomClient`.

`LiveClassRoomClient` memiliki fase lokal `lobby | joining | live`. Token baru diminta setelah klik join. Setelah token tersedia, komponen memasang satu `LiveKitRoom`, dengan key `roomName`, `connect=true`, dan preferensi audio/video dari lobby. `LiveKitRoom` versi terpasang membuat satu `Room`, menjalankan `connect()`, melepas event listener, dan `disconnect()` pada unmount. Source aplikasi tidak membuat `Room` web secara manual.

`VideoConference` menyediakan grid/focus/carousel, pagination, control bar, input-device menu, screen share, `RoomAudioRenderer`, tombol pemulihan autoplay (`StartMediaButton`), serta toast connecting/reconnecting/disconnected. Aplikasi menambahkan header, panel peserta/moderasi, absensi, whiteboard, pertanyaan, dan chat custom.

Konfigurasi web tidak mengirim `options` ke `LiveKitRoom`. Pada `livekit-client` 2.21.0 yang terpasang, `adaptiveStream=false`, `dynacast=false`, dan `autoSubscribe=true` secara default.

## Backend, token, identity, dan permission

- Token endpoint: `src/app/api/livekit/token/route.ts`.
- Identity deterministik: `user:<database user id>`. Ini mencegah dua participant aktif untuk user yang sama; tab terbaru akan menggantikan koneksi lama.
- Room name dibuat ketika sesi dijadwalkan: `pjj-<class suffix>-<timestamp>-<random hex>` dan disimpan unik di database.
- Semua role memperoleh `roomJoin`, `canPublish`, `canSubscribe`, dan `canPublishData`.
- `TEACHER`, `TUTOR`, dan `MODERATOR` juga memperoleh `roomAdmin`.
- Tidak ada `canPublishSources` per role dan tidak ada `RoomConfiguration.maxParticipants` pada token/room creation.
- API secret hanya dibaca server-side dari environment atau setting terenkripsi. Tidak ditemukan `NEXT_PUBLIC_LIVEKIT_API_SECRET` atau secret LiveKit di client.

## Role/authorization aktual

- Super admin -> moderator.
- Teacher owner atau assignment aktif -> teacher/tutor.
- Student aktif harus berada di ClassRoom sesi dan memiliki enrollment program berstatus `PENDING`, `ACTIVE`, atau `AT_RISK`.
- School/province admin tidak otomatis boleh join room.
- Endpoint moderation/attendance/question update mengulang authorization server-side; privilege tidak hanya berasal dari UI.

## Media dan device aktual

Web lobby memanggil `getUserMedia` untuk preview, menghentikan track ketika preferensi berubah atau join. Setelah connect, LiveKit memublikasikan mic/camera sesuai preferensi. Control bar menangani toggle, input device switching, screen sharing, remote audio attachment, dan autoplay recovery. Speaker/output selection eksplisit tidak tersedia.

Mobile meminta izin kamera dan mic sekaligus, membuat `Room(adaptiveStream: true, dynacast: true)`, memanggil `prepareConnection()` lalu `connect()`, dan selalu mencoba menyalakan mic. Lobby mobile tidak memakai camera stream sebenarnya dan preferensinya tidak diteruskan ke `LiveClassScreen`.

## Data/chat/whiteboard

- Chat web menggunakan reliable LiveKit data packets, disimpan hanya di React state, maksimum 200 pesan.
- ID chat dibuat client-side; dedup hanya berdasarkan ID dalam state lokal.
- Whiteboard mengirim seluruh stroke sebagai reliable packet; state hanya memory client dan tidak memiliki snapshot/backend persistence.
- Questions dan attendance memakai API/database sebagai source of truth; LiveKit data packet hanya menjadi invalidation signal.
- Mobile chat saat ini hanya UI placeholder dan tidak mengirim data.

## Reconnect dan cleanup aktual

SDK LiveKit menangani reconnect otomatis. Web prefab menampilkan toast reconnect; aplikasi tidak memiliki state machine/domain diagnostics sendiri dan tidak mendengarkan `Reconnecting`, `Reconnected`, connection quality, track subscribe/unsubscribe, atau device change. `onDisconnected` mengembalikan user ke lobby untuk semua disconnect final.

Web listener custom dan timer yang ditemukan memiliki cleanup. Flutter melepaskan listener, memanggil disconnect/dispose pada `_room`, tetapi room belum disimpan ke `_room` selama operasi connect; unmount/retry pada fase tersebut dapat meninggalkan room in-flight.

## Observability aktual

Belum ada correlation/session ID client, structured event log, metrics join/reconnect/media, atau diagnostics bundle. Database menyediakan kolom `connectionQuality`, tetapi tidak ada source yang menulisnya. Logging saat ini terbatas pada beberapa `console.error` server.

## Referensi resmi yang dipakai

- [Connecting and reconnect lifecycle](https://docs.livekit.io/intro/basics/connect/)
- [Webhooks, retries, and connection events](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/)
- [Tokens and grants](https://docs.livekit.io/home/server/generating-tokens)
- [Adaptive/selective subscription](https://docs.livekit.io/guides/room/receive)
- [Data packet reliability](https://docs.livekit.io/transport/data/packets/)
- [LiveKit Cloud quotas and media subscription limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/)

