"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ontologyService } from "@/lib/api/ontology-service";
import type { ThesaurusConcept, ThesaurusFramework } from "@/lib/types";

interface ConceptPickerProps {
  onPick: (concept: { uri: string; label: string }) => void;
  placeholder?: string;
  value?: string;
}

const FRAMEWORKS: ThesaurusFramework[] = ["apqc", "etom", "sid"];

/** Search an ontology thesaurus and pick a concept (its URI = a parameter/global type). */
export function ConceptPicker({
  onPick,
  placeholder,
  value,
}: ConceptPickerProps): React.ReactNode {
  const [framework, setFramework] = useState<ThesaurusFramework>("apqc");
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<ThesaurusConcept[]>([]);
  const [open, setOpen] = useState(false);

  const search = async (text: string): Promise<void> => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const found = await ontologyService.searchThesaurus(framework, text, 8);
      setResults(found);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(false);
    }
  };

  return (
    <div className="relative flex gap-2">
      <Select
        value={framework}
        onValueChange={(v) => setFramework(v as ThesaurusFramework)}
      >
        <SelectTrigger className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FRAMEWORKS.map((f) => (
            <SelectItem key={f} value={f}>
              {f.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative flex-1">
        <Input
          value={query}
          onChange={(event) => void search(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Search ontology concept…"}
        />
        {open && results.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
            {results.map((concept) => (
              <button
                key={concept.uri}
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onPick({ uri: concept.uri, label: concept.label });
                  setQuery(concept.label);
                  setOpen(false);
                }}
              >
                <span className="truncate">{concept.label}</span>
                {concept.notation ? (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {concept.notation}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
