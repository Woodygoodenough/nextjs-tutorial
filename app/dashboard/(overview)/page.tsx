
import { lusitana } from '@/app/ui/fonts';
import { ChartLineLabel } from '@/components/chart';
import Stats04 from '@/components/stats-04';

import { SearchWidget } from '@/components/search-widget';

export default async function Page() {

    return (
        <main>
            <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
                Dashboard
            </h1>
            <Stats04 />
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
                <div className="flex w-full flex-col md:col-span-4">
                    <h2 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
                        Mastery Progress
                    </h2>
                    <ChartLineLabel />
                </div>
                <div className="flex w-full flex-col md:col-span-4">
                    <h2 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
                        Let's Explore!
                    </h2>
                    <div className="w-full">
                        <SearchWidget />
                    </div>
                </div>
            </div>
        </main>
    );
}