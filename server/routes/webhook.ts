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

// Endpoint for receiving webhook payments from CAKTO
router.post("/cakto-webhook", async (req: Request, res: Response) => {
  console.log("[CAKTO Webhook] Payload recebido:", JSON.stringify(req.body, null, 2));

  try {
    const payload = req.body || {};
    const isSimulated = req.headers["x-simulated"] === "true" || payload.isSimulated === true;

    // 1. Signature validation (HMAC SHA-256)
    const secret = process.env.CAKTO_SECRET_KEY;
    if (secret && !isSimulated) {
      const signature = req.headers["x-cakto-signature"] || req.headers["x-signature"] || req.headers["signature"];
      if (!signature) {
        console.error("[CAKTO Webhook] Assinatura ausente.");
        return res.status(401).json({ success: false, message: "Webhook sem assinatura obrigatória (X-Cakto-Signature)." });
      }

      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      const computedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

      if (computedSignature !== signature) {
        console.error("[CAKTO Webhook] Falha de assinatura HMAC-SHA256.", { computedSignature, signature });
        return res.status(401).json({ success: false, message: "Assinatura do webhook inválida." });
      }
      console.log("[CAKTO Webhook] Assinatura validada com sucesso via HMAC-SHA256!");
    } else if (secret && isSimulated) {
      console.log("[CAKTO Webhook] Ignorando verificação de assinatura para requisição simulada via sandbox.");
    } else {
      console.warn("[CAKTO Webhook] CAKTO_SECRET_KEY não configurado no .env. Ignorando validação estrita de assinatura para desenvolvimento.");
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

    if (!email) {
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

    // 4. Extract and parse role/user type
    let tipoUsuario: "Leitor" | "Influenciador" | "Jornalista" | "Administrador" = "Leitor";
    const roleRaw = (payload.tipoUsuario || payload.role || "").toString().toLowerCase();
    if (roleRaw.includes("influenciador")) tipoUsuario = "Influenciador";
    else if (roleRaw.includes("jornalista")) tipoUsuario = "Jornalista";
    else if (roleRaw.includes("administrador") || roleRaw.includes("admin")) tipoUsuario = "Administrador";

    // 5. Extract and parse status (Ativa, Expirada, Cancelada, Em análise)
    let statusAssinatura: "Ativa" | "Expirada" | "Cancelada" | "Em análise" = "Ativa";
    const eventRaw = (payload.event || payload.event_name || "").toString().toLowerCase();
    const statusRaw = (payload.status || payload.statusAssinatura || "").toString().toLowerCase();
    
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

    // 7. Check if user exists or create automatically in Firebase Auth if approved
    const isApprovedPayment = statusAssinatura === "Ativa" || statusAssinatura === "Em análise";
    let userRecord;
    let passwordCreationLink = "";
    const tempPassword = `Sincero@${email.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8)}2026`;

    if (isApprovedPayment) {
      const authAdmin = adminAuth();
      try {
        userRecord = await authAdmin.getUserByEmail(email);
        console.log(`[CAKTO Webhook] Usuário existente no Auth para: ${email}`);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          userRecord = await authAdmin.createUser({
            email,
            displayName: nome,
          });
          console.log(`[CAKTO Webhook] Conta criada automaticamente no Auth para: ${email} com UID ${userRecord.uid}`);
        } else {
          throw err;
        }
      }

      // Generate standard password reset / creation link
      try {
        const actionCodeSettings = {
          url: `${req.protocol}://${req.get("host")}/?action=create-password&email=${encodeURIComponent(email)}&temp=${encodeURIComponent(tempPassword)}`,
        };
        passwordCreationLink = await authAdmin.generatePasswordResetLink(email, actionCodeSettings);
        console.log(`[CAKTO Webhook] Link oficial do Firebase Auth gerado: ${passwordCreationLink}`);
      } catch (linkErr) {
        console.warn("[CAKTO Webhook] Erro ao gerar link oficial, usando fallback do simulador:", linkErr);
        passwordCreationLink = `${req.protocol}://${req.get("host")}/?action=create-password&email=${encodeURIComponent(email)}&temp=${encodeURIComponent(tempPassword)}`;
      }
    } else {
      // For cancels, try to look up user to get the correct UID
      try {
        userRecord = await adminAuth().getUserByEmail(email);
      } catch (err) {}
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

    await subDocRef.set(subscriptionData, { merge: true });
    console.log(`[CAKTO Webhook] Documento salvo no Firestore em /subscriptions/${uid} com status: ${statusAssinatura}`);

    // 9. Add to simulated email inbox so developers can access the password link in UI sandbox
    if (isApprovedPayment && passwordCreationLink) {
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
    console.error("[CAKTO Webhook] Erro crítico no processamento:", error);
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
