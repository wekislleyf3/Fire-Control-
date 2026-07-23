import Sidebar from "./components/Sidebar";
import GlobalSearch from "./components/GlobalSearch";
import { AuthProvider } from "@/contexts/AuthContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex flex-col md:flex-row min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center px-4 md:px-6 py-3 border-b border-black/5 bg-white md:sticky md:top-0 z-30">
            <GlobalSearch />
          </header>
          <main className="flex-1 p-4 md:p-8 max-w-full overflow-x-hidden">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
