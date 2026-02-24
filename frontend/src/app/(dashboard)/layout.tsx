import { Sidebar } from "@/components/app/Sidebar";
import { MobileSidebar } from "@/components/app/MobileSidebar";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { PushPrompt } from "@/components/app/PushPrompt";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — visible at lg (1024px) and above */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        <PushPrompt />

        {/* Mobile header — visible below lg */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-[60px] border-b bg-background px-4 shrink-0">
          <div className="flex items-center gap-3">
            <MobileSidebar />
            <span className="font-bold text-lg tracking-tight">FinTrack</span>
          </div>
          {/* Avatar placeholder */}
          <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
