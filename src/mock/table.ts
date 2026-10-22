import { ServiceError } from "@/lib/service-error";

/**
 * An in-memory table — the prototype's "database table". Rows are replaced,
 * never mutated, on update, so anything a service already handed out (and
 * React Query cached) stays unchanged.
 */
export class Table<T extends { id: string }> {
  private rows: T[];
  private index = new Map<string, number>();

  constructor(
    rows: T[],
    /** Singular name for NOT_FOUND messages ("ride"). */
    private readonly entity: string,
  ) {
    this.rows = rows;
    this.reindex();
  }

  private reindex() {
    this.index.clear();
    this.rows.forEach((row, i) => this.index.set(row.id, i));
  }

  all(): readonly T[] {
    return this.rows;
  }

  get size() {
    return this.rows.length;
  }

  get(id: string): T | undefined {
    const i = this.index.get(id);
    return i === undefined ? undefined : this.rows[i];
  }

  /** Like `get`, but throws NOT_FOUND — what a backend returns as 404. */
  require(id: string): T {
    const row = this.get(id);
    if (!row) throw new ServiceError("NOT_FOUND", `${this.entity} ${id} not found`);
    return row;
  }

  /** New rows go first: lists default to newest-first. */
  insert(row: T): T {
    if (this.index.has(row.id)) throw new ServiceError("CONFLICT", `${this.entity} ${row.id} exists`);
    this.rows = [row, ...this.rows];
    this.reindex();
    return row;
  }

  update(id: string, change: Partial<T> | ((row: T) => T)): T {
    const i = this.index.get(id);
    if (i === undefined) throw new ServiceError("NOT_FOUND", `${this.entity} ${id} not found`);
    const current = this.rows[i]!;
    const next = typeof change === "function" ? change(current) : { ...current, ...change };
    this.rows[i] = next;
    return next;
  }
}

/** Counter for IDs of records created during the demo. */
export class Sequence {
  constructor(private next: number) {}
  take() {
    return this.next++;
  }
}

/** One-to-many lookup by ID (e.g. customer → ride IDs), kept in sync by services on reassignment. */
export class Index {
  private map = new Map<string, string[]>();

  add(key: string | undefined, id: string) {
    if (!key) return;
    const list = this.map.get(key);
    if (list) list.push(id);
    else this.map.set(key, [id]);
  }

  remove(key: string | undefined, id: string) {
    if (!key) return;
    const list = this.map.get(key);
    if (!list) return;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
  }

  get(key: string): readonly string[] {
    return this.map.get(key) ?? [];
  }
}
