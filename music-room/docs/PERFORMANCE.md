# Ramp-up (load capacity)

Tool: [autocannon](https://github.com/mcollina/autocannon) (`make bench`, script `backend/bench.js`).
Each scenario hits one of the 3 services with realistic mixed traffic (reads + writes) from 200 authenticated users
for 6–8 s at an increasing number of simultaneous connections. Rate limiting is disabled for the test (otherwise we would measure the limiter).

## Test platform
| | |
|---|---|
| Server | Cloud VM (premise-equivalent), Intel Xeon 2.3 GHz, **4 vCPU, 16 GiB RAM**, Linux, Node 22 |
| Process | **1** Node.js process (single thread for JS) + SQLite (WAL) on local disk |
| Client | autocannon on the **same machine** (competes for CPU: real numbers are a bit better with a separate load generator) |

## Results (6 s per line)
| Service | connections | req/s | p50 ms | p99 ms | non-2xx | errors |
|---|---|---|---|---|---|---|
| Track Vote (read queue + vote/unvote) | 10 | 1167 | 7 | 18 | 0 | 0 |
| Track Vote | 50 | 1242 | 36 | 89 | 0 | 0 |
| Track Vote | 100 | 1275 | 72 | 161 | 0 | 0 |
| Track Vote | 250 | 1335 | 96 | 1744 | 0 | 0 |
| Track Vote | 500 | 1320 | 96 | 2032 | 0 | 0 |
| Playlist Editor (read + move) | 10 | 1333 | 6 | 17 | 0 | 0 |
| Playlist Editor | 50 | 1458 | 32 | 55 | 0 | 0 |
| Playlist Editor | 100 | 1442 | 64 | 97 | 0 | 0 |
| Playlist Editor | 250 | 1426 | 92 | 1815 | 0 | 0 |
| Playlist Editor | 500 | 1380 | 102 | 1725 | 0 | 0 |
| Control Delegation (commands) | 10 | 2640 | 3 | 11 | 0 | 0 |
| Control Delegation | 50 | 2467 | 17 | 40 | 0 | 0 |
| Control Delegation | 100 | 2543 | 34 | 95 | 0 | 0 |
| Control Delegation | 250 | 2584 | 63 | 899 | 0 | 0 |
| Control Delegation | 500 | 2073 | 72 | 1211 | 0 | 0 |

## Interpretation
* Throughput saturates around **1.3–1.4 k req/s** for the heaviest service (writes serialised by SQLite `BEGIN IMMEDIATE`, which is exactly what guarantees correct concurrent voting/moving) and **~2.5 k req/s** for device commands. **No error or non-2xx up to 500 simultaneous connections.**
* p99 stays < 200 ms up to 100 connections; beyond ~250 connections requests queue (p99 ≈ 1–2 s) but nothing fails: that is the saturation knee.
* A user generates roughly one request every 5–10 s (votes, edits) + a WebSocket (idle most of the time), so **1 k req/s ≈ 5 000–10 000 simultaneously active users**; we **claim ~1 000 simultaneous users with comfortable latency (p99 < 200 ms)** on this 4 vCPU machine, and ~3 000 before degrading. WebSocket connections are cheap (a few KB each).
* Consistent with the platform: a Raspberry Pi would sustain dozens to a few hundred users, a low-end cloud VM thousands.

## How to scale beyond
Cluster mode / several instances behind a load balancer need a shared DB (PostgreSQL) and a pub/sub (Redis) for the WebSocket hub and rate limiter, which are already isolated behind `publish()` and `rateLimit()`.
