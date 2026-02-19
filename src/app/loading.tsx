import Image from 'next/image';

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950">
            <div className="relative w-64 h-64 animate-pulse">
                <Image
                    src="/loading.png"
                    alt="Loading..."
                    fill
                    className="object-contain"
                    priority
                />
            </div>
            <div className="mt-8 flex flex-col items-center gap-2">
                <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">
                    Initializing Match
                </p>
            </div>
        </div>
    );
}
