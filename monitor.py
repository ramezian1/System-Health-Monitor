import time
import psutil

_prev_net = None
_prev_net_time = None
_prev_disk_io = None
_prev_disk_io_time = None


def _net_speeds():
    global _prev_net, _prev_net_time
    now = time.time()
    counters = psutil.net_io_counters()
    if _prev_net is None:
        _prev_net = counters
        _prev_net_time = now
        return 0.0, 0.0
    elapsed = max(now - _prev_net_time, 0.001)
    sent = (counters.bytes_sent - _prev_net.bytes_sent) / elapsed
    recv = (counters.bytes_recv - _prev_net.bytes_recv) / elapsed
    _prev_net = counters
    _prev_net_time = now
    return round(sent, 1), round(recv, 1)


def _disk_io_speeds():
    global _prev_disk_io, _prev_disk_io_time
    now = time.time()
    try:
        counters = psutil.disk_io_counters()
    except Exception:
        return 0.0, 0.0
    if counters is None or _prev_disk_io is None:
        _prev_disk_io = counters
        _prev_disk_io_time = now
        return 0.0, 0.0
    elapsed = max(now - _prev_disk_io_time, 0.001)
    read_speed = (counters.read_bytes - _prev_disk_io.read_bytes) / elapsed
    write_speed = (counters.write_bytes - _prev_disk_io.write_bytes) / elapsed
    _prev_disk_io = counters
    _prev_disk_io_time = now
    return round(read_speed, 1), round(write_speed, 1)


def get_cpu():
    freq = psutil.cpu_freq()
    temps = {}
    try:
        raw = psutil.sensors_temperatures()
        for name, entries in raw.items():
            if entries:
                temps[name] = round(entries[0].current, 1)
    except AttributeError:
        pass
    return {
        "percent": psutil.cpu_percent(interval=None),
        "per_core": psutil.cpu_percent(percpu=True),
        "count_logical": psutil.cpu_count(logical=True),
        "count_physical": psutil.cpu_count(logical=False),
        "freq_mhz": round(freq.current, 1) if freq else None,
        "freq_max_mhz": round(freq.max, 1) if freq else None,
        "temperatures": temps,
    }


def get_ram():
    vm = psutil.virtual_memory()
    sw = psutil.swap_memory()
    return {
        "total": vm.total,
        "used": vm.used,
        "available": vm.available,
        "percent": vm.percent,
        "swap_total": sw.total,
        "swap_used": sw.used,
        "swap_percent": sw.percent,
    }


def get_disk():
    partitions = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except PermissionError:
            continue
        partitions.append({
            "device": part.device,
            "mountpoint": part.mountpoint,
            "fstype": part.fstype,
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent": usage.percent,
        })
    read_speed, write_speed = _disk_io_speeds()
    return {
        "partitions": partitions,
        "read_bytes_per_sec": read_speed,
        "write_bytes_per_sec": write_speed,
    }


def get_network():
    sent_speed, recv_speed = _net_speeds()
    counters = psutil.net_io_counters()
    connections = len(psutil.net_connections())
    return {
        "bytes_sent": counters.bytes_sent,
        "bytes_recv": counters.bytes_recv,
        "packets_sent": counters.packets_sent,
        "packets_recv": counters.packets_recv,
        "send_bytes_per_sec": sent_speed,
        "recv_bytes_per_sec": recv_speed,
        "active_connections": connections,
    }


def get_processes(limit=10):
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent", "status"]):
        try:
            info = p.info
            procs.append(info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    top_cpu = sorted(procs, key=lambda x: x.get("cpu_percent") or 0, reverse=True)[:limit]
    top_ram = sorted(procs, key=lambda x: x.get("memory_percent") or 0, reverse=True)[:limit]

    def fmt(lst):
        return [
            {
                "pid": p["pid"],
                "name": p["name"],
                "cpu_percent": round(p.get("cpu_percent") or 0, 1),
                "memory_percent": round(p.get("memory_percent") or 0, 2),
                "status": p.get("status", ""),
            }
            for p in lst
        ]

    return {"top_cpu": fmt(top_cpu), "top_ram": fmt(top_ram)}


def collect():
    return {
        "timestamp": time.time(),
        "cpu": get_cpu(),
        "ram": get_ram(),
        "disk": get_disk(),
        "network": get_network(),
        "processes": get_processes(),
    }
