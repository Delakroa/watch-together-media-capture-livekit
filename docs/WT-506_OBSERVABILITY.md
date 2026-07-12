# WT-506 Observability dashboard

## Статус

Завершено для backend room-метрик. Клиентские метрики (first frame, publish failure, TURN ratio, quality) — follow-up (см. ниже).

## Цель

Дать наблюдаемость по жизненному циклу комнаты: аггрегированные метрики для внешнего дашборда (Prometheus scrape), privacy-safe (без идентификаторов и PII). Сами counters — источник для funnel и алертов.

## Реализация

- `backend/build.gradle.kts` — добавлен `io.micrometer:micrometer-registry-prometheus`; `backend/gradle.lockfile` перегенерирован (`--write-locks`).
- `application.yml` — `management.endpoints.web.exposure.include: health,info,metrics,prometheus`.
- `RoomMetrics` (`@Component`) — Micrometer counters, инкрементируются в `RoomWebSocketHandler` (единственная точка инструментирования — она уже видит все нужные события через `RoomEventPublisher` и WS-обработчики, поэтому изменение не задело сервисы и их unit-тесты):
  - `wt.ws.connections` — установленные room WebSocket соединения;
  - `wt.room.participants.joined` / `wt.room.participants.left`;
  - `wt.room.closed{reason}` — закрытия по причине (`HOST_CLOSED` / `EXPIRED` / `HOST_TIMEOUT`);
  - `wt.host.disconnected` / `wt.host.reconnected`;
  - `wt.chat.messages` / `wt.chat.rate_limited`.
- Тест: `RoomWebSocketIntegrationTest.recordsMetricsForWebSocketConnectionsAndChat` проверяет инкремент counters через `MeterRegistry`.

## Соответствие областям WT-506

- **Room funnel / reconnect** — joined/left/closed{reason} + host.disconnected/reconnected + ws.connections.
- **Chat abuse** — chat.messages / chat.rate_limited.
- **First frame / publish failure / TURN ratio / quality** — это клиентские (LiveKit) метрики; сейчас отражаются в UI (WT-405 quality indicators), в backend-дашборд не репортятся — см. follow-up.

## Приватность и доступ

- Метрики только аггрегированные: счётчики + низкокардинальный тег `reason`. Никаких `roomId` / `participantId` / имён / IP.
- Эндпоинты `metrics` / `prometheus` НЕ добавлены в `SecurityConfig` permitAll — остаются за security-цепочкой. Скрейп должен идти по внутренней сети или через отдельный management-порт (deployment-заметка).

## Проверка

```bash
./gradlew :backend:build
```

Локально: `:backend:build` зелёный (все backend-тесты, lockfile консистентен); metrics-тест подтверждает инкремент counters; при запущенном стенде counters доступны на `/actuator/prometheus` (за security).

## Известные ограничения / следующие шаги

- `room.created`, join-failures и token mint/deny живут в сервисах/`ApiExceptionHandler` (unit-тесты создают их через `new` / `@WebMvcTest` без `MeterRegistry`), поэтому их инструментирование требует изменения конструкторов/тестов — вынесено в follow-up, чтобы не раздувать blast radius.
- Клиентские метрики (first frame, publish failure, TURN ratio, quality) требуют privacy-safe telemetry endpoint (клиент → backend) — отдельный шаг.
- Сам дашборд (Grafana/Prometheus) — деплой/инфра; этот тикет даёт scrapeable-метрики, которые он потребляет.
