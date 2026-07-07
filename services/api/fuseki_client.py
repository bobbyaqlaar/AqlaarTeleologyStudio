from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx

FUSEKI_URL = os.getenv("FUSEKI_URL", "http://localhost:3030").rstrip("/")
FUSEKI_DATASET = os.getenv("FUSEKI_DATASET", "ots")
FUSEKI_USER = os.getenv("FUSEKI_USER", "admin")
FUSEKI_PASSWORD = os.getenv("FUSEKI_PASSWORD", "admin")
BASELINE_DIR = Path(os.getenv("OTS_BASELINE_DIR", "../../data/baselines")).resolve()

VALID_STREAMS = {"o2c", "p2p", "c2m", "h2r", "t2r"}


class FusekiError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class FusekiClient:
    def __init__(self) -> None:
        self._auth = (FUSEKI_USER, FUSEKI_PASSWORD)
        self._dataset_base = f"{FUSEKI_URL}/{FUSEKI_DATASET}"

    async def ensure_dataset(self) -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{FUSEKI_URL}/$/datasets",
                auth=self._auth,
            )
            if response.status_code == 401:
                return
            response.raise_for_status()
            payload = response.json()
            names = {item["ds.name"] for item in payload.get("datasets", [])}
            if f"/{FUSEKI_DATASET}" in names or FUSEKI_DATASET in names:
                return

            create = await client.post(
                f"{FUSEKI_URL}/$/datasets",
                auth=self._auth,
                data={"dbName": FUSEKI_DATASET, "dbType": "mem"},
            )
            if create.status_code not in {200, 201, 409}:
                raise FusekiError(
                    f"Failed to create dataset: {create.text}",
                    create.status_code,
                )

    async def ping(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{FUSEKI_URL}/$/ping")
                return response.status_code == 200
        except httpx.HTTPError:
            return False

    def graph_uri(self, engagement_id: str, stream_type: str) -> str:
        return f"urn:ots:engagement:{engagement_id}:stream:{stream_type}"

    async def graph_triple_count(self, graph_uri: str) -> int:
        query = f"""
        SELECT (COUNT(?s) AS ?count) WHERE {{
          GRAPH <{graph_uri}> {{
            ?s ?p ?o .
          }}
        }}
        """
        result = await self.query(query)
        bindings = result.get("results", {}).get("bindings", [])
        if not bindings:
            return 0
        return int(bindings[0]["count"]["value"])

    async def clear_graph(self, graph_uri: str) -> None:
        update = f"""
        CLEAR GRAPH <{graph_uri}>
        """
        await self.update(update)

    async def load_baseline(self, graph_uri: str, stream_type: str) -> None:
        if stream_type not in VALID_STREAMS:
            raise FusekiError("Invalid stream type", 400)

        ttl_path = BASELINE_DIR / f"{stream_type}.ttl"
        if not ttl_path.exists():
            raise FusekiError(f"Baseline TTL not found: {ttl_path}", 404)

        ttl = ttl_path.read_text(encoding="utf-8")
        url = f"{self._dataset_base}/data"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                url,
                params={"graph": graph_uri},
                content=ttl,
                headers={"Content-Type": "text/turtle"},
                auth=self._auth,
            )
            if response.status_code not in {200, 201, 204}:
                raise FusekiError(
                    f"Failed to load baseline graph: {response.text}",
                    response.status_code,
                )

    async def reload_baseline(
        self,
        graph_uri: str,
        stream_type: str,
    ) -> None:
        await self.clear_graph(graph_uri)
        await self.load_baseline(graph_uri, stream_type)

    async def query(self, sparql: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self._dataset_base}/sparql",
                data={"query": sparql},
                headers={"Accept": "application/sparql-results+json"},
                auth=self._auth,
            )
            if response.status_code != 200:
                raise FusekiError(f"SPARQL query failed: {response.text}", response.status_code)
            return response.json()

    async def update(self, update_query: str) -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self._dataset_base}/update",
                data={"update": update_query},
                auth=self._auth,
            )
            if response.status_code not in {200, 204}:
                raise FusekiError(f"SPARQL update failed: {response.text}", response.status_code)

    async def fetch_graph(self, graph_uri: str) -> list[dict[str, Any]]:
        query = f"""
        PREFIX ots: <http://ots.local/ontology/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>

        SELECT ?class ?label ?functionUnit ?bpmnElement WHERE {{
          GRAPH <{graph_uri}> {{
            ?class a owl:Class .
            OPTIONAL {{ ?class rdfs:label ?label }}
            OPTIONAL {{ ?class ots:functionUnit ?functionUnit }}
            OPTIONAL {{ ?class ots:linkedBpmnElement ?bpmnElement }}
          }}
        }}
        ORDER BY ?label
        """
        result = await self.query(query)
        class_map: dict[str, dict[str, Any]] = {}

        for binding in result.get("results", {}).get("bindings", []):
            class_uri = binding["class"]["value"]
            if class_uri not in class_map:
                class_map[class_uri] = {
                    "uri": class_uri,
                    "label": binding.get("label", {}).get("value", class_uri.split("/")[-1]),
                    "functionUnit": binding.get("functionUnit", {}).get("value"),
                    "linkedBpmnElements": [],
                }

            bpmn = binding.get("bpmnElement", {}).get("value")
            if bpmn and bpmn not in class_map[class_uri]["linkedBpmnElements"]:
                class_map[class_uri]["linkedBpmnElements"].append(bpmn)

        return list(class_map.values())

    async def fetch_edges(self, graph_uri: str) -> list[dict[str, Any]]:
        query = f"""
        PREFIX ots: <http://ots.local/ontology/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>

        SELECT ?source ?target ?predicate WHERE {{
          GRAPH <{graph_uri}> {{
            ?source ?predicate ?target .
            FILTER(
              ?predicate IN (rdfs:subClassOf, ots:precedes) &&
              isIRI(?target)
            )
          }}
        }}
        """
        result = await self.query(query)
        edges: list[dict[str, Any]] = []
        seen: set[str] = set()

        predicate_labels = {
            "http://www.w3.org/2000/01/rdf-schema#subClassOf": "subClassOf",
            "http://ots.local/ontology/precedes": "precedes",
        }

        for binding in result.get("results", {}).get("bindings", []):
            source = binding["source"]["value"]
            target = binding["target"]["value"]
            predicate = binding["predicate"]["value"]
            edge_id = f"{source}|{predicate}|{target}"
            if edge_id in seen:
                continue
            seen.add(edge_id)
            edges.append(
                {
                    "id": edge_id,
                    "source": source,
                    "target": target,
                    "label": predicate_labels.get(predicate, predicate.split("/")[-1]),
                    "edgeType": predicate_labels.get(predicate, "relation"),
                }
            )

        return edges

    async def fetch_ontology(self, graph_uri: str) -> dict[str, Any]:
        classes = await self.fetch_graph(graph_uri)
        edges = await self.fetch_edges(graph_uri)
        return {"classes": classes, "edges": edges}

    async def update_class(
        self,
        graph_uri: str,
        class_uri: str,
        label: str | None,
        function_unit: str | None,
    ) -> None:
        iri = self._iri(class_uri)

        if label is not None:
            await self.update(
                f"""
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                DELETE {{ GRAPH <{graph_uri}> {{ {iri} rdfs:label ?label . }} }}
                INSERT DATA {{ GRAPH <{graph_uri}> {{ {iri} rdfs:label "{self._escape(label)}"@en . }} }}
                WHERE {{ GRAPH <{graph_uri}> {{ {iri} rdfs:label ?label . }} }}
                """
            )

        if function_unit is not None:
            if function_unit == "":
                await self.update(
                    f"""
                    PREFIX ots: <http://ots.local/ontology/>
                    DELETE {{ GRAPH <{graph_uri}> {{ {iri} ots:functionUnit ?fn . }} }}
                    WHERE {{ GRAPH <{graph_uri}> {{ {iri} ots:functionUnit ?fn . }} }}
                    """
                )
            else:
                await self.update(
                    f"""
                    PREFIX ots: <http://ots.local/ontology/>
                    DELETE {{ GRAPH <{graph_uri}> {{ {iri} ots:functionUnit ?fn . }} }}
                    INSERT DATA {{ GRAPH <{graph_uri}> {{ {iri} ots:functionUnit "{self._escape(function_unit)}" . }} }}
                    WHERE {{ GRAPH <{graph_uri}> {{ {iri} ots:functionUnit ?fn . }} }}
                    """
                )

    async def set_link(
        self,
        graph_uri: str,
        class_uri: str,
        bpmn_element_id: str,
    ) -> None:
        await self.clear_bpmn_link(graph_uri, bpmn_element_id)
        update = f"""
        PREFIX ots: <http://ots.local/ontology/>

        INSERT DATA {{
          GRAPH <{graph_uri}> {{
            {self._iri(class_uri)} ots:linkedBpmnElement "{self._escape(bpmn_element_id)}" .
          }}
        }}
        """
        await self.update(update)

    async def clear_bpmn_link(self, graph_uri: str, bpmn_element_id: str) -> None:
        update = f"""
        PREFIX ots: <http://ots.local/ontology/>

        DELETE {{
          GRAPH <{graph_uri}> {{
            ?class ots:linkedBpmnElement "{self._escape(bpmn_element_id)}" .
          }}
        }}
        WHERE {{
          GRAPH <{graph_uri}> {{
            ?class ots:linkedBpmnElement "{self._escape(bpmn_element_id)}" .
          }}
        }}
        """
        await self.update(update)

    async def remove_class_link(
        self,
        graph_uri: str,
        class_uri: str,
        bpmn_element_id: str,
    ) -> None:
        update = f"""
        PREFIX ots: <http://ots.local/ontology/>

        DELETE DATA {{
          GRAPH <{graph_uri}> {{
            {self._iri(class_uri)} ots:linkedBpmnElement "{self._escape(bpmn_element_id)}" .
          }}
        }}
        """
        await self.update(update)

    @staticmethod
    def _iri(value: str) -> str:
        if value.startswith("http://") or value.startswith("https://"):
            return f"<{value}>"
        return value

    @staticmethod
    def _escape(value: str) -> str:
        return value.replace("\\", "\\\\").replace('"', '\\"')
