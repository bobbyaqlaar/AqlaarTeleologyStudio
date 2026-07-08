"use client";

import { useEffect, useState } from "react";
import { BookOpen, Link2, Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OntologyApiError, ontologyService } from "@/lib/api/ontology-service";
import type {
  OwlClass,
  ThesaurusConcept,
  ThesaurusFramework,
} from "@/lib/types";

const FRAMEWORKS: Array<{ id: ThesaurusFramework; label: string }> = [
  { id: "apqc", label: "APQC PCF" },
  { id: "etom", label: "TM Forum eTOM" },
  { id: "sid", label: "TM Forum SID" },
];

interface ThesaurusPanelProps {
  selectedClass: OwlClass | null;
  canEdit: boolean;
  onMap: (conceptUri: string) => void;
  onUnmap: (conceptUri: string) => void;
  mapping: boolean;
}

export function ThesaurusPanel({
  selectedClass,
  canEdit,
  onMap,
  onUnmap,
  mapping,
}: ThesaurusPanelProps): React.ReactNode {
  const [framework, setFramework] = useState<ThesaurusFramework>("apqc");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ThesaurusConcept[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);
      ontologyService
        .searchThesaurus(framework, query.trim())
        .then(setResults)
        .catch((err) => {
          setError(
            err instanceof OntologyApiError
              ? err.message
              : "Thesaurus search failed.",
          );
          setResults([]);
        })
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [framework, query]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">Thesaurus</p>
      </div>

      {selectedClass ? (
        <p className="text-xs text-muted-foreground">
          Map <span className="font-medium">{selectedClass.label}</span> to a
          standard concept.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select a class to map it to a standard concept.
        </p>
      )}

      {selectedClass && selectedClass.mappedConcepts.length > 0 ? (
        <div className="space-y-1">
          {selectedClass.mappedConcepts.map((conceptUri) => (
            <div
              key={conceptUri}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1"
            >
              <span className="truncate font-mono text-xs" title={conceptUri}>
                {conceptUri.split("/thesaurus/")[1] ?? conceptUri}
              </span>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0"
                  disabled={mapping}
                  onClick={() => onUnmap(conceptUri)}
                  aria-label="Remove concept mapping"
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Select
          value={framework}
          onValueChange={(value) => setFramework(value as ThesaurusFramework)}
        >
          <SelectTrigger className="w-[130px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FRAMEWORKS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search concepts…"
            className="pl-8"
          />
        </div>
      </div>

      {error ? <p className="text-xs text-amber-500">{error}</p> : null}
      {searching ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Searching…
        </div>
      ) : null}

      <div className="max-h-[280px] space-y-2 overflow-y-auto">
        {results.map((concept) => (
          <div
            key={concept.uri}
            className="space-y-1 rounded-md border border-border/60 p-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{concept.label}</p>
                {concept.notation ? (
                  <Badge variant="secondary" className="mt-0.5 font-mono text-[10px]">
                    {concept.notation}
                  </Badge>
                ) : null}
              </div>
              {canEdit && selectedClass ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  disabled={
                    mapping ||
                    selectedClass.mappedConcepts.includes(concept.uri)
                  }
                  onClick={() => onMap(concept.uri)}
                >
                  <Link2 className="size-3.5" />
                  Map
                </Button>
              ) : null}
            </div>
            {concept.definition ? (
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {concept.definition}
              </p>
            ) : null}
          </div>
        ))}
        {!searching && query.trim().length >= 2 && results.length === 0 && !error ? (
          <p className="text-xs text-muted-foreground">No concepts found.</p>
        ) : null}
      </div>
    </div>
  );
}
