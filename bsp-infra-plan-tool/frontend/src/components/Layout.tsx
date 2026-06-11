import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Upload, History, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/geschiedenis", label: "Geschiedenis", icon: History },
  { to: "/instellingen", label: "Instellingen", icon: Settings },
];

export default function Layout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white dark:bg-black border-b border-gray-200 dark:border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src="/vz-logo.png"
              alt="VodafoneZiggo"
              className="h-7 sm:h-8 w-auto shrink-0 dark:brightness-110"
            />
            <div className="hidden sm:block h-6 w-px bg-gray-200 dark:bg-neutral-800 shrink-0" />
            <p className="hidden sm:block text-sm font-medium text-gray-600 dark:text-neutral-300 truncate">
              Infrastructure Plan Tool
            </p>
          </div>
          <nav className="flex items-center gap-1 shrink-0">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-vodafone text-white shadow-sm"
                      : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-vodafone dark:hover:text-ziggo"
                  }`
                }
              >
                <Icon size={16} />
                <span className="hidden md:inline">{label}</span>
              </NavLink>
            ))}
            <button
              onClick={toggle}
              className="ml-2 p-2 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
              aria-label="Thema wisselen"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </div>
        <div className="vz-gradient-bar" aria-hidden />
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
