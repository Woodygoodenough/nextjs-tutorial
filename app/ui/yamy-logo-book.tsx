import { BookOpenIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { lusitana } from "@/app/ui/fonts";

type YamyLogoBookProps = {
    className?: string;
    size?: number;
};

export default function YamyLogoBook({ className, size }: YamyLogoBookProps) {
    return (
        <div className={clsx(
            lusitana.className,
            "flex flex-row items-center leading-none",
            className
        )}>
            <BookOpenIcon className="rotate-[15deg]" style={{ width: size, height: size }} />
        </div>
    );
}