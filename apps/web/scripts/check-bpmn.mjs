import { BpmnModdle } from "bpmn-moddle";
import fs from "fs";

const dir = process.argv[2] ?? "../../data/baselines/generic";
const moddle = new BpmnModdle();
for (const f of ["o2c", "p2p", "c2m", "h2r", "t2r"]) {
  const xml = fs.readFileSync(`${dir}/${f}.bpmn`, "utf8");
  const { rootElement, warnings } = await moddle.fromXML(xml);
  const proc = rootElement.rootElements.find((e) => e.$type === "bpmn:Process");
  const tasks = proc.flowElements.filter((e) => e.$type === "bpmn:Task").length;
  const lanes = proc.laneSets[0].lanes.map((l) => l.name).join(",");
  console.log(f, "tasks:", tasks, "lanes:", lanes, "warnings:", warnings.length);
}
