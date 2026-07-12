import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  EyeOff 
} from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { auth } from "../services/firebaseClient";

interface AtivarContaProps {
  onGoToLogin: () => void;
}

export const AtivarConta: React.FC<AtivarContaProps> = ({ onGoToLogin }) => {
  // Fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !email || !senha || !confirmarSenha) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (senha.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const emailLower = email.trim().toLowerCase();
      let userCredential;

      try {
        // 1. Tentar login primeiro usando a senha digitada pelo usuário
        userCredential = await signInWithEmailAndPassword(auth, emailLower, senha);
        console.log("[AtivarConta] Login realizado com sucesso usando a senha fornecida pelo usuário.");
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: nome.trim() });
        }
      } catch (signInErr: any) {
        // Se falhar o login, pode ser que o usuário tenha sido pré-criado e a senha informada esteja errada (senha temporária ativa),
        // ou que o usuário não exista.
        const tempPassword = `Sincero@${emailLower.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8)}2026`;
        console.log("[AtivarConta] Falha no login inicial. Tentando com a senha temporária...");
        
        try {
          userCredential = await signInWithEmailAndPassword(auth, emailLower, tempPassword);
          console.log("[AtivarConta] Login realizado com sucesso com a senha temporária.");
          
          // Após autenticar com a temporária, atualiza para a nova senha do usuário
          await updatePassword(userCredential.user, senha);
          await updateProfile(userCredential.user, { displayName: nome.trim() });
          console.log("[AtivarConta] Senha atualizada com sucesso de provisória para permanente.");
        } catch (tempErr: any) {
          // Se falhar o login com a temporária e o erro indicar que o usuário não existe, tentamos criar a conta do zero
          if (
            tempErr.code === "auth/user-not-found" || 
            tempErr.code === "auth/invalid-credential" || 
            tempErr.code === "auth/wrong-password" ||
            tempErr.code === "auth/invalid-email"
          ) {
            console.log("[AtivarConta] Usuário não encontrado ou credencial inválida com temporária. Tentando criar conta do zero...");
            try {
              userCredential = await createUserWithEmailAndPassword(auth, emailLower, senha);
              if (userCredential.user) {
                await updateProfile(userCredential.user, { displayName: nome.trim() });
              }
              console.log("[AtivarConta] Nova conta de usuário criada com sucesso via Client SDK.");
            } catch (createErr: any) {
              console.error("[AtivarConta] Erro ao criar conta do zero:", createErr);
              throw createErr;
            }
          } else {
            console.error("[AtivarConta] Erro crítico no fluxo de ativação:", tempErr);
            throw tempErr;
          }
        }
      }

      setSuccess("Conta ativada com sucesso! Redirecionando...");
      setTimeout(() => {
        window.location.href = "https://noticias.sinceronews.com";
      }, 1500);

    } catch (err: any) {
      console.error("[AtivarConta] Erro ao ativar conta:", err);
      if (err.code === "auth/invalid-email") {
        setError("O e-mail digitado não é válido.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha escolhida é muito fraca.");
      } else {
        setError(err.message || "Erro ao ativar sua conta. Tente novamente mais tarde.");
      }
    } finally {
      setLoading(false);
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

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#0F0F0F] border border-neutral-800/60 rounded-xl p-6 shadow-2xl relative overflow-hidden"
          id="ativar-conta-container"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
          
          <h2 className="text-xl font-bold mb-1 text-white text-center">Bem-vindo ao Sincero News</h2>
          <p className="text-xs text-neutral-400 mb-5 text-center leading-relaxed">
            Sua compra foi confirmada.<br />
            Agora basta criar sua senha para acessar sua assinatura.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-lg flex items-start gap-2.5 text-xs text-red-400" id="activation-error">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg flex items-start gap-2.5 text-xs text-emerald-400" id="activation-success">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" id="ativar-conta-form">
            {/* Nome */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Nome</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-10 py-2.5 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-0.5"
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type={showConfirmarSenha ? "text" : "password"}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-sm text-white rounded-lg pl-10 pr-10 py-2.5 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-0.5"
                >
                  {showConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-black font-semibold text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-sky-500/5 cursor-pointer disabled:opacity-50"
              id="ativar-conta-submit-btn"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                "Criar minha conta"
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-5 pt-4 border-t border-neutral-900 flex justify-center items-center text-xs text-neutral-400 gap-1.5">
            <span>Já criou sua conta?</span>
            <button 
              type="button" 
              onClick={onGoToLogin}
              className="text-sky-400 hover:text-sky-300 hover:underline transition-all font-medium cursor-pointer"
              id="back-to-login-btn"
            >
              Entrar
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
