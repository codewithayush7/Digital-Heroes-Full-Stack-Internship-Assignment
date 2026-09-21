import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-[#F8FAFC]">
      <PublicHeader />
      <div className="flex-1 flex flex-col">{children}</div>
      <PublicFooter />
    </div>
  );
}
