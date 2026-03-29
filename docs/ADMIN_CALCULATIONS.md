# Админка money-ui ↔ сервис calculations

Схема БД: миграции `000001_init.up.sql`, `000002_auth.up.sql`, `000003_username.up.sql` в репозитории calculations.

| Таблица (`calculations.*`) | REST (prefix `/api/v1/calculations`) | Примечание |
|---------------------------|--------------------------------------|------------|
| `person` (`login` = телефон, `username`, `password_hash`) | `POST/GET/PATCH/DELETE /persons`, `GET /persons/:id` | `GET` — для всех; `POST`/`PATCH`/`DELETE` — только **banker** или **admin** (JWT). В ответах для banker/admin поле `roles`. `PATCH`: частичное тело + опционально `password`, `roles` (полная замена ролей) |
| `user_role` | назначение через `POST /persons` (`roles`) или SQL | `(person_id, role)` где `role` ∈ `banker` \| `client` \| `admin` |
| — | `POST /auth/login` (`identifier`/`phone`, `password`; опц. `role` для явного выбора), `GET /auth/me` | JWT; активная роль из БД, без `role` — авто при нескольких ролях |
| `contract` | `POST/GET/PATCH/DELETE /contracts`, `GET /contracts/:id`, `POST /contracts/:id/recalculate` | Полный CRUD; список `GET /contracts` — опционально `person` (банкир или клиент), `status`; устаревшие `banker`/`client` без `person`; из админки `X-Admin-Context: 1` для banker |
| `payment` | `POST /payments`, `GET/PATCH/DELETE /payments/:id`, `GET /contracts/:id/payments`, **`GET /payments`** с опциональными `contract_id`, `payer_id`, `from_date`+`to_date` | Плоский список платежей — `GET /payments` |
| `balance_snapshot` | **`GET /contracts/:id/snapshots` только чтение** | В админке вкладки нет; снимки на карточке договора и пересчёт через `recalculate` |

Агрегат **`GET /clients/summary`** не является таблицей; в админском UI не используется.
