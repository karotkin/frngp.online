-- ============================================================
-- frngp.online — схема под закупки парка и серверы
-- выполняется автоматически при первом старте контейнера postgres
-- ============================================================

-- настройки приложения (курс USD->BYN и пр.)
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- серверы парка
CREATE TABLE IF NOT EXISTS servers (
    id    TEXT PRIMARY KEY,        -- dc / proc / parse / conv
    name  TEXT NOT NULL,
    role  TEXT,
    ip    TEXT,
    sort  INT  NOT NULL DEFAULT 0
);

-- группы закупки: каждый сервер + общая группа "сопутствующие"
CREATE TABLE IF NOT EXISTS purchase_groups (
    id        TEXT PRIMARY KEY,    -- = servers.id, либо 'acc'
    label     TEXT NOT NULL,
    is_server BOOLEAN NOT NULL DEFAULT true,
    sort      INT NOT NULL DEFAULT 0
);

-- позиции сметы (цена хранится как ввёл пользователь: price + валюта cur)
CREATE TABLE IF NOT EXISTS purchase_items (
    id         BIGSERIAL PRIMARY KEY,
    group_id   TEXT NOT NULL REFERENCES purchase_groups(id) ON DELETE CASCADE,
    category   TEXT NOT NULL DEFAULT 'Прочее',
    item       TEXT NOT NULL DEFAULT '',
    qty        INT NOT NULL DEFAULT 1 CHECK (qty >= 0),
    price      NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (price >= 0),
    cur        TEXT NOT NULL DEFAULT 'usd' CHECK (cur IN ('usd','byn')),
    sort       INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_group ON purchase_items(group_id);
