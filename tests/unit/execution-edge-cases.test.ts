import { describe, it, expect } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Inline the topological sort + cycle detection logic mirroring useExecution.ts
// ──────────────────────────────────────────────────────────────────────────────
interface Node { id: string; position: { x: number; y: number }; data: { label: string } }
interface Edge { source: string; target: string }

interface SortResult {
  sorted: Node[];
  hasCycle: boolean;
  cycleNodeLabels: string[];
  disconnectedNodes: Node[];
}

function topologicalSort(nodes: Node[], edges: Edge[]): SortResult {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (graph.has(edge.source) && inDegree.has(edge.target)) {
      graph.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const sorted: Node[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodeMap.get(current);
    if (node) sorted.push(node);
    for (const neighbor of graph.get(current) || []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  const sortedIds = new Set(sorted.map(n => n.id));
  const unreached = nodes.filter(n => !sortedIds.has(n.id));
  const cycleNodes = unreached.filter(n => (inDegree.get(n.id) ?? 0) > 0);
  const disconnectedNodes = unreached.filter(n => (inDegree.get(n.id) ?? 0) === 0);
  sorted.push(...disconnectedNodes.sort((a, b) => a.position.x - b.position.x));

  return { sorted, hasCycle: cycleNodes.length > 0, cycleNodeLabels: cycleNodes.map(n => n.data.label), disconnectedNodes };
}

// Pre-execution input validation logic (mirrors useExecution.ts)
const INPUT_NODES_REQUIRING_TEXT = ["IN-001"];
const FILE_INPUT_NODES = ["IN-002", "IN-003", "IN-005", "IN-006"];

function validateNodesBeforeExecution(
  nodes: Array<{ data: { catalogueId: string; label: string; inputValue?: string; fileData?: string } }>
): string | null {
  for (const node of nodes) {
    const { catalogueId } = node.data;

    if (INPUT_NODES_REQUIRING_TEXT.includes(catalogueId)) {
      const val = node.data.inputValue ?? "";
      if (!val.trim()) return "Please enter text in the Text Prompt node before running";
      if (val.length > 4000) return "Text is too long (maximum 4,000 characters). Try shortening your description.";
    }

    if (FILE_INPUT_NODES.includes(catalogueId)) {
      if (!node.data.fileData && !node.data.inputValue) {
        return `Please upload a file to the "${node.data.label}" node before running`;
      }
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────

describe("Execution Edge Cases — Topology", () => {
  const makeNode = (id: string, label = id, x = 0): Node => ({
    id, position: { x, y: 0 }, data: { label },
  });

  it("should return empty sorted for 0-node workflow", () => {
    const result = topologicalSort([], []);
    expect(result.sorted).toHaveLength(0);
    expect(result.hasCycle).toBe(false);
  });

  it("should handle single node (no edges)", () => {
    const result = topologicalSort([makeNode("A")], []);
    expect(result.sorted).toHaveLength(1);
    expect(result.sorted[0].id).toBe("A");
    expect(result.hasCycle).toBe(false);
    expect(result.disconnectedNodes).toHaveLength(0);
  });

  it("should sort linear A→B→C correctly", () => {
    const nodes = [makeNode("C", "C", 200), makeNode("A", "A", 0), makeNode("B", "B", 100)];
    const edges: Edge[] = [{ source: "A", target: "B" }, { source: "B", target: "C" }];
    const result = topologicalSort(nodes, edges);
    expect(result.sorted.map(n => n.id)).toEqual(["A", "B", "C"]);
    expect(result.hasCycle).toBe(false);
  });

  it("should detect simple A→B→A cycle", () => {
    const nodes = [makeNode("A"), makeNode("B")];
    const edges: Edge[] = [{ source: "A", target: "B" }, { source: "B", target: "A" }];
    const result = topologicalSort(nodes, edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodeLabels.sort()).toEqual(["A", "B"]);
    expect(result.sorted).toHaveLength(0); // no root nodes
  });

  it("should detect 3-node cycle A→B→C→A", () => {
    const nodes = [makeNode("A"), makeNode("B"), makeNode("C")];
    const edges: Edge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "C", target: "A" },
    ];
    const result = topologicalSort(nodes, edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodeLabels).toHaveLength(3);
  });

  it("should detect cycle in partial graph (D is disconnected, A→B→A is a cycle)", () => {
    const nodes = [makeNode("A"), makeNode("B"), makeNode("D", "D", 0)];
    const edges: Edge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "A" },
    ];
    const result = topologicalSort(nodes, edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodeLabels.sort()).toEqual(["A", "B"]);
    // D is disconnected, should be in sorted (appended)
    expect(result.sorted.some(n => n.id === "D")).toBe(true);
  });

  it("should handle disconnected node alongside connected ones", () => {
    const nodes = [makeNode("A", "A", 0), makeNode("B", "B", 100), makeNode("D", "D", 50)];
    const edges: Edge[] = [{ source: "A", target: "B" }];
    const result = topologicalSort(nodes, edges);
    expect(result.hasCycle).toBe(false);
    // D is disconnected — inDegree=0, so it's in queue and processed
    expect(result.sorted).toHaveLength(3);
    expect(result.disconnectedNodes).toHaveLength(0); // D was processed by Kahn's
  });

  it("should not loop infinitely with large cycle", () => {
    // 100-node cycle
    const nodes = Array.from({ length: 100 }, (_, i) => makeNode(`n${i}`));
    const edges: Edge[] = nodes.map((n, i) => ({ source: n.id, target: nodes[(i + 1) % 100].id }));
    const result = topologicalSort(nodes, edges);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodeLabels).toHaveLength(100);
  });
});

describe("Execution Edge Cases — Input Validation", () => {
  it("should return error for empty text prompt", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-001", label: "Text Prompt", inputValue: "" } },
    ]);
    expect(err).toContain("Please enter text");
  });

  it("should return error for whitespace-only text prompt", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-001", label: "Text Prompt", inputValue: "   " } },
    ]);
    expect(err).toContain("Please enter text");
  });

  it("should return error for text exceeding 4000 chars", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-001", label: "Text Prompt", inputValue: "A".repeat(4001) } },
    ]);
    expect(err).toContain("too long");
    expect(err).toContain("4,000");
  });

  it("should accept text at exactly 4000 chars", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-001", label: "Text Prompt", inputValue: "A".repeat(4000) } },
    ]);
    expect(err).toBeNull();
  });

  it("should accept valid text prompt", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-001", label: "Text Prompt", inputValue: "Design a 5-story office building" } },
    ]);
    expect(err).toBeNull();
  });

  it("should return error for file upload node with no file", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-002", label: "PDF Upload" } },
    ]);
    expect(err).toContain("upload a file");
  });

  it("should accept file upload node with fileData", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-002", label: "PDF Upload", fileData: "base64encodeddata" } },
    ]);
    expect(err).toBeNull();
  });

  it("should pass non-input nodes (transform/generate)", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "TR-003", label: "Design Analyzer" } },
      { data: { catalogueId: "GN-003", label: "Concept Render" } },
    ]);
    expect(err).toBeNull();
  });

  it("should validate the first failing node and stop", () => {
    const err = validateNodesBeforeExecution([
      { data: { catalogueId: "IN-001", label: "Text Prompt", inputValue: "" } },
      { data: { catalogueId: "IN-002", label: "PDF Upload" } },
    ]);
    expect(err).toContain("Text Prompt");
  });
});
