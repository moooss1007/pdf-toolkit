import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One row per member who has used the app, keyed by the Gateway's user id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

// A file a tool produced. The bytes live in R2 under `r2Key`; the row is
// what the library lists. Rows past `expiresAt` are never listed or served.
export const results = sqliteTable(
  "results",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    tool: text("tool").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    r2Key: text("r2_key").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    index("results_owner_idx").on(table.ownerId, table.createdAt),
    index("results_expires_idx").on(table.expiresAt),
  ],
);
