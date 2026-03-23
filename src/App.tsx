/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useNavigate, 
  Link, 
  useParams 
} from 'react-router-dom';
import { 
  auth, 
  db, 
  storage, 
  googleProvider, 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  query, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  User
} from './firebase';
import { 
  Book, 
  Search, 
  Plus, 
  LogOut, 
  User as UserIcon, 
  FileText, 
  ArrowLeft, 
  Loader2, 
  Upload,
  BookOpen,
  X,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { KotlinGuide } from './KotlinGuide';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Kitab {
  id: string;
  judul: string;
  deskripsi: string;
  kategori: string;
  pdf_url: string;
  uploader_id: string;
  uploader_name: string;
  timestamp: number;
}

// --- Components ---

const Navbar = ({ user, onShowGuide }: { user: User | null, onShowGuide: () => void }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <div className="bg-emerald-600 p-1.5 rounded-lg">
          <Book className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-emerald-900 text-lg tracking-tight">Pustaka Diniyah</span>
      </Link>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onShowGuide}
          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
          title="Panduan Kotlin"
        >
          <Info className="w-5 h-5" />
        </button>

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-xs font-medium text-emerald-900">
                {user.isAnonymous ? 'Tamu' : user.displayName}
              </span>
              <span className="text-[10px] text-emerald-600 uppercase tracking-widest font-bold">
                {user.isAnonymous ? 'Guest Mode' : 'Contributor'}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <UserIcon className="w-5 h-5 text-emerald-300" />
        )}
      </div>
    </nav>
  );
};

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
      navigate('/');
    } catch (error) {
      console.error("Guest login failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-emerald-200/50 p-8 text-center"
      >
        <div className="bg-emerald-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
          <Book className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-emerald-900 mb-2">Pustaka Diniyah</h1>
        <p className="text-emerald-600 mb-10">Perpustakaan Digital Kitab Madrasah Diniyah</p>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-emerald-100 text-emerald-900 font-semibold py-3.5 rounded-2xl hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Masuk dengan Google
              </>
            )}
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-emerald-100 flex-1"></div>
            <span className="text-emerald-300 text-sm font-medium">ATAU</span>
            <div className="h-px bg-emerald-100 flex-1"></div>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full text-emerald-600 font-semibold py-3 hover:text-emerald-800 transition-colors"
          >
            Masuk Tanpa Login (Baca Saja)
          </button>
        </div>
      </motion.div>
      <p className="mt-8 text-emerald-400 text-sm">© 2026 Pustaka Diniyah</p>
    </div>
  );
};

const Home = ({ user, onShowGuide }: { user: User | null, onShowGuide: () => void }) => {
  const [kitabs, setKitabs] = useState<Kitab[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'kitab_list'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kitab));
      setKitabs(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredKitabs = useMemo(() => {
    return kitabs.filter(k => 
      k.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.kategori.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [kitabs, searchQuery]);

  return (
    <div className="min-h-screen bg-emerald-50/30 pb-24">
      <Navbar user={user} onShowGuide={onShowGuide} />
      
      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cari kitab atau kategori..."
            className="w-full bg-white border-none rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-emerald-900 placeholder:text-emerald-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories (Quick Filter) */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
          {['Semua', 'Fiqh', 'Aqidah', 'Akhlak', 'Nahwu', 'Shorof', 'Hadits'].map((cat) => (
            <button 
              key={cat}
              onClick={() => setSearchQuery(cat === 'Semua' ? '' : cat)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                (searchQuery === cat || (cat === 'Semua' && searchQuery === '')) 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
                  : "bg-white text-emerald-600 hover:bg-emerald-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
            <p className="text-emerald-600 font-medium">Memuat kitab...</p>
          </div>
        ) : filteredKitabs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredKitabs.map((kitab) => (
              <Link 
                key={kitab.id} 
                to={`/read/${kitab.id}`}
                className="group bg-white p-4 rounded-2xl border border-emerald-50 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50 transition-all flex gap-4"
              >
                <div className="bg-emerald-50 w-16 h-20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <FileText className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-bold text-emerald-900 line-clamp-1">{kitab.judul}</h3>
                    <p className="text-xs text-emerald-500 font-medium uppercase tracking-wider mt-1">{kitab.kategori}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <UserIcon className="w-3 h-3 text-emerald-300" />
                    <span className="text-[10px] text-emerald-400 font-medium truncate max-w-[120px]">
                      {kitab.uploader_name}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-emerald-200" />
            </div>
            <h3 className="text-emerald-900 font-bold text-lg">Kitab Tidak Ditemukan</h3>
            <p className="text-emerald-500">Coba cari dengan kata kunci lain.</p>
          </div>
        )}
      </div>

      {/* FAB - Only for Google Users */}
      {user && !user.isAnonymous && (
        <Link 
          to="/upload"
          className="fixed bottom-8 right-8 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all z-40"
        >
          <Plus className="w-7 h-7" />
        </Link>
      )}
    </div>
  );
};

const UploadKitab = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('Fiqh');
  const [deskripsi, setDeskripsi] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!user || user.isAnonymous) {
    return <div className="p-8 text-center">Akses Ditolak. Silakan login dengan Google.</div>;
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !judul) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `kitab/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const pdfUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'kitab_list'), {
        judul,
        kategori,
        deskripsi,
        pdf_url: pdfUrl,
        uploader_id: user.uid,
        uploader_name: user.displayName || 'Contributor',
        timestamp: Date.now()
      });

      navigate('/');
    } catch (error) {
      console.error("Upload failed", error);
      alert("Gagal mengunggah kitab. Pastikan file adalah PDF.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50/30">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm text-emerald-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-emerald-900">Tambah Kitab Baru</h1>
        </div>

        <form onSubmit={handleUpload} className="bg-white rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-bold text-emerald-900 mb-2">Judul Kitab</label>
            <input 
              required
              type="text" 
              className="w-full bg-emerald-50/50 border-2 border-transparent focus:border-emerald-500 rounded-xl p-3.5 outline-none transition-all"
              placeholder="Contoh: Safinatun Najah"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-emerald-900 mb-2">Kategori</label>
            <select 
              className="w-full bg-emerald-50/50 border-2 border-transparent focus:border-emerald-500 rounded-xl p-3.5 outline-none transition-all"
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
            >
              {['Fiqh', 'Aqidah', 'Akhlak', 'Nahwu', 'Shorof', 'Hadits', 'Lainnya'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-emerald-900 mb-2">Deskripsi Singkat</label>
            <textarea 
              className="w-full bg-emerald-50/50 border-2 border-transparent focus:border-emerald-500 rounded-xl p-3.5 outline-none transition-all h-24 resize-none"
              placeholder="Tulis sedikit tentang kitab ini..."
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-emerald-900 mb-2">File PDF</label>
            <div className="relative">
              <input 
                required
                type="file" 
                accept="application/pdf"
                className="hidden" 
                id="pdf-upload"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label 
                htmlFor="pdf-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-2xl p-8 bg-emerald-50/30 cursor-pointer hover:bg-emerald-50 transition-all"
              >
                <Upload className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="text-emerald-600 font-medium">
                  {file ? file.name : "Pilih File PDF"}
                </span>
                <span className="text-emerald-300 text-xs mt-1">Maksimal 10MB</span>
              </label>
            </div>
          </div>

          <button 
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                <Plus className="w-5 h-5" />
                Simpan Kitab
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kitab, setKitab] = useState<Kitab | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'kitab_list'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const found = snapshot.docs.find(d => d.id === id);
      if (found) {
        setKitab({ id: found.id, ...found.data() } as Kitab);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-emerald-600" /></div>;
  if (!kitab) return <div className="p-8 text-center">Kitab tidak ditemukan.</div>;

  return (
    <div className="h-screen flex flex-col bg-emerald-900">
      <div className="bg-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-bold text-emerald-900 leading-tight line-clamp-1">{kitab.judul}</h2>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{kitab.kategori}</p>
          </div>
        </div>
        <a 
          href={kitab.pdf_url} 
          target="_blank" 
          rel="noreferrer"
          className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Unduh PDF
        </a>
      </div>
      
      <div className="flex-1 bg-emerald-800/20 overflow-hidden relative">
        {/* Simple PDF Viewer using iframe */}
        <iframe 
          src={`${kitab.pdf_url}#toolbar=0`} 
          className="w-full h-full border-none"
          title={kitab.judul}
        />
        
        {/* Overlay to prevent some interactions if needed */}
        <div className="absolute top-0 left-0 w-full h-12 pointer-events-none bg-gradient-to-b from-black/10 to-transparent"></div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-emerald-50">
        <div className="bg-emerald-600 p-4 rounded-2xl animate-bounce mb-4">
          <Book className="w-10 h-10 text-white" />
        </div>
        <p className="text-emerald-600 font-bold tracking-widest uppercase text-xs">Pustaka Diniyah</p>
      </div>
    );
  }

  return (
    <Router>
      <KotlinGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      <Routes>
        {!user ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            <Route path="/" element={<Home user={user} onShowGuide={() => setShowGuide(true)} />} />
            <Route path="/upload" element={<UploadKitab user={user} />} />
            <Route path="/read/:id" element={<Reader />} />
          </>
        )}
      </Routes>
    </Router>
  );
}
