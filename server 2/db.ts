import { drizzle } from "drizzle-orm/d1";
import * as schema from "../shared/schema";

export type AppDatabase = ReturnType<typeof createDb>;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
