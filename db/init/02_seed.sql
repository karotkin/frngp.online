-- ============================================================
-- frngp.online — сид данными из data.jsx (buildKit / buildAccessories)
-- ============================================================

INSERT INTO app_settings (key, value) VALUES
    ('usd_byn_rate', '3.27')
ON CONFLICT (key) DO NOTHING;

INSERT INTO servers (id, name, role, ip, sort) VALUES
    ('dc',    'ЦОД',    'Хранение · NAS',     '10.0.0.11', 1),
    ('proc',  'ML/AL',  'Compute · ETL',      '10.0.0.12', 2),
    ('parse', 'SNIPER', 'Scraping · Workers', '10.0.0.13', 3),
    ('conv',  'NAS',    'Media · Transcode',  '10.0.0.14', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO purchase_groups (id, label, is_server, sort) VALUES
    ('dc',    'ЦОД',          true,  1),
    ('proc',  'ML/AL',        true,  2),
    ('parse', 'SNIPER',       true,  3),
    ('conv',  'NAS',          true,  4),
    ('acc',   'Сопутствующие', false, 5)
ON CONFLICT (id) DO NOTHING;

-- Позиции сметы намеренно не засеиваются — смета начинается пустой
-- по всем серверам и сопутствующим. Наполняется через интерфейс закупок.
