# Конвенции проекта

## Контроль области

Одна branch — один backlog ticket. Не смешивать room lifecycle, media lifecycle, chat, voice и infrastructure work в одном изменении.

## Границы репозитория

- `backend/` отвечает за server-side product state и APIs.
- `frontend/` отвечает за product UI и browser media lifecycle.
- `infra/` отвечает за local и deployment infrastructure.
- `poc/` содержит только reference prototypes.
- `docs/` содержит ADR, compatibility notes, quality notes, contracts и handoff reports.

## Приватность

- Не загружать локальные movie files в application backend.
- Не логировать полные local file paths.
- Не коммитить реальные секреты.
- Не помещать LiveKit API secrets во frontend code.

## Документация

Каждый тикет должен обновлять ближайший релевантный документ и фиксировать:

- как запускать;
- что было проверено;
- известные ограничения;
- риски для следующих тикетов.

Документы и пользовательские тексты ведутся на русском. Code identifiers, protocol fields и общепринятые technical names остаются на английском.

## Контракты

- `contracts/openapi.yaml` является source of truth для REST.
- JSON Schema в `contracts/schemas/` является source of truth для WebSocket и shared payload.
- Product endpoint или event не реализуется без контракта и valid/invalid tests.
- Breaking change требует новой API или `schemaVersion`.
- Неизвестный server event игнорируется, неизвестный client command отклоняется.
- DTO не передают domain entity напрямую через API boundary.

## REST и ошибки

- Paths используют lowercase nouns и version prefix `/api/v1`.
- HTTP status отражает transport semantics; `code` уточняет domain reason.
- Ошибки соответствуют `application/problem+json`.
- `correlationId` обязателен во внешней ошибке и безопасном логе.
- `detail` не содержит stack trace, secret, SQL, local path или внутренний hostname.
- Повторяемые create/command endpoints явно определяют idempotency.

## Backend

- Java package names lowercase, classes `PascalCase`, методы и поля `camelCase`.
- Constructor injection предпочтительнее field injection.
- DTO задаются records, когда им не нужна identity или mutable lifecycle.
- Время передается как `Instant` в UTC; duration хранится в миллисекундах.
- Нельзя использовать untyped `Map<String, Object>` вместо известного contract DTO.
- Permission и validation checks выполняются до изменения authoritative state.

## Frontend

- TypeScript работает в strict mode без `any` на API/media boundaries.
- Network и WebSocket payload проверяется runtime schema до попадания в state.
- Server state хранится в TanStack Query, локальный UI state не дублирует authoritative room state.
- Effect с network/media resource обязан иметь cleanup и обработку abort/reconnect.
- Пользовательский текст ошибки определяется по stable error code, а не по raw backend detail.

## Тесты

- Happy path без error path недостаточен.
- Boundary tests проверяют malformed payload, unknown code/event и stale version.
- Исправление дефекта включает regression test.
- Test fixture не содержит реальных secrets и private file paths.

## Команды

Root commands должны оставаться стабильными:

```bash
pnpm contracts:check
pnpm test
pnpm build
pnpm check
```

Ticket-specific commands можно добавлять, но root checks должны оставаться основным quality gate.

## Завершение

Общий checklist находится в [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md).
