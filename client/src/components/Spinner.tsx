import React from "react";
import { Loader2 } from "lucide-react";

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <Loader2 className={`spinner ${className}`} size={size} />;
}
