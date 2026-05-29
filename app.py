import time
import sqlite3
import logging
import threading
from datetime import datetime
from functools import wraps

import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_socketio import SocketIO, emit

import monitor
import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
socketio = SocketIO(app, async_mode="eventlet", cors_allowed_origins="*")

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def _get_db():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS stats_history (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                ts        REAL NOT NULL,
                cpu_pct   REAL,
                ram_pct   REAL,
                disk_pct  REAL,
                net_send  REAL,
                net_recv  REAL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                ts        REAL NOT NULL,
                metric    TEXT NOT NULL,
                value     REAL NOT NULL,
                threshold REAL NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_stats_ts ON stats_history(ts)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts)")


def _save_snapshot(stats):
    disk_pct = None
    if stats["disk"]["partitions"]:
        disk_pct = stats["disk"]["partitions"][0]["percent"]
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO stats_history(ts,cpu_pct,ram_pct,disk_pct,net_send,net_recv) VALUES(?,?,?,?,?,?)",
            (
                stats["timestamp"],
                stats["cpu"]["percent"],
                stats["ram"]["percent"],
                disk_pct,
                stats["network"]["send_bytes_per_sec"],
                stats["network"]["recv_bytes_per_sec"],
            ),
        )


def _log_alert(metric, value, threshold):
    ts = time.time()
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO alerts(ts,metric,value,threshold) VALUES(?,?,?,?)",
            (ts, metric, value, threshold),
        )
    with open(config.ALERT_LOG_PATH, "a") as f:
        f.write(f"{datetime.utcfromtimestamp(ts).isoformat()} UTC  ALERT  {metric}={value:.1f}%  (threshold {threshold}%)\n")


def _check_alerts(stats):
    triggered = []
    t = config.ALERT_THRESHOLDS
    checks = [
        ("cpu", stats["cpu"]["percent"], t.get("cpu", 85)),
        ("ram", stats["ram"]["percent"], t.get("ram", 90)),
    ]
    if stats["disk"]["partitions"]:
        checks.append(("disk", stats["disk"]["partitions"][0]["percent"], t.get("disk", 80)))
    for metric, value, threshold in checks:
        if value >= threshold:
            _log_alert(metric, value, threshold)
            triggered.append({"metric": metric, "value": value, "threshold": threshold})
    return triggered

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        if (
            request.form.get("username") == config.DASHBOARD_USERNAME
            and request.form.get("password") == config.DASHBOARD_PASSWORD
        ):
            session["logged_in"] = True
            return redirect(url_for("index"))
        error = "Invalid credentials."
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
@login_required
def index():
    return render_template("index.html", thresholds=config.ALERT_THRESHOLDS)


@app.route("/api/stats")
@login_required
def api_stats():
    return jsonify(monitor.collect())


@app.route("/api/history")
@login_required
def api_history():
    hours = min(int(request.args.get("hours", 1)), 24)
    since = time.time() - hours * 3600
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT ts,cpu_pct,ram_pct,disk_pct,net_send,net_recv FROM stats_history WHERE ts>=? ORDER BY ts",
            (since,),
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/alerts")
@login_required
def api_alerts():
    limit = min(int(request.args.get("limit", 50)), 200)
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT ts,metric,value,threshold FROM alerts ORDER BY ts DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return jsonify([dict(r) for r in rows])

# ---------------------------------------------------------------------------
# Background broadcaster
# ---------------------------------------------------------------------------

_history_lock = threading.Lock()
_last_snapshot_ts = [0.0]


def _background_emit():
    while True:
        eventlet.sleep(config.STATS_INTERVAL)
        try:
            stats = monitor.collect()
            alerts = _check_alerts(stats)
            socketio.emit("stats_update", {"stats": stats, "alerts": alerts})
            now = time.time()
            with _history_lock:
                if now - _last_snapshot_ts[0] >= config.HISTORY_INTERVAL:
                    _save_snapshot(stats)
                    _last_snapshot_ts[0] = now
        except Exception as exc:
            log.error("Emitter error: %s", exc)

# ---------------------------------------------------------------------------
# SocketIO events
# ---------------------------------------------------------------------------

@socketio.on("connect")
def on_connect():
    if not session.get("logged_in"):
        return False
    log.info("Client connected: %s", request.sid)


@socketio.on("disconnect")
def on_disconnect():
    log.info("Client disconnected: %s", request.sid)

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    _init_db()
    # Prime the psutil rate counters so first reading isn't zero
    monitor.collect()
    eventlet.spawn(_background_emit)
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)
