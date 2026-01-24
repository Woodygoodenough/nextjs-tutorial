"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export type ReviewSettings = {
  autoPlay: boolean;
  showTitle: boolean;
  showDetails: boolean;
};

type Props = {
  settings: ReviewSettings;
  onSettingsChange: (settings: ReviewSettings) => void;
};

export function ReviewSettingsSheet({ settings, onSettingsChange }: Props) {
  const update = (key: keyof ReviewSettings, value: boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings2 className="h-5 w-5" />
          <span className="sr-only">Review Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Review Settings</SheetTitle>
          <SheetDescription>
            Customize your review session experience.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="auto-play">Auto-play audio</Label>
            <input
              id="auto-play"
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              checked={settings.autoPlay}
              onChange={(e) => update("autoPlay", e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="show-title">Show word title</Label>
            <input
              id="show-title"
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              checked={settings.showTitle}
              onChange={(e) => update("showTitle", e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="show-details">Show full details</Label>
            <input
              id="show-details"
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              checked={settings.showDetails}
              onChange={(e) => update("showDetails", e.target.checked)}
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
