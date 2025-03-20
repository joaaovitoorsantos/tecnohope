import { NextResponse } from "next/server";
import pm2 from "pm2";

const PM2_REMOTE_CONFIG = {
  remote: true,
  host: '104.234.224.196',
  port: 6666
};

export async function GET() {
  return new Promise((resolve) => {
    try {
      console.log('Tentando conectar ao PM2 remoto...');
      
      // @ts-ignore
      pm2.connect(PM2_REMOTE_CONFIG, (connectErr) => {
        if (connectErr) {
          console.error('Erro na conexão PM2:', connectErr);
          resolve(NextResponse.json({ 
            error: "Erro ao conectar com o servidor remoto",
            details: connectErr.message 
          }, { status: 500 }));
          return;
        }

        console.log('Conexão PM2 estabelecida, listando processos...');
        
        pm2.list((listErr, list) => {
          pm2.disconnect();
          
          if (listErr) {
            console.error('Erro ao listar processos:', listErr);
            resolve(NextResponse.json({ 
              error: "Erro ao listar bots",
              details: listErr.message 
            }, { status: 500 }));
            return;
          }
          
          console.log('Processos listados com sucesso:', list);
          resolve(NextResponse.json(list, { status: 200 }));
        });
      });
    } catch (error) {
      console.error('Erro não tratado:', error);
      resolve(NextResponse.json({ 
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }, { status: 500 }));
    }
  });
}

export async function POST(request: Request) {
  try {
    const { action, botName } = await request.json();

    return new Promise((resolve) => {
      // @ts-ignore
      pm2.connect(PM2_REMOTE_CONFIG, (connectErr) => {
        if (connectErr) {
          console.error('Erro na conexão PM2:', connectErr);
          resolve(NextResponse.json({ 
            error: "Erro ao conectar com o servidor remoto",
            details: connectErr.message 
          }, { status: 500 }));
          return;
        }

        if (action === "start") {
          pm2.start(botName, (err) => {
            pm2.disconnect();
            if (err) {
              console.error('Erro ao iniciar bot:', err);
              resolve(NextResponse.json({ 
                error: "Erro ao iniciar",
                details: err.message 
              }, { status: 500 }));
            } else {
              resolve(NextResponse.json({ success: true }));
            }
          });
        } else if (action === "stop") {
          pm2.stop(botName, (err) => {
            pm2.disconnect();
            if (err) {
              console.error('Erro ao parar bot:', err);
              resolve(NextResponse.json({ 
                error: "Erro ao parar",
                details: err.message 
              }, { status: 500 }));
            } else {
              resolve(NextResponse.json({ success: true }));
            }
          });
        } else {
          pm2.disconnect();
          resolve(NextResponse.json({ error: "Ação inválida" }, { status: 400 }));
        }
      });
    });
  } catch (error) {
    console.error('Erro não tratado:', error);
    return NextResponse.json({ 
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 