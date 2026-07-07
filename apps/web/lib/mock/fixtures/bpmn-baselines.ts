import type { FunctionalUnit, ValueStreamType } from "@/lib/types";

export interface BaselineTask {
  id: string;
  name: string;
  defaultFunctionUnit?: FunctionalUnit;
}

const STREAM_TASKS: Record<ValueStreamType, BaselineTask[]> = {
  o2c: [
    { id: "Task_validate", name: "Validate order", defaultFunctionUnit: "sales" },
    { id: "Task_credit", name: "Credit check" },
    { id: "Task_fulfil", name: "Fulfil order", defaultFunctionUnit: "operations" },
    { id: "Task_invoice", name: "Invoice customer", defaultFunctionUnit: "finance" },
    { id: "Task_collect", name: "Collect payment", defaultFunctionUnit: "finance" },
  ],
  p2p: [
    { id: "Task_requisition", name: "Create requisition", defaultFunctionUnit: "operations" },
    { id: "Task_approve", name: "Approve spend" },
    { id: "Task_po", name: "Issue purchase order", defaultFunctionUnit: "procurement_scm" },
    { id: "Task_receive", name: "Receive goods", defaultFunctionUnit: "procurement_scm" },
    { id: "Task_pay", name: "Pay supplier", defaultFunctionUnit: "finance" },
  ],
  c2m: [
    { id: "Task_ideate", name: "Capture concept", defaultFunctionUnit: "products" },
    { id: "Task_design", name: "Design solution" },
    { id: "Task_build", name: "Build product", defaultFunctionUnit: "production" },
    { id: "Task_launch", name: "Launch to market", defaultFunctionUnit: "marketing" },
    { id: "Task_support", name: "Customer onboarding", defaultFunctionUnit: "customer_care" },
  ],
  h2r: [
    { id: "Task_recruit", name: "Recruit candidate", defaultFunctionUnit: "operations" },
    { id: "Task_interview", name: "Interview panel" },
    { id: "Task_offer", name: "Issue offer", defaultFunctionUnit: "operations" },
    { id: "Task_onboard", name: "Onboard employee", defaultFunctionUnit: "it" },
    { id: "Task_develop", name: "Career development", defaultFunctionUnit: "operations" },
  ],
  t2r: [
    { id: "Task_intake", name: "Log incident", defaultFunctionUnit: "customer_care" },
    { id: "Task_triage", name: "Triage issue" },
    { id: "Task_diagnose", name: "Diagnose root cause", defaultFunctionUnit: "it" },
    { id: "Task_resolve", name: "Resolve incident", defaultFunctionUnit: "operations" },
    { id: "Task_close", name: "Close and survey", defaultFunctionUnit: "customer_care" },
  ],
};

export function getBaselineTasks(streamType: ValueStreamType): BaselineTask[] {
  return STREAM_TASKS[streamType];
}

export function getDefaultElementMeta(
  streamType: ValueStreamType,
): Record<string, { functionUnit?: FunctionalUnit }> {
  const meta: Record<string, { functionUnit?: FunctionalUnit }> = {};

  for (const task of STREAM_TASKS[streamType]) {
    meta[task.id] = task.defaultFunctionUnit
      ? { functionUnit: task.defaultFunctionUnit }
      : {};
  }

  return meta;
}

export function getBaselineBpmnXml(streamType: ValueStreamType): string {
  const tasks = STREAM_TASKS[streamType];
  const processId = `Process_${streamType}`;

  const taskNodes = tasks
    .map((task) => `    <bpmn:task id="${task.id}" name="${task.name}" />`)
    .join("\n");

  const flowNodes: string[] = [
    `    <bpmn:sequenceFlow id="Flow_start" sourceRef="StartEvent_1" targetRef="${tasks[0].id}" />`,
  ];

  for (let index = 1; index < tasks.length; index += 1) {
    flowNodes.push(
      `    <bpmn:sequenceFlow id="Flow_${index}" sourceRef="${tasks[index - 1].id}" targetRef="${tasks[index].id}" />`,
    );
  }

  flowNodes.push(
    `    <bpmn:sequenceFlow id="Flow_end" sourceRef="${tasks[tasks.length - 1].id}" targetRef="EndEvent_1" />`,
  );

  const shapes = [
    `      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="160" y="182" width="36" height="36" /></bpmndi:BPMNShape>`,
    ...tasks.map((task, index) => {
      const x = 240 + index * 160;
      return `      <bpmndi:BPMNShape id="${task.id}_di" bpmnElement="${task.id}"><dc:Bounds x="${x}" y="160" width="120" height="80" /></bpmndi:BPMNShape>`;
    }),
    `      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="${240 + tasks.length * 160}" y="182" width="36" height="36" /></bpmndi:BPMNShape>`,
  ].join("\n");

  const edges = [
    `      <bpmndi:BPMNEdge id="Flow_start_di" bpmnElement="Flow_start"><di:waypoint x="196" y="200" /><di:waypoint x="240" y="200" /></bpmndi:BPMNEdge>`,
    ...tasks.slice(1).map((task, index) => {
      const x1 = 240 + index * 160 + 120;
      const x2 = 240 + (index + 1) * 160;
      return `      <bpmndi:BPMNEdge id="Flow_${index + 1}_di" bpmnElement="Flow_${index + 1}"><di:waypoint x="${x1}" y="200" /><di:waypoint x="${x2}" y="200" /></bpmndi:BPMNEdge>`;
    }),
    `      <bpmndi:BPMNEdge id="Flow_end_di" bpmnElement="Flow_end"><di:waypoint x="${240 + (tasks.length - 1) * 160 + 120}" y="200" /><di:waypoint x="${240 + tasks.length * 160}" y="200" /></bpmndi:BPMNEdge>`,
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${streamType}" targetNamespace="http://ots.local/bpmn/${streamType}">
  <bpmn:process id="${processId}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
${taskNodes}
    <bpmn:endEvent id="EndEvent_1" name="End" />
${flowNodes.join("\n")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">
${shapes}
${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
