import { Link, useLocation } from "@tanstack/react-router";
import { SideNav, SideNavSection, SideNavItem, SideNavHeading, VStack } from "@astryxdesign/core";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Home, Info, Boxes, Container, Sun, Moon } from "lucide-react";
import { useAppTheme } from "../context/ThemeContext";

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
    <VStack gap={1} width="100%">
      <SideNavSection title="MENU">
        <SideNavItem
          label="Home"
          icon={<Home className="w-4 h-4" />}
          isSelected={currentPath === "/"}
          as={Link}
          href="/"
          size="md"
        />
        <SideNavItem
          label="Workspaces"
          icon={<Boxes className="w-4 h-4" />}
          isSelected={isSelected(currentPath, "/workspaces", true)}
          as={Link}
          href="/workspaces"
          size="md"
        />
        <SideNavItem
          label="Docker"
          icon={<Container className="w-4 h-4" />}
          isSelected={isSelected(currentPath, "/docker", false)}
          as={Link}
          href="/docker"
          size="md"
        />
        <SideNavItem
          label="About"
          icon={<Info className="w-4 h-4" />}
          isSelected={isSelected(currentPath, "/about", true)}
          as={Link}
          href="/about"
          size="md"
        />
      </SideNavSection>

      <SideNavSection title="THEME">
        <SideNavItem
          label={mode === "dark" ? "Light Mode" : "Dark Mode"}
          icon={mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          onClick={toggleMode}
          size="md"
        />
      </SideNavSection>
    </VStack>
  );
}

export function Sidebar() {
  const isCompact = useMediaQuery("(max-width: 768px)");

  return (
    <SideNav
      resizable={false}
      style={{ width: isCompact ? 64 : 260 }}
      collapsible={{ isCollapsed: isCompact, hasButton: false }}
      header={
        isCompact ? undefined :
        <SideNavHeading
          heading="Portside"
          headingHref="/"
        />
      }
    >
      <NavItems />
    </SideNav>
  );
}

export default Sidebar;
