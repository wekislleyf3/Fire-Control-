import Sidebar from "./components/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex flex-col md:flex-row min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 max-w-full overflow-x-hidden">{children}</main>
      </div>
    </AuthProvider>
  );
}
