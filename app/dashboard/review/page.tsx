import { getDueReviewItems } from "@/lib/actions/review";
import { ReviewSessionClient } from "./review-session-client";
import { lusitana } from "@/app/ui/fonts";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpenCheck } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  // Fetch a batch of due items
  const items = await getDueReviewItems(10);

  return (
    <main className="max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className={`${lusitana.className} text-2xl md:text-3xl font-bold mb-2`}>
          Review Session
        </h1>
        <p className="text-muted-foreground">
          Review your vocabulary words to keep them fresh.
        </p>
      </div>

      {items.length > 0 ? (
        <ReviewSessionClient initialItems={items} />
      ) : (
        <Card className="text-center py-12">
           <CardContent className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                  <BookOpenCheck className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">All caught up!</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                  You have no words due for review right now. Check back later or add new words to your library.
              </p>
           </CardContent>
        </Card>
      )}
    </main>
  );
}
