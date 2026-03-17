import { NavLink, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { getNavigationConfig } from "@/shared/config";
import { Separator } from "@/shared/ui/atoms/separator";
import { ScrollArea } from "@/shared/ui/molecules/scroll-area";
import { useSidebar } from "@/shared/lib/sidebar-context";

export function AppSidebar() {
  const { isOpen } = useSidebar();
  const { pathname } = useLocation();
  const navGroups = useMemo(() => getNavigationConfig(pathname), [pathname]);

  return (
    <aside
      className={`${
        isOpen ? "w-64" : "w-0"
      } shrink-0 overflow-hidden border-r bg-sidebar`}
    >
      <ScrollArea className="h-full">
        <nav className="flex flex-col gap-2 p-4">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title}>
              {groupIdx > 0 && <Separator className="my-2" />}
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
