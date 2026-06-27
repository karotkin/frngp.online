# Base mainnet node — reth discovers peers but never holds RLPx sessions (0 peers), EL sync of snapshot→head gap stalls

## Summary
Running a Base **mainnet** node from the official `base/node` repo (latest, `versions.env` → base/base **v1.1.1**, `base-reth-node 2.3.0-dev (9384bc5)` + `base-consensus`) via Docker. The node is in a **datacenter behind NAT**: outbound works fine, but there is **no inbound DNAT** for P2P (only SSH is port-forwarded). We run the stack with `network_mode: host`.

We restored from the **official pruned reth snapshot** (`base-mainnet-pruned-reth-1781849953.tar.zst`). reth comes up at block **47,530,287 (0x2d5412f)**, ~2 days behind head. The remaining gap to head will not sync because **reth holds 0 EL peers**, indefinitely.

## What works
- **op-node / base-consensus**: connects to our own L1 (Geth+Lighthouse, fully synced, reachable over LAN), follows the Base head via gossip, inserts unsafe payloads and sends `forkchoiceUpdated` to reth. Engine API + JWT OK.
- **reth discv5 discovery works** (on host networking): it sends FINDNODE and receives NODES responses with dozens of Base EL ENRs. (On docker bridge networking discv5 got no responses — host networking fixed discovery.)
- **Egress is fine**: raw TCP from the host to live Base EL peers (e.g. `216.144.245.121:30303`, `40.160.32.19:30303`, `131.153.232.233:30342`) connects in 30–200 ms.

## The problem
- reth: `stage: Headers, checkpoint: 47530287, target: None`, `connected_peers: 0` for 30+ minutes continuously.
- Occasionally a burst of ~19 outbound session attempts appears, then immediately back to 0 — **RLPx sessions never stick**.
- Tried `--trusted-peers` + `--bootnodes` with the live enodes above (raw TCP to them is OPEN) — still 0 held peers, reth does not even maintain TCP to the trusted peers.
- base-consensus is stuck in `AwaitingELSyncCompletion`, `confirmed_safe_head: 0`, "Skipping derivation" on every L1 head update — it waits for reth EL sync to complete, which never happens because reth has no peers.
- reth advertises `enode://...@178.163.229.70:30303?discport=9200` (the DC's public NAT IP); inbound to 30303/9200 is **not** reachable from the internet.
- Warning on startup from the snapshot DB: `Storage settings mismatch detected. Using the stored settings... stored: storage_v2: false, requested: storage_v2: true`.

## Questions
1. For a node **behind NAT (outbound-only, inbound-unreachable)** — is inbound reachability on `:30303`/`:9200` **required** for base-reth to hold EL peers on Base mainnet? (Our L1 Ethereum node syncs fine outbound-only, but Base's EL network is smaller.)
2. Is there a way to make **base-consensus / op-node derive the snapshot→head gap from L1** (consensus-layer / derivation sync) instead of waiting for reth EL P2P sync? We didn't find a sync-mode flag in `base-consensus node --help`.
3. Is the **`storage_v2: false` vs `true` mismatch** from the pruned snapshot a problem, or expected/benign?
4. Any recommended `--bootnodes` / `--trusted-peers` (ENR format) for the Base **EL** network, or required discovery config we're missing?

## Environment
- base/node latest; base-reth-node 2.3.0-dev (9384bc5); base-consensus; Docker host networking.
- reth flags: `--chain base --discovery.port=30303 --discovery.v5.port=9200 --port=30303 --max-outbound-peers=100 --rollup.sequencer-http=https://mainnet-sequencer.base.org`.
- L1: own Geth+Lighthouse, reachable on LAN, fully synced.
