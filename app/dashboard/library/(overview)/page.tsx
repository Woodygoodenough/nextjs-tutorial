import { lusitana } from '@/app/ui/fonts';
import { LibrarySearch } from '@/components/library-search';
import { getUserLibraryUnits } from '@/lib/actions/library';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LibraryUnitCard } from '@/components/library-unit-card';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: Props) {
  const params = await searchParams;
  const searchQuery = params.q || '';
  const currentPage = Number(params.page) || 1;
  const pageSize = 10;

  const { units, total, page, totalPages } = await getUserLibraryUnits(
    searchQuery,
    currentPage,
    pageSize
  );

  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        My Library
      </h1>
      
      <div className="mb-6">
        <LibrarySearch />
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              {searchQuery
                ? `No learning units found matching "${searchQuery}".`
                : 'Your library is empty. Start adding words to build your vocabulary!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {units.length} of {total} learning unit{total !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>

          <div className="mb-6">
            {units.map((unit) => (
              <div key={unit.unitId} className="mb-3 last:mb-0">
                <LibraryUnitCard unit={unit} />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={page === 1}
              >
                <Link
                  href={`/dashboard/library?${new URLSearchParams({
                    ...(searchQuery && { q: searchQuery }),
                    page: String(Math.max(1, page - 1)),
                  }).toString()}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              </Button>

              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={page >= totalPages}
              >
                <Link
                  href={`/dashboard/library?${new URLSearchParams({
                    ...(searchQuery && { q: searchQuery }),
                    page: String(Math.min(totalPages, page + 1)),
                  }).toString()}`}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
