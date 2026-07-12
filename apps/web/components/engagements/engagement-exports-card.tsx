"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText, History, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { engagementExportService } from "@/lib/api/engagement-export-service";
import { cn } from "@/lib/utils";

interface EngagementExportsCardProps {
  engagementId: string;
  engagementName: string;
}

export function EngagementExportsCard({
  engagementId,
  engagementName,
}: EngagementExportsCardProps): React.ReactNode {
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDownloadPdf = async (): Promise<void> => {
    setDownloading(true);
    setMessage(null);
    try {
      await engagementExportService.downloadPdf(engagementId);
      setMessage("PDF downloaded.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "PDF export failed.",
      );
    }
    setDownloading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" />
          Exports & audit
        </CardTitle>
        <CardDescription>
          Watermarked engagement summary PDF and append-only activity log for{" "}
          {engagementName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={downloading}
            onClick={() => void handleDownloadPdf()}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download PDF
          </Button>
          <Link
            href={`/engagements/${engagementId}/audit`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-2")}
          >
            <History className="size-4" />
            View audit trail
          </Link>
        </div>
        {message ? (
          <p className="text-xs text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
