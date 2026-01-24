import { lusitana } from '@/app/ui/fonts';
import { getWordDetail } from '@/lib/actions/library';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPercentageProgress } from '@/domain/review/scheduler';
import { cn } from '@/lib/utils';
import { PronunciationButton } from '@/components/pronunciation-button';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function getProgressColor(percentage: number): string {
  if (percentage < 30) return 'bg-red-500';
  if (percentage < 60) return 'bg-amber-500';
  if (percentage < 85) return 'bg-blue-500';
  return 'bg-emerald-500';
}

function getProgressBgColor(percentage: number): string {
  if (percentage < 30) return 'bg-red-50 dark:bg-red-950/20';
  if (percentage < 60) return 'bg-amber-50 dark:bg-amber-950/20';
  if (percentage < 85) return 'bg-blue-50 dark:bg-blue-950/20';
  return 'bg-emerald-50 dark:bg-emerald-950/20';
}

const formatDate = (date: Date | string | null) => {
  if (!date) return 'Never reviewed';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Never reviewed';
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - dateObj.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return dateObj.toLocaleDateString();
};

function mwDisplayTerm(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(/\*/g, '').normalize('NFC').trim();
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

  // Minimal fallback: show dtType badge if we can’t render it yet
  if (dt.text) {
    return <p className="text-sm leading-relaxed">{dt.text}</p>;
  }
  return null;
}

export default async function WordDetailPage({ params }: Props) {
  const { id } = await params;
  const word = await getWordDetail(id);

  if (!word) {
    notFound();
  }

  const progressPercentage = await getPercentageProgress(word.progress);
  const progressColor = getProgressColor(progressPercentage);
  const progressBgColor = getProgressBgColor(progressPercentage);

  return (
    <main>
      <div className="mb-6">
        <Link href="/dashboard/library">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </Link>
        
        <div className="flex items-center justify-between">
          <h1 className={`${lusitana.className} text-2xl md:text-3xl font-bold`}>
            {word.label}
          </h1>
          <PronunciationButton
            soundAudio={word.selectedStem.soundAudio}
            variant="outline"
            size="icon"
            className="h-10 w-10"
            ariaLabel="Pronounce selected stem"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Word Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {word.headwordRaw && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Headword</p>
                <p className="font-medium">{word.headwordRaw}</p>
              </div>
            )}

            {word.metaId && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Dictionary Entry ID</p>
                <p className="font-mono text-sm">{word.metaId}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-1">Anchor</p>
              <Badge variant="outline">{word.anchorKind ?? "—"}</Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Selected stem (learning unit)</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{mwDisplayTerm(word.selectedStem.stem)}</span>
                <Badge variant="outline">meta.stems[{word.selectedStem.rank}]</Badge>
                <Badge variant="secondary">{word.selectedStem.anchorKind}</Badge>
                {word.selectedStem.fallbackWarning && (
                  <Badge variant="destructive">FALLBACK</Badge>
                )}
              </div>
            </div>

            {word.shortdef && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Definition</p>
                <p className="text-sm">{word.shortdef}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Learning Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Progress</p>
                <span className={cn("text-sm font-medium", {
                  "text-red-600 dark:text-red-400": progressPercentage < 30,
                  "text-amber-600 dark:text-amber-400": progressPercentage >= 30 && progressPercentage < 60,
                  "text-blue-600 dark:text-blue-400": progressPercentage >= 60 && progressPercentage < 85,
                  "text-emerald-600 dark:text-emerald-400": progressPercentage >= 85,
                })}>
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <div className={cn("h-3 w-full rounded-full overflow-hidden", progressBgColor)}>
                <div
                  className={cn("h-full transition-all duration-300", progressColor)}
                  style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Reviewed</p>
              <p className="text-sm">{formatDate(word.lastReviewedAt)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Raw Progress Value</p>
              <p className="text-sm font-mono">{word.progress}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed view: full lexical group (entries + stems) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Entry group</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This learning unit belongs to a lexical group with {word.entries.length} entry(ies). The entry containing the selected stem is shown first.
            </p>

            <div className="space-y-4">
              {word.entries.map((e) => {
                const isSelectedEntry = e.entryUuid === word.selectedStem.entryUuid;
                const entryTitle = mwDisplayTerm(e.titleStem ?? e.hwiHw ?? e.headwordRaw ?? e.stems[0]?.stem ?? 'Entry');
                const entryIndex = e.groupRank + 1;
                const visibleStems = e.stems.filter((s) => {
                  // If the entry title is the headword, don't repeat it in the stems list.
                  // (We preserve capitalization by using the raw term minus MW '*' markers.)
                  return mwDisplayTerm(s.stem) !== entryTitle;
                });
                return (
                  <Card key={e.entryUuid} className="border-dashed">
                    <CardHeader className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {entryIndex}. {entryTitle}
                        </CardTitle>
                        <PronunciationButton
                          soundAudio={e.hwiSoundAudio}
                          ariaLabel={`Pronounce ${entryTitle}`}
                        />
                        <Badge variant="outline">entry#{e.groupRank}</Badge>
                        {isSelectedEntry && <Badge>ANCHOR ENTRY</Badge>}
                      </div>
                      <div className="flex flex-col gap-1">
                        {e.metaId && (
                          <p className="text-xs text-muted-foreground font-mono break-all">
                            meta.id: {e.metaId}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground font-mono break-all">
                          entry_uuid: {e.entryUuid}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {visibleStems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No stems persisted for this entry yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {visibleStems.map((s) => {
                            const stemDisplay = mwDisplayTerm(s.stem);
                            const detail = s.anchorText ? mwDisplayTerm(s.anchorText) : null;
                            const kindLabel =
                              s.anchorKind === 'URO'
                                ? 'Undefined run-on'
                                : s.anchorKind === 'DRO'
                                  ? 'Defined run-on'
                                  : s.anchorKind === 'VRS'
                                    ? 'Variant'
                                    : s.anchorKind === 'INS'
                                      ? 'Inflection'
                                      : s.anchorKind === 'AHW'
                                        ? 'Alt headword'
                                        : s.anchorKind === 'HWI'
                                          ? 'Headword'
                                          : null;

                            return (
                            <div
                              key={s.stemId}
                              className="flex items-start justify-between gap-4 rounded-md border p-3"
                            >
                              <div className="min-w-0">
                                <div className="font-medium">{stemDisplay}</div>
                                {kindLabel && (
                                  <div className="mt-1 text-xs text-muted-foreground">{kindLabel}</div>
                                )}
                                {detail && detail !== stemDisplay && (
                                  <div className="mt-1 text-sm text-muted-foreground">
                                    {detail}
                                  </div>
                                )}
                                {s.fallbackWarning && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    No explicit owner found yet; keep as a searchable stem.
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <PronunciationButton
                                  soundAudio={s.soundAudio}
                                  ariaLabel={`Pronounce ${stemDisplay}`}
                                />
                                {s.isUnitStem && <Badge>UNIT</Badge>}
                                <Badge variant="outline">meta.stems[{s.rank}]</Badge>
                                <Badge variant="secondary">{s.anchorKind}</Badge>
                                {s.fallbackWarning && <Badge variant="destructive">FALLBACK</Badge>}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}

                      {e.definitions.scopes.length > 0 && (
                        <div className="pt-4 space-y-4">
                          {e.definitions.scopes.map((scope) => (
                            <div key={`${scope.scopeType}:${scope.scopeId}`} className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold">
                                  {scope.scopeType === 'ENTRY'
                                    ? 'Definitions'
                                    : scope.label
                                      ? `Run-on: ${scope.label}`
                                      : 'Run-on'}
                                </h4>
                                <Badge variant="outline">{scope.scopeType}</Badge>
                              </div>

                              <div className="space-y-3">
                                {(() => {
                                  let lastVd: string | null = null;
                                  return scope.senses.map((s) => {
                                    const showVd = s.vd && s.vd !== lastVd;
                                    lastVd = s.vd ?? lastVd;
                                    const indent = Math.min(6, Math.max(0, s.depth)) * 12;
                                    return (
                                      <div key={s.senseId} style={{ marginLeft: indent }} className="space-y-1">
                                        {showVd && (
                                          <p className="text-xs text-muted-foreground italic">{s.vd}</p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-2">
                                          {s.sn && <span className="text-sm font-semibold">{s.sn}</span>}
                                          <Badge variant="secondary">{s.kind}</Badge>
                                        </div>

                                        <div className="space-y-2">
                                          {s.dt.map((dt) => (
                                            <div key={dt.dtId}>{renderDtItem(dt)}</div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
