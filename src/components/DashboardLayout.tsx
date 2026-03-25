import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, UtensilsCrossed, LucideIcon } from "lucide-react";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  title: string;
}

function SidebarNav({ navItems, title }: { navItems: NavItem[]; title: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <UtensilsCrossed className="h-6 w-6 shrink-0 text-sidebar-primary" />
        {!collapsed && <span className="font-bold text-sidebar-foreground truncate">OrderMaster</span>}
      </div>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">{title}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url.split("/").length <= 2}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function DashboardLayout({ children, navItems, title }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarNav navItems={navItems} title={title} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 backdrop-blur-lg px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h2 className="text-sm font-semibold text-foreground hidden sm:block">{title}</h2>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link to={`/${profile?.role}/settings`} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" /> Cài đặt tài khoản
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
