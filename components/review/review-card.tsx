"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PronunciationButton, mwAudioUrlFromBaseFilename } from "@/components/pronunciation-button";
import { ReviewSettings } from "./review-settings";
import { WordDetail } from "@/lib/actions/library";
import { cn } from "@/lib/utils";
import { Eye, Check, X } from "lucide-react";

type Props = {
  item: WordDetail;
  settings: ReviewSettings;
  onReview: (unitId: string, isRemembered: boolean) => void;
};

function mwDisplayTerm(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\*/g, "").normalize("NFC").trim();
}

function renderDtItem(dt: {
  dtType: string;
  text: string | null;
  payload: any | null;
}) {
  if (dt.dtType === 'text' && dt.text) {
    return <p className="text-sm leading-relaxed">{dt.text}</p>;
  }

  if (dt.dtType === 'vis' && Array.isArray(dt.payload?.examples)) {
    const examples = dt.payload.examples as Array<{ t: string; aq?: any }>;
    if (examples.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Examples</p>
        <ul className="list-disc pl-5 space-y-1">
          {examples.map((ex, i) => (
            <li key={i} className="text-sm">
              {ex.t}
              {ex.aq?.auth && (
                <span className="text-xs text-muted-foreground"> — {ex.aq.auth}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (dt.dtType === 'ca' && Array.isArray(dt.payload?.cats)) {
    const intro = typeof dt.payload?.intro === 'string' ? dt.payload.intro : 'called also';
    const cats = (dt.payload.cats as Array<{ cat: string }>).map((c) => c.cat).filter(Boolean);
    if (cats.length === 0) return null;
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">{intro} </span>
        {cats.join(', ')}
      </p>
    );
  }

  if (dt.dtType === 'uns' && Array.isArray(dt.payload?.items)) {
    const items = dt.payload.items as Array<any>;
    const lines = items
      .map((it) => (typeof it?.text === 'string' ? it.text : null))
      .filter(Boolean) as string[];
    if (lines.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Usage</p>
        {lines.map((t, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {t}
          </p>
        ))}
      </div>
    );
  }

  // Minimal fallback
  if (dt.text) {
    return <p className="text-sm leading-relaxed">{dt.text}</p>;
  }
  return null;
}

export function ReviewCard({ item, settings, onReview }: Props) {
  const [revealed, setRevealed] = useState(false);
  const audioPlayedRef = useRef(false);

  // Audio Logic
  // Use the item.selectedStem.soundAudio for the main pronunciation
  const audioUrl = item.selectedStem.soundAudio
    ? mwAudioUrlFromBaseFilename(item.selectedStem.soundAudio)
    : null;

  // Reset state when item changes
  useEffect(() => {
    setRevealed(false);
    // Note: We do NOT reset audioPlayedRef here.
    // Since ReviewCard is keyed by unitId, a new instance is created for each word,
    // and useRef initializes to false.
    // Resetting it here causes double-playback in Strict Mode (mount -> reset -> play -> unmount -> remount -> reset -> play).
  }, [item.unitId]);

  // Auto-play
  useEffect(() => {
    // Only play if we haven't played yet (guarded by ref)
    if (settings.autoPlay && audioUrl && !audioPlayedRef.current) {
      const audio = new Audio(audioUrl);
      audio.play().catch((err) => {
        console.warn("Auto-play failed (likely browser blocked):", err);
      });
      audioPlayedRef.current = true;

      // Cleanup: pause audio if component unmounts (e.g. user skips quickly)
      return () => {
        audio.pause();
        // Reset ref so that if Strict Mode remounts the component immediately, it can play again.
        // Without this, the second mount sees ref=true and skips playing, resulting in silence
        // (because the first mount's audio was paused by this cleanup).
        audioPlayedRef.current = false;
      };
    }
  }, [settings.autoPlay, audioUrl]); // Removed item.unitId dependency as it is constant for this instance (keyed)

  // Visibility Logic
  // If no PR (no audio), title MUST be shown.
  const hasAudio = !!audioUrl;
  const showTitle = settings.showTitle || !hasAudio || revealed;
  const showDetails = settings.showDetails || revealed;

  const isMasked = !showTitle && !showDetails;

  // If details are shown (either by setting or reveal), buttons should be visible.
  // This matches the flow: Question -> [Reveal] -> Answer+Buttons.
  // If Show Details setting is ON, we skip the reveal step for the definition.
  const actionsVisible = revealed || settings.showDetails;

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-md">
      <CardHeader className="relative">
         {/* Top controls: Audio + Settings trigger (handled by parent, but we might want audio here) */}
         <div className="flex justify-between items-start">
             <div className="space-y-2">
                 {/* Title Section */}
                 {showTitle ? (
                     <div className="flex items-center gap-3">
                         <h2 className="text-3xl font-bold">{item.label}</h2>
                         <PronunciationButton soundAudio={item.selectedStem.soundAudio} />
                         {item.anchorKind && <Badge variant="outline">{item.anchorKind}</Badge>}
                     </div>
                 ) : (
                    <div className="h-10 flex items-center gap-2">
                        <span className="italic text-muted-foreground">Title hidden...</span>
                        <Button variant="ghost" size="sm" onClick={() => setRevealed(true)}>Reveal</Button>
                        <PronunciationButton soundAudio={item.selectedStem.soundAudio} />
                    </div>
                 )}
             </div>
         </div>
      </CardHeader>

      <CardContent className="min-h-[200px] flex flex-col justify-center">
        {isMasked && !revealed ? (
            <Button
                size="lg"
                className="w-full h-32 text-lg"
                onClick={() => setRevealed(true)}
            >
                <Eye className="mr-2 h-6 w-6" />
                Show Details
            </Button>
        ) : (
            <div className="space-y-6">
                {/* Short Def */}
                {showDetails && item.shortdef && (
                     <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Definition</h3>
                        <p className="text-lg">{item.shortdef}</p>
                     </div>
                )}

                {/* Full Entries (if showDetails) */}
                {showDetails && (
                    <div className="space-y-4 pt-4 border-t">
                        {item.entries.map((e) => {
                            const entryTitle = mwDisplayTerm(e.titleStem ?? e.hwiHw ?? e.headwordRaw ?? 'Entry');
                            // Only show if it's not redundant or if we want full context
                             return (
                                <div key={e.entryUuid} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{entryTitle}</span>
                                        <Badge variant="secondary" className="text-[10px] h-5">{e.hwiHw ? 'Headword' : 'Entry'}</Badge>
                                    </div>
                                    {e.definitions.scopes.map((scope) => (
                                        <div key={`${scope.scopeType}:${scope.scopeId}`} className="pl-4 border-l-2 border-muted">
                                            {scope.senses.map((s) => (
                                                <div key={s.senseId} className="mb-2">
                                                     {s.dt.map((dt) => (
                                                        <div key={dt.dtId}>{renderDtItem(dt)}</div>
                                                     ))}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                             )
                        })}
                    </div>
                )}

                {/* If details are hidden but title is shown, show button to reveal rest */}
                {!showDetails && !revealed && (
                     <Button
                        variant="secondary"
                        className="w-full mt-4"
                        onClick={() => setRevealed(true)}
                    >
                        <Eye className="mr-2 h-4 w-4" />
                        Show Full Details
                    </Button>
                )}
            </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-4 pt-6 border-t bg-muted/20">
          {actionsVisible ? (
              <>
                <Button
                    variant="destructive"
                    className="flex-1 h-12 text-lg"
                    onClick={() => onReview(item.unitId, false)}
                >
                    <X className="mr-2 h-5 w-5" />
                    I don't remember
                </Button>
                <Button
                    variant="default"
                    className="flex-1 h-12 text-lg bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onReview(item.unitId, true)}
                >
                    <Check className="mr-2 h-5 w-5" />
                    I remember
                </Button>
              </>
          ) : (
              <div className="w-full text-center text-sm text-muted-foreground italic">
                  Reveal details to review
              </div>
          )}
      </CardFooter>
    </Card>
  );
}
