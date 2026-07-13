import React, { useState, useEffect } from "react";
import { 
  UserPlus, 
  Copy, 
  Check, 
  Trash2, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  User,
  Shield,
  Key,
  ExternalLink
} from "lucide-react";
import { motion } from "motion/react";

interface Invite {
  token: string;
  role: string;
  validity: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  used: boolean;
  usedBy: string | null;
  usedAt: string | null;
  active: boolean;
}

interface InvitesTabProps {
  userRole: string | null;
  user: any;
  showFeedback: (type: "success" | "error", text: string) => void;
}

export const InvitesTab: React.FC<InvitesTabProps> = ({ userRole, user, showFeedback }) => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  
  // Create Invite Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [formRole, setFormRole] = useState("user");
  const [formValidity, setFormValidity] = useState("7d");
  
  // Renew Invite state
  const [renewingInvite, setRenewingInvite] = useState<Invite | null>(null);
  const [renewValidity, setRenewValidity] = useState("7d");
  const [renewLoading, setRenewLoading] = useState(false);

  const fetchInvites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/invites", {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setInvites(data.invites);
      } else {
        showFeedback("error", data.error || "Erro ao carregar convites.");
      }
    } catch (err) {
      console.error("Error fetching invites:", err);
      showFeedback("error", "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [user]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreateLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          role: formRole,
          validity: formValidity
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback("success", "Convite gerado com sucesso!");
        setShowCreateModal(false);
        fetchInvites();
      } else {
        showFeedback("error", data.error || "Erro ao gerar convite.");
      }
    } catch (err) {
      console.error("Error generating invite:", err);
      showFeedback("error", "Erro ao conectar com o servidor.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCancelInvite = async (token: string) => {
    if (!window.confirm("Deseja realmente cancelar este convite? Ele não poderá mais ser utilizado.")) return;
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/invites/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback("success", "Convite cancelado com sucesso!");
        fetchInvites();
      } else {
        showFeedback("error", data.error || "Erro ao cancelar convite.");
      }
    } catch (err) {
      console.error("Error cancelling invite:", err);
      showFeedback("error", "Erro ao conectar com o servidor.");
    }
  };

  const handleRenewInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingInvite || !user) return;
    setRenewLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/invites/renew", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          token: renewingInvite.token, 
          validity: renewValidity 
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback("success", "Convite renovado com sucesso!");
        setRenewingInvite(null);
        fetchInvites();
      } else {
        showFeedback("error", data.error || "Erro ao renovar convite.");
      }
    } catch (err) {
      console.error("Error renewing invite:", err);
      showFeedback("error", "Erro ao conectar com o servidor.");
    } finally {
      setRenewLoading(false);
    }
  };

  const handleDeleteInvite = async (token: string) => {
    if (!window.confirm("Deseja realmente excluir permanentemente este convite do banco de dados?")) return;
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/invites", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback("success", "Convite excluído permanentemente!");
        fetchInvites();
      } else {
        showFeedback("error", data.error || "Erro ao excluir convite.");
      }
    } catch (err) {
      console.error("Error deleting invite:", err);
      showFeedback("error", "Erro ao conectar com o servidor.");
    }
  };

  const getInviteLink = (token: string) => {
    return `https://noticias.sinceronews.com/ativar-conta?invite=${token}`;
  };

  const handleCopyLink = (token: string) => {
    const link = getInviteLink(token);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      showFeedback("success", "Link copiado para a área de transferência!");
    });
  };

  const getInviteStatus = (invite: Invite) => {
    if (!invite.active) return { label: "Cancelado", color: "bg-red-500", text: "text-red-400" };
    if (invite.used) return { label: "Utilizado", color: "bg-neutral-500", text: "text-neutral-500" };
    if (invite.expiresAt) {
      const expires = new Date(invite.expiresAt);
      const now = new Date();
      if (expires < now) {
        return { label: "Expirado", color: "bg-neutral-500", text: "text-neutral-500" };
      }
      const diffMs = expires.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 24) {
        return { label: "Expira em <24h", color: "bg-amber-500", text: "text-amber-500" };
      }
    }
    return { label: "Ativo", color: "bg-emerald-500", text: "text-emerald-400" };
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
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

  const isSuperadmin = userRole === "superadmin";

  return (
    <div className="space-y-6 w-full">
      {/* Tab Header with Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0a0a0a]/40 p-4 rounded-xl border border-neutral-800/50">
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider font-mono">Gerenciamento de Convites</h2>
          <p className="text-xs text-neutral-400 leading-relaxed mt-1">
            Gere links de convite exclusivos para ativação de contas na plataforma sem a necessidade de pagamento da Cakto.
          </p>
        </div>

        <button
          onClick={() => {
            setFormRole("user");
            setFormValidity("7d");
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-black font-semibold text-xs px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-sky-500/5 cursor-pointer whitespace-nowrap self-start sm:self-center"
        >
          <span>➕ GERAR CONVITE</span>
        </button>
      </div>

      {/* Invites List Table Container */}
      <div className="bg-[#0f0f0f] border border-neutral-800/60 rounded-xl overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
        
        <div className="p-4 border-b border-neutral-800/60 bg-neutral-950/20 flex items-center justify-between">
          <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">Histórico de Convites</span>
          <button
            onClick={fetchInvites}
            disabled={loading}
            className="p-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Atualizar Lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && invites.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mx-auto mb-2" />
            <span className="text-xs text-neutral-400 uppercase font-mono">Carregando convites...</span>
          </div>
        ) : invites.length === 0 ? (
          <div className="p-12 text-center border-t border-neutral-900">
            <UserPlus className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-400 font-mono">Nenhum convite gerado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-900 bg-neutral-950/40 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Convite / Token</th>
                  <th className="py-3 px-4 font-semibold">Cargo</th>
                  <th className="py-3 px-4 font-semibold">Criado Por</th>
                  <th className="py-3 px-4 font-semibold">Data Criação</th>
                  <th className="py-3 px-4 font-semibold">Expira Em</th>
                  <th className="py-3 px-4 font-semibold">Utilização</th>
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/60 text-xs text-neutral-300">
                {invites.map((invite) => {
                  const status = getInviteStatus(invite);
                  const inviteLink = getInviteLink(invite.token);
                  return (
                    <tr key={invite.token} className="hover:bg-neutral-950/20 transition-all">
                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${status.color} animate-pulse`} />
                          <span className={`font-mono text-[10px] uppercase font-bold ${status.text}`}>
                            {status.label}
                          </span>
                        </div>
                      </td>

                      {/* Token / Copy */}
                      <td className="py-3.5 px-4 font-mono max-w-[200px]">
                        <div className="flex items-center gap-1.5 group">
                          <span className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-sky-400 select-all font-semibold truncate text-[11px]">
                            {invite.token}
                          </span>
                          <button
                            onClick={() => handleCopyLink(invite.token)}
                            className="p-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer opacity-60 hover:opacity-100"
                            title="Copiar Link"
                          >
                            {copiedToken === invite.token ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                          invite.role === "admin" || invite.role === "superadmin"
                            ? "bg-blue-950/50 text-blue-400 border border-blue-500/20"
                            : "bg-emerald-950/50 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {invite.role === "admin" ? "Admin" : invite.role === "superadmin" ? "Superadmin" : "User"}
                        </span>
                      </td>

                      {/* Created By */}
                      <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px] truncate max-w-[150px]" title={invite.createdBy}>
                        {invite.createdBy}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                        {formatDate(invite.createdAt)}
                      </td>

                      {/* Expires At */}
                      <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                        {invite.expiresAt ? (
                          formatDate(invite.expiresAt)
                        ) : (
                          <span className="text-emerald-500 font-bold uppercase text-[10px]">Permanente</span>
                        )}
                      </td>

                      {/* Used Status */}
                      <td className="py-3.5 px-4">
                        {invite.used ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-neutral-400 font-medium">Utilizado</span>
                            <span className="text-[9px] font-mono text-neutral-500 truncate max-w-[120px]" title={`UID: ${invite.usedBy || ""}`}>
                              Por: {invite.usedBy?.substring(0, 8)}...
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-500/80 font-mono text-[10px] uppercase">Pendente</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Cancel Invite */}
                          {invite.active && !invite.used && (
                            <button
                              onClick={() => handleCancelInvite(invite.token)}
                              className="px-2 py-1 rounded bg-red-950/30 border border-red-500/20 text-red-400 hover:bg-red-900/20 transition-all text-[10px] font-bold uppercase cursor-pointer"
                              title="Cancelar Convite"
                            >
                              Cancelar
                            </button>
                          )}

                          {/* Renew Invite */}
                          {!invite.used && (
                            <button
                              onClick={() => {
                                setRenewingInvite(invite);
                                setRenewValidity("7d");
                              }}
                              className="px-2 py-1 rounded bg-blue-950/30 border border-blue-500/20 text-blue-400 hover:bg-blue-900/20 transition-all text-[10px] font-bold uppercase cursor-pointer"
                              title="Renovar Validade"
                            >
                              Renovar
                            </button>
                          )}

                          {/* Delete Invite */}
                          <button
                            onClick={() => handleDeleteInvite(invite.token)}
                            className="p-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
                            title="Excluir Convite"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE CONVITE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-6 max-w-md w-full relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
            
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono mb-1">Gerar Novo Convite</h3>
            <p className="text-xs text-neutral-400 mb-5">
              Escolha as opções de cargo e expiração para este convite especial.
            </p>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              {/* Role Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Cargo</label>
                <div className="grid grid-cols-2 gap-3">
                  {/* User Role option */}
                  <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    formRole === "user" 
                      ? "bg-sky-500/5 border-sky-500/40 text-white" 
                      : "bg-neutral-950/40 border-neutral-900 text-neutral-400 hover:text-neutral-200"
                  }`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="user" 
                      checked={formRole === "user"}
                      onChange={() => setFormRole("user")}
                      className="accent-sky-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">User</span>
                      <span className="text-[10px] text-neutral-500">Leitor do portal</span>
                    </div>
                  </label>

                  {/* Admin Role option */}
                  <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    !isSuperadmin ? "opacity-40 cursor-not-allowed" : ""
                  } ${
                    formRole === "admin" 
                      ? "bg-sky-500/5 border-sky-500/40 text-white" 
                      : "bg-neutral-950/40 border-neutral-900 text-neutral-400 hover:text-neutral-200"
                  }`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="admin" 
                      checked={formRole === "admin"}
                      disabled={!isSuperadmin}
                      onChange={() => setFormRole("admin")}
                      className="accent-sky-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">Admin</span>
                      <span className="text-[10px] text-neutral-500">Moderador/Gestor</span>
                    </div>
                  </label>
                </div>
                {!isSuperadmin && (
                  <p className="text-[10px] text-red-400 mt-1">
                    * Apenas Superadmins podem gerar convites para cargos administrativos.
                  </p>
                )}
              </div>

              {/* Validity Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Validade do Convite</label>
                <select
                  value={formValidity}
                  onChange={(e) => setFormValidity(e.target.value)}
                  className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-xs text-white rounded-lg px-3 py-2.5 outline-none transition-all cursor-pointer font-mono"
                >
                  <option value="24h">24 Horas</option>
                  <option value="7d">7 Dias</option>
                  <option value="30d">30 Dias</option>
                  <option value="90d">90 Dias</option>
                  <option value="permanente">Permanente</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer text-neutral-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded bg-gradient-to-r from-sky-600 to-sky-500 text-black font-semibold hover:from-sky-500 hover:to-sky-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  {createLoading ? "Gerando..." : "Gerar Convite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW CONVITE MODAL */}
      {renewingInvite && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-6 max-w-md w-full relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
            
            <button
              onClick={() => setRenewingInvite(null)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono mb-1">Renovar Convite</h3>
            <p className="text-xs text-neutral-400 mb-5">
              Defina a nova data de expiração para o convite <code className="text-sky-300 font-mono">{renewingInvite.token}</code>.
            </p>

            <form onSubmit={handleRenewInviteSubmit} className="space-y-4">
              {/* Validity Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Nova Validade</label>
                <select
                  value={renewValidity}
                  onChange={(e) => setRenewValidity(e.target.value)}
                  className="w-full bg-[#141414] border border-neutral-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 text-xs text-white rounded-lg px-3 py-2.5 outline-none transition-all cursor-pointer font-mono"
                >
                  <option value="24h">24 Horas</option>
                  <option value="7d">7 Dias</option>
                  <option value="30d">30 Dias</option>
                  <option value="90d">90 Dias</option>
                  <option value="permanente">Permanente</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRenewingInvite(null)}
                  className="px-4 py-2 rounded bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer text-neutral-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={renewLoading}
                  className="px-4 py-2 rounded bg-gradient-to-r from-sky-600 to-sky-500 text-black font-semibold hover:from-sky-500 hover:to-sky-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  {renewLoading ? "Renovando..." : "Confirmar Renovação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
