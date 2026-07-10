import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { adminAuth, adminDb } from "../firebaseAdmin";

const router = Router();
const DATA_FILE = path.join("/tmp", "cakto_data.json");

interface SavedEmail {
  id: string;
  email: string;
  nome: string;
  subject: string;
  body: string;
  link: string;
  sentAt: string;
}

// Helper to load only simulated emails from JSON file to keep the sandbox UI inbox working
function loadSimulatedEmails(): SavedEmail[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return parsed.simulatedEmails || [];
    }
  } catch (err) {
    console.error("[Cakto Storage] Erro ao carregar e-mails simulados:", err);
  }
  return [];
}

// Helper to save simulated emails to JSON file for the sandbox UI inbox
function saveSimulatedEmails(emails: SavedEmail[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ subscriptions: {}, simulatedEmails: emails }, null, 2), "utf-8");
  } catch (err) {
    console.error("[Cakto Storage] Erro ao salvar e-mails simulados:", err);
  }
}

// Healthcheck route for diagnostics (GET /api/health)
router.get("/health", (req: Request, res: Response) => {
  return res.json({
    status: "ok",
    server: "running"
  });
});

// GET endpoint to prevent fallthrough/confusion when accessing via browser (GET /api/cakto-webhook)
router.get("/cakto-webhook", (req: Request, res: Response) => {
  return res.status(405).json({
    success: false,
    error: "Method Not Allowed",
    message: "O webhook do Sincero News aceita apenas requisições POST com payloads de pagamento da CAKTO. Acesso direto pelo navegador realiza requisições GET padrão."
  });
});

// Endpoint for receiving webhook payments from CAKTO
router.post("/cakto-webhook", async (req: Request, res: Response) => {
  const requestTimestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[CAKTO Webhook] [INFO] [${requestTimestamp}] NOVA REQUISIÇÃO RECEBIDA`);
  console.log(`[CAKTO Webhook] Método: ${req.method}`);
  console.log(`[CAKTO Webhook] URL: ${req.originalUrl || req.url}`);
  
  // Omit / mask sensitive headers
  const sanitizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("auth") || 
      lowerKey.includes("key") || 
      lowerKey.includes("secret") || 
      lowerKey.includes("signature") || 
      lowerKey.includes("cookie") ||
      lowerKey.includes("token")
    ) {
      sanitizedHeaders[key] = "[REDACTED / PROTECTED]";
    } else {
      sanitizedHeaders[key] = Array.isArray(value) ? value.join(", ") : String(value || "");
    }
  }
  console.log(`[CAKTO Webhook] Headers recebidos (seguros):`, JSON.stringify(sanitizedHeaders, null, 2));
  console.log("[CAKTO Webhook] Payload recebido:", JSON.stringify(req.body, null, 2));

  try {
    const payload = req.body || {};
    const isSimulated = req.headers["x-simulated"] === "true" || payload.isSimulated === true;

    // 1. Validation (Cakto "secret" field inside body payload, or HMAC fallback)
    const secret = process.env.CAKTO_SECRET_KEY;
    if (secret && !isSimulated) {
      console.log("========== DEBUG CAKTO ==========");
      console.log("DEBUG payload.secret =", payload.secret);
      console.log("DEBUG payload.token =", payload.token);
      console.log("DEBUG process.env.CAKTO_SECRET_KEY =", process.env.CAKTO_SECRET_KEY);
      console.log("DEBUG comparação =", payload.secret === process.env.CAKTO_SECRET_KEY);
      const payloadSecret = payload.secret || payload.token;

      console.log("DEBUG -> entrou no bloco payloadSecret");
      if (payloadSecret) {
        console.log(`[CAKTO Webhook] [INFO] [${new Date().toISOString()}] Detectado token de segurança no corpo do payload (payload.secret).`);
        if (payloadSecret !== secret) {
          console.error(`[CAKTO Webhook] [ERROR] [${new Date().toISOString()}] Validação falhou: Secret do payload não confere.`);
          console.error(`[CAKTO Webhook] [AUDIT] Secret recebido no payload: "${payloadSecret}"`);
          console.error(`[CAKTO Webhook] [AUDIT] Secret esperado (.env): "${secret}"`);
          return res.status(401).json({ success: false, message: "Token de segurança do webhook (secret) inválido." });
        }
        console.log(`[CAKTO Webhook] [SUCCESS] [${new Date().toISOString()}] Validação do payload passou: Secret validado com sucesso!`);
      } else {
        console.log("DEBUG -> entrou no fallback HMAC");
        // Fallback to Header HMAC Signature validation if no payload.secret is present but signature headers are sent
        console.log(`[CAKTO Webhook] [INFO] Campo "secret" ausente no payload. Verificando assinatura nos headers...`);
        const headerNamesChecked = ["x-cakto-signature", "x-signature", "signature"];
        let headerFound: string | null = null;
        let signature: string | undefined = undefined;

        for (const h of headerNamesChecked) {
          if (req.headers[h]) {
            headerFound = h;
            signature = req.headers[h] as string;
            break;
          }
        }

        const headersAbsent = headerNamesChecked.filter(h => !req.headers[h]);

        if (!signature) {
          console.error(`[CAKTO Webhook] [ERROR] [${new Date().toISOString()}] Validação falhou: Nenhuma assinatura (header) ou campo "secret" (payload) foi encontrado.`);
          console.error(`[CAKTO Webhook] [AUDIT] Todos os headers recebidos:\n`, JSON.stringify(req.headers, null, 2));
          console.error(`[CAKTO Webhook] [AUDIT] Headers de assinatura ausentes: ${headersAbsent.join(", ")}`);
          console.error(`[CAKTO Webhook] [AUDIT] Campo "secret" no payload: ausente`);
          return res.status(401).json({ success: false, message: "Webhook sem autenticação ou assinatura obrigatória." });
        }

        const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
        const computedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

        if (computedSignature !== signature) {
          console.error(`[CAKTO Webhook] [ERROR] [${new Date().toISOString()}] Validação HMAC falhou: Assinaturas não coincidem.`);
          console.error(`[CAKTO Webhook] [AUDIT] Todos os headers recebidos:\n`, JSON.stringify(req.headers, null, 2));
          console.error(`[CAKTO Webhook] [AUDIT] Header de assinatura encontrado: "${headerFound}"`);
          console.error(`[CAKTO Webhook] [AUDIT] Assinatura calculada (HMAC-SHA256): "${computedSignature}"`);
          console.error(`[CAKTO Webhook] [AUDIT] Assinatura recebida: "${signature}"`);
          return res.status(401).json({ success: false, message: "Assinatura do webhook inválida." });
        }
        console.log(`[CAKTO Webhook] [SUCCESS] [${new Date().toISOString()}] Validação HMAC passou: Assinatura validada com sucesso via HMAC-SHA256!`);
      }
    } else if (secret && isSimulated) {
      console.log(`[CAKTO Webhook] [INFO] [${new Date().toISOString()}] Ignorando verificação de assinatura para requisição simulada via sandbox.`);
    } else {
      console.warn(`[CAKTO Webhook] [WARN] [${new Date().toISOString()}] CAKTO_SECRET_KEY não configurado no .env. Ignorando validação de segurança para desenvolvimento.`);
    }

    // 2. Extract email and name with extensive fallbacks
    let email = "";
    if (typeof payload.email === "string") email = payload.email;
    else if (payload.customer && typeof payload.customer.email === "string") email = payload.customer.email;
    else if (payload.client && typeof payload.client.email === "string") email = payload.client.email;
    else if (payload.data && payload.data.email) email = payload.data.email;

    let nome = "Usuário Sincero";
    if (typeof payload.name === "string") nome = payload.name;
    else if (typeof payload.nome === "string") nome = payload.nome;
    else if (payload.customer && typeof payload.customer.name === "string") nome = payload.customer.name;
    else if (payload.client && typeof payload.client.name === "string") nome = payload.client.name;
    else if (payload.data && payload.data.name) nome = payload.data.name;

    email = email.trim().toLowerCase();
    nome = nome.trim();

    console.log(`[CAKTO Webhook] [INFO] E-mail do comprador extraído: "${email}"`);
    console.log(`[CAKTO Webhook] [INFO] Nome do comprador extraído: "${nome}"`);

    if (!email) {
      console.error(`[CAKTO Webhook] [ERROR] E-mail do comprador não encontrado no payload.`);
      return res.status(400).json({ 
        success: false, 
        message: "E-mail do comprador não encontrado no payload do webhook." 
      });
    }

    // 3. Extract and parse Plan (Mensal, Trimestral, Semestral, Anual, Vitalício)
    let plano: "Mensal" | "Trimestral" | "Semestral" | "Anual" | "Vitalício" = "Trimestral";
    const planRaw = (payload.plan || payload.plano || payload.product || payload.product_name || "").toString().toLowerCase();

    if (planRaw.includes("mensal") || planRaw.includes("1 mes") || planRaw.includes("1 mês")) {
      plano = "Mensal";
    } else if (planRaw.includes("semestral") || planRaw.includes("6 meses")) {
      plano = "Semestral";
    } else if (planRaw.includes("anual") || planRaw.includes("12 meses") || planRaw.includes("ano")) {
      plano = "Anual";
    } else if (planRaw.includes("vitalicio") || planRaw.includes("vitalício") || planRaw.includes("lifetime")) {
      plano = "Vitalício";
    } else if (planRaw.includes("trimestral") || planRaw.includes("3 meses")) {
      plano = "Trimestral";
    }
    console.log(`[CAKTO Webhook] [INFO] Plano identificado: ${plano} (Texto original: "${planRaw}")`);

    // 4. Extract and parse role/user type
    let tipoUsuario: "Leitor" | "Influenciador" | "Jornalista" | "Administrador" = "Leitor";
    const roleRaw = (payload.tipoUsuario || payload.role || "").toString().toLowerCase();
    if (roleRaw.includes("influenciador")) tipoUsuario = "Influenciador";
    else if (roleRaw.includes("jornalista")) tipoUsuario = "Jornalista";
    else if (roleRaw.includes("administrador") || roleRaw.includes("admin")) tipoUsuario = "Administrador";
    console.log(`[CAKTO Webhook] [INFO] Tipo de usuário (role): ${tipoUsuario} (Texto original: "${roleRaw}")`);

    // 5. Extract and parse status (Ativa, Expirada, Cancelada, Em análise)
    let statusAssinatura: "Ativa" | "Expirada" | "Cancelada" | "Em análise" = "Ativa";
    const eventRaw = (payload.event || payload.event_name || "").toString().toLowerCase();
    const statusRaw = (payload.status || payload.statusAssinatura || "").toString().toLowerCase();
    console.log(`[CAKTO Webhook] [INFO] Evento CAKTO: "${eventRaw}" | Status CAKTO: "${statusRaw}"`);
    
    const isCancelOrRefund = 
      eventRaw.includes("cancel") || 
      eventRaw.includes("refund") || 
      eventRaw.includes("estorno") || 
      eventRaw.includes("reembolso") || 
      eventRaw.includes("chargeback") ||
      statusRaw.includes("cancel") || 
      statusRaw.includes("refund") || 
      statusRaw.includes("estorno") || 
      statusRaw.includes("reembolso") || 
      statusRaw.includes("chargeback") ||
      statusRaw === "canceled" ||
      statusRaw === "refunded";
      
    const isExpired = 
      eventRaw.includes("expire") || 
      eventRaw.includes("expir") || 
      statusRaw.includes("expire") || 
      statusRaw.includes("expir");
      
    const isPending = 
      statusRaw.includes("pending") || 
      statusRaw.includes("analise") || 
      statusRaw.includes("processing") || 
      statusRaw.includes("aguardando");

    if (isCancelOrRefund) {
      statusAssinatura = "Cancelada";
    } else if (isExpired) {
      statusAssinatura = "Expirada";
    } else if (isPending) {
      statusAssinatura = "Em análise";
    } else {
      statusAssinatura = "Ativa";
    }
    console.log(`[CAKTO Webhook] [INFO] Status final mapeado para assinatura: "${statusAssinatura}"`);

    // 6. Calculate purchase dates
    const dataCompra = new Date();
    const dataExpiracao = new Date();

    if (plano === "Mensal") {
      dataExpiracao.setMonth(dataCompra.getMonth() + 1);
    } else if (plano === "Trimestral") {
      dataExpiracao.setMonth(dataCompra.getMonth() + 3);
    } else if (plano === "Semestral") {
      dataExpiracao.setMonth(dataCompra.getMonth() + 6);
    } else if (plano === "Anual") {
      dataExpiracao.setFullYear(dataCompra.getFullYear() + 1);
    } else if (plano === "Vitalício") {
      dataExpiracao.setFullYear(dataCompra.getFullYear() + 100);
    }
    console.log(`[CAKTO Webhook] [INFO] Data Compra: ${dataCompra.toISOString()} | Data Expiração: ${dataExpiracao.toISOString()}`);

    // 7. Check if user exists or create automatically in Firebase Auth if approved
    const isApprovedPayment = statusAssinatura === "Ativa" || statusAssinatura === "Em análise";
    let userRecord;
    let passwordCreationLink = "";
    const tempPassword = `Sincero@${email.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8)}2026`;

    if (isApprovedPayment) {
      const authAdmin = adminAuth();
      try {
        console.log(`[CAKTO Webhook] [INFO] Verificando existência do e-mail no Firebase Auth: ${email}`);
        userRecord = await authAdmin.getUserByEmail(email);
        console.log(`[CAKTO Webhook] [INFO] Usuário já existe no Auth para o e-mail: ${email} (UID: ${userRecord.uid})`);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          console.log(`[CAKTO Webhook] [INFO] Iniciando criação automática de usuário no Firebase Auth para: ${email}`);
          try {
            userRecord = await authAdmin.createUser({
              email,
              displayName: nome,
            });
            console.log(`[CAKTO Webhook] [SUCCESS] Conta criada no Firebase Auth. UID: ${userRecord.uid}`);
          } catch (createErr: any) {
            console.error(`[CAKTO Webhook] [FATAL] Falha crítica ao executar createUser() no Firebase Auth. Stack completa:`, createErr.stack || createErr);
            throw createErr;
          }
        } else {
          console.error(`[CAKTO Webhook] [FATAL] Erro ao buscar usuário por e-mail no Firebase Auth. Stack completa:`, err.stack || err);
          throw err;
        }
      }

      // Generate standard password reset / creation link
      try {
        console.log(`[CAKTO Webhook] [INFO] Gerando link de definição de senha oficial do Firebase para: ${email}`);
        const actionCodeSettings = {
          url: `${req.protocol}://${req.get("host")}/?action=create-password&email=${encodeURIComponent(email)}&temp=${encodeURIComponent(tempPassword)}`,
        };
        passwordCreationLink = await authAdmin.generatePasswordResetLink(email, actionCodeSettings);
        console.log(`[CAKTO Webhook] [SUCCESS] Link oficial do Firebase Auth gerado com sucesso: ${passwordCreationLink}`);
      } catch (linkErr: any) {
        console.warn(`[CAKTO Webhook] [WARN] Erro ao gerar link oficial, usando fallback do simulador. Stack:`, linkErr.stack || linkErr);
        passwordCreationLink = `${req.protocol}://${req.get("host")}/?action=create-password&email=${encodeURIComponent(email)}&temp=${encodeURIComponent(tempPassword)}`;
      }
    } else {
      // For cancels, try to look up user to get the correct UID
      console.log(`[CAKTO Webhook] [INFO] Evento de inativação/cancelamento. Buscando UID correspondente se existir para: ${email}`);
      try {
        userRecord = await adminAuth().getUserByEmail(email);
        console.log(`[CAKTO Webhook] [INFO] Usuário localizado para inativação: ${email} (UID: ${userRecord.uid})`);
      } catch (err) {
        console.log(`[CAKTO Webhook] [INFO] Usuário não possuía conta ativa no Firebase Auth para: ${email}`);
      }
    }

    // Determine the UID (fallback if they are not in auth yet)
    const uid = userRecord?.uid || `uid-${email.replace(/[^a-zA-Z0-9]/g, "")}`;

    // 8. Save or update subscription details in Cloud Firestore
    const dbAdmin = adminDb();
    const subDocRef = dbAdmin.collection("subscriptions").doc(uid);

    const subscriptionData: any = {
      uid,
      nome,
      email,
      tipoUsuario,
      plano,
      statusAssinatura,
      dataCompra: dataCompra.toISOString(),
      dataExpiracao: dataExpiracao.toISOString(),
      origemCadastro: "CAKTO",
      ultimoPagamento: dataCompra.toISOString(),
      renovacaoAutomatica: true,
      lastUpdated: new Date().toISOString()
    };

    console.log(`[CAKTO Webhook] [INFO] Gravando documento de assinatura no Firestore em "/subscriptions/${uid}"`);
    await subDocRef.set(subscriptionData, { merge: true });
    console.log(`[CAKTO Webhook] [SUCCESS] Documento salvo com sucesso no Firestore com status: ${statusAssinatura}`);

    // 9. Add to simulated email inbox so developers can access the password link in UI sandbox
    if (isApprovedPayment && passwordCreationLink) {
      console.log(`[CAKTO Webhook] [INFO] Adicionando e-mail de boas-vindas à caixa simulada.`);
      const simulatedEmails = loadSimulatedEmails();
      const newEmail: SavedEmail = {
        id: `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        email,
        nome,
        subject: "Ative sua conta - Sincero News",
        body: `Olá, ${nome}! Sua assinatura do plano ${plano} no Sincero News foi aprovada. Para definir sua senha e acessar a plataforma, utilize o link oficial do Firebase Auth abaixo:`,
        link: passwordCreationLink,
        sentAt: new Date().toISOString()
      };
      simulatedEmails.unshift(newEmail);
      saveSimulatedEmails(simulatedEmails.slice(0, 10)); // Keep last 10 emails
    }

    console.log(`[CAKTO Webhook] [SUCCESS] [${new Date().toISOString()}] PROCESSAMENTO FINALIZADO COM SUCESSO!`);
    console.log(`========================================\n`);

    return res.status(200).json({
      success: true,
      message: "Webhook processado com sucesso. Assinatura sincronizada no Firestore.",
      data: {
        uid,
        email,
        nome,
        plano,
        statusAssinatura,
        link: passwordCreationLink || undefined
      }
    });

  } catch (error: any) {
    console.error(`[CAKTO Webhook] [FATAL ERROR] [${new Date().toISOString()}] Erro crítico no processamento do webhook:`, error);
    console.error(`[CAKTO Webhook] [FATAL ERROR] Stack de erro completa:`, error.stack || error);
    console.log(`========================================\n`);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao processar o webhook.",
      error: error.message || error
    });
  }
});

// Endpoint to fetch subscription details by email in real-time from Firestore
router.get("/subscription-details", async (req: Request, res: Response) => {
  try {
    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: "Parâmetro email é obrigatório." });
    }

    const dbAdmin = adminDb();
    const snapshot = await dbAdmin.collection("subscriptions").where("email", "==", email).limit(1).get();

    if (snapshot.empty) {
      console.warn(`[CAKTO API] Assinatura não encontrada no Firestore para: ${email}`);
      return res.json({ success: false, found: false });
    }

    const sub = snapshot.docs[0].data();
    return res.json({ success: true, found: true, subscription: sub });
  } catch (err: any) {
    console.error("[CAKTO API] Erro ao buscar detalhes da assinatura no Firestore:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Helper endpoint to fetch simulated emails for development sandbox
router.get("/debug-emails", (req: Request, res: Response) => {
  try {
    const emails = loadSimulatedEmails();
    return res.json({ success: true, emails });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to fetch public Firebase configuration dynamically for the client
router.get("/firebase-config", (req: Request, res: Response) => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return res.json({
        success: true,
        config: {
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId
        }
      });
    } else {
      return res.json({
        success: true,
        config: {
          projectId: "sinceronewsapp",
          apiKey: "AIzaSyAYLg_SlM_8NgYYJhTOLk1Mz4OuSt3JIQc",
          authDomain: "sinceronewsapp.firebaseapp.com",
          appId: "1:689265991241:web:c0d8fdec2b87857da6e998"
        }
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
