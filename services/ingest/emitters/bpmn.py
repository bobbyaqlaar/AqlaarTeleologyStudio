"""Emit a BPMN 2.0 XML workflow diagram for a value stream.

Sequential flow of process-level tasks (same chain as ots:precedes in the
TTL emitter), one lane per function unit. Includes BPMNDiagram DI section so
the file opens directly in the bpmn-js editor in apps/web. Gateways/branches
are consultant work in the editor — the generated file is a straight-line
baseline.
"""

from __future__ import annotations

import re
from pathlib import Path
from xml.etree import ElementTree as ET

from services.ingest.models import ProcessElement, StreamMapping
from services.ingest.selection import leaf_level_elements, select

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
DI_NS = "http://www.omg.org/spec/DD/20100524/DI"

TASK_W, TASK_H, GAP_X, LANE_H, START_X = 140, 70, 60, 130, 180


def _task_id(element: ProcessElement) -> str:
    return "Task_" + re.sub(r"[^A-Za-z0-9]", "_", element.id)


def emit(
    stream: StreamMapping,
    elements: list[ProcessElement],
    out_path: Path,
) -> None:
    ET.register_namespace("bpmn", BPMN_NS)
    ET.register_namespace("bpmndi", BPMNDI_NS)
    ET.register_namespace("dc", DC_NS)
    ET.register_namespace("di", DI_NS)

    # Ordered process-level tasks with their default function unit.
    tasks: list[tuple[ProcessElement, str]] = []
    for subtree in stream.subtrees:
        selected = leaf_level_elements(subtree, select(subtree, elements))
        tasks.extend((element, subtree.function_unit) for element in selected)

    lanes = list(dict.fromkeys(unit for _, unit in tasks))

    definitions = ET.Element(
        f"{{{BPMN_NS}}}definitions",
        {
            "id": f"Defs_{stream.stream}",
            "targetNamespace": "http://ots.local/bpmn",
        },
    )
    process = ET.SubElement(
        definitions,
        f"{{{BPMN_NS}}}process",
        {"id": f"Process_{stream.stream}", "name": stream.label, "isExecutable": "false"},
    )

    lane_set = ET.SubElement(process, f"{{{BPMN_NS}}}laneSet", {"id": "LaneSet_1"})
    lane_nodes: dict[str, ET.Element] = {}
    for unit in lanes:
        lane_nodes[unit] = ET.SubElement(
            lane_set, f"{{{BPMN_NS}}}lane", {"id": f"Lane_{unit}", "name": unit}
        )

    def lane_ref(unit: str, node_id: str) -> None:
        ET.SubElement(lane_nodes[unit], f"{{{BPMN_NS}}}flowNodeRef").text = node_id

    start_id, end_id = "StartEvent_1", "EndEvent_1"
    ET.SubElement(process, f"{{{BPMN_NS}}}startEvent", {"id": start_id, "name": "Start"})
    lane_ref(lanes[0], start_id)

    node_ids = [start_id]
    for element, unit in tasks:
        task_id = _task_id(element)
        ET.SubElement(
            process,
            f"{{{BPMN_NS}}}task",
            {"id": task_id, "name": element.name},
        )
        lane_ref(unit, task_id)
        node_ids.append(task_id)

    ET.SubElement(process, f"{{{BPMN_NS}}}endEvent", {"id": end_id, "name": "End"})
    lane_ref(lanes[-1], end_id)
    node_ids.append(end_id)

    for index, (source, target) in enumerate(zip(node_ids, node_ids[1:]), start=1):
        ET.SubElement(
            process,
            f"{{{BPMN_NS}}}sequenceFlow",
            {"id": f"Flow_{index}", "sourceRef": source, "targetRef": target},
        )

    # --- DI: straight horizontal chain, y per lane ---
    diagram = ET.SubElement(definitions, f"{{{BPMNDI_NS}}}BPMNDiagram", {"id": "Diagram_1"})
    plane = ET.SubElement(
        diagram,
        f"{{{BPMNDI_NS}}}BPMNPlane",
        {"id": "Plane_1", "bpmnElement": f"Process_{stream.stream}"},
    )

    lane_y = {unit: 40 + index * LANE_H for index, unit in enumerate(lanes)}
    positions: dict[str, tuple[float, float, float, float]] = {}

    x = START_X
    positions[start_id] = (x, lane_y[lanes[0]] + LANE_H / 2 - 18, 36, 36)
    x += 36 + GAP_X
    for element, unit in tasks:
        positions[_task_id(element)] = (x, lane_y[unit] + (LANE_H - TASK_H) / 2, TASK_W, TASK_H)
        x += TASK_W + GAP_X
    positions[end_id] = (x, lane_y[lanes[-1]] + LANE_H / 2 - 18, 36, 36)

    for node_id, (nx, ny, width, height) in positions.items():
        shape = ET.SubElement(
            plane,
            f"{{{BPMNDI_NS}}}BPMNShape",
            {"id": f"{node_id}_di", "bpmnElement": node_id},
        )
        ET.SubElement(
            shape,
            f"{{{DC_NS}}}Bounds",
            {"x": str(nx), "y": str(ny), "width": str(width), "height": str(height)},
        )

    for index, (source, target) in enumerate(zip(node_ids, node_ids[1:]), start=1):
        edge = ET.SubElement(
            plane,
            f"{{{BPMNDI_NS}}}BPMNEdge",
            {"id": f"Flow_{index}_di", "bpmnElement": f"Flow_{index}"},
        )
        sx, sy, sw, sh = positions[source]
        tx, ty, _, th = positions[target]
        ET.SubElement(edge, f"{{{DI_NS}}}waypoint", {"x": str(sx + sw), "y": str(sy + sh / 2)})
        ET.SubElement(edge, f"{{{DI_NS}}}waypoint", {"x": str(tx), "y": str(ty + th / 2)})

    out_path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(definitions).write(out_path, xml_declaration=True, encoding="UTF-8")
