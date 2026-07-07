declare module "bpmn-js/lib/Modeler" {
  import type { BaseViewerOptions } from "bpmn-js";

  export default class BpmnModeler {
    constructor(options: BaseViewerOptions);
    importXML(xml: string): Promise<{ warnings: string[] }>;
    saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
    get(service: "eventBus"): {
      on(
        event: string,
        callback: (event: { newSelection?: Array<{ id: string; businessObject?: { name?: string; $type?: string } }> }) => void,
      ): void;
      off(event: string, callback: (...args: unknown[]) => void): void;
    };
    get(service: "selection"): {
      select(element: unknown): void;
    };
    get(service: "elementRegistry"): {
      get(id: string): unknown;
    };
    destroy(): void;
  }
}

declare module "bpmn-js/lib/NavigatedViewer" {
  import type { BaseViewerOptions } from "bpmn-js";

  export default class NavigatedViewer {
    constructor(options: BaseViewerOptions);
    importXML(xml: string): Promise<{ warnings: string[] }>;
    saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
    get(service: "eventBus"): {
      on(
        event: string,
        callback: (event: { newSelection?: Array<{ id: string; businessObject?: { name?: string; $type?: string } }> }) => void,
      ): void;
      off(event: string, callback: (...args: unknown[]) => void): void;
    };
    get(service: "selection"): {
      select(element: unknown): void;
    };
    get(service: "elementRegistry"): {
      get(id: string): unknown;
    };
    destroy(): void;
  }
}

declare module "bpmn-js" {
  export interface BaseViewerOptions {
    container: HTMLElement;
    keyboard?: { bind: Window };
  }
}
