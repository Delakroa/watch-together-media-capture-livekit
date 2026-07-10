# WT-401 Host controls (play / pause / seek)

## Статус

Завершено.

## Цель

Дать host-у управление воспроизведением: кнопки play/pause, seek-бар и отображение текущего времени / длительности. Управляет напрямую DOM `HTMLVideoElement`, который feed-ит `captureStream()` — гостям состояние синхронизируется автоматически через уже существующий WT-306 playback-state publisher.

Файл на сервер по-прежнему не загружается.

## Поведение

- После успешной публикации файла в `use-room-session` запускается `startHostPlaybackTracking`, которая слушает DOM события `play`, `pause`, `ended`, `timeupdate`, `durationchange` и отражает их в React state.
- `hostPlaybackStatus`: `"idle" | "playing" | "paused" | "ended"`.
- `hostPlaybackCurrentTime` и `hostPlaybackDuration` синхронизируются с видеоэлементом через `timeupdate` / `durationchange`.
- `hostPlay()` вызывает `video.play()`; при rejection устанавливает `hostPlaybackStatus: "paused"` и `hostPlaybackError` с текстом ошибки.
- `hostPause()` вызывает `video.pause()`.
- `hostSeek(seconds)` устанавливает `video.currentTime = Math.max(0, seconds)`.
- Кнопка play недоступна (disabled) когда `hostPlaybackStatus === "ended"`.
- Seek-бар: `onChange` обновляет локальный `seekBarValue` для плавного отображения во время drag; `onPointerUp` вызывает `hostSeek` и сбрасывает `seekBarValue`.
- Cleanup (`stopHostPlaybackTracking`) автоматически вызывается при stop publication, выборе нового файла, leave, close, LiveKit disconnect и unmount.

## Реализация

- `frontend/src/features/rooms/use-room-session.ts` — добавлены `hostPlaybackStatus`, `hostPlaybackCurrentTime`, `hostPlaybackDuration`, `hostPlaybackError`, `hostPlaybackCleanupRef`, `startHostPlaybackTracking`, `stopHostPlaybackTracking`, `hostPlay`, `hostPause`, `hostSeek`.
- `frontend/src/pages/HomePage.tsx` — блок `.host-controls` показывается только когда `filePublicationStatus === "live"`.
- `frontend/src/styles/global.css` — стили `.host-controls`, `.host-controls__buttons`, `.host-controls__play`, `.host-controls__time`, `.host-controls__seek`.
- `frontend/src/features/rooms/use-room-session-host-controls.test.tsx` — тесты: DOM события → state, hostPlay rejection → error, hostSeek negative clamp.
