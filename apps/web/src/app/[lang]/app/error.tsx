"use client";

import { ErrorView, type ErrorViewProps } from "@/components/states/ErrorView";

/* A page of the connected space that failed: the shell and its menu stay around it, so the person can go elsewhere. */
export default function AppError({ error, reset }: ErrorViewProps) {
  return <ErrorView error={error} reset={reset} />;
}
