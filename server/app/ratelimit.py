import threading
import time


class SlidingWindowCounter:
    def __init__(self, limit: int, window_s: float):
        self.limit = limit
        self.window_s = window_s
        self._events: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            events = self._events.setdefault(key, [])
            cutoff = now - self.window_s
            while events and events[0] <= cutoff:
                events.pop(0)
            if len(events) >= self.limit:
                return False
            events.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


create_limiter = SlidingWindowCounter(limit=10, window_s=3600)
join_limiter = SlidingWindowCounter(limit=30, window_s=3600)
