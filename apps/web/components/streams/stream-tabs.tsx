"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VALUE_STREAM_META } from "@/lib/constants/value-streams";
import type { ValueStreamType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface StreamTabsProps {
  engagementId: string;
  loadedStreams: ValueStreamType[];
  activeStream: ValueStreamType;
}

type StreamTabMode = "stream" | "process" | "ontology";

function resolveMode(pathname: string): StreamTabMode {
  if (pathname.endsWith("/ontology")) {
    return "ontology";
  }
  if (pathname.endsWith("/process")) {
    return "process";
  }
  return "stream";
}

export function StreamTabs({
  engagementId,
  loadedStreams,
  activeStream,
}: StreamTabsProps): React.ReactNode {
  const pathname = usePathname();
  const mode = resolveMode(pathname);

  return (
    <div className="flex flex-wrap gap-2">
      {loadedStreams.map((streamType) => {
        const meta = VALUE_STREAM_META[streamType];
        const href =
          mode === "process"
            ? `/engagements/${engagementId}/streams/${streamType}/process`
            : mode === "ontology"
              ? `/engagements/${engagementId}/streams/${streamType}/ontology`
              : `/engagements/${engagementId}/streams/${streamType}`;
        const active = streamType === activeStream;

        return (
          <Link
            key={streamType}
            href={href}
            className={cn(
              buttonVariants({
                variant: active ? "default" : "outline",
                size: "sm",
              }),
            )}
          >
            {meta.shortLabel}
          </Link>
        );
      })}
    </div>
  );
}
