
import { loadData } from '../server/data.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const data = await loadData(process.env);
    res.status(200).json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}
