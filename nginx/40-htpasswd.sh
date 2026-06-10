#!/bin/sh
# Генерируем .htpasswd из переменных окружения при старте контейнера.
# Пароль кладётся bcrypt-хэшем (htpasswd -B), не в открытом виде.
set -e

HTPASSWD_FILE=/etc/nginx/.htpasswd

if [ -z "$BASIC_AUTH_USER" ] || [ -z "$BASIC_AUTH_PASS" ]; then
  echo "[htpasswd] ВНИМАНИЕ: BASIC_AUTH_USER/BASIC_AUTH_PASS не заданы — вход открыт!" >&2
  # пустой файл, чтобы nginx не падал на отсутствии auth_basic_user_file
  : > "$HTPASSWD_FILE"
  exit 0
fi

# -c create, -B bcrypt, -b пароль из аргумента
htpasswd -cbB "$HTPASSWD_FILE" "$BASIC_AUTH_USER" "$BASIC_AUTH_PASS" >/dev/null 2>&1
# nginx-воркер (user nginx) должен иметь право чтения файла
chmod 644 "$HTPASSWD_FILE"
echo "[htpasswd] basic-auth включён для пользователя '$BASIC_AUTH_USER' (bcrypt)"
