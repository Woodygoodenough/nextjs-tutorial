"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import {
  addExistingUnitToLibrary,
  resolveExistingUnit,
  searchExistingUnits,
  searchAndResolve,
  type SearchAndResolveResult,
  type SearchWidgetResolved,
  type SearchWidgetResult,
} from "@/lib/actions/search-widget";

type Status = "idle" | "suggesting" | "loading" | "success" | "empty" | "error";

function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function ExploreTiles() {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="text-sm font-medium">Search to get started</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Start typing to see matches from your library, then press Enter to run a full lookup.
      </div>
    </div>
  );
}

export function SearchWidget() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [suggestions, setSuggestions] = React.useState<Array<SearchWidgetResult>>([]);
  const [candidates, setCandidates] = React.useState<Array<SearchWidgetResult> | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [resolved, setResolved] = React.useState<SearchWidgetResolved | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Debounced DB-only suggestions while typing.
  React.useEffect(() => {
    // Idiomatic behavior: suggestions are for typing assistance only.
    // Once a result has been "resolved" (full search), we suppress the dropdown so it
    // doesn't pop open over the rendered result panel.
    if (resolved) return;
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setStatus("idle");
      return;
    }

    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          setStatus("suggesting");
          const r = await searchExistingUnits(q);
          setSuggestions(r);
          setSuggestionsOpen(isFocused && r.length > 0);
          setError(null);
        } catch (e) {
          // Don't hard-fail the whole widget on suggestion errors.
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    }, 300);

    return () => clearTimeout(t);
  }, [query, resolved, isFocused]);

  function clear() {
    setQuery("");
    setStatus("idle");
    setSuggestions([]);
    setCandidates(null);
    setSuggestionsOpen(false);
    setResolved(null);
    setError(null);
  }

  function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSuggestionsOpen(false);
    startTransition(async () => {
      try {
        setStatus("loading");
        const r: SearchAndResolveResult = await searchAndResolve(q);
        if (r.kind === "candidates") {
          setCandidates(r.candidates);
          setResolved(null);
          setStatus("success");
          setError(null);
          return;
        }
        setCandidates(null);
        setResolved(r.resolved);
        setStatus("success");
        setError(null);
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function selectSuggestion(unitId: string) {
    setSuggestionsOpen(false);
    startTransition(async () => {
      try {
        setStatus("loading");
        const r = await resolveExistingUnit(unitId);
        setResolved(r);
        setQuery(r.label);
        setStatus("success");
        setError(null);
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  async function addToLibrary() {
    if (!resolved) return;
    if (resolved.inLibrary) return;
    startTransition(async () => {
      try {
        await addExistingUnitToLibrary(resolved.unitId);
        setResolved({ ...resolved, inLibrary: true });
        // Trigger an RSC refresh so server-rendered stats (e.g. Total Vocab) update immediately.
        router.refresh();
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const showDropdown = isFocused && !resolved && query.trim().length > 0;

  return (
    <Card className="p-4">
      <div className="relative flex items-center gap-2">
        <div className="flex-1">
          <Input
            value={query}
            placeholder="Search a word…"
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              // Any new typing starts a new search flow.
              setResolved(null);
              setCandidates(null);
              setError(null);
              setSuggestionsOpen(true);
            }}
            onFocus={() => {
              setIsFocused(true);
              setSuggestionsOpen(true);
            }}
            onBlur={() => {
              // Defer closing so clicking a suggestion (mousedown) doesn't instantly
              // blur/close before the click handler runs.
              setTimeout(() => setIsFocused(false), 0);
              setTimeout(() => setSuggestionsOpen(false), 0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
          />
          {showDropdown && suggestionsOpen ? (
            <div className="absolute left-0 right-0 top-[44px] z-10">
              <Card className="p-2">
                <div className="text-xs text-muted-foreground px-2 py-1">
                  Library matches
                </div>
                {status === "suggesting" && suggestions.length === 0 ? (
                  <div className="px-2 py-2">
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    No matches
                  </div>
                ) : (
                  <div className="space-y-1">
                    {suggestions.slice(0, 3).map((s, idx) => (
                      <button
                        key={s.unitId}
                        type="button"
                        className="w-full text-left rounded-md px-2 py-2 hover:bg-muted"
                        onClick={() => {
                          setSuggestionsOpen(false);
                          selectSuggestion(s.unitId);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">#{idx + 1}</Badge>
                          <div className="truncate font-medium">{s.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </div>
        <Button onClick={runSearch} disabled={isPending || query.trim().length === 0}>
          Search
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={clear}
          disabled={isPending && status === "loading"}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="my-4" />

      {candidates && candidates.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Multiple matches found for this lookup. Pick one to view details.
          </div>
          <Card className="p-2">
            <div className="space-y-1">
              {candidates.map((c, idx) => (
                <button
                  key={c.unitId}
                  type="button"
                  className="w-full text-left rounded-md px-2 py-2 hover:bg-muted"
                  onClick={() => selectSuggestion(c.unitId)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">#{idx + 1}</Badge>
                    <div className="truncate font-medium">{c.label}</div>
                    <div className="ml-auto">
                      <Badge variant="outline">{c.matchMethod}</Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      ) : !resolved ? (
        <ExploreTiles />
      ) : (
        <ScrollArea className="h-[460px]">
          {status === "loading" ? (
            <ResultsSkeleton />
          ) : status === "error" ? (
            <div className="space-y-3">
              <div className="text-sm text-destructive">{error ?? "Something went wrong."}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={runSearch} disabled={isPending}>
                  Retry
                </Button>
              </div>
            </div>
          ) : status === "empty" ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                No matches in your library.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Card className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{resolved.label}</div>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline">{resolved.matchMethod}</Badge>
                      {resolved.inLibrary ? (
                        <Badge variant="secondary">In library</Badge>
                      ) : null}
                    </div>
                  </div>
                  {resolved.inLibrary ? (
                    <Button disabled variant="secondary">
                      In library
                    </Button>
                  ) : (
                    <Button onClick={addToLibrary} disabled={isPending}>
                      Add to library
                    </Button>
                  )}
                </div>
              </Card>

              <div className="text-sm text-muted-foreground">
                Top entries (showing first 3)
              </div>
              <Card className="p-0">
                {resolved.entries.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No entries available.
                  </div>
                ) : (
                  <div>
                    {resolved.entries.slice(0, 3).map((e, i) => (
                      <React.Fragment key={e.entryUuid}>
                        {i > 0 ? <Separator /> : null}
                        <div className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">#{i + 1}</Badge>
                            <div className="font-medium truncate">
                              {e.headwordRaw ?? "—"}
                            </div>
                          </div>
                          {e.metaId ? (
                            <div className="mt-1 text-xs text-muted-foreground truncate">
                              {e.metaId}
                            </div>
                          ) : null}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </ScrollArea>
      )}
    </Card>
  );
}

