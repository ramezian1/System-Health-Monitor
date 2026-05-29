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

## Prerequisites

Before you start, make sure these are installed and ready:

| Tool | Version | Why you need it | Download |
|---|---|---|---|
| **Python** | 3.9 or newer | Runs the app | [python.org/downloads](https://www.python.org/downloads/) |
| **pip** | bundled with Python | Installs the Python dependencies | included with Python 3.4+ |
| **Git** | any recent version | Clones the repository | [git-scm.com/downloads](https://git-scm.com/downloads) |
| **A modern web browser** | current | Views the live dashboard | [Chrome](https://www.google.com/chrome/) · [Firefox](https://www.mozilla.org/firefox/) · [Edge](https://www.microsoft.com/edge) · Safari (built in) |

**Also good to know:**

- **Internet connection** — the dashboard loads Chart.js, the Socket.IO client, and the
  Inter font from public CDNs at runtime, so the device viewing it needs internet access.
- **Verify your install** before continuing:
  ```bash
  python --version    # or: python3 --version   → should print 3.9+
  pip --version
  git --version
  ```
  On Windows, if `python` opens the Microsoft Store, install Python from the link above and
  re-open your terminal.
- **For the Raspberry Pi deployment** you'll additionally need a Raspberry Pi running
  Raspberry Pi OS (or any Linux) with terminal/SSH access — see the
  [Raspberry Pi section](#raspberry-pi-recommended--monitors-the-pi-itself-24-7).

> Don't have Python or Git yet? The OS-specific setup steps below include one-line install
> commands (Homebrew, apt, winget) that fetch them for you.

---

## Setup

**Requirements:** Python 3.9+ and `git` (see [Prerequisites](#prerequisites) above).

### macOS

```bash
# 0. Install Python 3 if you don't have it (Homebrew: https://brew.sh)
brew install python git

# 1. Clone
git clone https://github.com/ramezian1/System-Health-Monitor.git
cd System-Health-Monitor

# 2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

> On macOS, `psutil` cannot read CPU **temperature**, so that field is simply omitted —
> everything else (CPU %, per-core, RAM, disk, network, processes) works normally.

### Linux (Debian / Ubuntu / Raspberry Pi OS)

```bash
# 0. Install Python 3 + venv if needed
sudo apt update && sudo apt install -y python3 python3-venv python3-pip git

# 1. Clone
git clone https://github.com/ramezian1/System-Health-Monitor.git
cd System-Health-Monitor

# 2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

> On Fedora/RHEL use `sudo dnf install python3 python3-pip git`; on Arch use
> `sudo pacman -S python git`. CPU temperature is available on Linux where the kernel
> exposes sensors.

### Windows

Run these in **PowerShell**:

```powershell
# 0. Install Python 3 + git if needed (or download from python.org / git-scm.com)
winget install Python.Python.3 Git.Git

# 1. Clone
git clone https://github.com/ramezian1/System-Health-Monitor.git
cd System-Health-Monitor

# 2. Create and activate a virtual environment
python -m venv venv
venv\Scripts\Activate.ps1        # Command Prompt instead: venv\Scripts\activate.bat

# 3. Install dependencies
pip install -r requirements.txt
```

> If PowerShell blocks `Activate.ps1` with a script-execution error, allow signed local
> scripts for your user once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then
> retry. Like macOS, `psutil` cannot read CPU **temperature** on Windows, so that field is
> omitted; all other metrics work. (The `yes > /dev/null` load test below is Unix-only.)

To leave the virtual environment later, run `deactivate`.

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
| Secret key | `SECRET_KEY` | random per startup | Flask session signing. Auto-generated if unset (sessions reset on restart) — **set this in production** for stable sessions |
| Username | `DASHBOARD_USERNAME` | `admin` | Login username |
| Password | `DASHBOARD_PASSWORD` | `admin` | Login password |
| Database path | `DB_PATH` | `monitor.db` | SQLite history/alerts store |

> On startup the app logs a warning if you're still using the default `admin` / `admin`
> login or haven't set a `SECRET_KEY`, so insecure deployments are easy to spot.

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

For a long-running deployment, run it under a process manager such as `systemd` so it starts
on boot and restarts on failure. The app binds to `0.0.0.0:5000` and uses an eventlet async
worker, so it can serve WebSocket traffic directly. Ready-made files live in [`deploy/`](deploy/).

> Some metrics depend on the platform: CPU temperature requires sensors the OS exposes, and
> a few process/connection details may need elevated privileges. The app degrades gracefully
> and simply omits anything unavailable.

### Raspberry Pi (recommended — monitors the Pi itself, 24/7)

Run these on the Pi (assumes the default `pi` user and a clone at `/home/pi/System-Health-Monitor`).

```bash
# 1. Clone and set up the app
git clone https://github.com/ramezian1/System-Health-Monitor.git
cd System-Health-Monitor
python -m venv venv
venv/bin/pip install -r requirements.txt

# 2. Create your secrets file (git-ignored)
cp deploy/system-health-monitor.env.example deploy/system-health-monitor.env
# Generate a secret key and paste it into the file, then set a real username/password:
python -c "import secrets; print(secrets.token_hex(32))"
nano deploy/system-health-monitor.env

# 3. Install and start the systemd service
sudo cp deploy/system-health-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now system-health-monitor

# 4. Check it's running
systemctl status system-health-monitor
```

Now open `http://<your-pi-ip>:5000` from any device on your network and log in.

Useful commands:

```bash
sudo systemctl restart system-health-monitor   # restart after a config/code change
journalctl -u system-health-monitor -f         # follow live logs
```

> If you cloned to a different path or use a non-`pi` user, edit the `User`, `WorkingDirectory`,
> `EnvironmentFile`, and `ExecStart` lines in `deploy/system-health-monitor.service` to match.

**Optional — reach it on port 80 / add HTTPS:** put nginx in front using
[`deploy/nginx.conf.example`](deploy/nginx.conf.example), then add a free Let's Encrypt
certificate with `certbot` if the Pi is reachable from a domain.

---

## Tech stack

- **Backend:** Flask, Flask-SocketIO, eventlet
- **Metrics:** psutil
- **Storage:** SQLite (standard library)
- **Frontend:** vanilla JS, Chart.js, Socket.IO client

## License

See [LICENSE](LICENSE).
