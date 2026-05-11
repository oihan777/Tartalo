from __future__ import annotations

import ipaddress
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Optional

from .pcap_parser import ParsedPacket, _is_private_ip, _classify_port


@dataclass
class FlowAggregate:
    flow_id: str
    protocol: str
    src_ip: str
    dst_ip: str
    src_port: Optional[int]
    dst_port: Optional[int]
    packets: int = 0
    bytes: int = 0
    first_seen: float = 0.0
    last_seen: float = 0.0
    packet_indices: list[int] = field(default_factory=list)
    syn: int = 0
    fin: int = 0
    rst: int = 0
    has_payload: bool = False
    severity: Optional[str] = None
    summary: Optional[str] = None
    has_anomaly: bool = False


@dataclass
class HostAggregate:
    ip: str
    mac: Optional[str] = None
    packets_sent: int = 0
    packets_recv: int = 0
    bytes_sent: int = 0
    bytes_recv: int = 0
    peers: set[str] = field(default_factory=set)
    protocols: set[str] = field(default_factory=set)
    first_seen: float = 0.0
    last_seen: float = 0.0


@dataclass
class Alert:
    id: str
    severity: str
    title: str
    category: str
    description: str
    evidence: list[str] = field(default_factory=list)
    packet_indices: list[int] = field(default_factory=list)
    flow_ids: list[str] = field(default_factory=list)
    hosts: list[str] = field(default_factory=list)
    confidence: float = 0.5


def aggregate(packets: list[ParsedPacket]) -> tuple[dict[str, FlowAggregate], dict[str, HostAggregate], list[Alert]]:
    flows: dict[str, FlowAggregate] = {}
    hosts: dict[str, HostAggregate] = {}

    for p in packets:
        if p.flow_id:
            f = flows.get(p.flow_id)
            if f is None:
                f = FlowAggregate(
                    flow_id=p.flow_id,
                    protocol=p.protocol,
                    src_ip=p.src_ip or "",
                    dst_ip=p.dst_ip or "",
                    src_port=p.src_port,
                    dst_port=p.dst_port,
                    first_seen=p.timestamp,
                    last_seen=p.timestamp,
                )
                flows[p.flow_id] = f
            f.packets += 1
            f.bytes += p.length
            f.first_seen = min(f.first_seen, p.timestamp) if f.first_seen else p.timestamp
            f.last_seen = max(f.last_seen, p.timestamp)
            f.packet_indices.append(p.index)
            if "SYN" in p.flags:
                f.syn += 1
            if "FIN" in p.flags:
                f.fin += 1
            if "RST" in p.flags:
                f.rst += 1
            if p.length > 80:
                f.has_payload = True

        for direction, ip, peer, mac in (
            ("sent", p.src_ip, p.dst_ip, p.src_mac),
            ("recv", p.dst_ip, p.src_ip, p.dst_mac),
        ):
            if not ip:
                continue
            h = hosts.get(ip)
            if h is None:
                h = HostAggregate(ip=ip, mac=mac, first_seen=p.timestamp, last_seen=p.timestamp)
                hosts[ip] = h
            else:
                if mac and not h.mac:
                    h.mac = mac
            h.first_seen = min(h.first_seen, p.timestamp) if h.first_seen else p.timestamp
            h.last_seen = max(h.last_seen, p.timestamp)
            if peer:
                h.peers.add(peer)
            if p.protocol:
                h.protocols.add(p.protocol)
            if direction == "sent":
                h.packets_sent += 1
                h.bytes_sent += p.length
            else:
                h.packets_recv += 1
                h.bytes_recv += p.length

    alerts = detect_anomalies(packets, flows, hosts)

    # Mark anomalies on flows
    flow_severity_rank = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
    for a in alerts:
        sev_rank = flow_severity_rank.get(a.severity, 0)
        for fid in a.flow_ids:
            f = flows.get(fid)
            if f is not None:
                f.has_anomaly = True
                if f.severity is None or flow_severity_rank.get(f.severity, 0) < sev_rank:
                    f.severity = a.severity

    return flows, hosts, alerts


def detect_anomalies(
    packets: list[ParsedPacket],
    flows: dict[str, FlowAggregate],
    hosts: dict[str, HostAggregate],
) -> list[Alert]:
    alerts: list[Alert] = []

    # 1. Port scan: a host contacts many distinct destination ports on few hosts in short time
    scan_counter: dict[tuple[str, str], set[int]] = defaultdict(set)
    scan_packets: dict[tuple[str, str], list[int]] = defaultdict(list)
    for p in packets:
        if not (p.src_ip and p.dst_ip and p.dst_port and p.transport_proto in ("TCP", "UDP")):
            continue
        if "SYN" in p.flags and "ACK" not in p.flags:
            scan_counter[(p.src_ip, p.dst_ip)].add(p.dst_port)
            scan_packets[(p.src_ip, p.dst_ip)].append(p.index)
        elif p.transport_proto == "UDP":
            scan_counter[(p.src_ip, p.dst_ip)].add(p.dst_port)
            scan_packets[(p.src_ip, p.dst_ip)].append(p.index)
    for (src, dst), ports in scan_counter.items():
        if len(ports) >= 20:
            sev = "high" if len(ports) >= 100 else "medium"
            alerts.append(
                Alert(
                    id=f"scan-{src}-{dst}",
                    severity=sev,
                    title=f"Posible escaneo de puertos: {src} → {dst}",
                    category="recon",
                    description=f"{src} contactó {len(ports)} puertos distintos en {dst}.",
                    evidence=[f"Puertos observados (muestra): {sorted(list(ports))[:15]}"],
                    packet_indices=scan_packets[(src, dst)][:50],
                    hosts=[src, dst],
                    confidence=min(0.95, 0.4 + len(ports) / 200),
                )
            )

    # 2. Horizontal scan: one src talks to many dst IPs on same port
    horiz_counter: dict[tuple[str, int], set[str]] = defaultdict(set)
    horiz_packets: dict[tuple[str, int], list[int]] = defaultdict(list)
    for p in packets:
        if p.src_ip and p.dst_ip and p.dst_port and "SYN" in p.flags and "ACK" not in p.flags:
            horiz_counter[(p.src_ip, p.dst_port)].add(p.dst_ip)
            horiz_packets[(p.src_ip, p.dst_port)].append(p.index)
    for (src, port), targets in horiz_counter.items():
        if len(targets) >= 15:
            sev = "high" if len(targets) >= 50 else "medium"
            alerts.append(
                Alert(
                    id=f"horiz-{src}-{port}",
                    severity=sev,
                    title=f"Posible escaneo horizontal: {src} en puerto {port}",
                    category="recon",
                    description=f"{src} envió SYN a {len(targets)} destinos distintos en puerto {port}.",
                    evidence=[f"Destinos (muestra): {sorted(list(targets))[:10]}"],
                    packet_indices=horiz_packets[(src, port)][:50],
                    hosts=[src],
                    confidence=min(0.95, 0.4 + len(targets) / 100),
                )
            )

    # 3. SYN flood / unusual SYN ratio per flow
    for fid, f in flows.items():
        if f.protocol in ("TCP",) or "TCP" in fid:
            if f.syn >= 30 and (f.fin + f.rst) == 0 and f.packets >= 30:
                alerts.append(
                    Alert(
                        id=f"synflood-{fid}",
                        severity="high",
                        title=f"Patrón SYN flood / connect storm en {f.src_ip}:{f.src_port} → {f.dst_ip}:{f.dst_port}",
                        category="dos",
                        description=f"{f.syn} SYN sin cierre limpio.",
                        evidence=[f"SYN={f.syn} FIN={f.fin} RST={f.rst}"],
                        packet_indices=f.packet_indices[:50],
                        flow_ids=[fid],
                        hosts=[f.src_ip, f.dst_ip],
                        confidence=0.7,
                    )
                )

    # 4. DNS anomalies: very long names (tunneling), high entropy responses
    dns_query_lengths: list[tuple[int, int]] = []
    for p in packets:
        if p.app_proto == "DNS" and "Query:" in p.info:
            try:
                name = p.info.split("Query:")[1].split(" type=")[0].strip()
                if len(name) >= 60:
                    dns_query_lengths.append((p.index, len(name)))
            except Exception:
                pass
    if len(dns_query_lengths) >= 3:
        alerts.append(
            Alert(
                id="dns-tunnel",
                severity="medium",
                title="Posible DNS tunneling",
                category="exfil",
                description=f"{len(dns_query_lengths)} consultas DNS con nombres inusualmente largos.",
                evidence=[f"Ejemplos: índices {[i for i, _ in dns_query_lengths[:5]]}"],
                packet_indices=[i for i, _ in dns_query_lengths[:50]],
                confidence=0.55,
            )
        )

    # 5. Cleartext credentials / cleartext sensitive protocols
    cleartext_proto_packets: dict[str, list[int]] = defaultdict(list)
    cleartext_protocols = {"FTP", "TELNET", "HTTP", "POP3", "SMTP", "IMAP"}
    for p in packets:
        if p.protocol in cleartext_protocols or (p.app_proto in cleartext_protocols):
            cleartext_proto_packets[p.protocol or p.app_proto or "HTTP"].append(p.index)
    for proto, idxs in cleartext_proto_packets.items():
        if len(idxs) >= 5:
            alerts.append(
                Alert(
                    id=f"cleartext-{proto}",
                    severity="low",
                    title=f"Tráfico {proto} en texto claro",
                    category="hygiene",
                    description=f"Se detectaron {len(idxs)} paquetes {proto} sin cifrado.",
                    packet_indices=idxs[:50],
                    confidence=0.85,
                )
            )

    # 6. Beaconing: same src→dst flow with very regular interval
    flow_times: dict[str, list[float]] = defaultdict(list)
    for p in packets:
        if p.flow_id:
            flow_times[p.flow_id].append(p.timestamp)
    for fid, times in flow_times.items():
        if len(times) < 8:
            continue
        times_sorted = sorted(times)
        deltas = [times_sorted[i + 1] - times_sorted[i] for i in range(len(times_sorted) - 1)]
        if not deltas:
            continue
        try:
            mean = statistics.mean(deltas)
            if mean < 0.1 or mean > 600:
                continue
            stdev = statistics.pstdev(deltas)
            cv = stdev / mean if mean > 0 else 0
            if cv < 0.2 and len(deltas) >= 8:
                f = flows.get(fid)
                alerts.append(
                    Alert(
                        id=f"beacon-{fid}",
                        severity="medium",
                        title=f"Posible beaconing C2 en flujo {fid}",
                        category="c2",
                        description=f"{len(times_sorted)} paquetes con intervalo medio {mean:.2f}s (CV={cv:.2f}).",
                        evidence=[f"Intervalos consistentes en {fid}"],
                        packet_indices=(f.packet_indices[:50] if f else []),
                        flow_ids=[fid],
                        hosts=[f.src_ip, f.dst_ip] if f else [],
                        confidence=0.65,
                    )
                )
        except Exception:
            continue

    # 7. Tráfico hacia IP pública en puertos no estándar con mucho volumen
    for fid, f in flows.items():
        try:
            if not f.dst_ip:
                continue
            if _is_private_ip(f.dst_ip):
                continue
            if f.bytes > 1_000_000 and f.dst_port and f.dst_port not in (80, 443, 53):
                alerts.append(
                    Alert(
                        id=f"egress-large-{fid}",
                        severity="medium",
                        title=f"Salida grande a IP pública {f.dst_ip}:{f.dst_port}",
                        category="exfil",
                        description=f"{f.bytes/1024:.0f} KB enviados en {f.packets} paquetes a IP pública por puerto no estándar.",
                        packet_indices=f.packet_indices[:50],
                        flow_ids=[fid],
                        hosts=[f.src_ip, f.dst_ip],
                        confidence=0.55,
                    )
                )
        except Exception:
            continue

    # 8. ARP spoof: dos MACs distintas anuncian la misma IP
    arp_map: dict[str, set[str]] = defaultdict(set)
    arp_packets: dict[str, list[int]] = defaultdict(list)
    for p in packets:
        if p.protocol == "ARP" and p.src_ip and p.src_mac:
            arp_map[p.src_ip].add(p.src_mac)
            arp_packets[p.src_ip].append(p.index)
    for ip, macs in arp_map.items():
        if len(macs) > 1:
            alerts.append(
                Alert(
                    id=f"arp-spoof-{ip}",
                    severity="high",
                    title=f"Posible ARP spoofing en {ip}",
                    category="mitm",
                    description=f"{len(macs)} MACs distintas anuncian la IP {ip}.",
                    evidence=[f"MACs: {sorted(macs)}"],
                    packet_indices=arp_packets[ip][:50],
                    hosts=[ip],
                    confidence=0.8,
                )
            )

    return alerts


def compute_stats(
    packets: list[ParsedPacket],
    flows: dict[str, FlowAggregate],
    hosts: dict[str, HostAggregate],
    alerts: list[Alert],
) -> dict[str, Any]:
    total_bytes = sum(p.length for p in packets)
    if not packets:
        return {
            "total_bytes": 0,
            "avg_packet_size": 0.0,
            "packets_per_second": 0.0,
            "top_protocols": [],
            "top_talkers": [],
            "top_conversations": [],
            "timeline": [],
            "port_distribution": [],
            "alert_counts": {},
            "flow_count": 0,
            "host_count": 0,
            "private_vs_public": {"private": 0, "public": 0},
        }
    first = packets[0].timestamp
    last = packets[-1].timestamp
    duration = max(last - first, 0.0001)

    proto_counter = Counter(p.protocol for p in packets)
    top_protocols = [{"name": k, "packets": v, "bytes": sum(p.length for p in packets if p.protocol == k)} for k, v in proto_counter.most_common(10)]

    talker_bytes: dict[str, int] = defaultdict(int)
    talker_pkts: dict[str, int] = defaultdict(int)
    for p in packets:
        if p.src_ip:
            talker_bytes[p.src_ip] += p.length
            talker_pkts[p.src_ip] += 1
        if p.dst_ip:
            talker_bytes[p.dst_ip] += p.length
            talker_pkts[p.dst_ip] += 1
    top_talkers = sorted(
        [{"ip": ip, "bytes": b, "packets": talker_pkts[ip]} for ip, b in talker_bytes.items()],
        key=lambda x: x["bytes"],
        reverse=True,
    )[:10]

    top_conversations = sorted(
        [
            {
                "flow_id": f.flow_id,
                "protocol": f.protocol,
                "src": f"{f.src_ip}:{f.src_port}" if f.src_port else f.src_ip,
                "dst": f"{f.dst_ip}:{f.dst_port}" if f.dst_port else f.dst_ip,
                "packets": f.packets,
                "bytes": f.bytes,
                "duration": round(max(f.last_seen - f.first_seen, 0), 3),
                "severity": f.severity,
            }
            for f in flows.values()
        ],
        key=lambda x: x["bytes"],
        reverse=True,
    )[:15]

    # Timeline bucketing
    bucket_count = 60
    bucket_size = duration / bucket_count
    timeline_pkts = [0] * bucket_count
    timeline_bytes = [0] * bucket_count
    for p in packets:
        idx = min(int((p.timestamp - first) / bucket_size), bucket_count - 1)
        timeline_pkts[idx] += 1
        timeline_bytes[idx] += p.length
    timeline = [
        {"t": first + i * bucket_size, "packets": timeline_pkts[i], "bytes": timeline_bytes[i]}
        for i in range(bucket_count)
    ]

    # Port distribution
    port_counter: Counter[int] = Counter()
    for p in packets:
        if p.dst_port:
            port_counter[p.dst_port] += 1
    port_dist = [
        {"port": port, "service": _classify_port(None, port) or f"port {port}", "packets": n}
        for port, n in port_counter.most_common(15)
    ]

    severity_order = ["critical", "high", "medium", "low", "info"]
    alert_counts: dict[str, int] = {s: 0 for s in severity_order}
    for a in alerts:
        alert_counts[a.severity] = alert_counts.get(a.severity, 0) + 1

    private_count = 0
    public_count = 0
    for p in packets:
        for ip in (p.src_ip, p.dst_ip):
            if not ip:
                continue
            if _is_private_ip(ip):
                private_count += 1
            else:
                public_count += 1

    return {
        "total_bytes": total_bytes,
        "avg_packet_size": total_bytes / len(packets),
        "packets_per_second": len(packets) / duration,
        "top_protocols": top_protocols,
        "top_talkers": top_talkers,
        "top_conversations": top_conversations,
        "timeline": timeline,
        "port_distribution": port_dist,
        "alert_counts": alert_counts,
        "flow_count": len(flows),
        "host_count": len(hosts),
        "private_vs_public": {"private": private_count, "public": public_count},
    }


def role_hint(host: HostAggregate) -> Optional[str]:
    if host.bytes_sent > host.bytes_recv * 3 and host.bytes_sent > 10_000:
        return "emisor dominante"
    if host.bytes_recv > host.bytes_sent * 3 and host.bytes_recv > 10_000:
        return "receptor dominante"
    if len(host.peers) >= 20:
        return "hub (muchos peers)"
    if "DNS" in host.protocols and len(host.peers) <= 3:
        return "cliente DNS"
    return None
