import type { NextApiRequest, NextApiResponse } from "next";
import pm2 from "pm2";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    pm2.list((err, list) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao listar bots do PM2" });
      }
      return res.status(200).json(list);
    });
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Método ${req.method} não permitido`);
  }
}
