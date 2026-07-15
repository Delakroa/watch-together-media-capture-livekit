# Локальная инфраструктура

Локальная Docker Compose среда Watch Together, созданная в WT-104.

## Сервисы

| Сервис     | Назначение                                       | Локальный адрес         |
| ---------- | ------------------------------------------------ | ----------------------- |
| `gateway`  | Nginx, React frontend и reverse proxy для `/api` | `http://127.0.0.1:8088` |
| `backend`  | Spring Boot API                                  | `http://127.0.0.1:8080` |
| `livekit`  | WebSocket/HTTP и WebRTC SFU                      | `ws://127.0.0.1:7880`   |
| `postgres` | PostgreSQL                                       | `127.0.0.1:5432`        |
| `redis`    | Redis                                            | `127.0.0.1:6379`        |

LiveKit TCP fallback доступен на `7881`, UDP media range — `50000-50100`.

## Запуск

Из корня репозитория:

```bash
pnpm infra:up
```

Команда собирает backend/frontend images, запускает все сервисы и ждёт успешного прохождения health checks.

Проверить стек отдельно:

```bash
pnpm infra:check
pnpm infra:ps
```

Начиная с WT-301 `infra:check` создаёт комнату через gateway, проверяет guest join, session replay, restore, LiveKit token grants для host/guest, room WebSocket snapshot, reconnect, heartbeat, leave и close.

Открыть приложение:

```text
http://127.0.0.1:8088
```

Посмотреть логи:

```bash
pnpm infra:logs
```

Остановить сервисы без удаления данных:

```bash
pnpm infra:down
```

Удалить сервисы вместе с локальными PostgreSQL/Redis volumes:

```bash
pnpm infra:reset
```

## Настройка

Compose работает с локальными значениями по умолчанию, поэтому `.env` не обязателен.

Чтобы переопределить порты или credentials:

```bash
cp infra/.env.example infra/.env
```

Docker Compose автоматически читает `infra/.env`, если команда запускается с `--env-file infra/.env`. Корневые команды используют значения по умолчанию; собственный файл можно передать напрямую:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml up --build -d --wait
```

Все значения из `.env.example` предназначены только для локальной разработки. Их нельзя использовать в production или публиковать как реальные секреты.

## Данные

PostgreSQL и Redis используют named volumes:

- `watch-together_postgres-data`;
- `watch-together_redis-data`.

Обычный `pnpm infra:down` сохраняет данные. `pnpm infra:reset` удаляет их без возможности восстановления.

## Проверка между домашними компьютерами (LAN)

Обычный запуск намеренно доступен только на MacBook. Чтобы проверить комнату с
Windows-компьютера в **той же приватной домашней сети**, не меняйте
`compose.yaml` и не открывайте router port forwarding:

```bash
cp infra/lan.env.example infra/lan.env
```

В `infra/lan.env` заменить `192.168.1.42` на текущий private IPv4 MacBook.
Затем перезапустить стек в opt-in LAN-режиме:

```bash
pnpm infra:down
pnpm infra:lan:up
```

Windows открывает `http://<MacBook-private-IP>:8088`. Gateway и LiveKit
сигналинг будут доступны в LAN; backend, Redis и PostgreSQL останутся на
loopback. `lan.env` задаёт тот же LAN URL для backend token response и
frontend build: это необходимо, иначе Windows попытается подключиться к
собственному `127.0.0.1`. После проверки вернуть обычный закрытый режим:

```bash
pnpm infra:lan:down
pnpm infra:up
```

Этот режим не является staging или production: нет TLS, public TURN и
secure-cookie semantics. Браузеры по правилам безопасности не дают доступ к
микрофону на `http://<private-IP>`: в LAN проверяйте room/file/chat, а голос —
только через `https` staging или `localhost`. Не используйте этот режим с
публичным IP, пробросом портов на router, VPN exit node или облачной VM.

## Границы

Эта среда нужна для воспроизводимой локальной проверки. Бэкенд использует Redis для room state и idempotency; PostgreSQL пока не подключён к product state.

TLS, публичный TURN, monitoring stack и beta deployment находятся вне области WT-104.

## Beta deployment notes

WT-508 добавляет только repo-side подготовку к закрытой beta. Перед публичным запуском нужен внешний TLS/TURN/monitoring слой.

Минимальные production overrides:

- `SESSION_COOKIE_SECURE=true`;
- реальные `REDIS_PASSWORD`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`;
- `LIVEKIT_URL=wss://<livekit-public-host>` — URL, который backend возвращает в token response;
- `PUBLIC_LIVEKIT_URL=wss://<livekit-public-host>` — URL, который встраивается во frontend build;
- `LIVEKIT_NODE_IP=<public-or-private-routable-ip>` — адрес LiveKit для ICE candidates;
- `FEEDBACK_ADMIN_TOKEN=<secret>` — включает WT-605 operator endpoints (list/export/triage); без него beta feedback только пишется, но не читается;
- `WT_CSP_CONNECT_SRC='self' wss://<livekit-public-host>` — сужает CSP `connect-src` под фиксированный beta-host (WT-606);
- rate limiting (WT-606) включён по умолчанию; `RATE_LIMIT_*` overrides — в `application.yml`;
- TLS termination должен выставлять `Strict-Transport-Security` и прокидывать `X-Forwarded-Proto`.

После деплоя:

```bash
WT_BETA_BASE_URL=https://<app-host> WT_BETA_LIVEKIT_URL=wss://<livekit-public-host> pnpm beta:smoke
```

## Reproducible staging bootstrap

Для реального WT-610 не открывайте `compose.yaml` наружу: он предназначен для
локальной разработки. [staging/](staging/) содержит application compose,
env-template и Caddy route fragment для Linux VM, на котором LiveKit +
embedded TURN/TLS подняты official generator-ом. Этот путь разделяет Redis
databases, оставляет backend/gateway на loopback и фиксирует DNS/firewall,
TLS, rollback и публичные smoke-команды.
