# WT-648 — Desktop backend profile

## Цель

Убрать Redis из runtime первого desktop host, не меняя проверенный Docker и
staging профиль. Desktop host запускается одним JVM-процессом, поэтому
процесс-локальные atomic stores сохраняют те же room-контракты без отдельной
инфраструктуры.

## Реализовано

- Profile desktop отключает Redis auto-configuration и Redis repositories.
- InMemoryRoomStore реализует create idempotency, room join, lifecycle,
  presence и authentication за одним monitor внутри JVM.
- TTL остаётся частью контрактов: idempotency entries и room storage очищаются
  по заданному TTL, а room и presence проверяются по expiresAt и presence TTL.
- InMemoryRateLimiter сохраняет fixed-window budgets REST endpoints в рамках
  одного desktop host.
- InMemoryFeedbackStore сохраняет локальный feedback с существующим retention.
- Docker/staging profile не изменён: Redis реализации остаются его
  единственными beans.

## Проверки

- backend suite проверяет прежние Redis contracts;
- InMemoryRoomStoreTest покрывает idempotency, replay join, stale connection,
  host recovery и close;
- DesktopProfileContextTest подтверждает запуск profile desktop без Redis beans
  и выбор in-memory rate limit и feedback stores.

## Ограничения

Desktop profile рассчитан ровно на один backend process. Его нельзя применять
для публичного или multi-node режима: там Redis остаётся обязательным shared
store. Это foundation для WT-649 Electron host proof, но ещё не installer и не
заменяет физический Windows или macOS LAN smoke.
