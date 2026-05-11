from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from ..services.analyzer import Alert, FlowAggregate, HostAggregate
from ..services.pcap_parser import ParsedPacket


@dataclass
class Bookmark:
    id: str
    packet_index: int
    label: str = ""
    note: str = ""
    created_at: float = field(default_factory=time.time)


@dataclass
class ChatMessage:
    role: str
    content: str
    timestamp: float = field(default_factory=time.time)
    refs: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Capture:
    id: str
    filename: str
    size_bytes: int
    uploaded_at: float
    packets: list[ParsedPacket]
    flows: dict[str, FlowAggregate]
    hosts: dict[str, HostAggregate]
    alerts: list[Alert]
    stats: dict[str, Any]
    linktype: int = 1
    truncated: bool = False
    notes: str = ""
    tags: list[str] = field(default_factory=list)
    bookmarks: list[Bookmark] = field(default_factory=list)
    chat_history: list[ChatMessage] = field(default_factory=list)


class CaptureStore:
    def __init__(self, max_captures: int = 8) -> None:
        self._captures: dict[str, Capture] = {}
        self._lock = threading.Lock()
        self._max = max_captures

    def add(self, capture: Capture) -> None:
        with self._lock:
            self._captures[capture.id] = capture
            if len(self._captures) > self._max:
                # Evict oldest by uploaded_at
                oldest_id = min(self._captures, key=lambda k: self._captures[k].uploaded_at)
                if oldest_id != capture.id:
                    self._captures.pop(oldest_id, None)

    def get(self, capture_id: str) -> Optional[Capture]:
        with self._lock:
            return self._captures.get(capture_id)

    def list(self) -> list[Capture]:
        with self._lock:
            return sorted(self._captures.values(), key=lambda c: c.uploaded_at, reverse=True)

    def delete(self, capture_id: str) -> bool:
        with self._lock:
            return self._captures.pop(capture_id, None) is not None

    @staticmethod
    def new_id() -> str:
        return uuid.uuid4().hex[:12]


store = CaptureStore()
