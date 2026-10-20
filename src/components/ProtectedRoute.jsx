
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function ProtectedRoute() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (mounted) {
          setSession(data.session);
          setChecking(false);
        }
      } catch (error) {
        console.error("Session check failed:", error);

        if (mounted) {
          setSession(null);
          setChecking(false);
        }
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#080608] text-white">
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle
            size={32}
            className="animate-spin text-pink-400"
          />
          <p className="text-sm text-zinc-400">
            Checking your DARLING session...
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}
