import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ListTree,
  GitBranch,
  Server,
  ShieldAlert,
  MessageCircle,
  Bookmark,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { useStore } from "../store/store";
import { Eye } from "./Eye";
import clsx from "clsx";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/packets", icon: ListTree, label: "Paquetes" },
  { to: "/flows", icon: GitBranch, label: "Flujos" },
  { to: "/hosts", icon: Server, label: "Hosts" },
  { to: "/alerts", icon: ShieldAlert, label: "Alertas" },
  { to: "/chat", icon: MessageCircle, label: "Chat IA" },
  { to: "/bookmarks", icon: Bookmark, label: "Marcadores" },
];

export function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggle = useStore((s) => s.toggleSidebar);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const navigate = useNavigate();

  return (
    <aside
      className={clsx(
        "flex h-full flex-col border-r border-bark-600/40 bg-bark-900/80 backdrop-blur-md",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center gap-2 border-b border-bark-600/40 px-3 py-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 group"
          aria-label="Inicio Tartalo"
        >
          <Eye size={36} />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-xl tracking-wide text-parchment">
                Tartalo
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-moss-200/80">
                Análisis de red
              </span>
            </div>
          )}
        </button>
      </div>

      <button
        onClick={() => setPaletteOpen(true)}
        className={clsx(
          "mx-3 mt-3 flex items-center gap-2 rounded-md border border-bark-500/40 bg-bark-800/60 px-2.5 py-2 text-left text-sm text-parchment/70 transition hover:border-moss-300/50 hover:text-parchment",
          collapsed && "justify-center"
        )}
      >
        <Search size={16} />
        {!collapsed && (
          <>
            <span className="flex-1">Buscar…</span>
            <span className="kbd">⌘K</span>
          </>
        )}
      </button>

      <nav className="mt-4 flex-1 space-y-0.5 px-2">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition",
                isActive
                  ? "bg-moss-700/30 text-parchment shadow-glow"
                  : "text-parchment/70 hover:bg-bark-700/40 hover:text-parchment",
                collapsed && "justify-center"
              )
            }
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mt-2 border-t border-bark-600/40 p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition",
              isActive
                ? "bg-bark-700/40 text-parchment"
                : "text-parchment/70 hover:bg-bark-700/40 hover:text-parchment",
              collapsed && "justify-center"
            )
          }
        >
          <Settings size={18} />
          {!collapsed && <span>Ajustes</span>}
        </NavLink>
        <button
          onClick={toggle}
          className={clsx(
            "mt-1 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-parchment/60 transition hover:bg-bark-700/40 hover:text-parchment",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
