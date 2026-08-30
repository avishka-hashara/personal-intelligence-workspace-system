"use client";

import { useEffect } from "react";
import { useUIStore, type PageContextType } from "@/store/uiStore";

export interface ContextSetterProps {
  type: PageContextType;
  id: string;
  title: string;
  data?: string;
}

export function truncate(str?: string, maxLen: number = 2000): string | undefined {
  if (!str) return undefined;
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\n\n[...truncated]";
}

export function ContextSetter({ type, id, title, data }: ContextSetterProps) {
  const setPageContext = useUIStore((s) => s.setPageContext);
  const clearPageContext = useUIStore((s) => s.clearPageContext);

  useEffect(() => {
    setPageContext({
      type,
      id,
      title,
      data: truncate(data),
    });
    return () => clearPageContext(id);
  }, [type, id, title, data, setPageContext, clearPageContext]);

  return null;
}
