import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/sidebar-03/app-sidebar";
import { getDueReviewCount } from "@/lib/actions/review";
import {
  Home,
  Settings,
  ChartBar,
  BookOpen,
  GraduationCap,
  Puzzle,
  BookHeadphones
} from "lucide-react";
import type { Route } from "./nav-main";

export default async function Sidebar03() {
  const reviewCount = await getDueReviewCount();

  const dashboardRoutes: Route[] = [
    {
      id: "home",
      title: "Home",
      icon: <Home className="size-4" />,
      link: "/",
    },
    {
      id: "dashboard",
      title: "Dashboard",
      icon: <ChartBar className="size-4" />,
      link: "/dashboard",
    },
    {
      id: "library",
      title: "My Library",
      icon: <BookOpen className="size-4" />,
      link: "/dashboard/library",
    },
    {
      id: "review",
      title: "Review",
      icon: <GraduationCap className="size-4" />,
      link: "/dashboard/review",
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    {
      id: "crossword",
      title: "Crossword",
      icon: <Puzzle className="size-4" />,
      link: "/dashboard/crossword",
    },
    {
      id: "story",
      title: "AI Story",
      icon: <BookHeadphones className="size-4" />,
      link: "/dashboard/story",
    },
    {
      id: "settings",
      title: "Settings",
      icon: <Settings className="size-4" />,
      link: "#",
      subs: [
        { title: "General", link: "#" },
        { title: "Webhooks", link: "#" },
        { title: "Custom Fields", link: "#" },
      ],
    },
  ];

  return (
    <SidebarProvider>
      <div className="relative flex h-screen w-full">
        <DashboardSidebar routes={dashboardRoutes} />
        <SidebarInset className="flex flex-col" />
      </div>
    </SidebarProvider>
  );
}
