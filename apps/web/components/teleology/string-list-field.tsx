"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StringListFieldProps {
  id: string;
  label: string;
  description?: string;
  items: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (items: string[]) => void;
}

export function StringListField({
  id,
  label,
  description,
  items,
  disabled = false,
  placeholder = "Add item…",
  onChange,
}: StringListFieldProps): React.ReactNode {
  const [draft, setDraft] = useState("");

  const addItem = (): void => {
    const value = draft.trim();
    if (!value || disabled) {
      return;
    }
    onChange([...items, value]);
    setDraft("");
  };

  const removeItem = (index: number): void => {
    if (disabled) {
      return;
    }
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={`${id}-${index}-${item}`}
            className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-sm"
          >
            <span className="flex-1">{item}</span>
            {!disabled ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${item}`}
                onClick={() => removeItem(index)}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
            No items yet.
          </li>
        ) : null}
      </ul>

      {!disabled ? (
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
