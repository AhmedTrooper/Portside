import { Link, useLocation } from "@tanstack/react-router";
import { SideNav, SideNavSection, SideNavItem, SideNavHeading, VStack } from "@astryxdesign/core";
import { Home, Info, Boxes, Container, Sun, Moon, Cloud, GitBranch } from "lucide-react";
import { useAppTheme } from "../context/ThemeContext";

import { useUIStore } from "../store/uiStore";

// `isExact` lets the caller distinguish section roots (which should highlight
// on exact match) from section entries (which should highlight on any nested
// route, e.g. `/docker/containers` still highlights "Docker").
function isSelected(currentPath: string, target: string, exact: boolean): boolean {
  if (exact) {
    return currentPath === target;
  }
  return currentPath === target || currentPath.startsWith(`${target}/`);
}

function NavItems() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { mode, toggleMode } = useAppTheme();

  return (
    <VStack className="gap-2 px-3 py-2">
      <SideNavSection title="MENU" className="m-2">
        <SideNavItem
          label="Home"
          icon={<Home className="w-4 h-4 m-2" />}
          isSelected={currentPath === "/"}
          as={Link}
          href="/"
          size="md"
        />
        <SideNavItem
          label="Workspaces"
          icon={<Boxes className="w-4 h-4 m-2" />}
          isSelected={isSelected(currentPath, "/workspaces", true)}
          as={Link}
          href="/workspaces"
          size="md"
        />
        <SideNavItem
          label="Docker"
          icon={<Container className="w-4 h-4 m-2" />}
          isSelected={isSelected(currentPath, "/docker", false)}
          as={Link}
          href="/docker"
          size="md"
        />
        <SideNavItem
          label="AWS"
          icon={<Cloud className="w-4 h-4 m-2" />}
          isSelected={isSelected(currentPath, "/aws", false)}
          as={Link}
          href="/aws"
          size="md"
        />
        <SideNavItem
          label="Git"
          icon={<GitBranch className="w-4 h-4 m-2" />}
          isSelected={isSelected(currentPath, "/git", false)}
          as={Link}
          href="/git"
          size="md"
        />
        <SideNavItem
          label="About"
          icon={<Info className="w-4 h-4 m-2" />}
          isSelected={isSelected(currentPath, "/about", true)}
          as={Link}
          href="/about"
          size="md"
        />
      </SideNavSection>

      <SideNavSection title="THEME" className="m-2">
        <SideNavItem
          label={mode === "dark" ? "Light Mode" : "Dark Mode"}
          icon={mode === "dark" ? <Sun className="w-4 h-4 m-2" /> : <Moon className="w-4 h-4 m-2" />}
          onClick={toggleMode}
          size="md"
        />
      </SideNavSection>
    </VStack>
  );
}

export function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <SideNav
      collapsible={{ isCollapsed: isSidebarCollapsed, onCollapsedChange: toggleSidebar }}
      header={
        <SideNavHeading
          heading="Portside"
          headingHref="/"
          className="px-4 py-3"
        />
      }
    >
      <NavItems />
    </SideNav>
  );
}

export default Sidebar;
