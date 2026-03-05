import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { kv } from '@vercel/kv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, 'db.json');

// Ensure db.json exists for local development
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

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

// Helper to check if KV is configured
const isKVConfigured = () => {
    return process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/api/data/:email', async (req, res) => {
    try {
        const { email } = req.params;
        let userData: UserData | null = null;

        if (isKVConfigured()) {
            console.log(`[SERVER] Fetching data for ${email} from Vercel KV`);
            userData = await kv.get<UserData>(email);

            // Auto-migration: If KV is empty, try to load from local db.json
            if (!userData && fs.existsSync(DB_FILE)) {
                 console.log(`[SERVER] KV empty for ${email}, checking local db.json for migration`);
                 try {
                     const data = fs.readFileSync(DB_FILE, 'utf-8');
                     const db: Database = JSON.parse(data);
                     if (db[email]) {
                         console.log(`[SERVER] Migrating local data for ${email} to KV`);
                         userData = db[email];
                         await kv.set(email, userData);
                     }
                 } catch (err) {
                     console.error('[SERVER] Error reading local db.json during migration:', err);
                 }
            }
        } else {
            console.log(`[SERVER] Fetching data for ${email} from local db.json`);
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            const db: Database = JSON.parse(data);
            userData = db[email] || null;
        }

        const defaultData = {
            accounts: [],
            platforms: [],
            investments: [],
            assets: [],
            transactions: [],
            receivables: [],
        };

        res.json(userData || defaultData);
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ message: 'Error reading data' });
    }
});

app.post('/api/data/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const userData: UserData = req.body;
        
        if (isKVConfigured()) {
            console.log(`[SERVER] Writing data for ${email} to Vercel KV`);
            await kv.set(email, userData);
        } else {
            console.log(`[SERVER] Writing data for ${email} to local db.json`);
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            const db: Database = JSON.parse(data);
            db[email] = userData;
            fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        }
        
        res.status(200).json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('[SERVER] Error writing data:', error);
        res.status(500).json({ message: 'Error writing data' });
    }
});

// Setup Vite or Static files
async function setupServer() {
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

    // Only listen if not running on Vercel (Vercel handles the server)
    if (!process.env.VERCEL) {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }
}

setupServer();

export default app;
