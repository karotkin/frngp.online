#!/bin/bash
# Ежедневный бэкап БД frngp в gzip-дамп с ротацией.
# Запуск из cron: 30 3 * * * /opt/docker/frngp.online/deploy/backup.sh >> .../backups/backup.log 2>&1
set -eo pipefail

BACKUP_DIR=/opt/docker/frngp.online/backups
KEEP_DAYS=14
CONTAINER=frngp-db
DB_USER=frngp
DB_NAME=frngp

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y-%m-%d_%H%M%S)
FILE="$BACKUP_DIR/frngp_${TS}.sql.gz"

if docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "${FILE}.tmp"; then
  mv "${FILE}.tmp" "$FILE"
  echo "$(date '+%F %T') OK  -> $FILE ($(du -h "$FILE" | cut -f1))"
else
  rm -f "${FILE}.tmp"
  echo "$(date '+%F %T') FAIL: pg_dump не отработал" >&2
  exit 1
fi

# ротация: удаляем дампы старше KEEP_DAYS
find "$BACKUP_DIR" -name 'frngp_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
