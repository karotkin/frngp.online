# Мониторинг нод ETH (NodeE) и Base (NodeB) на frngp.online

Реал-метрики **железа + нод** на главной странице. Канал — приватный WireGuard,
хранилище — Prometheus, шейпинг — `node-api`, отрисовка — `telemetry.jsx`.

```
NodeE-VM ─┐ node_exporter:9100 geth:6060 lighthouse:5054 ┐
          ├─ WireGuard (исходящий) ─→ 93.85.236.17:51820/udp
NodeB-VM ─┘ node_exporter:9100 reth:9001 op-node:7300    ┘
web 192.168.1.10 (wg0 10.8.0.1):
  Prometheus ──scrape WG──> node-api ──/api/telemetry──> nginx ──> фронт
```

WG-адреса: **web=10.8.0.1, NodeE=10.8.0.2, NodeB=10.8.0.3**.

Доступ (ключи уже есть):
- web: `ssh ubnt@192.168.1.10`
- NodeE: `ssh -p 1422 <user>@178.163.229.70`
- NodeB: `ssh -p 1522 nb-user@178.163.229.70`

> Все шаги с `sudo` выполняются на хостах (пароль у тебя). Метрики/RPC НЕ публичить —
> только в WG. Единственный публичный новый порт — WG UDP 51820 на web.

---

## РУЧНОЙ ШАГ (1 раз): проброс порта на домашнем роутере
На роутере (93.85.236.17): **port-forward UDP 51820 → 192.168.1.10:51820**.
Без него ноды не дозвонятся до WG-хаба. TCP не нужен, только UDP.

---

## Фаза B — WireGuard

### B1. Установить wireguard на всех трёх хостах
```
sudo apt-get update && sudo apt-get install -y wireguard
```

### B2. Сгенерировать ключи (на КАЖДОМ хосте)
```
umask 077
wg genkey | tee /tmp/wg_priv | wg pubkey > /tmp/wg_pub
echo "PRIV=$(cat /tmp/wg_priv)"; echo "PUB=$(cat /tmp/wg_pub)"
```
Записать PUB каждого хоста — нужны крест-накрест.

### B3. web (хаб) — `/etc/wireguard/wg0.conf`
```
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = <WEB_PRIV>

[Peer]   # NodeE
PublicKey = <NODEE_PUB>
AllowedIPs = 10.8.0.2/32

[Peer]   # NodeB
PublicKey = <NODEB_PUB>
AllowedIPs = 10.8.0.3/32
```
```
sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
sudo ufw allow 51820/udp   # если ufw активен
```

### B4. NodeE-клиент — `/etc/wireguard/wg0.conf`
```
[Interface]
Address = 10.8.0.2/24
PrivateKey = <NODEE_PRIV>

[Peer]   # web hub
PublicKey = <WEB_PUB>
Endpoint = 93.85.236.17:51820
AllowedIPs = 10.8.0.0/24
PersistentKeepalive = 25
```
```
sudo systemctl enable --now wg-quick@wg0
```

### B5. NodeB-клиент — то же, `Address = 10.8.0.3/24`, остальное идентично B4.

### B6. Проверка туннеля
```
# на web:
ping -c2 10.8.0.2 && ping -c2 10.8.0.3
sudo wg show   # должны быть latest handshake у обоих пиров
```

---

## Фаза C — метрики на нодах (bind на WG IP)

### C1. NodeE · Geth — добавить флаги в команду запуска
```
--metrics --metrics.addr 10.8.0.2 --metrics.port 6060
```
(systemd unit или docker-compose geth — отредактировать, перезапустить сервис.)

### C2. NodeE · Lighthouse (beacon)
```
--metrics --metrics-address 10.8.0.2 --metrics-port 5054
```

### C3. NodeB · base-reth — `/opt/base-node/docker-compose.override.yml`
в `RETH_EXTRA_ARGS` добавить:
```
--metrics 10.8.0.3:9001
```
пересоздать: `docker compose up -d --force-recreate execution`

### C4. NodeB · op-node (base-consensus) — включить метрики
проверить флаги (`--metrics.enabled --metrics.addr 10.8.0.3 --metrics.port 7300`
или env), перезапустить `node`.

### C5. node_exporter на ОБЕИХ нодах (docker, bind на WG IP)
```
docker run -d --name node_exporter --restart unless-stopped \
  --net host --pid host \
  -v /:/host:ro,rslave \
  quay.io/prometheus/node-exporter:v1.8.2 \
  --path.rootfs=/host \
  --web.listen-address=10.8.0.2:9100   # NodeB: 10.8.0.3:9100
```

### C6. ufw — разрешить только WG-подсеть к метрикам
```
sudo ufw allow from 10.8.0.0/24 to any port 9100 proto tcp
sudo ufw allow from 10.8.0.0/24 to any port 6060 proto tcp   # NodeE geth
sudo ufw allow from 10.8.0.0/24 to any port 5054 proto tcp   # NodeE lighthouse
sudo ufw allow from 10.8.0.0/24 to any port 9001 proto tcp   # NodeB reth
sudo ufw allow from 10.8.0.0/24 to any port 7300 proto tcp   # NodeB op-node
```
Наружу эти порты НЕ открывать.

---

## Фаза D — деплой сайта (web)

### D1. Залить код
```
rsync -az --exclude '.git' --exclude '.DS_Store' --exclude '.env' \
  ./ ubnt@192.168.1.10:/opt/docker/frngp.online/
```

### D2. Поднять стек (добавились prometheus + node-api)
```
cd /opt/docker/frngp.online
docker compose -f docker-compose.server.yml up -d --build
```

### D3. Проверка
```
# Prometheus видит таргеты UP:
docker exec frngp-prometheus wget -qO- http://localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"' | sort | uniq -c
# node-api отдаёт телеметрию:
docker exec frngp-node-api wget -qO- http://localhost:8080/telemetry | head -c 400
# реальные имена метрик клиентов (сверить с CLIENTS в node-api/server.js):
docker exec frngp-node-api wget -qO- http://localhost:8080/debug/names | tr ',' '\n' | grep -iE 'chain_head|p2p_peers|beacon_head|libp2p|reth_|op_node|op_p2p'
```
Открыть https://frngp.online — карточки клиентов с реальными head/peers/sync.

---

## Сверка имён метрик (важно)
`node-api/server.js` → массив `CLIENTS`: head/peers/synced заданы СПИСКОМ кандидатов.
После C сверить с `/debug/names` и поправить точные имена (особенно op-node:
base-consensus на Rust может звать метрики иначе, чем Go op-node).
