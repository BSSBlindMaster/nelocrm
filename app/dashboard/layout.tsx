"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [hasSession, setHasSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function validateSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (!session) {
        router.replace("/");
        return;
      }

      setHasSession(true);
      setIsCheckingSession(false);
    }

    void validateSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isCheckingSession || !hasSession) {
    return null;
  }

  return <>{children}</>;
}
