#!/bin/bash
# Экспортёр прогресса staged-sync reth (NodeB) в textfile-коллектор node_exporter.
# Парсит docker logs reth → пишет /var/lib/node_exporter/textfile/reth_sync.prom.
# Запускается как systemd-сервис (бесконечный цикл, sleep 30).
set -u
OUT=/var/lib/node_exporter/textfile/reth_sync.prom
CONT=base-node-execution-1
INTERVAL="${INTERVAL:-30}"

while true; do
  LOG=$(docker logs --tail 400 "$CONT" 2>&1)
  # реальный индекс/имя из лога reth: "pipeline_stages":"N/M","stage":"X","checkpoint":"..","target":".."
  line=$(echo "$LOG" | grep -oE '"pipeline_stages":"[0-9]+/[0-9]+","stage":"[A-Za-z]+","checkpoint":"[0-9]+","target":"[0-9]+"' | tail -1)
  live=$(echo "$LOG" | grep -c "Block added to canonical chain")
  total=14

  if [ -n "$line" ]; then
    idx=$(echo "$line"   | sed -E 's#.*"pipeline_stages":"([0-9]+)/[0-9]+".*#\1#')
    total=$(echo "$line" | sed -E 's#.*"pipeline_stages":"[0-9]+/([0-9]+)".*#\1#')
    stage=$(echo "$line" | sed -E 's/.*"stage":"([A-Za-z]+)".*/\1/')
    cp=$(echo "$line"    | sed -E 's/.*"checkpoint":"([0-9]+)".*/\1/')
    tg=$(echo "$line"    | sed -E 's/.*"target":"([0-9]+)".*/\1/')
    synced=0
  else
    stage="live"; cp=0; tg=0; idx=$total; synced=1
  fi
  [ "$live" -gt 0 ] && synced=1

  TMP="${OUT}.$$"
  {
    echo "# HELP reth_sync_stage_checkpoint Current block of active reth staged-sync stage"
    echo "# TYPE reth_sync_stage_checkpoint gauge"
    echo "reth_sync_stage_checkpoint{stage=\"$stage\"} ${cp:-0}"
    echo "# TYPE reth_sync_stage_target gauge"
    echo "reth_sync_stage_target{stage=\"$stage\"} ${tg:-0}"
    echo "# TYPE reth_sync_stage_index gauge"
    echo "reth_sync_stage_index ${idx}"
    echo "# TYPE reth_sync_stage_total gauge"
    echo "reth_sync_stage_total ${total:-14}"
    echo "# TYPE reth_sync_live gauge"
    echo "reth_sync_live ${synced}"
  } > "$TMP" && mv -f "$TMP" "$OUT"

  sleep "$INTERVAL"
done
