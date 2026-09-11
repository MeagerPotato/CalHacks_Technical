"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";

interface MotionReplayProps {
  label: string;
  children: ReactNode;
}

/** Development gallery only: remounts its children so play-once CSS motion can be watched again. */
export function MotionReplay({ label, children }: MotionReplayProps) {
  const [round, setRound] = useState(0);

  return (
    <>
      <Button variant="secondary" onClick={() => setRound((current) => current + 1)}>
        {label}
      </Button>
      <div key={round}>{children}</div>
    </>
  );
}
