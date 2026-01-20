import YamyLogo from '@/app/ui/yamy-logo';

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="relative">
                <div className="animate-bounce">
                    <YamyLogo size={56} className="text-primary" />
                </div>
                {/* Subtle glow effect */}
                <div className="absolute inset-0 animate-pulse blur-xl opacity-20">
                    <YamyLogo size={56} className="text-primary" />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
            </div>
        </div>
    );
}
