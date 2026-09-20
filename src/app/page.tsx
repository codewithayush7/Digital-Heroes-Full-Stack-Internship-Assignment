export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-400">
          <span>Digital Heroes Platform</span>
          <span className="text-slate-500">•</span>
          <span>Foundation Ready</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-white">
          Give back. Play smart. <br />
          <span className="text-amber-400">Win together.</span>
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed">
          A modern platform combining golf performance tracking, charitable
          fundraising, and algorithm-driven monthly prize draws.
        </p>
      </div>
    </main>
  );
}
