"""Dataflow validation for the actor–method process model.

Walks the ordered steps maintaining the process variable space (seeded with the
initialised globals). Each required input of a step must bind to a variable that
is already available (an earlier step's output or a global) and whose ontology
type is compatible. Each output is also checked: it must be bound to a variable
name; re-publishing an existing variable with an incompatible type is a conflict
(error), and overwriting a compatible one is a warning. Problems carry a
`severity` of "error" | "warning" (warnings do not make the process invalid).
See docs/superpowers/specs/2026-07-13-actor-method-process-model-design.md.

Pure: takes plain dicts + an `is_a(actual_uri, expected_uri) -> bool` callable so
the ontology-subtype check (Fuseki) can be injected and the engine unit-tested.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

Problem = dict[str, Any]


def _exact(actual: str, expected: str) -> bool:
    return actual == expected


def validate_process(
    steps: list[dict],
    methods: dict[str, dict],
    globals_: list[dict],
    is_a: Callable[[str, str], bool] = _exact,
) -> list[Problem]:
    """Return an ordered list of problems (empty = the process is consistent).

    steps:   [{id, seq, method_id, input_bindings, output_bindings, label}] (any order)
    methods: {method_id: {name, inputs:[{name, concept_uri, concept_label, required}],
                          outputs:[{name, concept_uri, concept_label}]}}
    globals_: [{name, concept_uri, concept_label}]
    """
    problems: list[Problem] = []

    # variable name -> concept_uri currently available in the process space
    available: dict[str, str] = {g["name"]: g["concept_uri"] for g in globals_}
    global_names = set(available)

    for step in sorted(steps, key=lambda s: s.get("seq", 0)):
        method = methods.get(step["method_id"])
        if method is None:
            problems.append(
                {
                    "stepId": step["id"],
                    "seq": step.get("seq", 0),
                    "method": step["method_id"],
                    "input": None,
                    "kind": "unknown_method",
                    "severity": "error",
                    "message": f"step references unknown method {step['method_id']}",
                    "suggestions": ["pick an existing method for this step"],
                }
            )
            continue

        method_name = method.get("name", step["method_id"])
        bindings = step.get("input_bindings") or {}

        for param in method.get("inputs", []):
            if not param.get("required", True):
                continue
            pname = param["name"]
            expected = param["concept_uri"]
            src = bindings.get(pname)

            if not src:
                problems.append(
                    _problem(
                        step, method_name, pname, expected, "unbound",
                        f"input '{pname}' ({param.get('concept_label') or expected}) "
                        "is not bound to any process variable",
                        available, is_a, expected, global_names,
                        expected_label=param.get("concept_label"),
                    )
                )
            elif src not in available:
                problems.append(
                    _problem(
                        step, method_name, pname, expected, "unavailable",
                        f"input '{pname}' is bound to '{src}', which is not produced "
                        "by an earlier step and is not an initialised global",
                        available, is_a, expected, global_names, bound_to=src,
                        expected_label=param.get("concept_label"),
                    )
                )
            elif not is_a(available[src], expected):
                problems.append(
                    _problem(
                        step, method_name, pname, expected, "type_mismatch",
                        f"type mismatch: '{src}' is {available[src]} but input "
                        f"'{pname}' expects {expected}",
                        available, is_a, expected, global_names, bound_to=src,
                        expected_label=param.get("concept_label"),
                    )
                )

        # Publish this step's outputs into the variable space, checking each.
        out_bindings = step.get("output_bindings") or {}
        for param in method.get("outputs", []):
            oname = param["name"]
            produced = param["concept_uri"]
            var = out_bindings.get(oname, oname)
            if not var:
                problems.append(
                    {
                        "stepId": step["id"], "seq": step.get("seq", 0),
                        "method": method_name, "output": oname, "input": oname, "boundTo": None,
                        "expected": produced, "kind": "output_unbound",
                        "severity": "error",
                        "message": f"output '{oname}' is not bound to a variable name",
                        "suggestions": [f"name the variable this step produces for '{oname}'"],
                    }
                )
                continue
            existing = available.get(var)
            if existing is not None:
                incompatible = (
                    existing != produced
                    and not is_a(produced, existing)
                    and not is_a(existing, produced)
                )
                if incompatible:
                    problems.append(
                        {
                            "stepId": step["id"], "seq": step.get("seq", 0),
                            "method": method_name, "output": oname, "input": var, "boundTo": var,
                            "expected": produced, "kind": "output_conflict",
                            "severity": "error",
                            "message": (
                                f"output variable '{var}' was already {existing} but this "
                                f"step re-publishes it as an incompatible {produced}"
                            ),
                            "suggestions": [
                                f"publish '{oname}' under a different variable name",
                                "align the two step types via the ontology",
                            ],
                        }
                    )
                else:
                    # Compatible, but still silently overwrites an existing variable.
                    problems.append(
                        {
                            "stepId": step["id"], "seq": step.get("seq", 0),
                            "method": method_name, "output": oname, "input": var, "boundTo": var,
                            "expected": produced, "kind": "output_overwrite",
                            "severity": "warning",
                            "message": (
                                f"output '{oname}' overwrites the existing variable "
                                f"'{var}' (was {existing})"
                            ),
                            "suggestions": [
                                f"publish '{oname}' under a new variable name if the "
                                "earlier value is still needed downstream",
                            ],
                        }
                    )
            available[var] = produced

    return problems


def _problem(
    step: dict,
    method_name: str,
    pname: str,
    expected: str,
    kind: str,
    message: str,
    available: dict[str, str],
    is_a: Callable[[str, str], bool],
    expected_uri: str,
    global_names: set[str],
    bound_to: str | None = None,
    expected_label: str | None = None,
) -> Problem:
    # Actionable corrections: existing variables whose type satisfies the input.
    compatible = [
        name for name, uri in available.items() if is_a(uri, expected_uri)
    ]
    suggestions: list[str] = []
    if compatible:
        suggestions.append(f"bind to an existing variable: {', '.join(compatible)}")
    suggestions.append(f"initialise a process global of type {expected_uri}")
    suggestions.append(f"insert an upstream step whose output produces {expected_uri}")
    return {
        "stepId": step["id"],
        "seq": step.get("seq", 0),
        "method": method_name,
        "input": pname,
        "boundTo": bound_to,
        "expected": expected,
        "expectedLabel": expected_label,
        "compatible": compatible,
        "kind": kind,
        "severity": "error",
        "message": message,
        "suggestions": suggestions,
    }
