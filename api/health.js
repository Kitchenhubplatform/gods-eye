import { send } from './_util.js';
export default function handler(req, res) { send(res, 200, { ok: true, time: new Date().toISOString() }); }
