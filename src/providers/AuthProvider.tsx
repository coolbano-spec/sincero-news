import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebaseClient";
import { UserProfile } from "../types/auth";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  isBlocked: boolean; // if subscription is expired or cancelled
  isCheckingProfile: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setIsCheckingProfile(true);
        
        // Listen to live updates of user profile in Firestore subscriptions collection
        const userDocRef = doc(db, "subscriptions", currentUser.uid);
        
        const unsubscribeDoc = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
            setIsCheckingProfile(false);
            setLoading(false);
          } else {
            console.warn("[AuthProvider] No user profile found in Firestore for UID:", currentUser.uid);
            
            // Self-healing: try to fetch from Cakto JSON store backend to write to Firestore
            try {
              const res = await fetch(`/api/subscription-details?email=${encodeURIComponent(currentUser.email || "")}`);
              let foundProfile = false;
              if (res.ok) {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                  const json = await res.json();
                  if (json.success && json.found) {
                    const sub = json.subscription;
                    
                    // Write profile to Firestore from client-side (fully authenticated!)
                    const userProfileData: UserProfile = {
                      uid: currentUser.uid,
                      nome: sub.nome || currentUser.displayName || "Assinante Sincero",
                      email: currentUser.email || "",
                      tipoUsuario: (sub.tipoUsuario || "Leitor") as any,
                      plano: (sub.plano || "Trimestral") as any,
                      statusAssinatura: (sub.statusAssinatura || "Ativa") as any,
                      dataCompra: sub.dataCompra || new Date().toISOString(),
                      dataExpiracao: sub.dataExpiracao || new Date().toISOString(),
                      origemCadastro: "Cakto Webhook Sync",
                      dataCriacao: new Date().toISOString(),
                      ultimoLogin: new Date().toISOString()
                    };
                    
                    const { setDoc } = await import("firebase/firestore");
                    await setDoc(userDocRef, userProfileData, { merge: true });
                    console.log("[AuthProvider] Self-healing completed: Profile synced from Cakto and saved to Firestore!");
                    setUserProfile(userProfileData);
                    foundProfile = true;
                  }
                }
              }
              if (!foundProfile) {
                setUserProfile(null);
              }
            } catch (syncErr) {
              console.error("[AuthProvider] Error self-healing profile:", syncErr);
              setUserProfile(null);
            } finally {
              setIsCheckingProfile(false);
              setLoading(false);
            }
          }
        }, (err) => {
          console.error("[AuthProvider] Error listening to user profile:", err);
          setIsCheckingProfile(false);
          setLoading(false);
        });

        return () => {
          unsubscribeDoc();
        };
      } else {
        setUserProfile(null);
        setIsCheckingProfile(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      console.error("[AuthProvider] Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin + "/login"
    });
  };

  // Determine if the user subscription is blocked (Expired, Cancelled, or past expiration date)
  const getIsBlocked = (): boolean => {
    if (!user) return false;
    if (loading || isCheckingProfile) return false;
    if (!userProfile) return true; // If they logged in but don't have a profile yet, block them

    // Check status
    const status = userProfile.statusAssinatura;
    if (status === "Expirada" || status === "Cancelada") return true;

    // Check dates
    if (userProfile.dataExpiracao) {
      const expDate = new Date(userProfile.dataExpiracao);
      const today = new Date();
      if (today > expDate) {
        return true;
      }
    }

    return false;
  };

  const isBlocked = getIsBlocked();

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      login,
      logout,
      sendPasswordReset,
      isBlocked,
      isCheckingProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
