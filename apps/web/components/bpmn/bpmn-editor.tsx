"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

export interface BpmnEditorHandle {
  selectElement: (elementId: string) => void;
}

export interface BpmnSelection {
  id: string;
  name: string;
  type: string;
}

interface BpmnEditorProps {
  xml: string;
  readOnly: boolean;
  onSelectionChange: (selection: BpmnSelection | null) => void;
  onXmlChange: (xml: string) => void;
}

export const BpmnEditor = forwardRef<BpmnEditorHandle, BpmnEditorProps>(
  function BpmnEditor(
    { xml, readOnly, onSelectionChange, onXmlChange },
    ref,
  ): React.ReactNode {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<BpmnModeler | NavigatedViewer | null>(null);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onXmlChangeRef = useRef(onXmlChange);

    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange;
      onXmlChangeRef.current = onXmlChange;
    }, [onSelectionChange, onXmlChange]);

    useImperativeHandle(ref, () => ({
      selectElement(elementId: string): void {
        const modeler = modelerRef.current;
        if (!modeler) {
          return;
        }

        const element = modeler.get("elementRegistry").get(elementId);
        if (element) {
          modeler.get("selection").select(element);
        }
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const modeler = readOnly
        ? new NavigatedViewer({ container })
        : new BpmnModeler({ container, keyboard: { bind: window } });

      modelerRef.current = modeler;

      const handleSelection = (event: {
        newSelection?: Array<{
          id: string;
          businessObject?: { name?: string; $type?: string };
        }>;
      }): void => {
        const element = event.newSelection?.[0];
        if (!element) {
          onSelectionChangeRef.current(null);
          return;
        }

        onSelectionChangeRef.current({
          id: element.id,
          name: element.businessObject?.name ?? element.id,
          type: element.businessObject?.$type ?? "unknown",
        });
      };

      const handleChanged = async (): Promise<void> => {
        if (readOnly) {
          return;
        }

        const result = await modeler.saveXML({ format: true });
        onXmlChangeRef.current(result.xml);
      };

      const eventBus = modeler.get("eventBus");
      eventBus.on("selection.changed", handleSelection);
      if (!readOnly) {
        eventBus.on("commandStack.changed", () => {
          void handleChanged();
        });
      }

      void modeler.importXML(xml).catch(() => {
        onSelectionChangeRef.current(null);
      });

      return () => {
        modeler.destroy();
        modelerRef.current = null;
      };
    }, [readOnly, xml]);

    return (
      <div className="relative h-full min-h-[420px] overflow-hidden rounded-lg border border-border bg-card">
        <div ref={containerRef} className="h-full w-full [&_.bjs-powered-by]:hidden" />
        {readOnly ? (
          <div className="absolute right-3 top-3 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground">
            Read-only view
          </div>
        ) : null}
      </div>
    );
  },
);
