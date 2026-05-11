import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { CommandPalette } from "./components/CommandPalette";
import Dashboard from "./pages/Dashboard";
import Packets from "./pages/Packets";
import Flows from "./pages/Flows";
import Hosts from "./pages/Hosts";
import Alerts from "./pages/Alerts";
import Chat from "./pages/Chat";
import Bookmarks from "./pages/Bookmarks";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-bark text-parchment">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-hidden paper">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/packets" element={<Packets />} />
            <Route path="/flows" element={<Flows />} />
            <Route path="/hosts" element={<Hosts />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
