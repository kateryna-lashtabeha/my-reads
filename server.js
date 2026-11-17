import http from "node:http";
import fs from "node:fs/promises"
import { readBooks, writeBooks  } from "./utils/books.js";
import { readBody, sendJSON } from "./utils/server_helper.js";
import path from 'node:path'



async function getIndex() {
    const __dirname = import.meta.dirname

    const pathToResource = path.join(__dirname, 'public', 'index.html')
    const data = await fs.readFile(pathToResource);
    return data
}

const server = http.createServer(async(req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    if (req.method === "GET" && pathname === "/") {
        try {
            res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
            });
            const data = await getIndex();
            res.end(data);
         } catch (error) {
            console.error(error);

            res.writeHead(500, {
                "Content-Type": "application/json; charset=utf-8"
            });

            res.end(JSON.stringify({
                error: "Failed request"
            }));
        }
        return;
    }
    // GET /books/:id
    else if (req.method === "GET" && /^\/books\/\d+$/.test(pathname)) {
      const id = Number(pathname.split("/")[2]);
      const books = await readBooks();

      const book = books.find(book => book.id === id.toString());

      if (!book) {
        sendJSON(res, 404, { error: "Book not found" });
        return;
      }

      sendJSON(res, 200, book);
      return;
    }
    // GET /books
    else if (req.method === "GET" && pathname === "/books") {
        try {
            const books = await readBooks();

            const limit = Number(url.searchParams.get("limit")) || 10;
            const page = Number(url.searchParams.get("page")) || 1;
            const status = url.searchParams.get("status");
            const q = url.searchParams.get("q")?.toLowerCase();

             // Filtering and search
            const filteredBooks = books.filter(book => {
                const matchesStatus = !status || book.status === status;

                const matchesSearch = !q ||
                    book.title.toLowerCase().includes(q) ||
                    book.author.toLowerCase().includes(q);

                return matchesStatus && matchesSearch;
            });

            const total = filteredBooks.length;

            const start = (page - 1) * limit;

            const paginatedBooks = filteredBooks.slice(start, start + limit);

            res.setHeader("X-Total-Count", total);

            sendJSON(res, 200, paginatedBooks);
        } catch (error) {
            console.error(error);

            res.writeHead(500, {
                "Content-Type": "application/json; charset=utf-8"
            });

            res.end(JSON.stringify({
                error: "Failed to read books"
            }));
        }
        return;
    }
    // POST /books
    else if (req.method === "POST" && pathname === "/books") {
      let body;

      try {
        body = await readBody(req);
      } catch {
        sendJSON(res, 400, { error: "Invalid JSON" });
        return;
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        typeof body.title !== "string" ||
        typeof body.author !== "string" ||
        body.title.trim() === "" ||
        body.author.trim() === ""
      ) {
        sendJSON(res, 400, {
          error: "title and author are required"
        });
        return;
      }

      const books = await readBooks();

      const newBook = {
        id:( Math.max(0, ...books.map(book => book.id)) + 1).toString(),
        title: body.title,
        author: body.author,
        status: body.status ?? "want to read",
        createdAt: new Date().toISOString().split('T')[0],
        finishedAt: body.finishedAt
      };
      books.push(newBook);

      await writeBooks(books);

      sendJSON(res, 201, newBook);
      return;
    }

    // PATCH /books/:id
    else if (req.method === "PATCH" && /^\/books\/\d+$/.test(pathname)) {
      const id = Number(pathname.split("/")[2]);
      const books = await readBooks();

      const book = books.find(book => book.id === id.toString());

      if (!book) {
        sendJSON(res, 404, { error: "Book not found" });
        return;
      }

      let body;

      try {
        body = await readBody(req);
      } catch {
        sendJSON(res, 400, { error: "Invalid JSON" });
        return;
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        sendJSON(res, 400, { error: "Invalid request body" });
        return;
      }

      const allowedFields = ["title", "author", "status", "finishedAt"];

      for (const key of Object.keys(body)) {
        if (!allowedFields.includes(key)) {
          sendJSON(res, 400, {
            error: `Invalid field: ${key}`
          });
          return;
        }

        if (typeof body[key] !== "string" || !body[key].trim()) {
          sendJSON(res, 400, {
            error: `Invalid value for ${key}`
          });
          return;
        }
      }

      Object.assign(book, body);

      await writeBooks(books);

      sendJSON(res, 200, book);
      return;
    }
    // GET /stats
    else if (req.method === "GET" && pathname === "/stats") {
        const books = await readBooks();
        const stats = books.reduce((result, book) => {
        if (book.status === "read") {
            result.readBooks.push(book);
        } else if (book.status === "currently reading") {
            result.currentlyReading.push(book);
        } else if (book.status === "want to read") {
            result.wantToRead.push(book);
        }

        return result;
    }, {
        readBooks: [],
        currentlyReading: [],
        wantToRead: []
    });

    sendJSON(res, 200, stats);
    }
    else {
        sendJSON(res, 404, { error: "Route not found" });
    }
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});