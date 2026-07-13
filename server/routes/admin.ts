import { Router, Request, Response } from "express";
import { adminAuth, adminDb } from "../firebaseAdmin";

const router = Router();

// Middleware to authenticate admin requests using Firebase ID token
async function requireAdmin(req: Request, res: Response, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Token de autorização não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";

    // Treat owner email as superadmin automatically for self-healing/bootstrapping
    if (email.toLowerCase() === "coolbano@gmail.com") {
      (req as any).user = {
        uid,
        email,
        role: "superadmin",
      };
      return next();
    }

    if (email.toLowerCase() === "metodojmolina@gmail.com") {
      (req as any).user = {
        uid,
        email,
        role: "admin",
      };
      return next();
    }

    // Check role in "subscriptions" and "users" collections
    const db = adminDb();
    const subSnap = await db.collection("subscriptions").doc(uid).get();
    const userSnap = await db.collection("users").doc(uid).get();

    let role = "user";
    if (subSnap.exists) {
      const data = subSnap.data();
      if (data && data.role) {
        role = data.role;
      } else if (data && data.tipoUsuario === "Administrador") {
        role = "admin";
      }
    }
    
    // Check users collection as well
    if (userSnap.exists) {
      const data = userSnap.data();
      if (data && data.role) {
        role = data.role;
      }
    }

    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Acesso negado: privilégios insuficientes" });
    }

    (req as any).user = {
      uid,
      email,
      role,
    };
    next();
  } catch (error: any) {
    console.error("[Admin Middleware] Erro de autenticação:", error);
    return res.status(401).json({ success: false, error: "Não autorizado", details: error.message });
  }
}

// Check access route - called by frontend to verify permission to show /admin view
router.get("/check-access", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({ success: false, isAllowed: false });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";

    if (email.toLowerCase() === "coolbano@gmail.com") {
      // Auto bootstrap: set role as superadmin in subscriptions and users for coolbano@gmail.com
      const db = adminDb();
      const subRef = db.collection("subscriptions").doc(uid);
      const userRef = db.collection("users").doc(uid);
      
      const subSnap = await subRef.get();
      if (subSnap.exists) {
        await subRef.update({ role: "superadmin" });
      } else {
        await subRef.set({
          uid,
          email: email.toLowerCase(),
          nome: "Super Admin",
          role: "superadmin",
          statusAssinatura: "Ativa",
          plano: "Vitalício",
          tipoUsuario: "Administrador",
          dataCompra: new Date().toISOString(),
          dataExpiracao: "2036-12-31T23:59:59.000Z",
          origemCadastro: "Admin Auto Bootstrap"
        });
      }

      const userSnap = await userRef.get();
      if (userSnap.exists) {
        await userRef.update({ role: "superadmin" });
      } else {
        await userRef.set({
          nome: "Super Admin",
          email: email.toLowerCase(),
          createdAt: new Date().toISOString(),
          role: "superadmin",
          status: "active",
          subscription: true,
          origin: "admin-bootstrap"
        });
      }

      return res.json({ success: true, isAllowed: true, role: "superadmin" });
    }

    if (email.toLowerCase() === "metodojmolina@gmail.com") {
      // Auto bootstrap: set role as admin in subscriptions and users for metodojmolina@gmail.com
      const db = adminDb();
      const subRef = db.collection("subscriptions").doc(uid);
      const userRef = db.collection("users").doc(uid);
      
      const subSnap = await subRef.get();
      if (subSnap.exists) {
        await subRef.update({ role: "admin" });
      } else {
        await subRef.set({
          uid,
          email: email.toLowerCase(),
          nome: "Admin Molina",
          role: "admin",
          statusAssinatura: "Ativa",
          plano: "Vitalício",
          tipoUsuario: "Administrador",
          dataCompra: new Date().toISOString(),
          dataExpiracao: "2036-12-31T23:59:59.000Z",
          origemCadastro: "Admin Auto Bootstrap"
        });
      }

      const userSnap = await userRef.get();
      if (userSnap.exists) {
        await userRef.update({ role: "admin" });
      } else {
        await userRef.set({
          nome: "Admin Molina",
          email: email.toLowerCase(),
          createdAt: new Date().toISOString(),
          role: "admin",
          status: "active",
          subscription: true,
          origin: "admin-bootstrap"
        });
      }

      return res.json({ success: true, isAllowed: true, role: "admin" });
    }

    const db = adminDb();
    const subSnap = await db.collection("subscriptions").doc(uid).get();
    const userSnap = await db.collection("users").doc(uid).get();

    let role = "user";
    if (subSnap.exists) {
      const data = subSnap.data();
      if (data && data.role) {
        role = data.role;
      } else if (data && data.tipoUsuario === "Administrador") {
        role = "admin";
      }
    }
    
    if (userSnap.exists) {
      const data = userSnap.data();
      if (data && data.role) {
        role = data.role;
      }
    }

    const isAllowed = role === "admin" || role === "superadmin";
    return res.json({ success: true, isAllowed, role });
  } catch (err) {
    return res.json({ success: false, isAllowed: false });
  }
});

// Main endpoint to list users, calculate counts, search, and paginate
router.get("/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = adminDb();
    
    // 1. Fetch all documents from both collections to build a merged and sorted master list
    const subscriptionsSnap = await db.collection("subscriptions").get();
    const usersSnap = await db.collection("users").get();

    const mergedUsersMap = new Map<string, any>();

    // Process subscriptions collection
    subscriptionsSnap.forEach((doc) => {
      const data = doc.data();
      const uid = doc.id;
      const email = (data.email || "").toLowerCase();
      
      let resolvedRole = data.role || "user";
      if (email === "coolbano@gmail.com") {
        resolvedRole = "superadmin";
      } else if (email === "metodojmolina@gmail.com") {
        resolvedRole = "admin";
      } else if (!data.role && data.tipoUsuario === "Administrador") {
        resolvedRole = "admin";
      }

      const isActiveSub = data.statusAssinatura === "Ativa" || data.status === "active";

      mergedUsersMap.set(uid, {
        uid,
        nome: data.nome || "Usuário Sincero",
        email,
        role: resolvedRole,
        guest: resolvedRole === "guest" || data.guest === true || false,
        subscription: data.subscription === true || isActiveSub,
        status: data.status || data.statusAssinatura || "inactive",
        statusAssinatura: data.statusAssinatura || "inactive",
        plano: data.plano || "",
        createdAt: data.dataCriacao || data.dataCompra || data.createdAt || new Date().toISOString(),
        ultimoLogin: data.ultimoLogin || new Date().toISOString(),
        origemCadastro: data.origemCadastro || "Sistema",
        dataCompra: data.dataCompra || "",
        dataExpiracao: data.dataExpiracao || "",
        ultimoPagamento: data.ultimoPagamento || data.dataCompra || "",
      });
    });

    // Process users collection (merging fields or adding missing users)
    usersSnap.forEach((doc) => {
      const data = doc.data();
      const uid = doc.id;
      const email = (data.email || "").toLowerCase();

      let resolvedRole = data.role || "user";
      if (email === "coolbano@gmail.com") {
        resolvedRole = "superadmin";
      } else if (email === "metodojmolina@gmail.com") {
        resolvedRole = "admin";
      }

      const isSubscribed = data.subscription === true || data.status === "active";

      if (mergedUsersMap.has(uid)) {
        const existing = mergedUsersMap.get(uid);
        mergedUsersMap.set(uid, {
          ...existing,
          role: data.role || existing.role,
          guest: data.role === "guest" || data.guest === true || existing.guest,
          subscription: data.subscription !== undefined ? data.subscription : existing.subscription,
          status: data.status || existing.status,
          createdAt: data.createdAt || existing.createdAt,
          origin: data.origin || existing.origemCadastro,
        });
      } else {
        mergedUsersMap.set(uid, {
          uid,
          nome: data.nome || "Usuário Sincero",
          email,
          role: resolvedRole,
          guest: resolvedRole === "guest" || data.guest === true || false,
          subscription: isSubscribed,
          status: data.status || "pending",
          statusAssinatura: isSubscribed ? "Ativa" : "Cancelada",
          plano: "",
          createdAt: data.createdAt || new Date().toISOString(),
          ultimoLogin: data.ultimoLogin || new Date().toISOString(),
          origemCadastro: data.origin || "primeiro-acesso",
          dataCompra: "",
          dataExpiracao: "",
          ultimoPagamento: "",
        });
      }
    });

    const allUsers = Array.from(mergedUsersMap.values());

    // 2. Compute accurate stats for the Dashboard
    const stats = {
      totalUsers: allUsers.length,
      activeSubscribers: allUsers.filter(u => u.subscription === true).length,
      canceledSubscribers: allUsers.filter(u => u.subscription === false).length,
      planMensal: allUsers.filter(u => (u.plano || "").toLowerCase() === "mensal").length,
      planTrimestral: allUsers.filter(u => (u.plano || "").toLowerCase() === "trimestral").length,
      planSemestral: allUsers.filter(u => (u.plano || "").toLowerCase() === "semestral").length,
      planAnual: allUsers.filter(u => (u.plano || "").toLowerCase() === "anual").length,
      planVitalicio: allUsers.filter(u => (u.plano || "").toLowerCase().includes("vital")).length,
      admins: allUsers.filter(u => u.role === "admin").length,
      superadmins: allUsers.filter(u => u.role === "superadmin").length,
    };

    // 3. Apply Search query
    const search = (req.query.search as string || "").trim().toLowerCase();
    let filteredUsers = allUsers;
    if (search) {
      filteredUsers = filteredUsers.filter(
        (u) =>
          (u.nome || "").toLowerCase().includes(search) ||
          (u.email || "").toLowerCase().includes(search) ||
          (u.uid || "").toLowerCase().includes(search)
      );
    }

    // 4. Apply Filters
    // Options: todos, assinantes, convidados, admins, superadmins, sem_assinatura
    const filter = (req.query.filter as string || "todos").toLowerCase();
    if (filter === "ativos" || filter === "assinantes") {
      filteredUsers = filteredUsers.filter((u) => u.subscription === true);
    } else if (filter === "cancelados" || filter === "sem_assinatura") {
      filteredUsers = filteredUsers.filter((u) => u.subscription === false);
    } else if (filter === "convidados") {
      filteredUsers = filteredUsers.filter((u) => u.role === "guest" || u.guest === true);
    } else if (filter === "admins") {
      filteredUsers = filteredUsers.filter((u) => u.role === "admin");
    } else if (filter === "superadmins") {
      filteredUsers = filteredUsers.filter((u) => u.role === "superadmin");
    } else if (filter === "mensal") {
      filteredUsers = filteredUsers.filter((u) => (u.plano || "").toLowerCase() === "mensal");
    } else if (filter === "trimestral") {
      filteredUsers = filteredUsers.filter((u) => (u.plano || "").toLowerCase() === "trimestral");
    } else if (filter === "semestral") {
      filteredUsers = filteredUsers.filter((u) => (u.plano || "").toLowerCase() === "semestral");
    } else if (filter === "anual") {
      filteredUsers = filteredUsers.filter((u) => (u.plano || "").toLowerCase() === "anual");
    } else if (filter === "vitalicio") {
      filteredUsers = filteredUsers.filter((u) => (u.plano || "").toLowerCase().includes("vital"));
    }

    // Sort by creation date descending
    filteredUsers.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 5. Apply Pagination
    const page = Math.max(1, parseInt(req.query.page as string || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit as string || "20", 10));
    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);

    return res.json({
      success: true,
      stats,
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (err: any) {
    console.error("[Admin Users API] Erro ao listar usuários:", err);
    return res.status(500).json({ success: false, error: "Erro interno ao carregar usuários" });
  }
});

// Update role endpoint with safety checks
router.post("/update-role", requireAdmin, async (req: Request, res: Response) => {
  const { targetUid, newRole } = req.body;
  const caller = (req as any).user;

  if (!targetUid || !newRole) {
    return res.status(400).json({ success: false, error: "UID e nova role são necessários." });
  }

  const validRoles = ["user", "guest", "admin", "superadmin"];
  if (!validRoles.includes(newRole)) {
    return res.status(400).json({ success: false, error: "Role inválida fornecida." });
  }

  try {
    const db = adminDb();
    
    // Check target user existing role
    const subRef = db.collection("subscriptions").doc(targetUid);
    const userRef = db.collection("users").doc(targetUid);

    const subSnap = await subRef.get();
    const userSnap = await userRef.get();

    let targetEmail = "";
    let targetCurrentRole = "user";

    if (subSnap.exists) {
      const data = subSnap.data();
      targetEmail = data?.email || "";
      if (data?.role) targetCurrentRole = data.role;
    }
    if (userSnap.exists && !targetCurrentRole) {
      const data = userSnap.data();
      targetEmail = data?.email || targetEmail;
      if (data?.role) targetCurrentRole = data.role;
    }

    // Safety checks:
    // 1. Never demote coolbano@gmail.com
    if (targetEmail.toLowerCase() === "coolbano@gmail.com") {
      return res.status(403).json({ success: false, error: "Não é possível alterar a role do proprietário principal." });
    }

    // 2. Non-superadmins (regular admins) cannot remove or touch a superadmin
    if (caller.role !== "superadmin" && targetCurrentRole === "superadmin") {
      return res.status(403).json({ success: false, error: "Apenas superadmins podem remover ou alterar outros superadmins." });
    }

    // 3. Non-superadmins cannot promote someone to superadmin
    if (caller.role !== "superadmin" && newRole === "superadmin") {
      return res.status(403).json({ success: false, error: "Apenas superadmins podem promover usuários para superadmin." });
    }

    // Update in both databases
    const updateObj: any = { 
      role: newRole,
      guest: newRole === "guest"
    };

    if (newRole === "admin" || newRole === "superadmin") {
      updateObj.tipoUsuario = "Administrador";
    } else {
      updateObj.tipoUsuario = "Leitor";
    }

    if (subSnap.exists) {
      await subRef.update(updateObj);
    }
    if (userSnap.exists) {
      await userRef.update({
        role: newRole,
        guest: newRole === "guest"
      });
    }

    console.log(`[Admin Update Role] ${caller.email} alterou a role de ${targetEmail || targetUid} para ${newRole}.`);
    return res.json({ success: true, message: `Role atualizada para ${newRole} com sucesso!` });
  } catch (err: any) {
    console.error("[Admin Update Role] Erro ao atualizar role:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno ao atualizar role." });
  }
});

// Grant subscription access
router.post("/grant-access", requireAdmin, async (req: Request, res: Response) => {
  const { targetUid } = req.body;
  const caller = (req as any).user;

  if (!targetUid) {
    return res.status(400).json({ success: false, error: "UID do usuário é necessário." });
  }

  try {
    const db = adminDb();
    const subRef = db.collection("subscriptions").doc(targetUid);
    const userRef = db.collection("users").doc(targetUid);

    const subSnap = await subRef.get();
    const userSnap = await userRef.get();

    // 10 years in the future expiration
    const longTermExpiration = "2036-12-31T23:59:59.000Z";

    if (subSnap.exists) {
      await subRef.update({
        statusAssinatura: "Ativa",
        dataExpiracao: longTermExpiration,
        subscription: true,
        status: "active"
      });
    } else {
      // Create subscription doc if it doesn't exist
      const email = userSnap.exists ? userSnap.data()?.email : "";
      const nome = userSnap.exists ? userSnap.data()?.nome : "Usuário Ativado";
      await subRef.set({
        uid: targetUid,
        nome,
        email,
        tipoUsuario: "Leitor",
        plano: "Vitalício",
        statusAssinatura: "Ativa",
        dataCompra: new Date().toISOString(),
        dataExpiracao: longTermExpiration,
        origemCadastro: "Admin Panel Activation"
      });
    }

    if (userSnap.exists) {
      await userRef.update({
        subscription: true,
        status: "active"
      });
    }

    console.log(`[Admin Grant Access] ${caller.email} liberou acesso para o usuário ${targetUid}.`);
    return res.json({ success: true, message: "Acesso de assinatura liberado com sucesso!" });
  } catch (err: any) {
    console.error("[Admin Grant Access] Erro ao liberar acesso:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno ao liberar acesso." });
  }
});

// Block/Revoke subscription access
router.post("/revoke-access", requireAdmin, async (req: Request, res: Response) => {
  const { targetUid } = req.body;
  const caller = (req as any).user;

  if (!targetUid) {
    return res.status(400).json({ success: false, error: "UID do usuário é necessário." });
  }

  try {
    const db = adminDb();
    const subRef = db.collection("subscriptions").doc(targetUid);
    const userRef = db.collection("users").doc(targetUid);

    const subSnap = await subRef.get();
    const userSnap = await userRef.get();

    if (subSnap.exists) {
      await subRef.update({
        statusAssinatura: "Cancelada",
        dataExpiracao: new Date().toISOString(), // immediately expire
        subscription: false,
        status: "inactive"
      });
    }
    if (userSnap.exists) {
      await userRef.update({
        subscription: false,
        status: "inactive"
      });
    }

    console.log(`[Admin Revoke Access] ${caller.email} revogou acesso do usuário ${targetUid}.`);
    return res.json({ success: true, message: "Acesso de assinatura revogado com sucesso!" });
  } catch (err: any) {
    console.error("[Admin Revoke Access] Erro ao revogar acesso:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno ao revogar acesso." });
  }
});

// Delete user with safety checks
router.post("/delete-user", requireAdmin, async (req: Request, res: Response) => {
  const { targetUid } = req.body;
  const caller = (req as any).user;

  if (!targetUid) {
    return res.status(400).json({ success: false, error: "UID do usuário é necessário." });
  }

  try {
    const db = adminDb();
    
    // Retrieve target details for verification
    const subSnap = await db.collection("subscriptions").doc(targetUid).get();
    const userSnap = await db.collection("users").doc(targetUid).get();

    let targetEmail = "";
    let targetCurrentRole = "user";

    if (subSnap.exists) {
      const data = subSnap.data();
      targetEmail = data?.email || "";
      if (data?.role) targetCurrentRole = data.role;
    }
    if (userSnap.exists && !targetCurrentRole) {
      const data = userSnap.data();
      targetEmail = data?.email || targetEmail;
      if (data?.role) targetCurrentRole = data.role;
    }

    // Safety checks:
    // 1. Cannot delete coolbano@gmail.com
    if (targetEmail.toLowerCase() === "coolbano@gmail.com") {
      return res.status(403).json({ success: false, error: "Não é possível excluir o proprietário principal." });
    }

    // 2. Regular admins cannot delete a superadmin
    if (caller.role !== "superadmin" && targetCurrentRole === "superadmin") {
      return res.status(403).json({ success: false, error: "Apenas superadmins podem excluir outros superadmins." });
    }

    // 3. Regular admins cannot delete other admins (only superadmin can remove admins/guests)
    if (caller.role !== "superadmin" && targetCurrentRole === "admin") {
      return res.status(403).json({ success: false, error: "Apenas superadmins podem excluir outros administradores." });
    }

    // Delete documents from both Firestore collections
    await db.collection("subscriptions").doc(targetUid).delete();
    await db.collection("users").doc(targetUid).delete();

    // Optionally delete from Firebase Authentication
    try {
      await adminAuth().deleteUser(targetUid);
      console.log(`[Admin Delete User] Usuário ${targetUid} removido também do Firebase Auth.`);
    } catch (authErr: any) {
      console.warn(`[Admin Delete User] Detalhe: Falha ao remover do Auth (pode não existir):`, authErr.message);
    }

    console.log(`[Admin Delete User] ${caller.email} excluiu o usuário ${targetEmail || targetUid} com sucesso.`);
    return res.json({ success: true, message: "Usuário excluído com sucesso!" });
  } catch (err: any) {
    console.error("[Admin Delete User] Erro ao excluir usuário:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno ao excluir usuário." });
  }
});

// Update plan endpoint
router.post("/update-plan", requireAdmin, async (req: Request, res: Response) => {
  const { targetUid, newPlan } = req.body;
  const caller = (req as any).user;

  if (!targetUid || !newPlan) {
    return res.status(400).json({ success: false, error: "UID e plano são necessários." });
  }

  const validPlans = ["Mensal", "Trimestral", "Semestral", "Anual", "Vitalício"];
  if (!validPlans.includes(newPlan)) {
    return res.status(400).json({ success: false, error: "Plano inválido." });
  }

  try {
    const db = adminDb();
    const subRef = db.collection("subscriptions").doc(targetUid);
    const userRef = db.collection("users").doc(targetUid);

    const subSnap = await subRef.get();
    const userSnap = await userRef.get();

    // Safety checks:
    // Non-superadmins (regular admins) cannot modify a superadmin's plan/data
    let targetCurrentRole = "user";
    if (subSnap.exists) {
      targetCurrentRole = subSnap.data()?.role || "user";
    } else if (userSnap.exists) {
      targetCurrentRole = userSnap.data()?.role || "user";
    }

    if (caller.role !== "superadmin" && targetCurrentRole === "superadmin") {
      return res.status(403).json({ success: false, error: "Apenas superadmins podem alterar planos de superadmins." });
    }

    const updateObj: any = { plano: newPlan };

    if (subSnap.exists) {
      await subRef.update(updateObj);
    } else {
      // Create subscription if not exists
      const email = userSnap.exists ? userSnap.data()?.email : "";
      const nome = userSnap.exists ? userSnap.data()?.nome : "Usuário Ativado";
      await subRef.set({
        uid: targetUid,
        nome,
        email,
        tipoUsuario: "Leitor",
        plano: newPlan,
        statusAssinatura: "Ativa",
        dataCompra: new Date().toISOString(),
        dataExpiracao: "2036-12-31T23:59:59.000Z",
        origemCadastro: "Admin Panel Plan Modification"
      });
    }

    console.log(`[Admin Update Plan] ${caller.email} alterou o plano de ${targetUid} para ${newPlan}.`);
    return res.json({ success: true, message: `Plano atualizado para ${newPlan} com sucesso!` });
  } catch (err: any) {
    console.error("[Admin Update Plan] Erro ao atualizar plano:", err);
    return res.status(500).json({ success: false, error: err.message || "Erro interno ao atualizar plano." });
  }
});

export default router;
