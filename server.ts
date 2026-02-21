import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'db.json');

interface UserData {
  accounts: any[];
  platforms: any[];
  investments: any[];
  assets: any[];
  transactions: any[];
  receivables: any[];
}

interface Database {
  [email: string]: UserData;
}

async function readDb(): Promise<Database> {
  try {
    await fs.access(dbPath);
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function writeDb(data: Database): Promise<void> {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(bodyParser.json());

    app.get('/api/data/:email', async (req, res) => {
        const { email } = req.params;
        const db = await readDb();
        const userData = db[email] || {
            accounts: [],
            platforms: [],
            investments: [],
            assets: [],
            transactions: [],
            receivables: [],
        };
        res.json(userData);
    });

    app.post('/api/data/:email', async (req, res) => {
        const { email } = req.params;
        const userData: UserData = req.body;
        const db = await readDb();
        db[email] = userData;
        await writeDb(db);
        res.status(200).json({ message: 'Data saved successfully' });
    });

    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.join(__dirname, 'dist')));
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
