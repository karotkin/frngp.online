#!/bin/bash
# Экспортёр прогресса staged-sync reth (NodeB) в textfile-коллектор node_exporter.
# Парсит docker logs reth → пишет /var/lib/node_exporter/textfile/reth_sync.prom.
# Запускается как systemd-сервис (бесконечный цикл, sleep 30).
set -u
OUT=/var/lib/node_exporter/textfile/reth_sync.prom
CONT=base-node-execution-1
INTERVAL="${INTERVAL:-30}"

# индекс стадии (порядок пайплайна, всего 14)
stage_index() {
  case "$1" in
    Headers) echo 1;; Bodies) echo 2;; SenderRecovery) echo 3;;
    Execution) echo 4;; MerkleExecute|MerkleUnwind|MerkleChangeSets) echo 5;;
    AccountHashing) echo 6;; StorageHashing) echo 7;;
    TransactionLookup) echo 8;; IndexAccountHistory) echo 9;;
    IndexStorageHistory) echo 10;; PruneSenderRecovery) echo 11;;
    Prune) echo 12;; Era) echo 13;; Finish) echo 14;; *) echo 0;;
  esac
}

while true; do
  LOG=$(docker logs --tail 400 "$CONT" 2>&1)
  line=$(echo "$LOG" | grep -oE '"stage":"[A-Za-z]+","checkpoint":"[0-9]+","target":"[0-9]+"' | tail -1)
  live=$(echo "$LOG" | grep -c "Block added to canonical chain")

  if [ -n "$line" ]; then
    stage=$(echo "$line" | sed -E 's/.*"stage":"([A-Za-z]+)".*/\1/')
    cp=$(echo "$line"   | sed -E 's/.*"checkpoint":"([0-9]+)".*/\1/')
    tg=$(echo "$line"   | sed -E 's/.*"target":"([0-9]+)".*/\1/')
    idx=$(stage_index "$stage")
    synced=0
  else
    stage="live"; cp=0; tg=0; idx=14; synced=1
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
    echo "reth_sync_stage_total 14"
    echo "# TYPE reth_sync_live gauge"
    echo "reth_sync_live ${synced}"
  } > "$TMP" && mv -f "$TMP" "$OUT"

  sleep "$INTERVAL"
done
