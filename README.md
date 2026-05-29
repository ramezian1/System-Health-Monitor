# 🖥️ System Health Monitor

A real-time, web-based dashboard for monitoring the health of any machine it runs on —
CPU, memory, disk, network, and processes — pushed live to your browser over WebSockets,
with threshold alerting and historical trends.

Built with **Flask**, **Flask-SocketIO**, **psutil**, and **Chart.js**.

---

## What it is

System Health Monitor turns the box it runs on into an observable server. Point your
browser at it and you get a live, auto-updating dashboard — no page refreshing — backed by
a lightweight SQLite store so you can also look back at the last hour, 6 hours, or day.

It's small enough to run on a Raspberry Pi and useful enough to leave running 24/7 on a VPS.

## What it does

- **Live metrics, pushed every 2 seconds** over a WebSocket (with a REST fallback):
  - **CPU** — overall %, per-core breakdown, core counts, clock speed, temperature (where supported)
  - **Memory** — used / available / total and swap usage
  - **Disk** — per-partition usage plus read/write throughput
  - **Network** — upload/download speed, totals, packets, active connections
  - **Processes** — top 10 by CPU and top 10 by RAM, switchable in the table
- **At-a-glance stat cards** with green → yellow → red color coding as usage climbs
- **Charts** — live CPU line (last 60 s), RAM doughnut, per-disk bar, dual-line network
- **Threshold alerting** — when CPU/RAM/disk cross configured limits it flashes a banner,
  records the event in an in-app alert history panel, and appends to `alerts.log`
- **Historical trends** — snapshots are saved to SQLite every 60 s and charted over 1h / 6h / 24h
- **Login screen** (Flask session auth) so the dashboard isn't wide open
- **Light / dark theme** toggle that remembers your choice
- **Responsive** — works on phone, tablet, and desktop

---

## Project structure

```
System-Health-Monitor/
├── app.py               # Flask app: routes, SocketIO broadcaster, SQLite, alerting
├── monitor.py           # psutil data collection (CPU, RAM, disk, network, processes)
├── config.py            # Thresholds, credentials, intervals, paths
├── requirements.txt
├── templates/
│   ├── index.html       # Dashboard
│   └── login.html       # Login page
└── static/
    ├── css/style.css    # Theme + responsive layout
    └── js/dashboard.js  # Charts, SocketIO client, alert handling
```

---

## Setup

**Requirements:** Python 3.9+

```bash
# 1. Clone
git clone https://github.com/ramezian1/System-Health-Monitor.git
cd System-Health-Monitor

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
```

## Usage

```bash
python app.py
```

Then open **http://localhost:5000** and log in.

> **Default credentials:** `admin` / `admin` — change these before exposing the app
> (see Configuration below).

The dashboard connects automatically and starts streaming live data. Drive up some load
(e.g. `yes > /dev/null` for CPU) to watch the cards change color and trip an alert.

---

## Configuration

Settings live in `config.py` and can be overridden with environment variables — handy for
deployment so you never commit secrets.

| Setting | Env var | Default | Purpose |
|---|---|---|---|
| Secret key | `SECRET_KEY` | `dev-secret-key-change-in-prod` | Flask session signing — **set this in production** |
| Username | `DASHBOARD_USERNAME` | `admin` | Login username |
| Password | `DASHBOARD_PASSWORD` | `admin` | Login password |
| Database path | `DB_PATH` | `monitor.db` | SQLite history/alerts store |

Alert thresholds (percent) are defined directly in `config.py`:

```python
ALERT_THRESHOLDS = {
    "cpu": 85,
    "ram": 90,
    "disk": 80,
}
```

Other tunables in `config.py`: `STATS_INTERVAL` (live push cadence, default 2 s) and
`HISTORY_INTERVAL` (snapshot cadence, default 60 s).

Example with overrides:

```bash
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
export DASHBOARD_USERNAME="ramez"
export DASHBOARD_PASSWORD="a-strong-password"
python app.py
```

---

## API endpoints

All require an authenticated session.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Dashboard (redirects to `/login` if not authed) |
| `GET` | `/api/stats` | Current snapshot as JSON (REST fallback) |
| `GET` | `/api/history?hours=1` | Historical snapshots (max 24h) |
| `GET` | `/api/alerts?limit=50` | Recent triggered alerts (max 200) |
| WebSocket | `stats_update` event | Live stats + alerts pushed every `STATS_INTERVAL` seconds |

---

## Deployment notes

For a long-running deployment (VPS / Raspberry Pi), run it under a process manager such as
`systemd` or `supervisor`, set the environment variables above, and put it behind a reverse
proxy (nginx/Caddy) with HTTPS. The app already binds to `0.0.0.0:5000` and uses an
eventlet async worker, so it can serve WebSocket traffic directly.

> Some metrics depend on the platform: CPU temperature requires sensors the OS exposes, and
> a few process/connection details may need elevated privileges. The app degrades gracefully
> and simply omits anything unavailable.

---

## Tech stack

- **Backend:** Flask, Flask-SocketIO, eventlet
- **Metrics:** psutil
- **Storage:** SQLite (standard library)
- **Frontend:** vanilla JS, Chart.js, Socket.IO client

## License

See [LICENSE](LICENSE).
