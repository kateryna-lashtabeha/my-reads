import fs from "node:fs/promises";
import path from "node:path";

const filePath = path.join(import.meta.dirname, "books.json");
export async function readBooks() {
    try {
        const data = await fs.readFile(filePath, "utf8");

        return JSON.parse(data);
  } catch (error) {
    console.error(error);
  }
}

export async function writeBooks(books) {
  await fs.writeFile(filePath, JSON.stringify(books, null, 2), "utf8");
}