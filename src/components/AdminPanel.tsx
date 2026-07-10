import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Shield, 
  UserCheck, 
  UserX, 
  Search, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  RefreshCw, 
  UserPlus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Key
} from "lucide-react";
import { useAuth } from "../providers/AuthProvider";

interface AdminUser {
  uid: string;
  nome: string;
  email: string;
  role: "superadmin" | "admin" | "guest" | "user";
  guest?: boolean;
  subscription: boolean;
  status: string;
  statusAssinatura?: string;
  plano?: string;
  createdAt: string;
  ultimoLogin: string;
  origemCadastro: string;
}

interface Stats {
  totalUsers: number;
  activeSubscribers: number;
  guests: number;
  admins: number;
  superadmins: number;
}

interface AdminPanelProps {
  onNavigate: (path: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  
  // Navigation & Menu States
  const [activeTab, setActiveTab] = useState<"dashboard" | "usuarios" | "assinaturas" | "convidados" | "administradores" | "configuracoes">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Users Data & Query States
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeSubscribers: 0,
    guests: 0,
    admins: 0,
    superadmins: 0
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

  // Edit / Action Feedback States
  const [actionLoading, setActionLoading] = useState<string | null>(null); // holds userUid
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Verify access immediately and periodically
  useEffect(() => {
    let active = true;
    const verifyAccess = async () => {
      if (!user) {
        onNavigate("/");
        return;
      }

      try {
        const idToken = await user.getIdToken(true);
        const res = await fetch("/api/admin/check-access", {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });
        const data = await res.json();

        if (active) {
          if (data.success && data.isAllowed) {
            setAccessVerified(true);
            setUserRole(data.role);
          } else {
            // Unpermitted users redirect immediately to home with no error messages
            onNavigate("/");
          }
        }
      } catch (err) {
        if (active) {
          onNavigate("/");
        }
      }
    };

    verifyAccess();
    return () => {
      active = false;
    };
  }, [user]);

  // Fetch users list with current filter, search query, and page number
  const fetchUsers = async () => {
    if (!user || !accessVerified) return;

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      
      // Map frontend tab selections to API query filters if applicable
      let resolvedFilter = filter;
      if (activeTab === "assinaturas") resolvedFilter = "assinantes";
      else if (activeTab === "convidados") resolvedFilter = "convidados";
      else if (activeTab === "administradores") resolvedFilter = "admins";

      const url = `/api/admin/users?page=${page}&limit=12&search=${encodeURIComponent(search)}&filter=${resolvedFilter}`;
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      const data = await res.json();

      if (data.success) {
        setUsers(data.users);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
        setTotalItems(data.pagination.totalItems);
      } else {
        showFeedback("error", data.error || "Erro ao carregar usuários.");
      }
    } catch (err: any) {
      showFeedback("error", "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch on query, tab, filter, or page state change
  useEffect(() => {
    if (accessVerified) {
      fetchUsers();
    }
  }, [accessVerified, activeTab, filter, page]);

  // Handle instant search with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (accessVerified) {
        setPage(1);
        fetchUsers();
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // Handle Tab navigation
  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setPage(1);
    setFilter("todos"); // Reset filter on tab changes
    setIsSidebarOpen(false);
  };

  const showFeedback = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 4000);
  };

  // Grant Subscription
  const handleGrantAccess = async (targetUid: string) => {
    if (!user) return;
    setActionLoading(targetUid);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/grant-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ targetUid })
      });
      const data = await res.json();

      if (data.success) {
        showFeedback("success", "Assinatura liberada com sucesso!");
        fetchUsers();
      } else {
        showFeedback("error", data.error || "Erro ao liberar assinatura.");
      }
    } catch (err) {
      showFeedback("error", "Erro na requisição.");
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke Subscription
  const handleRevokeAccess = async (targetUid: string) => {
    if (!user) return;
    setActionLoading(targetUid);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/revoke-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ targetUid })
      });
      const data = await res.json();

      if (data.success) {
        showFeedback("success", "Assinatura revogada com sucesso!");
        fetchUsers();
      } else {
        showFeedback("error", data.error || "Erro ao revogar assinatura.");
      }
    } catch (err) {
      showFeedback("error", "Erro na requisição.");
    } finally {
      setActionLoading(null);
    }
  };

  // Change Role
  const handleRoleChange = async (targetUid: string, newRole: string) => {
    if (!user) return;
    setActionLoading(targetUid);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ targetUid, newRole })
      });
      const data = await res.json();

      if (data.success) {
        showFeedback("success", `Role atualizada para ${newRole} com sucesso!`);
        fetchUsers();
      } else {
        showFeedback("error", data.error || "Erro ao alterar nível.");
      }
    } catch (err) {
      showFeedback("error", "Erro na requisição.");
    } finally {
      setActionLoading(null);
    }
  };

  // Delete User Account
  const handleDeleteUser = async (targetUid: string, targetNome: string) => {
    if (!window.confirm(`Tem certeza de que deseja excluir permanentemente o usuário ${targetNome}? Esta ação é irreversível e excluirá o usuário do banco e do Authentication.`)) {
      return;
    }

    if (!user) return;
    setActionLoading(targetUid);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ targetUid })
      });
      const data = await res.json();

      if (data.success) {
        showFeedback("success", "Usuário deletado permanentemente!");
        fetchUsers();
      } else {
        showFeedback("error", data.error || "Erro ao excluir usuário.");
      }
    } catch (err) {
      showFeedback("error", "Erro na requisição.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNavigate("/");
  };

  // Role pill colors mapping
  const getRoleBadgeClasses = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-red-950/50 text-red-400 border border-red-500/30 font-medium";
      case "admin":
        return "bg-blue-950/50 text-blue-400 border border-blue-500/30 font-medium";
      case "guest":
        return "bg-amber-950/50 text-amber-500 border border-amber-500/30 font-medium";
      default:
        return "bg-neutral-800 text-neutral-400 border border-neutral-700 font-normal";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "superadmin": return "Superadmin";
      case "admin": return "Admin";
      case "guest": return "Convidado";
      default: return "Usuário";
    }
  };

  // Format dates elegantly
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (!accessVerified) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex flex-col justify-center items-center font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mb-2" />
        <p className="text-xs text-neutral-400 uppercase tracking-widest font-mono">Verificando Credenciais...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-[#070707] font-sans relative overflow-x-hidden flex">
      {/* Sincero Wallpaper Watermark Backdrop */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-10">
        <img 
          src="/api/proxy-image?url=https%3A%2F%2Fsinceronews.com%2Fwp-content%2Fuploads%2F2026%2F07%2Fpretela.jpg" 
          alt="Wallpaper background decoration" 
          className="w-full h-full object-cover blur-md"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070707]/10 via-black to-[#070707]" />
      </div>

      {/* MOBILE HEADER BAR */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0c0c0c] border-b border-neutral-800/60 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <img 
            src="/api/proxy-image?url=https%3A%2F%2Fsinceronews.com%2Fwp-content%2Fuploads%2F2026%2F07%2FSINCERO-NEWS-3D.png" 
            alt="Logo" 
            className="h-8 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="text-[10px] tracking-wider uppercase font-mono font-bold text-sky-400 bg-sky-950/30 border border-sky-500/20 px-1.5 py-0.5 rounded">
            ADMIN
          </span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* NAVIGATION SIDEBAR */}
      <aside 
        className={`fixed lg:sticky top-0 left-0 bottom-0 z-40 w-64 bg-[#0a0a0a] border-r border-neutral-800/50 flex flex-col justify-between transform transition-transform duration-300 lg:transform-none pt-16 lg:pt-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col flex-1 p-4 overflow-y-auto">
          {/* Logo container (visible only on desktop) */}
          <div className="hidden lg:flex flex-col items-center gap-2 pb-6 border-b border-neutral-900 mb-6">
            <img 
              src="/api/proxy-image?url=https%3A%2F%2Fsinceronews.com%2Fwp-content%2Fuploads%2F2026%2F07%2FSINCERO-NEWS-3D.png" 
              alt="Logo" 
              className="max-h-12 w-auto object-contain mt-2"
              referrerPolicy="no-referrer"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase font-mono tracking-widest text-sky-400 bg-sky-500/5 px-2 py-0.5 rounded border border-sky-500/15">
                PAINEL DE CONTROLE
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5 flex-1">
            <button 
              onClick={() => handleTabChange("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                activeTab === "dashboard" 
                  ? "bg-sky-500/10 text-sky-400 border-l-2 border-sky-500 font-medium" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button 
              onClick={() => handleTabChange("usuarios")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                activeTab === "usuarios" 
                  ? "bg-sky-500/10 text-sky-400 border-l-2 border-sky-500 font-medium" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuários</span>
            </button>

            <button 
              onClick={() => handleTabChange("assinaturas")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                activeTab === "assinaturas" 
                  ? "bg-sky-500/10 text-sky-400 border-l-2 border-sky-500 font-medium" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Assinaturas</span>
            </button>

            <button 
              onClick={() => handleTabChange("convidados")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                activeTab === "convidados" 
                  ? "bg-sky-500/10 text-sky-400 border-l-2 border-sky-500 font-medium" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Convidados</span>
            </button>

            <button 
              onClick={() => handleTabChange("administradores")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                activeTab === "administradores" 
                  ? "bg-sky-500/10 text-sky-400 border-l-2 border-sky-500 font-medium" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Administradores</span>
            </button>

            <button 
              onClick={() => handleTabChange("configuracoes")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                activeTab === "configuracoes" 
                  ? "bg-sky-500/10 text-sky-400 border-l-2 border-sky-500 font-medium" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </button>
          </nav>
        </div>

        {/* User Info & Sign Out Footer */}
        <div className="p-4 border-t border-neutral-900 bg-neutral-950/20">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 font-semibold text-xs">
              {(user?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{user?.displayName || "Administrador"}</p>
              <p className="text-[10px] text-neutral-500 truncate font-mono">{user?.email}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onNavigate("/")}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-neutral-900 text-neutral-300 hover:bg-neutral-800 transition-all border border-neutral-800 cursor-pointer"
            >
              <span>Sair p/ Site</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-red-950/20 text-red-400 hover:bg-red-950/45 transition-all border border-red-950/50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* BACKGROUND BLOCK OVERLAY FOR MOBILE SIDEBAR */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
        />
      )}

      {/* MAIN ADMIN WORKSPACE */}
      <main className="flex-1 flex flex-col p-4 md:p-8 pt-20 lg:pt-8 z-10 overflow-x-hidden">
        {/* HEADER BAR AND FEEDBACK FEED */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-sky-400">
              Sincero News / Painel Administrativo / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white capitalize mt-1">
              {activeTab === "usuarios" ? "Controle de Usuários" : activeTab}
            </h1>
          </div>

          <button 
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] border border-neutral-800 text-xs text-neutral-300 rounded-lg hover:bg-neutral-900 hover:border-neutral-700 transition-all cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
            <span>Sincronizar Dados</span>
          </button>
        </div>

        {/* GLOBAL MESSAGES OR ERRORS */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 mb-5 ${
                message.type === "success" 
                  ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400" 
                  : "bg-red-950/30 border-red-500/20 text-red-400"
              }`}
            >
              {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAB SWITCHBOARD VIEWPORTS */}

        {/* 1. DASHBOARD VIEWPORT */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Metrics Dashboard Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden" id="card-users">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-neutral-500/25 to-transparent" />
                <div className="flex items-center justify-between text-neutral-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider uppercase">Usuários Cadastrados</span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">{stats.totalUsers}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Total de contas criadas</p>
                </div>
              </div>

              <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden" id="card-subscribers">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />
                <div className="flex items-center justify-between text-neutral-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider uppercase">Assinantes Ativos</span>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-emerald-400">{stats.activeSubscribers}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Com acesso liberado</p>
                </div>
              </div>

              <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden" id="card-guests">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent" />
                <div className="flex items-center justify-between text-neutral-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider uppercase">Convidados</span>
                  <UserPlus className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-amber-500">{stats.guests}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Acesso guest = true</p>
                </div>
              </div>

              <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden" id="card-admins">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/25 to-transparent" />
                <div className="flex items-center justify-between text-neutral-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider uppercase">Administradores</span>
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-blue-400">{stats.admins}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Moderadores do painel</p>
                </div>
              </div>

              <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden" id="card-superadmins">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500/25 to-transparent" />
                <div className="flex items-center justify-between text-neutral-400 mb-2">
                  <span className="text-[10px] font-mono tracking-wider uppercase">Superadmins</span>
                  <Shield className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-red-400">{stats.superadmins}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Permissões totais</p>
                </div>
              </div>
            </div>

            {/* QUICK OVERVIEW / SYSTEM DIAGNOSTICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick statistics breakdown */}
              <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-5 shadow-xl relative lg:col-span-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-mono">Resumo e Atividades Recentes</h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-900/40 rounded-lg border border-neutral-800/50">
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      Bem-vindo ao canal administrativo central do <strong>Sincero News</strong>. 
                      Como <span className="text-sky-400 font-medium capitalize">{userRole}</span>, você possui acesso para moderar a base de usuários e o fluxo de assinaturas de nossa plataforma de notícias exclusivas.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-neutral-900/10 border border-neutral-800 rounded-lg">
                      <span className="text-[10px] uppercase font-mono text-neutral-500 block">Conversão de Leads</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-bold text-emerald-400">
                          {stats.totalUsers > 0 ? ((stats.activeSubscribers / stats.totalUsers) * 100).toFixed(1) : 0}%
                        </span>
                        <span className="text-xs text-neutral-400">Usuários são assinantes ativos</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-neutral-900/10 border border-neutral-800 rounded-lg">
                      <span className="text-[10px] uppercase font-mono text-neutral-500 block">Privilégios Administrativos</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-bold text-blue-400">{stats.admins + stats.superadmins}</span>
                        <span className="text-xs text-neutral-400">Operadores com privilégios</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* System details */}
              <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-5 shadow-xl relative flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-mono">Status da Integração</h3>
                  
                  <div className="space-y-3.5 text-xs text-neutral-400">
                    <div className="flex justify-between pb-2 border-b border-neutral-900">
                      <span>Firebase Auth</span>
                      <span className="text-emerald-400 font-medium font-mono">Conectado</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-900">
                      <span>Firestore DB</span>
                      <span className="text-emerald-400 font-medium font-mono">Ativo (default)</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-neutral-900">
                      <span>Cakto Webhook Secret</span>
                      <span className={process.env.CAKTO_SECRET_KEY ? "text-emerald-400 font-medium font-mono" : "text-amber-500 font-medium font-mono"}>
                        {process.env.CAKTO_SECRET_KEY ? "Configurado" : "Pendente"}
                      </span>
                    </div>
                    <div className="flex justify-between pb-2">
                      <span>Ambiente</span>
                      <span className="text-sky-400 font-medium font-mono">Produção (Cloud)</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleTabChange("usuarios")}
                  className="w-full text-center py-2.5 mt-4 bg-sky-500/10 hover:bg-sky-500/15 text-sky-400 border border-sky-500/25 font-medium text-xs rounded-lg transition-all cursor-pointer"
                >
                  Gerenciar Base de Usuários
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. TABLE AND FILTERS WORKSPACE (USUARIOS, ASSINATURAS, CONVIDADOS, ADMINISTRADORES) */}
        {activeTab !== "dashboard" && activeTab !== "configuracoes" && (
          <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
            
            {/* Search, Filter bar */}
            <div className="p-4 md:p-5 border-b border-neutral-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Search query input */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome ou e-mail..."
                  className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-xs text-white rounded-lg pl-10 pr-4 py-2.5 outline-none transition-all placeholder:text-neutral-500"
                />
              </div>

              {/* Filter tabs (visible only on full users tab, customized on others) */}
              {activeTab === "usuarios" && (
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  {[
                    { id: "todos", label: "Todos" },
                    { id: "assinantes", label: "Assinantes" },
                    { id: "convidados", label: "Convidados" },
                    { id: "admins", label: "Admins" },
                    { id: "superadmins", label: "SuperAdmins" },
                    { id: "sem_assinatura", label: "Sem assinatura" }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFilter(f.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                        filter === f.id
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                          : "bg-neutral-900 border-neutral-800/60 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Informational item counts indicator */}
              <div className="text-[10px] font-mono text-neutral-500 self-end md:self-center">
                Total localizado: <span className="text-neutral-300 font-bold">{totalItems}</span>
              </div>
            </div>

            {/* USERS TABLE WRAPPER */}
            <div className="overflow-x-auto w-full">
              {loading ? (
                <div className="py-24 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400 font-mono">Carregando lote de usuários...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="py-24 text-center">
                  <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400 font-mono">Nenhum usuário correspondente localizado.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-neutral-950/40 border-b border-neutral-900 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                      <th className="px-5 py-3.5">Nome / E-mail</th>
                      <th className="px-5 py-3.5">Permissão (Role)</th>
                      <th className="px-5 py-3.5">Assinatura</th>
                      <th className="px-5 py-3.5">Criação da Conta</th>
                      <th className="px-5 py-3.5">Último Login</th>
                      <th className="px-5 py-3.5 text-right">Ações de Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/60">
                    {users.map((item) => (
                      <tr 
                        key={item.uid} 
                        className="hover:bg-neutral-950/20 text-xs transition-colors"
                      >
                        {/* Name and email */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white truncate max-w-[200px]" title={item.nome}>
                              {item.nome}
                            </span>
                            <span className="text-[11px] text-neutral-500 font-mono truncate mt-0.5" title={item.email}>
                              {item.email}
                            </span>
                          </div>
                        </td>

                        {/* Permission role selection */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {/* Role badge display */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize ${getRoleBadgeClasses(item.role)}`}>
                              {getRoleLabel(item.role)}
                            </span>

                            {/* Dropdown for role changes */}
                            {/* Rule: admins cannot change roles of superadmins or promote anyone to superadmin */}
                            {(userRole === "superadmin" || (userRole === "admin" && item.role !== "superadmin")) && (
                              <select
                                value={item.role}
                                disabled={actionLoading === item.uid}
                                onChange={(e) => handleRoleChange(item.uid, e.target.value)}
                                className="bg-[#141414] border border-neutral-800 text-[10px] text-neutral-300 rounded px-1.5 py-0.5 focus:border-sky-500/50 outline-none transition-all font-mono"
                              >
                                <option value="user">User</option>
                                <option value="guest">Guest</option>
                                <option value="admin">Admin</option>
                                {userRole === "superadmin" && <option value="superadmin">Superadmin</option>}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* Subscription indicators */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            {item.subscription ? (
                              <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Ativa
                              </span>
                            ) : (
                              <span className="bg-neutral-800 text-neutral-500 border border-neutral-700/60 text-[10px] font-mono px-2 py-0.5 rounded">
                                Sem acesso
                              </span>
                            )}
                            {item.plano && (
                              <span className="text-[10px] text-neutral-500 font-mono">
                                Plano: {item.plano}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Creation date */}
                        <td className="px-5 py-3.5 text-neutral-400 font-mono text-[11px]">
                          {formatDate(item.createdAt)}
                        </td>

                        {/* Last login date */}
                        <td className="px-5 py-3.5 text-neutral-400 font-mono text-[11px]">
                          {formatDate(item.ultimoLogin)}
                        </td>

                        {/* Action buttons */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Subscription Access button */}
                            {item.subscription ? (
                              <button
                                onClick={() => handleRevokeAccess(item.uid)}
                                disabled={actionLoading !== null}
                                title="Revogar acesso"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-950/20 text-amber-500 border border-amber-500/10 hover:bg-amber-950/40 hover:border-amber-500/30 text-[10px] font-medium tracking-wide transition-all cursor-pointer"
                              >
                                <UserX className="w-3 h-3" />
                                <span>Bloquear</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGrantAccess(item.uid)}
                                disabled={actionLoading !== null}
                                title="Liberar acesso"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-500/10 hover:bg-emerald-950/40 hover:border-emerald-500/30 text-[10px] font-medium tracking-wide transition-all cursor-pointer"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Liberar</span>
                              </button>
                            )}

                            {/* Excluir/Delete button */}
                            {/* Rules:
                                - Admins cannot delete Superadmins
                                - Admins cannot delete other Admins (only superadmin can)
                                - Superadmin can delete anyone (except themselves/main owner)
                            */}
                            {((userRole === "superadmin" && item.role !== "superadmin") || 
                              (userRole === "admin" && item.role !== "superadmin" && item.role !== "admin")) && (
                              <button
                                onClick={() => handleDeleteUser(item.uid, item.nome)}
                                disabled={actionLoading !== null}
                                title="Excluir permanentemente"
                                className="p-1.5 rounded bg-red-950/10 text-red-500 hover:bg-red-950/35 hover:text-red-400 transition-all cursor-pointer border border-red-500/5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* LIVE SYSTEM PAGINATION CONTAINER */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-neutral-900 bg-neutral-950/30 flex items-center justify-between">
                <span className="text-[10px] font-mono text-neutral-500">
                  Mostrando página {page} de {totalPages} ({totalItems} itens no total)
                </span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="p-1.5 rounded bg-[#141414] border border-neutral-800 text-neutral-400 hover:text-white transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    // Only show first, last, current, and surrounding pages to avoid clutter
                    if (
                      pageNum === 1 || 
                      pageNum === totalPages || 
                      Math.abs(pageNum - page) <= 1
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          disabled={loading}
                          className={`w-7.5 h-7.5 rounded text-xs transition-all font-mono cursor-pointer border ${
                            page === pageNum
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/30 font-bold"
                              : "bg-[#141414] border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      pageNum === 2 || 
                      pageNum === totalPages - 1
                    ) {
                      return <span key={pageNum} className="text-neutral-600 px-1 text-xs font-mono">...</span>;
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="p-1.5 rounded bg-[#141414] border border-neutral-800 text-neutral-400 hover:text-white transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. CONFIGURACOES VIEWPORT */}
        {activeTab === "configuracoes" && (
          <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl p-6 shadow-2xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
            
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2 font-mono">Configurações do Painel</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Informações de infraestrutura e variáveis críticas para a operação da plataforma de assinantes Sincero News.
              </p>
            </div>

            {/* Environment Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-950/40 rounded-lg border border-neutral-900 flex items-start gap-3">
                <FileText className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono uppercase">Coleta de Logs (Railway)</h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Os webhooks da Cakto registram todas as requisições recebidas. Os dados brutos podem ser visualizados na aba de Deployments/Logs da plataforma Railway buscando pelo termo <code className="text-sky-300 font-mono bg-sky-950/40 px-1 py-0.5 rounded">DEBUG CAKTO</code>.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-neutral-950/40 rounded-lg border border-neutral-900 flex items-start gap-3">
                <Key className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono uppercase">Segurança de Assinatura</h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    As validações utilizam criptografia de segurança HMAC. Se o webhook falhar, as contas podem ser liberadas manualmente nesta interface clicando no botão "Liberar" na tabela de usuários.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#141414] border border-neutral-800 rounded-lg text-xs text-neutral-400">
              <h4 className="text-xs font-bold text-white mb-2 uppercase font-mono">Resumo de Níveis de Permissão</h4>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-red-400">Superadmin:</strong> Acesso irrestrito. Modera, promove, revoga e deleta qualquer conta.</li>
                <li><strong className="text-blue-400">Admin:</strong> Modera acessos (liberar/revogar) e visualiza usuários. Não pode alterar ou remover superadmins.</li>
                <li><strong className="text-amber-500">Convidado:</strong> Possui acesso normal ao site, porém marcado como convidado especial.</li>
                <li><strong className="text-neutral-400">Usuário:</strong> Cadastro comum do portal de assinantes.</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
