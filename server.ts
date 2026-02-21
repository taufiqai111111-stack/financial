import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { kv } from '@vercel/kv';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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





async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(bodyParser.json());

    app.get('/api/data/:email', async (req, res) => {
        try {
            const { email } = req.params;
            const userData = await kv.get<UserData>(email) || {
                accounts: [],
                platforms: [],
                investments: [],
                assets: [],
                transactions: [],
                receivables: [],
            };
            res.json(userData);
        } catch (error) {
            console.error('Error reading data:', error);
            res.status(500).json({ message: 'Error reading data' });
        }
    });

    app.post('/api/data/:email', async (req, res) => {
        try {
            const { email } = req.params;
            const userData: UserData = req.body;
            console.log(`[SERVER] Received data for ${email}:`, JSON.stringify(userData, null, 2));
            await kv.set(email, userData);
            console.log(`[SERVER] Successfully wrote data for ${email} to Vercel KV`);
            res.status(200).json({ message: 'Data saved successfully' });
        } catch (error) {
            console.error('[SERVER] Error writing data:', error);
            res.status(500).json({ message: 'Error writing data' });
        }
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
