from __future__ import annotations

import io
import ipaddress
import struct
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

from scapy.all import (
    ARP,
    DNS,
    DNSQR,
    DNSRR,
    Dot1Q,
    Ether,
    ICMP,
    ICMPv6EchoRequest,
    IP,
    IPv6,
    Raw,
    TCP,
    UDP,
)
from scapy.layers.tls.all import TLS
from scapy.packet import Packet
from scapy.utils import PcapReader

try:
    from scapy.layers.http import HTTPRequest, HTTPResponse  # type: ignore
except Exception:  # pragma: no cover
    HTTPRequest = None  # type: ignore
    HTTPResponse = None  # type: ignore

# scapy.layers.tls is heavy; only import lazily where needed.


TCP_FLAG_NAMES = [
    (0x01, "FIN"),
    (0x02, "SYN"),
    (0x04, "RST"),
    (0x08, "PSH"),
    (0x10, "ACK"),
    (0x20, "URG"),
    (0x40, "ECE"),
    (0x80, "CWR"),
]


def _flags_to_list(flags: int) -> list[str]:
    return [name for bit, name in TCP_FLAG_NAMES if flags & bit]


def _proto_number_to_name(num: int) -> str:
    return {
        1: "ICMP",
        2: "IGMP",
        6: "TCP",
        17: "UDP",
        47: "GRE",
        50: "ESP",
        51: "AH",
        58: "ICMPv6",
        89: "OSPF",
        132: "SCTP",
    }.get(num, f"IP({num})")


def _is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        return False


def _classify_port(sport: int | None, dport: int | None) -> Optional[str]:
    well_known = {
        20: "FTP-DATA",
        21: "FTP",
        22: "SSH",
        23: "TELNET",
        25: "SMTP",
        53: "DNS",
        67: "DHCP",
        68: "DHCP",
        69: "TFTP",
        80: "HTTP",
        88: "Kerberos",
        110: "POP3",
        123: "NTP",
        135: "RPC",
        137: "NetBIOS",
        138: "NetBIOS",
        139: "NetBIOS",
        143: "IMAP",
        161: "SNMP",
        389: "LDAP",
        443: "HTTPS",
        445: "SMB",
        465: "SMTPS",
        514: "Syslog",
        587: "SMTP",
        636: "LDAPS",
        993: "IMAPS",
        995: "POP3S",
        1433: "MSSQL",
        1521: "Oracle",
        1723: "PPTP",
        1900: "SSDP",
        3306: "MySQL",
        3389: "RDP",
        5060: "SIP",
        5061: "SIP-TLS",
        5222: "XMPP",
        5353: "mDNS",
        5432: "Postgres",
        5900: "VNC",
        6379: "Redis",
        6443: "K8s-API",
        8080: "HTTP-Alt",
        8443: "HTTPS-Alt",
        9000: "PHP-FPM",
        9092: "Kafka",
        9200: "Elasticsearch",
        11211: "Memcached",
        27017: "MongoDB",
    }
    for p in (dport, sport):
        if p is None:
            continue
        if p in well_known:
            return well_known[p]
    return None


@dataclass
class ParsedPacket:
    index: int
    timestamp: float
    length: int
    src_mac: Optional[str] = None
    dst_mac: Optional[str] = None
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    ip_version: Optional[int] = None
    transport_proto: Optional[str] = None
    app_proto: Optional[str] = None
    protocol: str = "OTHER"
    info: str = ""
    flags: list[str] = field(default_factory=list)
    flow_id: Optional[str] = None
    raw: bytes = b""
    linktype: int = 1


def _build_flow_id(src_ip: str | None, dst_ip: str | None, sp: int | None, dp: int | None, proto: str) -> Optional[str]:
    if not src_ip or not dst_ip:
        return None
    a = (src_ip, sp or 0)
    b = (dst_ip, dp or 0)
    lo, hi = (a, b) if a <= b else (b, a)
    return f"{proto}|{lo[0]}:{lo[1]}|{hi[0]}:{hi[1]}"


def _summarize_packet(pkt: Packet, parsed: ParsedPacket) -> None:
    info_parts: list[str] = []
    app_proto = None

    if TCP in pkt:
        tcp = pkt[TCP]
        parsed.src_port = int(tcp.sport)
        parsed.dst_port = int(tcp.dport)
        parsed.transport_proto = "TCP"
        parsed.flags = _flags_to_list(int(tcp.flags))
        info_parts.append(f"{tcp.sport} -> {tcp.dport} [{','.join(parsed.flags)}] Seq={tcp.seq} Ack={tcp.ack} Win={tcp.window} Len={len(tcp.payload)}")
    elif UDP in pkt:
        udp = pkt[UDP]
        parsed.src_port = int(udp.sport)
        parsed.dst_port = int(udp.dport)
        parsed.transport_proto = "UDP"
        info_parts.append(f"{udp.sport} -> {udp.dport} Len={int(udp.len)}")
    elif ICMP in pkt:
        icmp = pkt[ICMP]
        parsed.transport_proto = "ICMP"
        info_parts.append(f"ICMP type={icmp.type} code={icmp.code}")
    elif ICMPv6EchoRequest in pkt:
        parsed.transport_proto = "ICMPv6"
        info_parts.append("ICMPv6 Echo Request")

    if DNS in pkt:
        dns = pkt[DNS]
        app_proto = "DNS"
        try:
            if dns.qr == 0 and dns.qd is not None:
                qname = dns.qd.qname.decode(errors="replace") if dns.qd.qname else "?"
                qtype = int(dns.qd.qtype) if dns.qd.qtype else 0
                info_parts.append(f"DNS Query: {qname} type={qtype}")
            elif dns.qr == 1:
                qname = dns.qd.qname.decode(errors="replace") if dns.qd and dns.qd.qname else "?"
                ancount = int(dns.ancount)
                info_parts.append(f"DNS Response: {qname} answers={ancount}")
        except Exception:
            info_parts.append("DNS")
    elif ARP in pkt:
        arp = pkt[ARP]
        app_proto = "ARP"
        info_parts.append(f"ARP op={arp.op} {arp.psrc} -> {arp.pdst}")
    elif HTTPRequest is not None and HTTPRequest in pkt:
        try:
            req = pkt[HTTPRequest]
            method = (req.Method or b"").decode(errors="replace") if hasattr(req, "Method") else ""
            host = (req.Host or b"").decode(errors="replace") if hasattr(req, "Host") else ""
            path = (req.Path or b"").decode(errors="replace") if hasattr(req, "Path") else ""
            app_proto = "HTTP"
            info_parts.append(f"HTTP {method} {host}{path}".strip())
        except Exception:
            app_proto = "HTTP"
    elif HTTPResponse is not None and HTTPResponse in pkt:
        try:
            resp = pkt[HTTPResponse]
            code = (resp.Status_Code or b"").decode(errors="replace") if hasattr(resp, "Status_Code") else ""
            app_proto = "HTTP"
            info_parts.append(f"HTTP Response {code}")
        except Exception:
            app_proto = "HTTP"

    if app_proto is None:
        # Heuristic by well known port
        app_proto = _classify_port(parsed.src_port, parsed.dst_port)

    # TLS detection on TCP 443
    if app_proto in (None, "HTTPS") and parsed.transport_proto == "TCP" and (parsed.src_port == 443 or parsed.dst_port == 443):
        payload = bytes(pkt[TCP].payload) if TCP in pkt else b""
        if len(payload) >= 6 and payload[0] in (0x14, 0x15, 0x16, 0x17) and payload[1] == 0x03:
            app_proto = "TLS"
            rec_type = {0x14: "ChangeCipherSpec", 0x15: "Alert", 0x16: "Handshake", 0x17: "ApplicationData"}.get(payload[0], "?")
            info_parts.append(f"TLS {rec_type}")

    parsed.app_proto = app_proto
    parsed.protocol = app_proto or parsed.transport_proto or "OTHER"
    parsed.info = " | ".join(info_parts) if info_parts else parsed.protocol


def _base_extract(pkt: Packet) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[int]]:
    src_mac = dst_mac = src_ip = dst_ip = None
    ipv = None
    if Ether in pkt:
        eth = pkt[Ether]
        src_mac = eth.src
        dst_mac = eth.dst
    if IP in pkt:
        ip = pkt[IP]
        src_ip = ip.src
        dst_ip = ip.dst
        ipv = 4
    elif IPv6 in pkt:
        ip6 = pkt[IPv6]
        src_ip = ip6.src
        dst_ip = ip6.dst
        ipv = 6
    elif ARP in pkt:
        arp = pkt[ARP]
        src_ip = arp.psrc
        dst_ip = arp.pdst
    return src_mac, dst_mac, src_ip, dst_ip, ipv


def parse_packets_from_bytes(data: bytes, max_packets: int) -> tuple[list[ParsedPacket], bool, int]:
    """Parse PCAP/PCAPNG bytes into a list of ParsedPacket. Returns (packets, truncated, linktype)."""
    packets: list[ParsedPacket] = []
    truncated = False
    linktype = 1
    bio = io.BytesIO(data)
    try:
        reader = PcapReader(bio)  # auto-detects pcap and pcapng
    except Exception as e:
        raise ValueError(f"No se pudo abrir la captura: {e}") from e

    idx = 0
    try:
        for pkt in reader:
            if idx >= max_packets:
                truncated = True
                break
            ts = float(pkt.time)
            length = len(bytes(pkt))
            try:
                lt = int(getattr(reader, "linktype", 1))
                linktype = lt
            except Exception:
                pass
            parsed = ParsedPacket(index=idx, timestamp=ts, length=length, linktype=linktype)
            try:
                src_mac, dst_mac, src_ip, dst_ip, ipv = _base_extract(pkt)
                parsed.src_mac = src_mac
                parsed.dst_mac = dst_mac
                parsed.src_ip = src_ip
                parsed.dst_ip = dst_ip
                parsed.ip_version = ipv
                _summarize_packet(pkt, parsed)
                parsed.flow_id = _build_flow_id(
                    parsed.src_ip,
                    parsed.dst_ip,
                    parsed.src_port,
                    parsed.dst_port,
                    parsed.transport_proto or parsed.protocol,
                )
                parsed.raw = bytes(pkt)
            except Exception as e:
                parsed.info = f"<error parseando: {e}>"
                parsed.protocol = parsed.protocol or "OTHER"
            packets.append(parsed)
            idx += 1
    finally:
        try:
            reader.close()
        except Exception:
            pass

    return packets, truncated, linktype


def packet_to_layers(raw: bytes, linktype: int = 1) -> list[dict[str, Any]]:
    """Decode a raw packet into a layered representation (for the detail tree)."""
    from scapy.layers.l2 import Ether as EtherL
    from scapy.config import conf

    try:
        cls = conf.l2types.get(linktype, EtherL)
    except Exception:
        cls = EtherL
    try:
        pkt = cls(raw)
    except Exception:
        try:
            pkt = EtherL(raw)
        except Exception:
            return [{"name": "Raw", "fields": {"data_hex": raw.hex()}}]

    layers: list[dict[str, Any]] = []
    cur = pkt
    while cur is not None:
        try:
            name = cur.name or cur.__class__.__name__
        except Exception:
            name = cur.__class__.__name__
        fields: dict[str, Any] = {}
        try:
            for f in cur.fields_desc:
                try:
                    val = cur.getfieldval(f.name)
                    fields[f.name] = _stringify(val)
                except Exception:
                    continue
        except Exception:
            pass
        layers.append({"name": name, "fields": fields})
        nxt = getattr(cur, "payload", None)
        if not nxt or isinstance(nxt, type(None)) or len(bytes(nxt)) == 0:
            break
        if nxt.__class__.__name__ == "NoPayload":
            break
        cur = nxt
    return layers


def _stringify(val: Any) -> Any:
    if isinstance(val, (bytes, bytearray)):
        try:
            s = val.decode("utf-8", errors="replace")
            return s if len(s) < 256 else s[:256] + "…"
        except Exception:
            return val.hex()
    if isinstance(val, (list, tuple)):
        return [_stringify(v) for v in val][:20]
    if isinstance(val, (int, float, str, bool)) or val is None:
        return val
    return str(val)


def hex_dump(raw: bytes, width: int = 16, max_bytes: int = 4096) -> str:
    data = raw[:max_bytes]
    lines: list[str] = []
    for i in range(0, len(data), width):
        chunk = data[i : i + width]
        hex_part = " ".join(f"{b:02x}" for b in chunk)
        ascii_part = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        lines.append(f"{i:08x}  {hex_part:<{width*3}}  {ascii_part}")
    if len(raw) > max_bytes:
        lines.append(f"… ({len(raw) - max_bytes} bytes más)")
    return "\n".join(lines)


def payload_preview(raw: bytes, max_bytes: int = 512) -> Optional[str]:
    if not raw:
        return None
    sample = raw[:max_bytes]
    try:
        text = sample.decode("utf-8", errors="strict")
        if all(c.isprintable() or c in "\r\n\t " for c in text):
            return text
    except Exception:
        pass
    return None


def time_str(ts: float) -> str:
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="milliseconds")
    except Exception:
        return str(ts)
