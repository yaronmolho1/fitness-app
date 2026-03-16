# layout/

App shell navigation — desktop sidebar, mobile header + slide-out drawer.

## Files
- `nav-items.ts` — `navItems` array and `NavItem` type; single source of truth for route labels and icons
- `main-nav.tsx` — `MainNav` collapsible desktop sidebar (hidden on mobile), persists collapsed state to localStorage
- `sidebar-nav.tsx` — `SidebarNav` mobile slide-out Sheet drawer, renders same nav items + logout
- `top-header.tsx` — `TopHeader` fixed mobile header bar with hamburger menu trigger and logout button
