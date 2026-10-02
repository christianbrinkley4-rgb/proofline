"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSession } from "@/lib/auth-client";

export function ErrorUser() {
  const { data } = useSession();
  const id = data?.user.id;
  useEffect(() => {
    Sentry.setUser(id ? { id } : null);
    return () => { Sentry.setUser(null); };
  }, [id]);
  return null;
}
