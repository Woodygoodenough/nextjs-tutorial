"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuItem as SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";

export type Route = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  link: string;
  badge?: number | string;
  subs?: {
    title: string;
    link: string;
    icon?: React.ReactNode;
  }[];
};

export default function DashboardNavigation({ routes }: { routes: Route[] }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {routes.map((route) => {
        const isOpen = !isCollapsed && openCollapsible === route.id;
        const hasSubRoutes = !!route.subs?.length;
        
        // Check if this route matches the current pathname
        const routeMatches = pathname === route.link || 
          (route.link !== "/" && pathname.startsWith(route.link + "/"));
        
        // Check if any other route is a more specific match (longer path that also matches)
        // This prevents highlighting parent routes when a child route is active
        const hasMoreSpecificMatch = routes.some(
          (otherRoute) => 
            otherRoute.link !== route.link &&
            otherRoute.link.length > route.link.length &&
            (pathname === otherRoute.link || pathname.startsWith(otherRoute.link + "/")) &&
            otherRoute.link.startsWith(route.link)
        );
        
        // Only highlight if this route matches AND no more specific route matches
        const isActive = routeMatches && !hasMoreSpecificMatch;

        return (
          <SidebarMenuItem key={route.id}>
            {hasSubRoutes ? (
              <Collapsible
                open={isOpen}
                onOpenChange={(open) =>
                  setOpenCollapsible(open ? route.id : null)
                }
                className="w-full"
              >
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className={cn(
                      "flex w-full items-center rounded-lg px-2 transition-colors",
                      {
                        "bg-sidebar-accent text-sidebar-accent-foreground font-medium": isActive,
                        "bg-sidebar-muted text-foreground": isOpen && !isActive,
                        "text-muted-foreground hover:bg-sidebar-muted hover:text-foreground": !isOpen && !isActive,
                        "justify-center": isCollapsed,
                      }
                    )}
                  >
                    {route.icon}
                    {!isCollapsed && (
                      <span className="ml-2 flex-1 text-sm font-medium">
                        {route.title}
                      </span>
                    )}
                    {!isCollapsed && hasSubRoutes && (
                      <span className="ml-auto">
                        {isOpen ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </span>
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                {!isCollapsed && (
                  <CollapsibleContent>
                    <SidebarMenuSub className="my-1 ml-3.5 ">
                      {route.subs?.map((subRoute) => {
                        const isSubActive = pathname === subRoute.link;
                        return (
                          <SidebarMenuSubItem
                            key={`${route.id}-${subRoute.title}`}
                            className="h-auto"
                          >
                            <SidebarMenuSubButton asChild>
                              <Link
                                href={subRoute.link}
                                prefetch={true}
                                className={cn(
                                  "flex items-center rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                                  {
                                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium": isSubActive,
                                    "text-muted-foreground hover:bg-sidebar-muted hover:text-foreground": !isSubActive,
                                  }
                                )}
                              >
                                {subRoute.title}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                )}
              </Collapsible>
            ) : (
              <SidebarMenuButton tooltip={route.title} asChild>
                <Link
                  href={route.link}
                  prefetch={true}
                  className={cn(
                    "flex items-center rounded-lg px-2 transition-colors",
                    {
                      "bg-sidebar-accent text-sidebar-accent-foreground font-medium": isActive,
                      "text-muted-foreground hover:bg-sidebar-muted hover:text-foreground": !isActive,
                      "justify-center": isCollapsed,
                    }
                  )}
                >
                  {route.icon}
                  {!isCollapsed && (
                    <span className="ml-2 text-sm font-medium">
                      {route.title}
                    </span>
                  )}
                  {!isCollapsed && route.badge !== undefined && (
                    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {route.badge}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
