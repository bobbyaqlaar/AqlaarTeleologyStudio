"""Generate BPMN 2.0 XML from an ordered actor-method step sequence.

The step list is the source of truth; this renders it for the bpmn-js canvas:
one lane per distinct actor function unit, one task per step in `seq` order,
a straight sequence flow, and a DI section so it opens directly in the editor.
Mirrors services/ingest/emitters/bpmn output so the web renderer is unchanged.
"""

from __future__ import annotations

import re
from xml.etree import ElementTree as ET

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
DI_NS = "http://www.omg.org/spec/DD/20100524/DI"

TASK_W, TASK_H, GAP_X, LANE_H, START_X = 140, 70, 60, 130, 180


def _safe(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "_", text)


def generate_bpmn(stream: str, steps: list[dict]) -> str:
    """steps: ordered [{id, name, function_unit}]. Returns BPMN XML (str)."""
    for prefix, uri in (
        ("bpmn", BPMN_NS), ("bpmndi", BPMNDI_NS), ("dc", DC_NS), ("di", DI_NS)
    ):
        ET.register_namespace(prefix, uri)

    tasks = [
        (f"Step_{_safe(s['id'])}", s.get("name") or s["id"], s.get("function_unit") or "operations")
        for s in steps
    ]
    lanes = list(dict.fromkeys(unit for _, _, unit in tasks)) or ["operations"]

    definitions = ET.Element(
        f"{{{BPMN_NS}}}definitions",
        {"id": f"Defs_{stream}", "targetNamespace": "http://ots.local/bpmn"},
    )
    process = ET.SubElement(
        definitions, f"{{{BPMN_NS}}}process",
        {"id": f"Process_{stream}", "isExecutable": "false"},
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
    for task_id, name, unit in tasks:
        ET.SubElement(process, f"{{{BPMN_NS}}}task", {"id": task_id, "name": name})
        lane_ref(unit, task_id)
        node_ids.append(task_id)

    ET.SubElement(process, f"{{{BPMN_NS}}}endEvent", {"id": end_id, "name": "End"})
    lane_ref(lanes[-1], end_id)
    node_ids.append(end_id)

    for index, (source, target) in enumerate(zip(node_ids, node_ids[1:]), start=1):
        ET.SubElement(
            process, f"{{{BPMN_NS}}}sequenceFlow",
            {"id": f"Flow_{index}", "sourceRef": source, "targetRef": target},
        )

    diagram = ET.SubElement(definitions, f"{{{BPMNDI_NS}}}BPMNDiagram", {"id": "Diagram_1"})
    plane = ET.SubElement(
        diagram, f"{{{BPMNDI_NS}}}BPMNPlane",
        {"id": "Plane_1", "bpmnElement": f"Process_{stream}"},
    )
    lane_y = {unit: 40 + i * LANE_H for i, unit in enumerate(lanes)}
    positions: dict[str, tuple[float, float, float, float]] = {}

    x = START_X
    positions[start_id] = (x, lane_y[lanes[0]] + LANE_H / 2 - 18, 36, 36)
    x += 36 + GAP_X
    for task_id, _name, unit in tasks:
        positions[task_id] = (x, lane_y[unit] + (LANE_H - TASK_H) / 2, TASK_W, TASK_H)
        x += TASK_W + GAP_X
    positions[end_id] = (x, lane_y[lanes[-1]] + LANE_H / 2 - 18, 36, 36)

    for node_id, (nx, ny, w, h) in positions.items():
        shape = ET.SubElement(
            plane, f"{{{BPMNDI_NS}}}BPMNShape",
            {"id": f"{node_id}_di", "bpmnElement": node_id},
        )
        ET.SubElement(
            shape, f"{{{DC_NS}}}Bounds",
            {"x": str(nx), "y": str(ny), "width": str(w), "height": str(h)},
        )
    for index, (source, target) in enumerate(zip(node_ids, node_ids[1:]), start=1):
        edge = ET.SubElement(
            plane, f"{{{BPMNDI_NS}}}BPMNEdge",
            {"id": f"Flow_{index}_di", "bpmnElement": f"Flow_{index}"},
        )
        sx, sy, sw, sh = positions[source]
        tx, ty, _tw, th = positions[target]
        ET.SubElement(edge, f"{{{DI_NS}}}waypoint", {"x": str(sx + sw), "y": str(sy + sh / 2)})
        ET.SubElement(edge, f"{{{DI_NS}}}waypoint", {"x": str(tx), "y": str(ty + th / 2)})

    return ET.tostring(definitions, encoding="unicode", xml_declaration=True)
