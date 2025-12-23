import sqlite3 from "sqlite3";
import { join } from "node:path";
import { promisify } from "node:util";

const dbPath = join(process.cwd(), "burrito-considerations.db");

const db = new sqlite3.Database(dbPath);

// Initialize schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS burrito_considerations (
      username TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    )
  `);
});

const dbGet = promisify(db.get.bind(db));
const dbRun = promisify(db.run.bind(db));

export function getBurritoConsiderations(username: string): Promise<number> {
  return dbGet("SELECT count FROM burrito_considerations WHERE username = ?", [username])
    .then((row: any) => row?.count ?? 0);
}

export function incrementBurritoConsiderations(username: string): Promise<number> {
  return dbRun(`
    INSERT INTO burrito_considerations (username, count)
    VALUES (?, 1)
    ON CONFLICT(username) DO UPDATE SET count = count + 1
  `, [username])
    .then(() => {
      return dbGet("SELECT count FROM burrito_considerations WHERE username = ?", [username]);
    })
    .then((row: any) => row.count);
}
