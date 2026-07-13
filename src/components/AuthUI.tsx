import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../providers/AuthProvider";
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  Sparkles, 
  RefreshCw, 
  HelpCircle, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  CreditCard,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  Eye,
  EyeOff
} from "lucide-react";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "../services/firebaseClient";

interface AuthUIProps {
  onSuccess?: () => void;
}

export const AuthUI: React.FC<AuthUIProps> = () => {
  const { login, logout, sendPasswordReset, isBlocked, user, userProfile } = useAuth();
  
  const [view, setView] = useState<"login" | "forgot" | "reset-password" | "expired">("login");
  const [showSandbox, setShowSandbox] = useState(false);
  
  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Reset Password fields
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // CAKTO Simulator fields
  const [simName, setSimName] = useState("Carlos Oliveira");
  const [simEmail, setSimEmail] = useState("carlos.sincero@exemplo.com");
  const [simPlan, setSimPlan] = useState<"Trimestral" | "Semestral" | "Anual" | "Vitalício">("Anual");
  const [simRole, setSimRole] = useState<"Leitor" | "Influenciador" | "Jornalista" | "Administrador">("Leitor");
  const [simLoading, setSimLoading] = useState(false);
  const [simWebhookResult, setSimWebhookResult] = useState<any | null>(null);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);

  // Password Creation via Webhook Link
  const [resetEmail, setResetEmail] = useState("");
  const [resetTempPassword, setResetTempPassword] = useState("");

  // URL query params check for password activation on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const mailParam = params.get("email");
    const tempParam = params.get("temp");

    if ((action === "create-password" || params.get("reset") === "true") && mailParam) {
      setResetEmail(mailParam.trim().toLowerCase());
      if (tempParam) {
        setResetTempPassword(tempParam);
      }
      setView("reset-password");
    }
  }, []);

  // If user is logged in but blocked, show expired view
  useEffect(() => {
    if (view === "reset-password") return; // Prevent overriding when user is activating password
    if (user && isBlocked) {
      setView("expired");
    } else if (user && !isBlocked) {
      setView("login");
    }
  }, [user, isBlocked, view]);

  // Load simulated emails for testing
  const loadSimulatedEmails = async () => {
    try {
      const res = await fetch("/api/debug-emails");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data.success) {
            setRecentEmails(data.emails || []);
          }
        } else {
          console.warn("[AuthUI] /api/debug-emails retornou um content-type não-JSON:", contentType);
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar e-mails simulados (pode ser temporário durante a reinicialização do servidor):", e);
    }
  };

  useEffect(() => {
    loadSimulatedEmails();
    const interval = setInterval(loadSimulatedEmails, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await login(email, password);
    } catch (err: any) {
      console.error("Erro de login:", err);
      let msg = "Falha ao realizar login. Verifique suas credenciais.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        msg = "E-mail ou senha incorretos. Caso seja um novo usuário gerado pelo simulador da CAKTO, certifique-se de definir uma senha primeiro utilizando o link do e-mail simulado abaixo!";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password submission
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Por favor, insira o seu e-mail.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await sendPasswordReset(email);
      setSuccess("E-mail de recuperação enviado! Verifique seu e-mail (ou a caixa de e-mails simulados abaixo).");
    } catch (err: any) {
      console.error("Erro ao enviar e-mail de recuperação:", err);
      setError("Erro ao enviar e-mail de recuperação: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  // Handle password creation / activation from CAKTO Webhook Link
  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } = await import("firebase/auth");
      
      let userCredential;
      try {
        // Try creating the user first (case 1: brand new account in Auth)
        userCredential = await createUserWithEmailAndPassword(auth, resetEmail, newPassword);
        console.log("[AuthUI] Conta de usuário criada com sucesso via Client SDK.");
      } catch (createErr: any) {
        if (createErr.code === "auth/email-already-in-use" || createErr.code === "auth/email-already-exists") {
          // Case 2: User already exists, try logging in with temporary password to update
          if (resetTempPassword) {
            userCredential = await signInWithEmailAndPassword(auth, resetEmail, resetTempPassword);
            await updatePassword(userCredential.user, newPassword);
            console.log("[AuthUI] Senha do usuário atualizada com sucesso.");
          } else {
            // Already exists but no temp password, try to log in directly
            throw new Error("Este e-mail já está cadastrado. Por favor, faça login com sua senha atual ou solicite uma recuperação de senha.");
          }
        } else {
          throw createErr;
        }
      }

      // Sync/Create their Firestore document from the client-side (fully authenticated)
      const { doc, setDoc } = await import("firebase/firestore");
      const { db: firestoreDb } = await import("../services/firebaseClient");

      // Fetch latest subscription details from our JSON backend
      const res = await fetch(`/api/subscription-details?email=${encodeURIComponent(resetEmail)}`);
      const json = await res.json();

      let subData = {
        nome: userCredential.user.displayName || "Assinante Sincero",
        tipoUsuario: "Leitor",
        plano: "",
        statusAssinatura: "Ativa",
        dataCompra: new Date().toISOString(),
        dataExpiracao: new Date().toISOString()
      };

      if (json.success && json.found) {
        subData = {
          nome: json.subscription.nome || subData.nome,
          tipoUsuario: json.subscription.tipoUsuario || subData.tipoUsuario,
          plano: json.subscription.plano || subData.plano,
          statusAssinatura: json.subscription.statusAssinatura || subData.statusAssinatura,
          dataCompra: json.subscription.dataCompra || subData.dataCompra,
          dataExpiracao: json.subscription.dataExpiracao || subData.dataExpiracao
        };
      }

      const userProfileData = {
        uid: userCredential.user.uid,
        nome: subData.nome,
        email: resetEmail,
        tipoUsuario: subData.tipoUsuario,
        plano: subData.plano,
        statusAssinatura: subData.statusAssinatura,
        dataCompra: subData.dataCompra,
        dataExpiracao: subData.dataExpiracao,
        origemCadastro: "Cakto Password Activation",
        dataCriacao: new Date().toISOString(),
        ultimoLogin: new Date().toISOString()
      };

      await setDoc(doc(firestoreDb, "subscriptions", userCredential.user.uid), userProfileData, { merge: true });
      
      setSuccess("Sua conta foi ativada e sua senha foi configurada com sucesso! Conectando...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);

    } catch (err: any) {
      console.error("[AuthUI] Erro ao criar senha:", err);
      setError(err.message || "Erro ao definir senha.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger simulated CAKTO webhook purchase
  const triggerCaktoWebhook = async () => {
    if (!simName || !simEmail) {
      alert("Preencha o Nome e E-mail no simulador.");
      return;
    }
    
    setSimLoading(true);
    try {
      const payload = {
        name: simName,
        email: simEmail,
        plan: simPlan,
        role: simRole,
        status: "approved",
        event: "order_approved"
      };

      const res = await fetch("/api/cakto-webhook", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-simulated": "true"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSimWebhookResult(data.data);
        loadSimulatedEmails();
        // prefill login email
        setEmail(simEmail);
      } else {
        alert("Erro no webhook: " + data.message);
      }
    } catch (err: any) {
      alert("Erro ao enviar requisição de webhook: " + err.message);
    } finally {
      setSimLoading(false);
    }
  };

  // Quick simulation helper to set/update password for testing directly in the UI
  const [directPasswordMail, setDirectPasswordMail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directPassLoading, setDirectPassLoading] = useState(false);

  const handleSetPasswordSimulated = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directPasswordMail || !directPassword) {
      alert("Preencha o e-mail e a nova senha.");
      return;
    }
    setDirectPassLoading(true);
    try {
      // We will perform a fetch to update password or use firebase reset link if we can parse the oobCode from the link
      // But we can also look if we can confirm it if they have the link containing "oobCode".
      // Let's parse oobCode from the firebase password reset link!
      // Real firebase link looks like: https://.../__/auth/action?apiKey=...&mode=resetPassword&oobCode=XYZ
      const emailObj = recentEmails.find(m => m.email.toLowerCase() === directPasswordMail.toLowerCase().trim());
      if (emailObj && emailObj.link) {
        const url = new URL(emailObj.link);
        const oobCode = url.searchParams.get("oobCode");
        if (oobCode) {
          await confirmPasswordReset(auth, oobCode, directPassword);
          alert("Senha criada com sucesso pelo link do Firebase Auth! Agora você já pode logar.");
          setView("login");
          setPassword(directPassword);
          setEmail(directPasswordMail);
          return;
        }
      }
      
      // If we don't have a real oobCode, we explain how to use the link
      alert("Para criar a senha real, você deve clicar no link 'Definir Senha' no painel de e-mails simulados abaixo! Ele irá abrir a tela oficial do Firebase.");
    } catch (err: any) {
      alert("Erro ao definir senha: " + err.message);
    } finally {
      setDirectPassLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col justify-center items-center p-4 font-sans selection:bg-sky-500 selection:text-black relative overflow-hidden">
      {/* Premium Background Wallpaper with soft blur and dark overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="/api/proxy-image?url=https%3A%2F%2Fsinceronews.com%2Fwp-content%2Fuploads%2F2026%2F07%2Fpretela.jpg" 
          alt="Sincero News Wallpaper" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/75" />
      </div>
      
      <div className="w-full max-w-md z-10 relative">
        
        {/* LOGO HEADER */}
        <div className="text-center mb-6">
          <span className="text-[9px] uppercase font-mono tracking-widest text-sky-400 bg-sky-500/5 px-2.5 py-1 rounded-full border border-sky-500/15">
            SINCERO NEWS • PLATAFORMA DE ASSINANTES
          </span>
          <div className="flex justify-center items-center mt-3">
            <img 
              src="/api/proxy-image?url=https%3A%2F%2Fsinceronews.com%2Fwp-content%2Fuploads%2F2026%2F07%2FSINCERO-NEWS-3D.png" 
              alt="Sincero News" 
              className="max-h-16 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

          <AnimatePresence mode="wait">
            
            {/* VIEW 1: LOGIN */}
            {view === "login" && (
              <motion.div
                key="login-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full max-w-md bg-[#0F0F0F] border border-neutral-800/60 rounded-xl p-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
                
                <h2 className="text-xl font-bold mb-1 text-white text-center">Bem-vindo de volta</h2>
                <p className="text-xs text-neutral-400 mb-5 text-center">Faça login para continuar.</p>

                {error && (
                  <div className="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-lg flex items-start gap-2.5 text-xs text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg flex items-start gap-2.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{success}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">E-mail de Assinante</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="exemplo@email.com"
                        className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Senha de Acesso</label>
                      <button 
                        type="button" 
                        onClick={() => setView("forgot")}
                        className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline transition-all"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-10 py-2.5 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-0.5"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-black font-semibold text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-sky-500/5 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Entrar"
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* VIEW 2: FORGOT PASSWORD */}
            {view === "forgot" && (
              <motion.div
                key="forgot-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full max-w-md bg-[#0F0F0F] border border-neutral-800/60 rounded-xl p-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
                
                <h2 className="text-lg font-semibold mb-1 text-white">Recuperar Senha</h2>
                <p className="text-xs text-neutral-500 mb-5">Insira seu e-mail para receber um link de definição de senha.</p>

                {error && (
                  <div className="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-lg text-xs text-red-400">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
                    {success}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">E-mail Cadastrado</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="exemplo@email.com"
                        className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Enviar E-mail de Recuperação"}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setError(null);
                      setSuccess(null);
                      setView("login");
                    }}
                    className="w-full text-center text-xs text-neutral-400 hover:text-white transition-all mt-2 py-1"
                  >
                    Voltar para o login
                  </button>
                </form>
              </motion.div>
            )}

            {/* VIEW 4: RESET / CREATE PASSWORD (ACTIVATION) */}
            {view === "reset-password" && (
              <motion.div
                key="reset-password-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full max-w-md bg-[#0F0F0F] border border-sky-500/20 rounded-xl p-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
                
                <h2 className="text-lg font-bold mb-1 text-white">Criar Senha de Assinante</h2>
                <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
                  Defina a sua senha pessoal para ativar sua conta e liberar o acesso total ao Sincero News.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-lg flex items-start gap-2.5 text-xs text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg flex items-start gap-2.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{success}</span>
                  </div>
                )}

                <form onSubmit={handleCreatePassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Seu E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input 
                        type="email"
                        value={resetEmail}
                        disabled
                        className="w-full bg-[#141414]/50 border border-neutral-800/80 text-sm text-neutral-400 rounded-lg pl-10 pr-4 py-2.5 outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Escolha sua Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-10 py-2.5 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-0.5"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-black font-semibold text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Ativar Conta & Acessar
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <button 
                    type="button"
                    onClick={() => setView("login")}
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    Voltar ao Login
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 3: EXPIRED SUBSCRIPTION BLOCKER */}
            {view === "expired" && (
              <motion.div
                key="expired-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-[#0F0F0F] border border-red-500/20 rounded-xl p-6 shadow-2xl relative overflow-hidden text-center"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500" />
                
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-red-500">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                
                <h2 className="text-xl font-bold mb-1 text-white">Assinatura Expirada</h2>
                <p className="text-xs text-neutral-400 mb-4 px-2">
                  Olá, <span className="text-white font-semibold">{userProfile?.nome || user?.displayName || "Leitor"}</span>. Detectamos que a sua assinatura do plano <span className="text-sky-400 font-mono font-bold uppercase text-[10px] bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">{userProfile?.plano || "Plano não identificado"}</span> expirou ou foi cancelada no sistema de pagamentos.
                </p>

                {userProfile && (
                  <div className="bg-[#141414] border border-neutral-800 rounded-lg p-3 text-left mb-6 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase">
                      <span className="text-neutral-500">Status:</span>
                      <span className="text-red-500 font-bold">{userProfile.statusAssinatura}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase">
                      <span className="text-neutral-500">Adquirido em:</span>
                      <span className="text-neutral-300">{new Date(userProfile.dataCompra).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase">
                      <span className="text-neutral-500">Expirou em:</span>
                      <span className="text-red-400 font-bold">{new Date(userProfile.dataExpiracao).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <a 
                    href="https://cakto.com.br/checkout/sincero-news" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/10"
                  >
                    Renovar assinatura
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button 
                    onClick={async () => {
                      await logout();
                      setView("login");
                    }}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white font-medium text-xs py-2.5 px-4 rounded-lg transition-all"
                  >
                    Entrar com outra conta
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <div className="z-10 mt-8 text-center max-w-sm sm:max-w-md px-4">
        <p className="text-[9px] uppercase font-mono tracking-widest text-neutral-400 leading-relaxed">
          Idealizado e desenvolvido por Julio Molina e F.Texxx. Sincero News ® - todos os direitos reservados 2026
        </p>
      </div>

    </div>
  );
};
