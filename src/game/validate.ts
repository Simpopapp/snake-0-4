// NEONVOLT — table validation (pure, testable).
import { TABLE_HEIGHT, TABLE_WIDTH, type TableDef } from "./types";

export interface ValidationIssue {
  tableId: string;
  message: string;
}

/** Structural sanity checks run against every TableDef (used in tests too). */
export function validateTable(table: TableDef): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();

  for (const el of table.elements) {
    if (ids.has(el.id)) issues.push({ tableId: table.id, message: `id duplicado: ${el.id}` });
    ids.add(el.id);
  }
  for (const w of table.walls) {
    if (ids.has(w.id)) issues.push({ tableId: table.id, message: `id duplicado: ${w.id}` });
    ids.add(w.id);
  }

  const inBounds = (x: number, y: number) => x > 16 && x < 486 && y > 60 && y < 860;

  for (const el of table.elements) {
    switch (el.kind) {
      case "bumper":
        if (!inBounds(el.pos.x, el.pos.y))
          issues.push({ tableId: table.id, message: `bumper fora dos limites: ${el.id}` });
        break;
      case "target":
        if (!inBounds(el.pos.x, el.pos.y))
          issues.push({ tableId: table.id, message: `target fora dos limites: ${el.id}` });
        break;
      case "spinner":
        if (!inBounds(el.pos.x, el.pos.y))
          issues.push({ tableId: table.id, message: `spinner fora dos limites: ${el.id}` });
        break;
      case "kicker":
        if (!inBounds(el.pos.x, el.pos.y))
          issues.push({ tableId: table.id, message: `kicker fora dos limites: ${el.id}` });
        break;
      case "sling":
        for (const p of [el.a, el.b, el.c]) {
          if (p.x < 0 || p.x > TABLE_WIDTH || p.y < 0 || p.y > TABLE_HEIGHT)
            issues.push({ tableId: table.id, message: `sling fora dos limites: ${el.id}` });
        }
        break;
    }
  }

  // mission references must exist
  const goal = table.mission.goal;
  if (goal.type === "hits" && !ids.has(goal.elementId))
    issues.push({ tableId: table.id, message: `missão referência elemento inexistente: ${goal.elementId}` });
  if (goal.type === "spinnerHold" && !ids.has(goal.spinnerId))
    issues.push({ tableId: table.id, message: `missão referência spinner inexistente: ${goal.spinnerId}` });
  if (goal.type === "group") {
    const targets = table.elements.filter((e) => e.kind === "target" && e.group === goal.groupId);
    if (targets.length === 0)
      issues.push({ tableId: table.id, message: `missão referencia grupo sem alvos: ${goal.groupId}` });
  }

  // flipper sanity
  if (table.flippers.length !== 2)
    issues.push({ tableId: table.id, message: "uma mesa precisa de exatamente 2 flippers" });

  return issues;
}
