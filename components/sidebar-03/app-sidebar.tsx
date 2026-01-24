"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import YamyLogoBook from '@/app/ui/yamy-logo-book'
import type { Route } from "./nav-main";
import DashboardNavigation from "@/components/sidebar-03/nav-main";
import { NotificationsPopover } from "@/components/sidebar-03/nav-notifications";
import { TeamSwitcher } from "@/components/sidebar-03/team-switcher";

const sampleNotifications = [
  {
    id: "1",
    avatar: "/avatars/01.png",
    fallback: "YM",
    text: "New order received.",
    time: "10m ago",
  },
  {
    id: "2",
    avatar: "/avatars/02.png",
    fallback: "YM",
    text: "Server upgrade completed.",
    time: "1h ago",
  },
  {
    id: "3",
    avatar: "/avatars/03.png",
    fallback: "YM",
    text: "New user signed up.",
    time: "2h ago",
  },
];

const users = [
  { id: "1", name: "Demo User", logo: YamyLogoBook, plan: "Premium" },
];

export function DashboardSidebar({ routes }: { routes: Route[] }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader
        className={cn(
          "flex md:pt-3.5",
          isCollapsed
            ? "flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start"
            : "flex-row items-center justify-between"
        )}
      >
        <a href="#" className="flex items-center gap-2">
          <YamyLogoBook className="text-black" size={30} />
          {!isCollapsed && (
            <span className="font-semibold text-black dark:text-white text-sm">
              CTX English
            </span>
          )}
        </a>

        <motion.div
          key={isCollapsed ? "header-collapsed" : "header-expanded"}
          className={cn(
            "flex items-center gap-2",
            isCollapsed ? "flex-row md:flex-col-reverse" : "flex-row"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <NotificationsPopover notifications={sampleNotifications} />
          <SidebarTrigger />
        </motion.div>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-2 py-4">
        <DashboardNavigation routes={routes} />
      </SidebarContent>

      <SidebarFooter className="px-2">
        <TeamSwitcher teams={users} />
      </SidebarFooter>
    </Sidebar>
  );
}
