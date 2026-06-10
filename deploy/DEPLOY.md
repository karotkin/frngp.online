# Деплой frngp.online

## Где
Сервер `ubnt@192.168.1.10`, каталог `/opt/docker/frngp.online/`.
Публичный IP: `93.85.236.17`, домен `frngp.online` (A-запись на этот IP).

## Архитектура
```
Интернет → nginx-proxy (общий, :80/:443, TLS Let's Encrypt)
            └─ proxy_pass → frngp-web (nginx + basic-auth)
                              ├─ статика сайта
                              └─ /api/ → frngp-rate-api (курс)
                            frngp-db (postgres, только внутр. сеть)
```
- Общий reverse-proxy и certbot живут в `/opt/docker/common/nginx/` — **не наш**, общий для всех сайтов.
- Наш стек: `docker-compose.server.yml` (web/rate-api/db, без публикации портов; web в сети `proxy`).
- vhost: `/opt/docker/common/nginx/conf.d/frngp.online.conf` (копия — `deploy/nginx/frngp.online.conf`).
- Секреты: `/opt/docker/frngp.online/.env` (chmod 600, в git не коммитится).

## Обновить (ручной деплой)
Локально:
```
rsync -az --exclude '.git' --exclude '.DS_Store' --exclude '.env' \
  ./ ubnt@192.168.1.10:/opt/docker/frngp.online/
```
На сервере:
```
cd /opt/docker/frngp.online
docker compose -f docker-compose.server.yml up -d --build
```

## Данные БД (персистентность)
БД хранится в **external**-томе `frngp_pgdata` (объявлен `external: true` в compose).
Не удаляется ни `docker compose down -v`, ни сменой имени проекта/папки. Редеплой
(`up -d --build`) всегда цепляется к тем же данным.
- Свежий хост (один раз): `docker volume create frngp_pgdata`
- Бэкап: `docker exec frngp-db pg_dump -U frngp frngp > backup_$(date +%F).sql`
- Восстановление: `cat backup.sql | docker exec -i frngp-db psql -U frngp -d frngp`

## Сертификат
Выпущен через общий certbot (webroot `/var/www/certbot`). Действует до **2026-09-07**.
Ручное продление:
```
cd /opt/docker/common/nginx
docker compose --profile certbot run --rm certbot renew --webroot -w /var/www/certbot
docker exec nginx-proxy nginx -s reload
```
TODO: авто-продление (cron) — проверить, есть ли общий механизм для остальных сайтов в root-cron.

## TODO (обсуждали «потом»)
- Авто-деплой образа (по аналогии с остальными сайтами — `ghcr.io/karotkin/*` через CI/CD).
- Авто-продление сертификатов (cron `certbot renew` + reload).
