import React, { useState, useEffect, useRef, useMemo } from "react";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { AuthUI } from "./components/AuthUI";
import { AtivarConta } from "./components/AtivarConta";
import { AdminPanel } from "./components/AdminPanel";
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  Radio, 
  Newspaper, 
  Info,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  X,
  Volume2,
  VolumeX,
  ArrowUp,
  Landmark,
  Coins,
  Globe,
  Cpu,
  Vote,
  Building2,
  Users,
  Gavel,
  Palette,
  Film,
  Trophy,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  snippet: string;
  imageUrl: string;
  category: string;
}

interface ApiResponse {
  news: NewsItem[];
  lastUpdate: string | null;
  categories: { id: string; label: string; query: string }[];
  nextUpdateIn: string | null;
}

// Helper function to dynamically select "Destaque do Momento" without AI or DB
function getDestaqueDoMomento(articles: NewsItem[]): NewsItem | null {
  if (!articles || articles.length === 0) return null;
  if (articles.length === 1) return articles[0];

  // Portuguese stop words to ignore when looking for common topics
  const stopWords = new Set([
    "para", "como", "mais", "com", "uma", "este", "esta", "esse", "essa", "isso", "aquilo",
    "pelo", "pela", "pelos", "pelas", "seus", "suas", "onde", "quando", "quem", "sobre",
    "após", "contra", "desde", "entre", "novo", "nova", "novos", "novas", "muito", "tudo",
    "ser", "estar", "fazer", "pode", "podem", "deve", "devem", "está", "estão", "será", "serão",
    "foram", "têm", "tinha", "pelo", "pela", "seja", "suas", "pelas", "seus", "como", "pelas",
    "sobre", "entre", "pelo"
  ]);

  const wordCounts: { [key: string]: number } = {};

  // 1. Calculate word frequencies in all titles to measure "recorrência de assuntos semelhantes"
  articles.forEach((art) => {
    const words = art.title.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
      .split(/\s+/);
    
    const uniqueWordsInTitle = new Set(
      words.filter((w) => w.length > 3 && !stopWords.has(w))
    );

    uniqueWordsInTitle.forEach((w) => {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });

  // 2. Score each article according to the 4 requested factors
  const scores = articles.map((art, index) => {
    // Factor A: Recorrência de assuntos (Overlap frequency of keywords)
    const words = art.title.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
      .split(/\s+/);
    
    const uniqueWords = new Set(
      words.filter((w) => w.length > 3 && !stopWords.has(w))
    );

    let similarityScore = 0;
    uniqueWords.forEach((w) => {
      similarityScore += (wordCounts[w] || 0) - 1; // Subtract 1 so words only appearing in this article have 0 score
    });

    // Factor B: Maior atualidade (Recency)
    const pubTime = new Date(art.pubDate).getTime();
    const newestTime = Math.max(...articles.map((a) => new Date(a.pubDate).getTime()));
    const timeDiffHours = (newestTime - pubTime) / (1000 * 60 * 60);
    const recencyScore = 15 / (1 + timeDiffHours); // Absolute newest gets 15 points, decays over hours

    // Factor C: Maior relevância editorial (Editorial words / Key terms)
    const editorialKeywords = [
      "urgente", "exclusivo", "alerta", "decisão", "histórico", "crise", "bomba", "guerra",
      "stf", "inflação", "juros", "taxa", "reforma", "governo", "congresso", "senado", "câmara",
      "presidente", "lula", "ministro"
    ];
    let editorialBonus = 0;
    editorialKeywords.forEach((kw) => {
      if (art.title.toLowerCase().includes(kw)) {
        editorialBonus += 3;
      }
    });

    // Factor D: Destaque nas manchetes (Original order in news API)
    // The original API news list is already ordered by relevancy/freshness. Use the inverse rank as a signal.
    const priorityScore = ((articles.length - index) / articles.length) * 10;

    // Aggregate score
    const totalScore = similarityScore * 5.0 + recencyScore + priorityScore + editorialBonus;

    return {
      article: art,
      score: totalScore,
    };
  });

  // Sort by score descending and return the top-scored article
  scores.sort((a, b) => b.score - a.score);
  return scores[0].article;
}

// Helper to convert original image URLs to server-side proxied image URLs, resolving CORS & mixed-content blockages
const getProxiedImageUrl = (url: string) => {
  if (!url) {
    return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80";
  }
  // If it's already a relative path, base64 data, or localhost path, use it directly
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("http://localhost") || url.startsWith("https://localhost")) {
    return url;
  }
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

function PublisherLogoImage({ hostname, source }: { hostname: string; source: string }) {
  const [logoSrc, setLogoSrc] = useState<string>(`https://logo.clearbit.com/${hostname}`);
  const [attempt, setAttempt] = useState<number>(0);

  const handleError = () => {
    if (attempt === 0) {
      setLogoSrc(`https://www.google.com/s2/favicons?sz=128&domain=${hostname}`);
      setAttempt(1);
    } else if (attempt === 1) {
      setLogoSrc("");
      setAttempt(2);
    }
  };

  const monogram = source.trim().charAt(0).toUpperCase();

  if (!hostname || attempt === 2 || !logoSrc) {
    return (
      <div className="w-6 h-6 rounded-md bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-[10px] font-mono font-bold text-neutral-300 select-none shadow-inner">
        {monogram}
      </div>
    );
  }

  return (
    <div className="w-6 h-6 rounded-md bg-white p-0.5 flex items-center justify-center overflow-hidden shadow-sm border border-neutral-800/10 select-none flex-shrink-0">
      <img
        src={logoSrc}
        alt=""
        className="w-full h-full object-contain rounded-sm"
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function renderPublisherLogo(source: string, link: string) {
  let hostname = "";
  try {
    hostname = new URL(link).hostname.replace("www.", "");
  } catch (e) {}

  const cleanSource = source.trim();
  const lowerSource = cleanSource.toLowerCase();

  if (lowerSource.includes("cnn br") || lowerSource.includes("cnnbrasil")) {
    return (
      <span className="text-sm font-sans font-bold tracking-widest text-neutral-200">CNN BRASIL</span>
    );
  }

  if (lowerSource === "g1" || lowerSource.includes("globo.com/g1") || lowerSource.includes("g1.globo")) {
    return (
      <span className="text-sm font-sans font-bold text-white tracking-tight">g1 Globo</span>
    );
  }

  if (lowerSource.includes("folha")) {
    return (
      <span className="text-sm font-serif font-bold tracking-wider text-neutral-100 uppercase border-b border-white/20 pb-0.5">
        Folha de S.Paulo
      </span>
    );
  }

  if (lowerSource.includes("estadão") || lowerSource.includes("estadao")) {
    return (
      <span className="text-sm font-serif font-black tracking-wide text-neutral-100 uppercase">
        Estadão
      </span>
    );
  }

  if (lowerSource.includes("uol")) {
    return (
      <span className="text-sm font-sans font-black tracking-tight text-white">UOL</span>
    );
  }

  if (lowerSource.includes("bbc")) {
    return (
      <span className="text-sm font-sans font-semibold text-neutral-200">BBC News</span>
    );
  }

  if (lowerSource.includes("poder360") || lowerSource.includes("poder 360")) {
    return (
      <span className="text-sm font-sans font-black tracking-wide text-white uppercase">Poder360</span>
    );
  }

  if (lowerSource.includes("reuters")) {
    return (
      <span className="text-sm font-sans font-black tracking-wider text-white uppercase">REUTERS</span>
    );
  }

  if (lowerSource.includes("the guardian") || lowerSource.includes("guardian")) {
    return (
      <span className="text-sm font-serif font-bold text-white lowercase">the guardian</span>
    );
  }

  if (lowerSource.includes("carta")) {
    return (
      <span className="text-sm font-serif font-bold text-white tracking-tight">CartaCapital</span>
    );
  }

  if (lowerSource.includes("veja")) {
    return (
      <span className="text-sm font-sans font-black text-red-500 uppercase tracking-widest">VEJA</span>
    );
  }

  if (lowerSource.includes("globo") || lowerSource === "o globo") {
    return (
      <span className="text-sm font-serif font-black text-white">O GLOBO</span>
    );
  }

  // Default elegant typographic rendering with domain favicon using PublisherLogoImage
  return (
    <span className="text-sm font-sans font-semibold tracking-wide text-neutral-200 hover:text-white truncate">
      {cleanSource}
    </span>
  );
}

interface CategoryColor {
  id: string;
  hex: string;
  activeBtn: string;
  text: string;
  textMuted: string;
  groupHoverText: string;
  cardBorder: string;
  cardBorderHover: string;
  btnBg: string;
  btnOutline: string;
  glow: string;
}

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  todas: {
    id: "todas",
    hex: "#00a8ff",
    activeBtn: "bg-[#00a8ff]/15 text-[#00a8ff] border-[#00a8ff]",
    text: "text-[#00a8ff]",
    textMuted: "text-[#00a8ff]/90",
    groupHoverText: "group-hover:text-[#00a8ff]",
    cardBorder: "border-[#00a8ff]/10",
    cardBorderHover: "hover:border-[#00a8ff]/30",
    btnBg: "bg-[#00a8ff] hover:bg-[#33b9ff] text-black",
    btnOutline: "border-[#00a8ff]/30 text-[#00a8ff] hover:border-[#00a8ff] hover:bg-[#00a8ff] hover:text-black",
    glow: "shadow-[0_0_8px_rgba(0,168,255,0.4)]"
  },
  politica: {
    id: "politica",
    hex: "#ff4d5a",
    activeBtn: "bg-[#ff4d5a]/15 text-[#ff4d5a] border-[#ff4d5a]",
    text: "text-[#ff4d5a]",
    textMuted: "text-[#ff4d5a]/90",
    groupHoverText: "group-hover:text-[#ff4d5a]",
    cardBorder: "border-[#ff4d5a]/10",
    cardBorderHover: "hover:border-[#ff4d5a]/30",
    btnBg: "bg-[#ff4d5a] hover:bg-[#ff6671] text-white",
    btnOutline: "border-[#ff4d5a]/30 text-[#ff4d5a] hover:border-[#ff4d5a] hover:bg-[#ff4d5a] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(255,77,90,0.4)]"
  },
  economia: {
    id: "economia",
    hex: "#10b981",
    activeBtn: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]",
    text: "text-[#10b981]",
    textMuted: "text-[#10b981]/90",
    groupHoverText: "group-hover:text-[#10b981]",
    cardBorder: "border-[#10b981]/10",
    cardBorderHover: "hover:border-[#10b981]/30",
    btnBg: "bg-[#10b981] hover:bg-[#12d393] text-white",
    btnOutline: "border-[#10b981]/30 text-[#10b981] hover:border-[#10b981] hover:bg-[#10b981] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(16,185,129,0.4)]"
  },
  tecnologia: {
    id: "tecnologia",
    hex: "#ff9f1c",
    activeBtn: "bg-[#ff9f1c]/15 text-[#ff9f1c] border-[#ff9f1c]",
    text: "text-[#ff9f1c]",
    textMuted: "text-[#ff9f1c]/90",
    groupHoverText: "group-hover:text-[#ff9f1c]",
    cardBorder: "border-[#ff9f1c]/10",
    cardBorderHover: "hover:border-[#ff9f1c]/30",
    btnBg: "bg-[#ff9f1c] hover:bg-[#ffaf3c] text-black",
    btnOutline: "border-[#ff9f1c]/30 text-[#ff9f1c] hover:border-[#ff9f1c] hover:bg-[#ff9f1c] hover:text-black",
    glow: "shadow-[0_0_8px_rgba(255,159,28,0.4)]"
  },
  mundo: {
    id: "mundo",
    hex: "#a855f7",
    activeBtn: "bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]",
    text: "text-[#a855f7]",
    textMuted: "text-[#a855f7]/90",
    groupHoverText: "group-hover:text-[#a855f7]",
    cardBorder: "border-[#a855f7]/10",
    cardBorderHover: "hover:border-[#a855f7]/30",
    btnBg: "bg-[#a855f7] hover:bg-[#b86df9] text-white",
    btnOutline: "border-[#a855f7]/30 text-[#a855f7] hover:border-[#a855f7] hover:bg-[#a855f7] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(168,85,247,0.4)]"
  },
  eleicoes: {
    id: "eleicoes",
    hex: "#06b6d4",
    activeBtn: "bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]",
    text: "text-[#06b6d4]",
    textMuted: "text-[#06b6d4]/90",
    groupHoverText: "group-hover:text-[#06b6d4]",
    cardBorder: "border-[#06b6d4]/10",
    cardBorderHover: "hover:border-[#06b6d4]/30",
    btnBg: "bg-[#06b6d4] hover:bg-[#22d3ee] text-black",
    btnOutline: "border-[#06b6d4]/30 text-[#06b6d4] hover:border-[#06b6d4] hover:bg-[#06b6d4] hover:text-black",
    glow: "shadow-[0_0_8px_rgba(6,182,212,0.4)]"
  },
  governo: {
    id: "governo",
    hex: "#6366f1",
    activeBtn: "bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]",
    text: "text-[#6366f1]",
    textMuted: "text-[#6366f1]/90",
    groupHoverText: "group-hover:text-[#6366f1]",
    cardBorder: "border-[#6366f1]/10",
    cardBorderHover: "hover:border-[#6366f1]/30",
    btnBg: "bg-[#6366f1] hover:bg-[#7e82f7] text-white",
    btnOutline: "border-[#6366f1]/30 text-[#6366f1] hover:border-[#6366f1] hover:bg-[#6366f1] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(99,102,241,0.4)]"
  },
  congresso: {
    id: "congresso",
    hex: "#f43f5e",
    activeBtn: "bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]",
    text: "text-[#f43f5e]",
    textMuted: "text-[#f43f5e]/90",
    groupHoverText: "group-hover:text-[#f43f5e]",
    cardBorder: "border-[#f43f5e]/10",
    cardBorderHover: "hover:border-[#f43f5e]/30",
    btnBg: "bg-[#f43f5e] hover:bg-[#f6657e] text-white",
    btnOutline: "border-[#f43f5e]/30 text-[#f43f5e] hover:border-[#f43f5e] hover:bg-[#f43f5e] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.4)]"
  },
  stf: {
    id: "stf",
    hex: "#d97706",
    activeBtn: "bg-[#d97706]/15 text-[#d97706] border-[#d97706]",
    text: "text-[#d97706]",
    textMuted: "text-[#d97706]/90",
    groupHoverText: "group-hover:text-[#d97706]",
    cardBorder: "border-[#d97706]/10",
    cardBorderHover: "hover:border-[#d97706]/30",
    btnBg: "bg-[#d97706] hover:bg-[#f59e0b] text-white",
    btnOutline: "border-[#d97706]/30 text-[#d97706] hover:border-[#d97706] hover:bg-[#d97706] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(217,119,6,0.4)]"
  },
  cultura: {
    id: "cultura",
    hex: "#ec4899",
    activeBtn: "bg-[#ec4899]/15 text-[#ec4899] border-[#ec4899]",
    text: "text-[#ec4899]",
    textMuted: "text-[#ec4899]/90",
    groupHoverText: "group-hover:text-[#ec4899]",
    cardBorder: "border-[#ec4899]/10",
    cardBorderHover: "hover:border-[#ec4899]/30",
    btnBg: "bg-[#ec4899] hover:bg-[#f06db0] text-white",
    btnOutline: "border-[#ec4899]/30 text-[#ec4899] hover:border-[#ec4899] hover:bg-[#ec4899] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(236,72,153,0.4)]"
  },
  entretenimento: {
    id: "entretenimento",
    hex: "#d946ef",
    activeBtn: "bg-[#d946ef]/15 text-[#d946ef] border-[#d946ef]",
    text: "text-[#d946ef]",
    textMuted: "text-[#d946ef]/90",
    groupHoverText: "group-hover:text-[#d946ef]",
    cardBorder: "border-[#d946ef]/10",
    cardBorderHover: "hover:border-[#d946ef]/30",
    btnBg: "bg-[#d946ef] hover:bg-[#e174f4] text-white",
    btnOutline: "border-[#d946ef]/30 text-[#d946ef] hover:border-[#d946ef] hover:bg-[#d946ef] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(217,70,239,0.4)]"
  },
  esportes: {
    id: "esportes",
    hex: "#0ea5e9",
    activeBtn: "bg-[#0ea5e9]/15 text-[#0ea5e9] border-[#0ea5e9]",
    text: "text-[#0ea5e9]",
    textMuted: "text-[#0ea5e9]/90",
    groupHoverText: "group-hover:text-[#0ea5e9]",
    cardBorder: "border-[#0ea5e9]/10",
    cardBorderHover: "hover:border-[#0ea5e9]/30",
    btnBg: "bg-[#0ea5e9] hover:bg-[#38bdf8] text-white",
    btnOutline: "border-[#0ea5e9]/30 text-[#0ea5e9] hover:border-[#0ea5e9] hover:bg-[#0ea5e9] hover:text-white",
    glow: "shadow-[0_0_8px_rgba(14,165,233,0.4)]"
  }
};

function getCategoryColor(categoryId: string | undefined): CategoryColor {
  if (!categoryId) return CATEGORY_COLORS.todas;
  const cleanId = categoryId.toLowerCase().trim();
  return CATEGORY_COLORS[cleanId] || CATEGORY_COLORS.todas;
}

export function SinceroNewsApp() {
  const { user, userProfile, logout } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [nextUpdate, setNextUpdate] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [isSelectFocused, setIsSelectFocused] = useState<boolean>(false);
  const [isSourcesMenuOpen, setIsSourcesMenuOpen] = useState<boolean>(false);

  const activeCatColor = getCategoryColor(selectedCategory);

  // Notification and alerting state for auto updates
  const [isFlashingLogo, setIsFlashingLogo] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("sincero_news_muted");
      return saved ? saved === "true" : false;
    } catch {
      return false;
    }
  });
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // States for 30-second summary of featured/main article
  const [featuredSummary, setFeaturedSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // States for trending section "O que o Brasil está falando hoje"
  const [trendingData, setTrendingData] = useState<{ 
    topics: Array<{ title: string; sources: string[]; summary: string; searchTerm: string }>; 
    summary: string; 
    timestamp?: number 
  } | null>(null);
  const [isTrendingLoading, setIsTrendingLoading] = useState<boolean>(false);
  const [lastTick, setLastTick] = useState<number>(Date.now());

  // Card expansion states for Trending section
  const [expandedTopicTitle, setExpandedTopicTitle] = useState<string | null>(null);
  const [expandedNews, setExpandedNews] = useState<{ [topicTitle: string]: NewsItem[] }>({});
  const [expandedNewsLoading, setExpandedNewsLoading] = useState<{ [topicTitle: string]: boolean }>({});
  const [coberturaExibida, setCoberturaExibida] = useState<{ [topicTitle: string]: boolean }>({});
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setLastTick(Date.now());
    }, 15000); // refresh every 15 seconds
    return () => clearInterval(timer);
  }, []);

  const getTrendingAgeText = () => {
    if (!trendingData || !trendingData.timestamp) return "";
    const diffMs = lastTick - trendingData.timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) {
      return "Coletado agora mesmo";
    }
    return `Coletado há ${diffMins} ${diffMins === 1 ? "minuto" : "minutos"}`;
  };

  // Monitor scroll height to show/hide "back to top" button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const newsRef = useRef<NewsItem[]>([]);
  useEffect(() => {
    newsRef.current = news;
  }, [news]);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const nextVal = !prev;
      try {
        localStorage.setItem("sincero_news_muted", String(nextVal));
      } catch (e) {
        console.error("Local storage error:", e);
      }
      return nextVal;
    });
  };

  // Play subtle notification chime via Web Audio API
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      
      const playTone = (time: number, freq: number, duration: number, volume: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(time);
        osc.stop(time + duration);
      };

      const now = audioCtx.currentTime;
      // High-quality subtle double electronic bell sound
      playTone(now, 830.61, 0.35, 0.08); // Ab5
      playTone(now + 0.10, 1046.50, 0.45, 0.06); // C6
    } catch (error) {
      console.warn("Audio Context blocked or not supported:", error);
    }
  };

  // Source filtering state
  const [selectedSource, setSelectedSource] = useState<string>("todos");
  const [hiddenSources, setHiddenSources] = useState<string[]>([]);

  // Reset source filters when category or search changes
  useEffect(() => {
    setSelectedSource("todos");
    setHiddenSources([]);
  }, [selectedCategory, debouncedSearch]);

  // Debounce search query to prevent massive state updates
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch news on mount & when category or search changes
  const fetchNews = async (showLoading = true, retriesLeft = 3) => {
    if (showLoading && retriesLeft === 3) setIsLoading(true);
    try {
      const url = `/api/news?category=${selectedCategory}&search=${encodeURIComponent(debouncedSearch)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Não foi possível carregar as notícias em tempo real.");
      }

      // Defensive checking of Content-Type before parsing JSON to prevent Unexpected token '<' errors
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Servidor retornou resposta em formato HTML inesperado. O servidor pode estar reiniciando.");
      }

      const data: ApiResponse = await res.json();

      // Check if we have new articles on automatic/background updates
      if (!showLoading && newsRef.current.length > 0 && data.news.length > 0) {
        const existingIds = new Set(newsRef.current.map(item => item.id));
        const hasNewItems = data.news.some(item => !existingIds.has(item.id));
        
        if (hasNewItems) {
          setIsFlashingLogo(true);
          // Turn off flashing after 12 seconds
          setTimeout(() => {
            setIsFlashingLogo(false);
          }, 12000);

          if (!isMuted) {
            playNotificationSound();
          }
        }
      }

      setNews(data.news);
      if (data.lastUpdate) setLastUpdate(new Date(data.lastUpdate));
      if (data.nextUpdateIn) setNextUpdate(new Date(data.nextUpdateIn));
      setError(null);
      setIsLoading(false);
    } catch (err: any) {
      console.error("Erro na busca de notícias:", err);
      if (retriesLeft > 0) {
        setTimeout(() => {
          fetchNews(showLoading, retriesLeft - 1);
        }, 2000);
      } else {
        setError("Erro ao carregar notícias. Tentando novamente...");
        setIsLoading(false);
      }
    }
  };

  const fetchTrending = async () => {
    setIsTrendingLoading(true);
    try {
      const res = await fetch("/api/trending");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          throw new Error("Servidor retornou resposta em formato HTML inesperado para tendências.");
        }
        const data = await res.json();
        setTrendingData(data);
      }
    } catch (err) {
      console.error("Erro ao buscar assuntos em alta:", err);
    } finally {
      setIsTrendingLoading(false);
    }
  };

  const handleLoadCoberturaCompleta = async (title: string, searchTerm: string) => {
    // If already loaded, just toggle visibility state to true
    if (expandedNews[title]) {
      setCoberturaExibida(prev => ({ ...prev, [title]: true }));
      return;
    }
    
    setExpandedNewsLoading(prev => ({ ...prev, [title]: true }));
    try {
      const res = await fetch(`/api/news?category=todas&search=${encodeURIComponent(searchTerm)}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          throw new Error("Servidor retornou resposta em formato HTML inesperado para cobertura completa.");
        }
        const data = await res.json();
        setExpandedNews(prev => ({ ...prev, [title]: data.news || [] }));
      }
    } catch (err) {
      console.error("Erro ao buscar cobertura completa da tendência:", err);
    } finally {
      setExpandedNewsLoading(prev => ({ ...prev, [title]: false }));
      setCoberturaExibida(prev => ({ ...prev, [title]: true }));
    }
  };

  useEffect(() => {
    fetchNews(true);
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    fetchTrending();
  }, []);

  // Handle manual trigger refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/news/refresh", { method: "POST" });
      if (res.ok) {
        await Promise.all([
          fetchNews(false),
          fetchTrending()
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Live countdown timer for the 15-minute refresh
  useEffect(() => {
    const updateTimer = () => {
      if (!nextUpdate) {
        setTimeLeft("");
        setProgressPercent(100);
        return;
      }
      const now = new Date();
      const diffMs = nextUpdate.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeLeft("Atualizando agora...");
        setProgressPercent(0);
        // Auto fetch news if the timer runs out
        fetchNews(false);
        return;
      }

      const mins = Math.floor(diffMs / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeLeft(`${mins}m ${secs}s`);

      // 15 minutes is 15 * 60 * 1000 = 900,000 milliseconds
      const totalMs = 15 * 60 * 1000;
      const pct = Math.max(0, Math.min(100, (diffMs / totalMs) * 100));
      setProgressPercent(pct);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [nextUpdate]);

  // Calculate relative time in Portuguese
  const getRelativeTime = (pubDateStr: string) => {
    try {
      const pubDate = new Date(pubDateStr);
      const now = new Date();
      const diffMs = now.getTime() - pubDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return "agora mesmo";
      if (diffMins < 60) return `há ${diffMins} min`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "ontem";
      return `há ${diffDays} dias`;
    } catch (e) {
      return "recentemente";
    }
  };

  // Explicitly named categories in prompt: Política, Economia, Tecnologia, Mundo, Eleições, Todas
  const menuCategories = [
    { id: "todas", label: "Todas" },
    { id: "politica", label: "Política" },
    { id: "economia", label: "Economia" },
    { id: "tecnologia", label: "Tecnologia" },
    { id: "mundo", label: "Mundo" },
    { id: "eleicoes", label: "Eleições" },
    // Also including secondary items for quick filtering so users can find Government/Congress/STF easily
    { id: "governo", label: "Governo" },
    { id: "congresso", label: "Congresso" },
    { id: "stf", label: "STF" },
    { id: "cultura", label: "Cultura" },
    { id: "entretenimento", label: "Entretenimento" },
    { id: "esportes", label: "Esportes" }
  ];

  const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    todas: Newspaper,
    politica: Landmark,
    economia: Coins,
    tecnologia: Cpu,
    mundo: Globe,
    eleicoes: Vote,
    governo: Building2,
    congresso: Users,
    stf: Gavel,
    cultura: Palette,
    entretenimento: Film,
    esportes: Trophy,
  };

  // Get all unique news vehicles (sources) from the loaded news list
  const uniqueSources: string[] = Array.from(new Set(news.map((item) => item.source))).sort() as string[];

  // Filtered news to display based on dropdown/toggle selections
  const displayedNews = news.filter((item) => {
    if (selectedSource !== "todos" && item.source !== selectedSource) {
      return false;
    }
    if (hiddenSources.includes(item.source)) {
      return false;
    }
    return true;
  });

  // Automatically calculate the "Destaque do Momento" news article
  const destaqueArticle = useMemo(() => {
    return getDestaqueDoMomento(displayedNews);
  }, [displayedNews]);

  // Rest of the news (excluding the Destaque do Momento)
  const otherArticles = useMemo(() => {
    if (!destaqueArticle) return [];
    return displayedNews.filter((item) => item.id !== destaqueArticle.id);
  }, [displayedNews, destaqueArticle]);

  // Fetch "Entenda em 30 segundos" summary for the featured article (Destaque do Momento)
  useEffect(() => {
    const featuredArticle = destaqueArticle;
    if (!featuredArticle) {
      setFeaturedSummary("");
      return;
    }

    let isMounted = true;
    setFeaturedSummary("");
    setSummaryLoading(true);
    setSummaryError(null);

    const generateClientFallbackSummary = () => {
      const cleanTitle = featuredArticle.title.trim();
      const cleanSnippet = featuredArticle.snippet ? featuredArticle.snippet.trim() : "";
      const catLabel = menuCategories.find(c => c.id === featuredArticle.category)?.label || featuredArticle.category;
      
      const p1 = `O acontecimento de destaque refere-se a: "${cleanTitle}".`;
      const p2 = cleanSnippet ? ` Os fatos originais reportados indicam que: ${cleanSnippet}` : "";
      const p3 = ` De acordo com as informações veiculadas por ${featuredArticle.source || "veículo de imprensa"}, os envolvidos estão diretamente ligados às atividades na área de ${catLabel}.`;
      const p4 = ` A relevância do assunto reside no impacto direto para os setores afetados e no interesse em torno de suas implicações práticas.`;
      const p5 = ` Os próximos passos dependem do monitoramento contínuo das consequências deste evento, cujos detalhes completos estão disponíveis na cobertura original do veículo.`;
      return `${p1}${p2}${p3}${p4}${p5}`;
    };

    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/news/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: featuredArticle.id,
            title: featuredArticle.title,
            snippet: featuredArticle.snippet,
            source: featuredArticle.source,
            category: featuredArticle.category,
          }),
        });

        if (!res.ok) {
          throw new Error("Erro ao carregar o resumo");
        }

        const data = await res.json();
        if (isMounted) {
          setFeaturedSummary(data.summary);
        }
      } catch (err: any) {
        console.warn("Erro ao buscar resumo (usando fallback local):", err);
        if (isMounted) {
          // Gracefully fall back to client-side generated summary instead of displaying an error card
          setFeaturedSummary(generateClientFallbackSummary());
        }
      } finally {
        if (isMounted) {
          setSummaryLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchSummary();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [destaqueArticle?.id]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FFFFFF] font-sans selection:text-black" style={{ selectionBackgroundColor: activeCatColor.hex } as React.CSSProperties}>
      {/* Upper Status Accent Line */}
      <div className="h-1 w-full transition-colors duration-300" style={{ backgroundColor: activeCatColor.hex }}></div>

      {/* Main Header Container */}
      <header className="border-b border-[#222] bg-[#0A0A0A]">
        {/* Bloco de Anúncio Superior (Ads) */}
        <div className="w-full bg-[#000] border-b border-[#222]/40 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1.5 pb-0.5">
            <p className="text-[9px] font-mono tracking-widest text-[#666] uppercase select-none">
              publicidade
            </p>
          </div>
          <a 
            href="https://treinamento.sinceronews.com/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="block w-full hover:opacity-90 transition-opacity cursor-pointer"
            id="ad-top-link"
          >
            <img 
              src={getProxiedImageUrl("https://sinceronews.com/wp-content/uploads/2026/07/ads1.jpg")} 
              alt="Anúncio Superior" 
              className="w-full h-auto block"
              referrerPolicy="no-referrer"
            />
          </a>
        </div>

        {/* Banner principal em largura total */}
        <div className="w-full border-b border-[#222]/40 bg-[#000] overflow-hidden">
          <img 
            src={getProxiedImageUrl("https://sinceronews.com/wp-content/uploads/2026/07/home.jpg")} 
            alt="Sincero News" 
            className="w-full h-auto block"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-5 gap-4">
            
            {/* Logo and Live Status */}
            <div className="flex items-center justify-between w-full md:w-auto">
              <div className="flex items-center gap-3 w-full">
                <div className="flex flex-col w-full">
                  <p className="text-xs text-[#A0A0A0] font-sans mt-0.5 text-center">
                    Economizamos o seu tempo. Você entende o que aconteceu em 30 segundos e decide se quer ler a matéria completa.
                  </p>
                </div>
              </div>

              {/* Mobile-only refresh */}
              <button 
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="md:hidden text-neutral-400 hover:text-white transition-all cursor-pointer"
                id="mobile-refresh-btn"
                title="Atualizar Notícias"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} style={{ color: isRefreshing ? activeCatColor.hex : undefined }} />
              </button>
            </div>

            {/* Live Indicator and Clock stats */}
            <div className="flex flex-wrap items-center gap-4 bg-[#1A1A1A] border border-[#222] p-2 px-3 md:px-4 rounded-lg text-xs">
              <div className="flex items-center gap-1.5 font-medium transition-colors duration-300" style={{ color: activeCatColor.hex }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 transition-colors duration-300" style={{ backgroundColor: activeCatColor.hex }}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 transition-colors duration-300" style={{ backgroundColor: activeCatColor.hex }}></span>
                </span>
                <span className="tracking-wider font-mono font-bold uppercase">TEMPO REAL</span>
              </div>

              <div className="h-4 w-[1px] bg-[#333] hidden sm:block"></div>

              {/* Mute/Unmute sound control */}
              <button
                onClick={toggleMute}
                className="flex items-center gap-1.5 text-[#A0A0A0] hover:text-white transition-all cursor-pointer"
                title={isMuted ? "Ativar som de notificação" : "Silenciar notificações"}
                id="toggle-mute-btn"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-[10px] uppercase font-mono tracking-wider text-red-400 font-bold">MUDO</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 shrink-0 transition-colors duration-300" style={{ color: activeCatColor.hex }} />
                    <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold">SOM ATIVO</span>
                  </>
                )}
              </button>

              <div className="h-4 w-[1px] bg-[#333] hidden sm:block"></div>

              {lastUpdate && (
                <div className="flex items-center gap-1 text-[#A0A0A0]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Atualizado: <strong>{lastUpdate.toLocaleTimeString("pt-BR")}</strong></span>
                </div>
              )}

              <div className="h-4 w-[1px] bg-[#333] hidden sm:block"></div>

              {timeLeft && (
                <div className="text-[#A0A0A0] font-mono">
                  Próxima atualização em: <span className="text-white font-bold">{timeLeft}</span>
                </div>
              )}

              <div className="h-4 w-[1px] bg-[#333] hidden sm:block"></div>

              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="hidden md:flex items-center gap-1.5 px-3 py-1 text-black font-semibold tracking-wide transition-all cursor-pointer disabled:opacity-50 rounded-md hover:brightness-110"
                style={{
                  backgroundColor: activeCatColor.hex,
                  color: (activeCatColor.id === "politica" || activeCatColor.id === "economia" || activeCatColor.id === "mundo" || activeCatColor.id === "cultura" || activeCatColor.id === "entretenimento" || activeCatColor.id === "governo" || activeCatColor.id === "congresso" || activeCatColor.id === "esportes" || activeCatColor.id === "stf") ? "#ffffff" : "#000000"
                }}
                id="desktop-refresh-btn"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>ATUALIZAR</span>
              </button>

              {/* User profile & Logout */}
              <div className="h-4 w-[1px] bg-[#333] hidden sm:block"></div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[10px] font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-amber-500 uppercase font-bold">
                  {userProfile?.tipoUsuario || "Leitor"} ({userProfile?.plano || "Trimestral"})
                </span>
                <span className="text-white font-semibold hidden md:inline">{userProfile?.nome || user?.displayName || "Assinante"}</span>
                <button
                  onClick={() => logout()}
                  className="text-red-400 hover:text-red-300 font-mono text-[10px] uppercase font-black tracking-wider cursor-pointer ml-1 transition-colors hover:underline"
                  id="header-logout-btn"
                >
                  Sair
                </button>
              </div>
            </div>

          </div>

          {/* Navigation Menu (Organização: Menu superior) */}
          <nav className="py-3 border-t border-[#222]">
            <div className="flex flex-wrap gap-2">
              {menuCategories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                const IconComponent = categoryIcons[cat.id];
                const catColor = getCategoryColor(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                    }}
                    className={`px-3 py-1.5 text-[11px] font-sans font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer whitespace-nowrap rounded-lg border flex items-center gap-1.5 ${
                      isActive
                        ? catColor.activeBtn
                        : "bg-[#141414] text-[#A0A0A0] border-[#222] hover:text-white hover:border-neutral-700"
                    }`}
                    id={`nav-category-${cat.id}`}
                  >
                    {IconComponent && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

        </div>
      </header>

      {/* Tempo restante para próxima atualização automática (Barra de Progresso Horizontal Fixada) */}
      <div className="sticky top-0 z-50 w-full bg-[#111] h-1 overflow-hidden border-b border-[#222]/30">
        <motion.div 
          initial={{ width: "100%" }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full"
          style={{ backgroundColor: activeCatColor.hex, boxShadow: `0 0 8px ${activeCatColor.hex}66` }}
          title={`Tempo restante para próxima atualização: ${timeLeft}`}
        />
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Search Block and Category Title */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div>
            <h2 className="text-3xl font-display font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6" style={{ color: activeCatColor.hex }} />
              <span>
                {selectedCategory === "todas" 
                  ? "Todas as Notícias" 
                  : menuCategories.find(c => c.id === selectedCategory)?.label || "Notícias"}
              </span>
              <span className="text-xs text-[#A0A0A0] font-mono bg-[#1A1A1A] px-2.5 py-0.5 border border-[#333] font-normal rounded-md">
                {displayedNews.length !== news.length ? (
                  <span>{displayedNews.length} de {news.length} artigos</span>
                ) : (
                  <span>{news.length} {news.length === 1 ? "artigo" : "artigos"}</span>
                )}
              </span>
            </h2>
            <p className="text-[#A0A0A0] text-sm mt-1">
              {selectedCategory === "todas" 
                ? "Compilado geral de portais de comunicação em tempo real" 
                : `Últimas atualizações sobre ${menuCategories.find(c => c.id === selectedCategory)?.label}`}
            </p>
          </div>

          {/* Search Box Component */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-5 w-5 text-[#A0A0A0]" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar notícias no Sincero..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A1A1A] border text-white placeholder-neutral-500 text-sm py-2.5 pl-10 pr-10 focus:outline-none transition-all rounded-lg"
              style={{
                borderColor: isSearchFocused ? activeCatColor.hex : "#333",
                boxShadow: isSearchFocused ? `0 0 8px ${activeCatColor.hex}33` : "none"
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              id="search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#A0A0A0] hover:text-white cursor-pointer"
                id="clear-search-btn"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter by Vehicle Block */}
        <div className="mb-8 bg-[#131313] border border-[#222] p-4 sm:p-5 rounded-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Left side: Heading and Dropdown Menu */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#A0A0A0] font-semibold">
                <SlidersHorizontal className="w-4 h-4 transition-colors duration-300" style={{ color: activeCatColor.hex }} />
                <span>Filtrar por Veículo:</span>
              </div>
              
              <div className="relative">
                <select
                  value={selectedSource}
                  onChange={(e) => {
                    setSelectedSource(e.target.value);
                  }}
                  className="appearance-none bg-[#1A1A1A] border text-white text-xs font-semibold py-2 px-4 pr-10 focus:outline-none transition-all rounded-lg cursor-pointer min-w-[200px]"
                  style={{
                    borderColor: isSelectFocused ? activeCatColor.hex : "#333",
                    boxShadow: isSelectFocused ? `0 0 8px ${activeCatColor.hex}33` : "none"
                  }}
                  onFocus={() => setIsSelectFocused(true)}
                  onBlur={() => setIsSelectFocused(false)}
                  id="source-select-dropdown"
                >
                  <option value="todos">Todos os Veículos ({uniqueSources.length})</option>
                  {uniqueSources.map((src) => (
                    <option key={src} value={src}>
                      {src} ({news.filter((item) => item.source === src).length})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#A0A0A0]">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              {selectedSource !== "todos" && (
                <button
                  onClick={() => setSelectedSource("todos")}
                  className="text-xs hover:underline font-mono cursor-pointer"
                  style={{ color: activeCatColor.hex }}
                  id="clear-source-filter-btn"
                >
                  [Limpar Filtro]
                </button>
              )}
            </div>

            {/* Right side: Expandable dropdown to hide/show individual vehicles */}
            <div className="relative">
              <button
                onClick={() => setIsSourcesMenuOpen(!isSourcesMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-[#333] hover:border-neutral-500 rounded-lg text-xs font-semibold text-[#A0A0A0] hover:text-white transition-all cursor-pointer w-full sm:w-auto justify-between sm:justify-start"
                style={{
                  borderColor: isSourcesMenuOpen ? activeCatColor.hex : "#333",
                  boxShadow: isSourcesMenuOpen ? `0 0 8px ${activeCatColor.hex}33` : "none"
                }}
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: activeCatColor.hex }} />
                  <span>Gerenciar Fontes ({uniqueSources.length})</span>
                </div>
                {isSourcesMenuOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </button>

              {/* Collapsible Source Pill Cardápio */}
              {isSourcesMenuOpen && (
                <div className="absolute right-0 left-0 sm:left-auto mt-2 z-30 bg-[#161616] border border-[#222] p-4 rounded-xl shadow-2xl w-full sm:w-[480px]">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#222]">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: activeCatColor.hex }} />
                      <span className="text-xs font-mono font-bold uppercase text-white">Cardápio de Veículos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hiddenSources.length > 0 && (
                        <button
                          onClick={() => setHiddenSources([])}
                          className="text-[10px] font-mono text-red-400 hover:text-red-350 cursor-pointer uppercase bg-red-950/20 px-2 py-0.5 rounded border border-red-900/30"
                        >
                          Mostrar Todas ({hiddenSources.length})
                        </button>
                      )}
                      <button
                        onClick={() => setIsSourcesMenuOpen(false)}
                        className="text-[#A0A0A0] hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                    {uniqueSources.length === 0 ? (
                      <span className="text-xs text-neutral-600 italic col-span-2">Nenhum veículo disponível</span>
                    ) : (
                      uniqueSources.map((src) => {
                        const isHidden = hiddenSources.includes(src);
                        return (
                          <button
                            key={src}
                            onClick={() => {
                              if (isHidden) {
                                setHiddenSources(hiddenSources.filter((s) => s !== src));
                              } else {
                                setHiddenSources([...hiddenSources, src]);
                              }
                            }}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all border cursor-pointer flex items-center justify-between text-left ${
                              isHidden
                                ? "bg-transparent border-[#222] text-neutral-600 line-through decoration-red-900/60"
                                : "bg-[#1A1A1A] text-[#A0A0A0] hover:text-white"
                            }`}
                            style={{
                              borderColor: isHidden ? "#222" : "#333",
                            }}
                            title={isHidden ? `Exibir notícias de ${src}` : `Ocultar notícias de ${src}`}
                            id={`toggle-source-${src.replace(/\s+/g, "-")}`}
                          >
                            <span className="truncate mr-1">{src}</span>
                            {isHidden ? (
                              <EyeOff className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Disclaimer Informative Alert (MVP V1 scope discipline reminder) */}
        <div className="mb-8 bg-[#1A1A1A] border-l-2 p-4 flex gap-3 items-start text-xs text-[#A0A0A0] rounded-r-lg transition-colors duration-300" style={{ borderLeftColor: activeCatColor.hex }}>
          <Info className="w-5 h-5 shrink-0 mt-0.5 transition-colors duration-300" style={{ color: activeCatColor.hex }} />
          <div>
            <p className="font-bold text-white mb-0.5 uppercase tracking-wide">COMPROMISSO SINCERO NEWS</p>
            <p>
              Agregamos notícias brutas direto das fontes originais sem intermediação, sem filtros partidários, sem IA e sem qualquer edição de texto. Seus dados permanecem seguros porque <strong>não utilizamos cookies de rastreamento, nem salvamos nada em banco de dados</strong>.
            </p>
          </div>
        </div>

      </main>

      {/* Bloco de Publicidade em Largura Total */}
      <div className="w-full bg-black border-y border-[#222]/40 pb-6 pt-3 mb-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-2">
          <p className="text-[9px] font-mono tracking-widest text-[#666] uppercase select-none">
            publicidade
          </p>
        </div>
        <a 
          href="https://treinamento.sinceronews.com/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="block w-full hover:opacity-90 transition-opacity cursor-pointer"
          id="ad-middle-link"
        >
          <img 
            src={getProxiedImageUrl("https://sinceronews.com/wp-content/uploads/2026/07/ads2.jpg")} 
            alt="Publicidade" 
            className="w-full h-auto block"
            referrerPolicy="no-referrer"
          />
        </a>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">

        {/* Loading and States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4" id="loading-spinner">
            <RefreshCw className="w-12 h-12 animate-spin" style={{ color: activeCatColor.hex }} />
            <p className="text-[#A0A0A0] font-mono text-sm tracking-wider">CONSULTANDO FONTES EM TEMPO REAL...</p>
          </div>
        ) : error && news.length === 0 ? (
          <div className="text-center py-16 border border-[#222] bg-[#1A1A1A] p-8 rounded-xl">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => fetchNews(true)}
              className="px-6 py-2.5 text-black font-semibold transition-all hover:brightness-110 rounded-lg cursor-pointer"
              style={{ backgroundColor: activeCatColor.hex }}
              id="retry-button"
            >
              Tentar Novamente
            </button>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-800 bg-[#1A1A1A]/30 p-8 rounded-xl" id="empty-state">
            <Search className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-1">Nenhuma notícia encontrada</h3>
            <p className="text-[#A0A0A0] text-sm max-w-md mx-auto">
              Não encontramos nenhum artigo recente {searchQuery ? `correspondente a "${searchQuery}"` : "nesta categoria"} nos principais portais. Tente buscar outros termos.
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 hover:underline font-mono text-sm cursor-pointer font-bold"
                style={{ color: activeCatColor.hex }}
                id="reset-search-btn"
              >
                Limpar pesquisa
              </button>
            )}
          </div>
        ) : displayedNews.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-800 bg-[#1A1A1A]/30 p-8 rounded-xl" id="filtered-empty-state">
            <SlidersHorizontal className="w-12 h-12 text-neutral-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-bold mb-1">Nenhum artigo com os filtros aplicados</h3>
            <p className="text-[#A0A0A0] text-sm max-w-md mx-auto">
              As notícias desta categoria estão ocultadas pelos filtros aplicados ao veículo de notícia.
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => {
                  setSelectedSource("todos");
                  setHiddenSources([]);
                }}
                className="px-4 py-2 text-black font-semibold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer"
                style={{ backgroundColor: activeCatColor.hex }}
                id="reset-filters-btn"
              >
                Reexibir Todos os Veículos
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Featured Article (Destaque do Momento) */}
            {(() => {
               const item = destaqueArticle;
               if (!item) return null;
               const relativeTime = getRelativeTime(item.pubDate);
               const categoryLabel = menuCategories.find(c => c.id === item.category)?.label || item.category;
               const itemColor = getCategoryColor(item.category);

               return (
                <div className="space-y-4" id="destaque-container">
                  {/* Discrete Highlight Badge above the main news card */}
                  <div className="flex items-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase tracking-widest font-extrabold rounded-md shadow-sm ${itemColor.btnBg}`}>
                      🥇 Destaque do Momento
                    </span>
                  </div>

                  <motion.article
                    key={`featured-${item.id}-${selectedCategory}`}
                    initial={{ opacity: 0, y: 24, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 90,
                      damping: 14,
                      mass: 0.8
                    }}
                    className={`group bg-[#111111] border transition-all duration-300 rounded-2xl overflow-hidden shadow-xl p-6 sm:p-8 lg:p-10 ${itemColor.cardBorder} ${itemColor.cardBorderHover}`}
                    id={`featured-article-${item.id}`}
                  >
                    {/* Top: Logo oficial do veículo de imprensa */}
                    <div className="flex items-center justify-between border-b border-[#222]/40 pb-5 mb-5">
                      {renderPublisherLogo(item.source, item.link)}
                    </div>

                    {/* Categoria */}
                    <span className={`text-xs font-mono font-bold uppercase tracking-widest block mb-2 ${itemColor.text}`}>
                      {categoryLabel}
                    </span>

                    {/* Título da notícia */}
                    <h2 className={`text-xl sm:text-2xl lg:text-3xl font-display font-black text-white tracking-tight leading-snug transition-colors duration-200 mb-6 ${itemColor.groupHoverText}`}>
                      {item.title}
                    </h2>

                    {/* Seção: ⏱️ Entenda em 30 segundos / Resumo da notícia */}
                    <div className="border border-[#222]/40 bg-[#161616]/50 rounded-xl p-5 sm:p-6 mb-6">
                      <h3 className={`text-xs font-mono uppercase tracking-widest font-black mb-3 flex items-center gap-1.5 ${itemColor.text}`}>
                        <span>⏱️ Entenda em 30 segundos</span>
                      </h3>

                      {summaryLoading ? (
                        <div className="space-y-2.5 py-1 animate-pulse">
                          <div className="h-3 bg-[#222] rounded w-full"></div>
                          <div className="h-3 bg-[#222] rounded w-[95%]"></div>
                          <div className="h-3 bg-[#222] rounded w-[98%]"></div>
                          <div className="h-3 bg-[#222] rounded w-[85%]"></div>
                          <p className="text-[11px] text-neutral-500 font-mono mt-2 italic">Gerando resumo objetivo em tempo real via Gemini...</p>
                        </div>
                      ) : featuredSummary ? (
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-[#E0E0E0] text-[13.5px] sm:text-[14.5px] leading-relaxed font-sans font-light whitespace-pre-wrap select-text"
                        >
                          {featuredSummary}
                        </motion.p>
                      ) : (
                        <p className="text-[#A0A0A0] text-[13.5px] leading-relaxed font-sans font-light">
                          {item.snippet}
                        </p>
                      )}
                    </div>

                    {/* Horário da publicação & Botão: Ler matéria completa */}
                    <div className="pt-6 border-t border-[#222]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-600" />
                        <span>{relativeTime}</span>
                        <span className="text-neutral-800">•</span>
                        <span>{new Date(item.pubDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 text-xs font-bold tracking-wider uppercase transition-all duration-300 rounded-lg group/link cursor-pointer text-center ${itemColor.btnBg}`}
                        id={`read-more-featured-${item.id}`}
                      >
                        <span className="font-sans">Ler matéria completa</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </motion.article>
                </div>
              );
            })()}

            {/* 🇧🇷 Seção: O que o Brasil está falando hoje */}
            <motion.div
              id="brasil-trending-section"
              animate={{
                borderColor: [
                  "rgba(34, 34, 34, 1)",
                  `${activeCatColor.hex}55`,
                  "rgba(34, 34, 34, 1)"
                ],
                boxShadow: [
                  "0 0 0px rgba(0, 0, 0, 0)",
                  `0 0 25px ${activeCatColor.hex}1a`,
                  "0 0 0px rgba(0, 0, 0, 0)"
                ]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="bg-[#111111] border rounded-2xl p-6 sm:p-8"
            >
              <div className="flex items-center justify-between border-b border-[#222]/40 pb-4 mb-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-mono font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <span className="text-lg">🔥</span>
                    <span>O que está sendo Trending Tops no Brasil hoje</span>
                  </h3>
                  {!isTrendingLoading && trendingData && trendingData.timestamp && (
                    <span className="text-[10px] font-mono text-neutral-500">
                      ⏱️ {getTrendingAgeText()}
                    </span>
                  )}
                </div>
                {isTrendingLoading && (
                  <span className="text-[10px] font-mono text-neutral-500 animate-pulse">
                    Atualizando tendências...
                  </span>
                )}
              </div>

              {isTrendingLoading || !trendingData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-20 bg-[#161616]/40 border border-[#222]/30 rounded-xl"></div>
                    ))}
                  </div>
                  <div className="border border-[#222]/20 bg-[#141414]/20 rounded-xl p-5 animate-pulse space-y-2">
                    <div className="h-3 bg-[#181818] rounded w-1/4 mb-3"></div>
                    <div className="h-3.5 bg-[#181818] rounded w-full"></div>
                    <div className="h-3.5 bg-[#181818] rounded w-[94%]"></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {trendingData.topics.map((topic, i) => {
                      const isExpanded = expandedTopicTitle === topic.title;
                      const sourcesCount = topic.sources?.length || 1;
                      const repercussaoPct = Math.min(100, Math.max(15, sourcesCount === 1 ? 40 : sourcesCount === 2 ? 65 : sourcesCount === 3 ? 85 : 100));

                      return (
                        <motion.div
                          key={topic.title}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          layout="position"
                          className={`bg-[#161616] border border-[#222]/80 rounded-xl transition-all duration-300 w-full overflow-hidden ${
                            isExpanded 
                              ? "col-span-1 md:col-span-2 border-[#3a3a3a] shadow-lg p-5" 
                              : "col-span-1 hover:bg-[#1A1A1A] hover:border-[#3a3a3a] p-4 cursor-pointer"
                          }`}
                          onClick={() => {
                            if (!isExpanded) {
                              setExpandedTopicTitle(topic.title);
                            }
                          }}
                        >
                          <div 
                            onClick={(e) => {
                              if (isExpanded) {
                                e.stopPropagation();
                                setExpandedTopicTitle(null);
                              }
                            }}
                            className={`flex items-start justify-between gap-3 ${isExpanded ? "cursor-pointer pb-4 border-b border-[#222]/30 mb-4" : ""}`}
                          >
                            <div className="flex flex-col gap-1.5 w-full">
                              <div className="flex items-start gap-2">
                                <span className="text-sm shrink-0">🔥</span>
                                <span className={`font-sans font-bold leading-snug transition-colors duration-200 ${isExpanded ? "text-white text-sm sm:text-base" : "text-[#E0E0E0] text-[13px]"}`}>
                                  {topic.title}
                                </span>
                              </div>
                              {!isExpanded && topic.sources && topic.sources.length > 0 && (
                                <div className="pl-6 flex flex-wrap gap-1 items-center text-[10px] font-mono text-neutral-500">
                                  {topic.sources.map((src, idx) => (
                                    <span key={src} className="flex items-center">
                                      {idx > 0 && <span className="mx-1 text-neutral-600 font-sans">•</span>}
                                      <span>{src}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Índice de Repercussão */}
                              <div className="mt-1.5 pl-6 pr-2 space-y-1 w-full">
                                <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-neutral-500 relative">
                                  <span className="flex items-center gap-1.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse"></span>
                                    Índice de Repercussão
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-amber-500/90">{repercussaoPct}%</span>
                                    <div className="relative flex items-center justify-center">
                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation(); // Evita expandir ou fechar o card principal ao clicar no info
                                          setActiveTooltip(activeTooltip === topic.title ? null : topic.title);
                                        }}
                                        onMouseEnter={() => setActiveTooltip(topic.title)}
                                        onMouseLeave={() => setActiveTooltip(null)}
                                        className="text-neutral-500 hover:text-amber-400 transition-colors duration-200 p-0.5 focus:outline-none cursor-help"
                                        aria-label="Informações sobre o Índice de Repercussão"
                                      >
                                        <Info className="w-3.5 h-3.5" />
                                      </button>
                                      
                                      {/* Tooltip */}
                                      <div className={`absolute right-0 bottom-full mb-2 w-48 p-2.5 bg-[#1C1C1C] text-neutral-300 text-[10px] font-sans normal-case tracking-normal rounded-lg border border-[#333] shadow-xl transition-all duration-200 z-50 pointer-events-none leading-relaxed ${
                                        activeTooltip === topic.title 
                                          ? "opacity-100 visible translate-y-0" 
                                          : "opacity-0 invisible translate-y-1"
                                      }`}>
                                        <p className="font-semibold text-white mb-1">Como é calculado?</p>
                                        Este índice avalia a relevância do tema baseado no volume de buscas recentes, na quantidade de veículos que cobrem a matéria e no engajamento gerado em redes de fóruns e vídeos.
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="h-1 w-full bg-[#121212] rounded-full overflow-hidden border border-[#2a2a2a]/30">
                                  <motion.div 
                                    initial={{ width: "0%" }}
                                    animate={{ width: isExpanded ? `${repercussaoPct}%` : "0%" }}
                                    transition={{ 
                                      duration: 0.8, 
                                      ease: "easeOut", 
                                      delay: isExpanded ? 0.2 : 0.05
                                    }}
                                    className="h-full bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 rounded-full"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-neutral-500 hover:text-white shrink-0 pt-0.5">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="overflow-hidden space-y-4 text-left"
                              >
                                <div className="space-y-1.5">
                                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                    <span>🧠 Explicação da Tendência</span>
                                  </h4>
                                  <p className="text-neutral-300 text-[13px] leading-relaxed font-sans select-text whitespace-pre-wrap">
                                    {topic.summary || "Este tema ganhou força porque apareceu simultaneamente nas buscas do Google, nas manchetes dos principais portais e nas discussões das redes sociais."}
                                  </p>
                                </div>

                                <div className="border-t border-[#222]/40 pt-4 pb-1">
                                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                                    📍 Onde esse assunto está aparecendo
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {topic.sources.map(src => {
                                      let badgeColor = "bg-neutral-900 border-neutral-800 text-neutral-400";
                                      let icon = "🌐";
                                      if (src === "Google Trends") {
                                        badgeColor = "bg-blue-950/20 border-blue-900/30 text-blue-400";
                                        icon = "📈";
                                      } else if (src === "Google News") {
                                        badgeColor = "bg-emerald-950/20 border-emerald-900/30 text-emerald-400";
                                        icon = "📰";
                                      } else if (src === "YouTube") {
                                        badgeColor = "bg-red-950/20 border-red-900/30 text-red-400";
                                        icon = "▶️";
                                      } else if (src === "Reddit") {
                                        badgeColor = "bg-orange-950/20 border-orange-900/30 text-orange-400";
                                        icon = "💬";
                                      }
                                      return (
                                        <span key={src} className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono border rounded-lg ${badgeColor}`}>
                                          <span>{icon}</span>
                                          <span>{src}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="border border-[#222]/40 bg-[#161616]/40 rounded-xl p-5 sm:p-6">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#A0A0A0] font-bold mb-3.5 flex items-center gap-1.5">
                      <span>⏱️ Em poucas palavras</span>
                    </h4>
                    <p className="text-[#D0D0D0] text-[13.5px] leading-relaxed font-sans font-light select-text">
                      {trendingData.summary}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Rest of the News (Other articles grid) */}
            {otherArticles.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-400 font-bold mb-6 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeCatColor.hex }}></div>
                  <span>Mais notícias atualizadas ({otherArticles.length})</span>
                </h3>

                <AnimatePresence mode="popLayout">
                  <motion.div 
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    id="news-grid"
                  >
                    {otherArticles.map((item, idx) => {
                      const relativeTime = getRelativeTime(item.pubDate);
                      const categoryLabel = menuCategories.find(c => c.id === item.category)?.label || item.category;
                      const itemColor = getCategoryColor(item.category);

                      return (
                        <motion.article
                          key={`${item.id}-${selectedCategory}`}
                          layout
                          initial={{ opacity: 0, y: 24, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ 
                            type: "spring",
                            stiffness: 100,
                            damping: 15,
                            mass: 0.8,
                            delay: Math.min(idx * 0.04, 0.35)
                          }}
                          className={`group flex flex-col bg-[#141414] border transition-all duration-300 rounded-2xl overflow-hidden h-full p-6 sm:p-7 shadow-sm ${itemColor.cardBorder} ${itemColor.cardBorderHover}`}
                          id={`article-${item.id}`}
                        >
                          {/* Top: Logo oficial do veículo de imprensa */}
                          <div className="flex items-center justify-between border-b border-[#222]/40 pb-4 mb-4">
                            {renderPublisherLogo(item.source, item.link)}
                          </div>

                          {/* Card Content */}
                          <div className="flex-1 flex flex-col justify-between">
                            <div className="space-y-4">
                              {/* Categoria */}
                              <span className={`text-[11px] font-mono font-bold uppercase tracking-wider block ${itemColor.text}`}>
                                {categoryLabel}
                              </span>

                              {/* Título da notícia */}
                              <h3 className={`text-[17px] font-display font-bold text-white tracking-tight leading-snug transition-colors duration-200 line-clamp-3 ${itemColor.groupHoverText}`}>
                                {item.title}
                              </h3>

                              {/* Seção: ⏱️ Entenda em 30 segundos / Resumo da notícia */}
                              <div className="bg-[#181818]/60 p-4 rounded-xl border border-[#222]/30 space-y-2 mt-2">
                                <h4 className={`text-[11px] font-mono uppercase tracking-wider font-black flex items-center gap-1.5 ${itemColor.text}`}>
                                  <span>⏱️ Entenda em 30 segundos</span>
                                </h4>
                                
                                <p className="text-[#A0A0A0] text-[12.5px] leading-relaxed font-sans line-clamp-4 font-light">
                                  {item.snippet}
                                </p>
                              </div>
                            </div>

                            {/* Horário da publicação & Botão: Ler matéria completa */}
                            <div className="pt-5 border-t border-[#222]/40 mt-5 space-y-4">
                              <div className="flex items-center gap-1.5 text-[11px] text-[#A0A0A0] font-mono">
                                <Clock className="w-3.5 h-3.5 text-neutral-600" />
                                <span>{relativeTime}</span>
                                <span className="text-neutral-800">•</span>
                                <span>{new Date(item.pubDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>

                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`w-full inline-flex items-center justify-between px-4 py-2.5 bg-transparent border text-xs font-bold tracking-wider uppercase transition-all duration-300 rounded-lg group/link cursor-pointer text-center ${itemColor.btnOutline}`}
                                id={`read-more-${item.id}`}
                              >
                                <span className="font-sans flex-1 text-center font-semibold">Ler matéria completa</span>
                                <ExternalLink className="w-3.5 h-3.5 transform group-hover/link:translate-x-0.5 transition-transform" />
                              </a>
                            </div>

                          </div>
                        </motion.article>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Main Footer Container */}
      <footer className="border-t border-[#222] bg-[#000000] mt-20 text-xs text-[#A0A0A0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            <div className="text-center md:text-left space-y-3">
              <div className="max-w-md mx-auto md:mx-0 overflow-hidden rounded-lg border border-[#222]/60">
                <img 
                  src={getProxiedImageUrl("https://sinceronews.com/wp-content/uploads/2026/07/footer.jpg")} 
                  alt="Sincero News Footer" 
                  className="w-full h-auto block"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p>Seu agregador transparente de informações em tempo real.</p>
              <p className="text-[10px] text-neutral-600">Nenhum dado é salvo em nossos servidores. Sem persistência, sem rastreamento.</p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-2 text-[11px] font-mono text-[#A0A0A0]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-brand-blue animate-pulse"></span>
                <span>Criado por Julio Molina e F. Texxx</span>
              </div>
              <div>© {new Date().getFullYear()} Sincero News. Todos os direitos reservados.</div>
            </div>

          </div>
        </div>
      </footer>

      {/* Floating Back to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            key="back-to-top"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 p-3 bg-brand-blue text-black border border-brand-blue rounded-full shadow-xl hover:bg-[#0A0A0A] hover:text-brand-blue transition-colors duration-300 cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
            title="Voltar ao topo"
            aria-label="Voltar ao topo"
            id="back-to-top-btn"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppContent() {
  const { user, loading, isCheckingProfile, logout } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  // Se a rota for /ativar-conta, renderiza a tela de Ativar Conta
  if (currentPath === "/ativar-conta") {
    return (
      <AtivarConta 
        onGoToLogin={() => navigateTo("/")} 
      />
    );
  }

  // Se a rota for /admin, renderiza o Painel de Controle Administrativo
  if (currentPath === "/admin") {
    if (loading) {
      return (
        <div className="min-h-screen bg-[#070707] text-white flex flex-col justify-center items-center font-sans">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#0ea5e9] animate-spin" />
            <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase">Verificando Credenciais...</span>
          </div>
        </div>
      );
    }
    if (!user) {
      return <AuthUI />;
    }
    return <AdminPanel onNavigate={navigateTo} />;
  }

  if (loading || isCheckingProfile) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex flex-col justify-center items-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#0ea5e9] animate-spin" />
          <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase">Verificando Assinatura...</span>
        </div>
      </div>
    );
  }

  // Se o usuário não está autenticado, exibe a AuthUI
  if (!user) {
    return <AuthUI />;
  }

  // Se o usuário está autenticado e ativo, exibe o aplicativo de notícias principal (Home)
  return <SinceroNewsApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
