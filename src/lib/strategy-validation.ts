import type { Strategy } from "@/lib/match-simulator";

const ACTION_TYPES = new Set([
  "MOVE_FORWARD",
  "MOVE_BACK",
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "SHOOT_FORWARD",
  "SHOOT_BACK",
  "SHOOT_LEFT",
  "SHOOT_RIGHT",
  "SCAN_AROUND",
  "WAIT",
]);

const CHECK_CONDITION_TYPES = new Set([
  "scan_detected",
  "damaged",
  "moved",
  "shot_hit",
  "can_move_forward",
  "can_move_back",
  "can_move_left",
  "can_move_right",
]);

const METRIC_VALUE_TYPES = new Set([
  "enemy_distance",
  "enemy_forward_distance",
  "enemy_right_distance",
  "self_hp",
  "turns_left",
  "self_facing",
]);

const COMPARE_OPS = new Set(["EQ", "NEQ", "LT", "LTE", "GT", "GTE"]);
const ARITH_OPS = new Set(["ADD", "SUB", "MUL", "DIV"]);
const DIRECTIONS = new Set(["N", "E", "S", "W"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidAction(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!ACTION_TYPES.has(String(value.type))) return false;
  return value.ap === undefined || typeof value.ap === "number";
}

function isValidValue(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const type = String(value.type);
  if (type === "num") return typeof value.value === "number" && Number.isFinite(value.value);
  if (type === "dir") return DIRECTIONS.has(String(value.dir));
  if (type === "var") return typeof value.name === "string" && value.name.length > 0;
  if (type === "arith") {
    return ARITH_OPS.has(String(value.op)) && isValidValue(value.left) && isValidValue(value.right);
  }
  if (type === "mod") return isValidValue(value.left) && isValidValue(value.right);
  return METRIC_VALUE_TYPES.has(type);
}

function isValidSet(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && value.name.length > 0 && isValidValue(value.value);
}

function isValidStmt(value: unknown): boolean {
  if (!isRecord(value)) return false;
  switch (String(value.kind)) {
    case "action":
      return ACTION_TYPES.has(String(value.type));
    case "set":
      return typeof value.name === "string" && value.name.length > 0 && isValidValue(value.value);
    case "if": {
      const clauses = value.clauses;
      const elseBody = value.else;
      if (clauses === undefined) {
        if (!isValidCondition(value.cond)) return false;
        return value.body === undefined || (Array.isArray(value.body) && value.body.every(isValidStmt));
      }
      if (!Array.isArray(clauses) || clauses.length === 0) return false;
      for (const clause of clauses) {
        if (!isRecord(clause) || !isValidCondition(clause.cond)) return false;
        if (
          clause.body !== undefined &&
          (!Array.isArray(clause.body) || !clause.body.every(isValidStmt))
        ) {
          return false;
        }
      }
      return elseBody === undefined || (Array.isArray(elseBody) && elseBody.every(isValidStmt));
    }
    default:
      return false;
  }
}

function isValidCondition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const type = String(value.type);
  if (CHECK_CONDITION_TYPES.has(type)) return typeof value.value === "boolean";
  switch (type) {
    case "bool":
      return typeof value.value === "boolean";
    case "not":
      return isValidCondition(value.arg);
    case "and":
    case "or":
      return Array.isArray(value.args) && value.args.length > 0 && value.args.every(isValidCondition);
    case "compare":
      return COMPARE_OPS.has(String(value.cmp)) && isValidValue(value.left) && isValidValue(value.right);
    default:
      return false;
  }
}

export function isValidStrategy(value: unknown): value is Strategy {
  if (!isRecord(value)) return false;

  const rules = value.rules;
  if (rules !== undefined) {
    if (!Array.isArray(rules)) return false;
    for (const rule of rules) {
      if (!isRecord(rule)) return false;
      const conditions = rule.conditions;
      const actions = rule.actions;
      const sets = rule.sets;
      const body = rule.body;
      if (conditions !== undefined && (!Array.isArray(conditions) || !conditions.every(isValidCondition))) {
        return false;
      }
      if (actions !== undefined && (!Array.isArray(actions) || !actions.every(isValidAction))) {
        return false;
      }
      if (sets !== undefined && (!Array.isArray(sets) || !sets.every(isValidSet))) {
        return false;
      }
      if (body !== undefined && (!Array.isArray(body) || !body.every(isValidStmt))) {
        return false;
      }
    }
  }

  const fallbackActions = value.fallbackActions;
  if (
    fallbackActions !== undefined &&
    (!Array.isArray(fallbackActions) || !fallbackActions.every(isValidAction))
  ) {
    return false;
  }

  const fallbackSets = value.fallbackSets;
  if (fallbackSets !== undefined && (!Array.isArray(fallbackSets) || !fallbackSets.every(isValidSet))) {
    return false;
  }

  const fallbackBody = value.fallbackBody;
  if (fallbackBody !== undefined && (!Array.isArray(fallbackBody) || !fallbackBody.every(isValidStmt))) {
    return false;
  }

  return Array.isArray(rules) || Array.isArray(fallbackActions) || Array.isArray(fallbackBody);
}
