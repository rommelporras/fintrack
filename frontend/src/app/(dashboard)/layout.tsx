import { Sidebar } from "@/components/app/Sidebar";
import { MobileSidebar } from "@/components/app/MobileSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 border-b px-4 py-3">
          <MobileSidebar />
          <span className="font-semibold">FinTrack</span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
