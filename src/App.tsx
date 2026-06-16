/**
 * Sistem Akademik Madin Darul Dakwah
 * Stack: React 19 + TypeScript + Firebase + Tailwind CSS v4 (MD3)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  auth, db, googleProvider,
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged,
  collection, addDoc, getDocs, getDoc, onSnapshot,
  doc, deleteDoc, updateDoc, setDoc, where, query, orderBy, Timestamp, writeBatch,
  User
} from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  uid: string;
  nama: string;
  nip: string;
  email: string;
  role: 'guru' | 'admin';
  photoURL?: string;
}

interface Soal {
  id: string;
  kelas: string;
  mata_pelajaran: string;
  kategori: 'pg' | 'essai';
  nomor_soal: number;
  teks_soal: string;
  file_url?: string;
  pembuat_id: string;
  created_at: Timestamp;
}

interface Siswa {
  id: string;
  nama: string;
  nis: string;
  kelas: string;
  status: 'aktif' | 'lulus' | 'keluar';
}

interface NilaiEntry {
  id: string;
  siswa_id: string;
  siswa_nama: string;
  kelas: string;
  mata_pelajaran: string;
  nilai: number;
  guru_id: string;
  created_at: Timestamp;
}

interface JadwalItem {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  mata_pelajaran: string;
  kelas: string;
  ruang: string;
  guru_id: string;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

const KELAS_OPTIONS = ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'];
const MAPEL_OPTIONS = ['Nahwu', 'Shorf', 'Fiqih', 'Aqidah', 'Akhlak', 'Quran Hadits', 'Bahasa Arab'];
const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Shared Components ────────────────────────────────────────────────────────

const Icon = ({ name, className = '' }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const FloatingInput = ({
  id, label, type = 'text', value, onChange, required = false, autoComplete, rightIcon, onRightIconClick
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean; autoComplete?: string;
  rightIcon?: string; onRightIconClick?: () => void;
}) => (
  <div className="relative w-full">
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      autoComplete={autoComplete}
      placeholder=" "
      className="peer block w-full px-4 py-3 bg-transparent border border-outline rounded-xl
        focus:outline-none focus:border-2 focus:border-primary text-on-surface text-base
        transition-all"
    />
    <label
      htmlFor={id}
      className="absolute left-4 top-3 text-on-surface-variant text-sm duration-200 transform
        -translate-y-5 scale-75 origin-[0] bg-surface px-1
        peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0
        peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-primary z-10"
    >
      {label}
    </label>
    {rightIcon && (
      <button
        type="button"
        onClick={onRightIconClick}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
      >
        <Icon name={rightIcon} />
      </button>
    )}
  </div>
);

const TopAppBar = ({
  title, showBack = false, onBack, onSettings
}: {
  title: string; showBack?: boolean; onBack?: () => void; onSettings?: () => void;
}) => (
  <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-primary text-on-primary
    flex items-center px-4 gap-3 shadow-md">
    {showBack && (
      <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center
        hover:bg-white/20 active:scale-95 transition-all">
        <Icon name="arrow_back" />
      </button>
    )}
    <h1 className="flex-1 font-semibold text-lg">{title}</h1>
    {onSettings && (
      <button onClick={onSettings} className="w-10 h-10 rounded-full flex items-center justify-center
        hover:bg-white/20 active:scale-95 transition-all">
        <Icon name="manage_accounts" />
      </button>
    )}
  </header>
);

const BottomNav = ({ active }: { active: string }) => {
  const navigate = useNavigate();
  const items = [
    { label: 'Beranda', icon: 'home', path: '/beranda' },
    { label: 'Soal', icon: 'quiz', path: '/buat-soal' },
    { label: 'Siswa', icon: 'group', path: '/data-siswa' },
    { label: 'Nilai', icon: 'edit_note', path: '/input-nilai' },
    { label: 'Jadwal', icon: 'calendar_month', path: '/jadwal' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-surface border-t border-outline-variant
      flex items-center justify-around">
      {items.map(item => {
        const isActive = active === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all
              ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <Icon name={item.icon} className={isActive ? 'text-primary' : ''} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const Spinner = () => (
  <div className="flex items-center justify-center h-screen bg-surface">
    <div className="w-12 h-12 border-4 border-primary-container border-t-primary rounded-full animate-spin" />
  </div>
);

const EmptyState = ({ icon, message }: { icon: string; message: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
    <Icon name={icon} className="text-5xl text-outline" />
    <p className="text-sm">{message}</p>
  </div>
);

// ─── NIP Complete Modal ────────────────────────────────────────────────────────

const NipModal = ({ user, onComplete }: { user: User; onComplete: (profile: UserProfile) => void }) => {
  const [nama, setNama] = useState(user.displayName || '');
  const [nip, setNip] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const profile: UserProfile = {
      uid: user.uid,
      nama,
      nip,
      email: user.email || '',
      role: 'guru',
      photoURL: user.photoURL || undefined,
    };
    await setDoc(doc(db, 'users', user.uid), profile);
    onComplete(profile);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center">
            <Icon name="badge" className="text-on-primary-container" />
          </div>
          <div>
            <h2 className="font-semibold text-on-surface">Lengkapi Profil</h2>
            <p className="text-xs text-on-surface-variant">Masukkan data untuk melanjutkan</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FloatingInput id="m-nama" label="Nama Lengkap" value={nama} onChange={setNama} required />
          <FloatingInput id="m-nip" label="NIP (Nomor Induk Pegawai)" value={nip} onChange={setNip} required />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold
              hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
          >
            {loading ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Login Page ────────────────────────────────────────────────────────────────

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/beranda');
    } catch {
      setError('Email atau kata sandi salah.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/beranda');
    } catch {
      setError('Login Google gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-madin.jpg" alt="Logo" className="w-20 h-20 rounded-2xl object-cover shadow-lg mb-4" />
          <h1 className="text-2xl font-bold text-primary">Madin Darul Dakwah</h1>
          <p className="text-sm text-on-surface-variant mt-1">Sistem Akademik Madrasah</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant p-6">
          <h2 className="font-semibold text-on-surface mb-5 text-lg">Masuk</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-error-container text-on-error-container rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleEmail} className="flex flex-col gap-4">
            <FloatingInput id="l-email" label="Email" type="email" value={email} onChange={setEmail}
              required autoComplete="email" />
            <FloatingInput id="l-pass" label="Kata Sandi" type={showPass ? 'text' : 'password'}
              value={password} onChange={setPassword} required autoComplete="current-password"
              rightIcon={showPass ? 'visibility_off' : 'visibility'}
              onRightIconClick={() => setShowPass(!showPass)} />

            <button
              type="button"
              onClick={() => navigate('/lupa-password')}
              className="text-right text-sm text-primary hover:underline"
            >
              Lupa kata sandi?
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold
                hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-outline-variant flex-1" />
            <span className="text-xs text-on-surface-variant">atau</span>
            <div className="h-px bg-outline-variant flex-1" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-outline
              rounded-xl py-3 text-on-surface font-medium hover:bg-surface-container
              disabled:opacity-50 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Masuk dengan Google
          </button>

          <p className="text-center text-sm text-on-surface-variant mt-5">
            Belum punya akun?{' '}
            <button onClick={() => navigate('/daftar')} className="text-primary font-semibold hover:underline">
              Daftar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Register Page ─────────────────────────────────────────────────────────────

const Register = () => {
  const navigate = useNavigate();
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== konfirmasi) { setError('Kata sandi tidak cocok.'); return; }
    if (password.length < 6) { setError('Kata sandi minimal 6 karakter.'); return; }
    setLoading(true); setError('');
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const profile: UserProfile = { uid: result.user.uid, nama, nip, email, role: 'guru' };
      await setDoc(doc(db, 'users', result.user.uid), profile);
      navigate('/beranda');
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'auth/email-already-in-use') setError('Email sudah digunakan.');
      else setError('Gagal mendaftar. Periksa koneksi dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/beranda');
    } catch {
      setError('Daftar dengan Google gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/login')} className="w-10 h-10 rounded-full flex items-center
            justify-center text-on-surface hover:bg-surface-container transition-all">
            <Icon name="arrow_back" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-on-surface">Daftar Akun</h1>
            <p className="text-xs text-on-surface-variant">Madin Darul Dakwah</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant p-6">
          {error && (
            <div className="mb-4 px-4 py-3 bg-error-container text-on-error-container rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <FloatingInput id="r-nama" label="Nama Lengkap" value={nama} onChange={setNama} required />
            <FloatingInput id="r-nip" label="NIP" value={nip} onChange={setNip} required />
            <FloatingInput id="r-email" label="Email" type="email" value={email} onChange={setEmail}
              required autoComplete="email" />
            <FloatingInput id="r-pass" label="Kata Sandi" type={showPass ? 'text' : 'password'}
              value={password} onChange={setPassword} required
              rightIcon={showPass ? 'visibility_off' : 'visibility'}
              onRightIconClick={() => setShowPass(!showPass)} />
            <FloatingInput id="r-konfirmasi" label="Konfirmasi Kata Sandi"
              type={showPass ? 'text' : 'password'}
              value={konfirmasi} onChange={setKonfirmasi} required />

            <button type="submit" disabled={loading}
              className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold
                hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 mt-2">
              {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-outline-variant flex-1" />
            <span className="text-xs text-on-surface-variant">atau</span>
            <div className="h-px bg-outline-variant flex-1" />
          </div>

          <button onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-outline
              rounded-xl py-3 text-on-surface font-medium hover:bg-surface-container
              disabled:opacity-50 transition-all active:scale-95">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Daftar dengan Google
          </button>

          <p className="text-center text-sm text-on-surface-variant mt-5">
            Sudah punya akun?{' '}
            <button onClick={() => navigate('/login')} className="text-primary font-semibold hover:underline">
              Masuk
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Forgot Password Page ──────────────────────────────────────────────────────

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch {
      setError('Email tidak ditemukan atau tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/login')} className="w-10 h-10 rounded-full flex items-center
            justify-center text-on-surface hover:bg-surface-container transition-all">
            <Icon name="arrow_back" />
          </button>
          <h1 className="text-xl font-bold text-on-surface">Lupa Kata Sandi</h1>
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mb-4">
              <Icon name="lock_reset" className="text-3xl text-on-primary-container" />
            </div>
            <p className="text-sm text-on-surface-variant text-center">
              Masukkan email Anda. Kami akan mengirim tautan untuk mereset kata sandi.
            </p>
          </div>

          {sent ? (
            <div className="bg-secondary-container text-on-secondary-container rounded-xl px-4 py-4 text-sm text-center">
              <Icon name="mark_email_read" className="text-2xl mb-2" />
              <p>Tautan reset telah dikirim ke <strong>{email}</strong>. Periksa inbox Anda.</p>
              <button onClick={() => navigate('/login')} className="mt-3 text-primary font-semibold hover:underline text-sm">
                Kembali ke Login
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 bg-error-container text-on-error-container rounded-xl text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FloatingInput id="fp-email" label="Email" type="email" value={email}
                  onChange={setEmail} required autoComplete="email" />
                <button type="submit" disabled={loading}
                  className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold
                    hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Icon name="send" className="text-base" />
                  {loading ? 'Mengirim...' : 'Kirim Tautan'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Beranda ───────────────────────────────────────────────────────────────────

const Beranda = ({ profile }: { profile: UserProfile | null }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ soal: 0, siswa: 0, jadwal: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;
    Promise.all([
      getDocs(query(collection(db, 'soal'), where('pembuat_id', '==', auth.currentUser.uid))),
      getDocs(collection(db, 'siswa')),
      getDocs(query(collection(db, 'jadwal'), where('guru_id', '==', auth.currentUser.uid))),
    ]).then(([soalSnap, siswaSnap, jadwalSnap]) => {
      setStats({ soal: soalSnap.size, siswa: siswaSnap.size, jadwal: jadwalSnap.size });
    });
  }, []);

  const quickActions = [
    { icon: 'quiz', label: 'Buat Soal', sub: 'Buat soal ujian baru', path: '/buat-soal', color: 'bg-primary-container' },
    { icon: 'group', label: 'Data Siswa', sub: 'Kelola data siswa', path: '/data-siswa', color: 'bg-secondary-container' },
    { icon: 'edit_note', label: 'Input Nilai', sub: 'Catat nilai siswa', path: '/input-nilai', color: 'bg-tertiary-container' },
    { icon: 'calendar_month', label: 'Jadwal', sub: 'Lihat jadwal mengajar', path: '/jadwal', color: 'bg-surface-container-high' },
  ];

  return (
    <div className="min-h-screen bg-surface-container-low pb-20">
      <TopAppBar title="Beranda" onSettings={() => navigate('/pengaturan')} />
      <div className="pt-16 px-4">
        {/* Welcome */}
        <div className="mt-4 mb-5 bg-primary rounded-2xl p-5 text-on-primary relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -right-2 bottom-0 w-16 h-16 bg-white/5 rounded-full" />
          <p className="text-sm opacity-80">Ahlan wa Sahlan,</p>
          <h2 className="text-xl font-bold mt-0.5">
            {profile?.nama?.split(' ')[0] || 'Ustadz/Ustadzah'} 👋
          </h2>
          <p className="text-xs opacity-70 mt-1">NIP: {profile?.nip || '-'}</p>
          <div className="flex gap-4 mt-4">
            <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
              <p className="text-lg font-bold">{stats.soal}</p>
              <p className="text-[10px] opacity-80">Soal Dibuat</p>
            </div>
            <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
              <p className="text-lg font-bold">{stats.siswa}</p>
              <p className="text-[10px] opacity-80">Total Siswa</p>
            </div>
            <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
              <p className="text-lg font-bold">{stats.jadwal}</p>
              <p className="text-[10px] opacity-80">Jadwal</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h3 className="font-semibold text-on-surface mb-3">Menu Utama</h3>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(action => (
            <button key={action.path} onClick={() => navigate(action.path)}
              className="bg-surface rounded-2xl p-4 border border-outline-variant
                hover:border-primary hover:shadow-md transition-all active:scale-95 text-left">
              <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon name={action.icon} className="text-primary" />
              </div>
              <p className="font-semibold text-on-surface text-sm">{action.label}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{action.sub}</p>
            </button>
          ))}
        </div>
      </div>
      <BottomNav active="/beranda" />
    </div>
  );
};

// ─── Buat Soal ─────────────────────────────────────────────────────────────────

const BuatSoal = () => {
  const navigate = useNavigate();
  const [kelas, setKelas] = useState('');
  const [mapel, setMapel] = useState('');
  const [kategori, setKategori] = useState<'pg' | 'essai'>('pg');
  const [nomorSoal, setNomorSoal] = useState('');
  const [teksSoal, setTeksSoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [tab, setTab] = useState<'buat' | 'daftar'>('buat');

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'soal'),
      where('pembuat_id', '==', auth.currentUser.uid),
      orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setSoalList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Soal)));
      setLoadingList(false);
    });
    return () => unsub();
  }, []);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !kelas || !mapel || !teksSoal) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'soal'), {
        kelas, mata_pelajaran: mapel, kategori,
        nomor_soal: parseInt(nomorSoal) || 1,
        teks_soal: teksSoal,
        pembuat_id: auth.currentUser.uid,
        created_at: Timestamp.now(),
      });
      setTeksSoal(''); setNomorSoal(''); setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return;
    await deleteDoc(doc(db, 'soal', id));
  };

  return (
    <div className="min-h-screen bg-surface-container-low pb-20">
      <TopAppBar title="Buat Soal" onSettings={() => navigate('/pengaturan')} />
      <div className="pt-16">
        {/* Tabs */}
        <div className="flex border-b border-outline-variant bg-surface">
          {(['buat', 'daftar'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-all border-b-2 ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'
              }`}>
              {t === 'buat' ? 'Buat Soal Baru' : `Daftar Soal (${soalList.length})`}
            </button>
          ))}
        </div>

        <div className="px-4 py-4">
          {tab === 'buat' ? (
            <form onSubmit={handleSimpan} className="flex flex-col gap-4">
              {success && (
                <div className="bg-secondary-container text-on-secondary-container rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                  <Icon name="check_circle" /> Soal berhasil disimpan!
                </div>
              )}

              {/* Kelas */}
              <div className="relative">
                <select value={kelas} onChange={e => setKelas(e.target.value)} required
                  className="peer w-full px-4 py-3 bg-transparent border border-outline rounded-xl
                    appearance-none focus:outline-none focus:border-2 focus:border-primary text-on-surface">
                  <option value="" disabled hidden></option>
                  {KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <label className="absolute left-4 top-3 text-on-surface-variant text-sm duration-200
                  -translate-y-5 scale-75 origin-[0] bg-surface-container-low px-1 z-10
                  peer-[&:not(:placeholder-shown)]:-translate-y-5 peer-[&:not(:placeholder-shown)]:scale-75">
                  Pilih Kelas
                </label>
                <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>

              {/* Mapel */}
              <div className="relative">
                <select value={mapel} onChange={e => setMapel(e.target.value)} required
                  className="peer w-full px-4 py-3 bg-transparent border border-outline rounded-xl
                    appearance-none focus:outline-none focus:border-2 focus:border-primary text-on-surface">
                  <option value="" disabled hidden></option>
                  {MAPEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <label className="absolute left-4 top-3 text-on-surface-variant text-sm duration-200
                  -translate-y-5 scale-75 origin-[0] bg-surface-container-low px-1 z-10">
                  Mata Pelajaran
                </label>
                <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>

              {/* Kategori */}
              <div>
                <p className="text-xs text-on-surface-variant mb-2 px-1">Kategori Soal</p>
                <div className="flex gap-3">
                  {(['pg', 'essai'] as const).map(k => (
                    <label key={k} className={`flex-1 flex items-center justify-center gap-2 py-3
                      border rounded-xl cursor-pointer transition-all
                      ${kategori === k ? 'border-primary bg-primary/5 text-primary' : 'border-outline text-on-surface'}`}>
                      <input type="radio" name="kategori" value={k} checked={kategori === k}
                        onChange={() => setKategori(k)} className="sr-only" />
                      <Icon name={k === 'pg' ? 'radio_button_checked' : 'edit'} className="text-base" />
                      <span className="text-sm font-medium">{k === 'pg' ? 'Pilihan Ganda' : 'Essai'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Nomor Soal */}
              <FloatingInput id="nomor" label="Nomor Soal" type="number" value={nomorSoal} onChange={setNomorSoal} />

              {/* Teks Soal (RTL Pegon) */}
              <div className="flex flex-col">
                <label className="text-xs text-primary mb-2 text-right font-medium">
                  Soal (Arab / Pegon) - RTL
                </label>
                <div className="border border-outline-variant rounded-xl overflow-hidden focus-within:border-primary focus-within:border-2">
                  <div className="flex items-center justify-end gap-1 px-2 py-1.5 bg-surface-container border-b border-outline-variant">
                    <button type="button" className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-variant">
                      <Icon name="format_bold" className="text-base text-on-surface-variant" />
                    </button>
                    <button type="button" className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-variant">
                      <Icon name="format_italic" className="text-base text-on-surface-variant" />
                    </button>
                    <div className="w-px h-4 bg-outline-variant mx-1" />
                    <button type="button" className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-variant">
                      <Icon name="format_align_right" className="text-base text-on-surface-variant" />
                    </button>
                  </div>
                  <textarea
                    dir="rtl" lang="ar"
                    value={teksSoal}
                    onChange={e => setTeksSoal(e.target.value)}
                    placeholder="...اكتب السؤال هنا"
                    rows={5}
                    className="w-full p-4 bg-transparent border-none focus:ring-0 text-on-surface
                      text-right resize-none leading-loose placeholder:text-on-surface-variant/50 text-base"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading || !kelas || !mapel || !teksSoal}
                className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold
                  hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2">
                <Icon name="save" className="text-base" />
                {loading ? 'Menyimpan...' : 'Simpan Soal'}
              </button>
            </form>
          ) : (
            <div>
              {loadingList ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary-container border-t-primary rounded-full animate-spin" /></div>
              ) : soalList.length === 0 ? (
                <EmptyState icon="quiz" message="Belum ada soal. Buat soal baru!" />
              ) : (
                <div className="flex flex-col gap-3">
                  {soalList.map(soal => (
                    <div key={soal.id} className="bg-surface rounded-xl border border-outline-variant p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-medium">
                              {soal.kelas}
                            </span>
                            <span className="text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                              {soal.mata_pelajaran}
                            </span>
                            <span className="text-xs text-on-surface-variant">No. {soal.nomor_soal}</span>
                          </div>
                          <p className="text-sm text-on-surface text-right dir-rtl leading-relaxed line-clamp-2"
                            dir="rtl">{soal.teks_soal}</p>
                        </div>
                        <button onClick={() => handleDelete(soal.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center
                            text-error hover:bg-error-container transition-all shrink-0">
                          <Icon name="delete" className="text-base" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNav active="/buat-soal" />
    </div>
  );
};

// ─── Data Siswa ────────────────────────────────────────────────────────────────

const DataSiswa = () => {
  const navigate = useNavigate();
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSiswa, setEditSiswa] = useState<Siswa | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [nama, setNama] = useState('');
  const [nis, setNis] = useState('');
  const [kelas, setKelas] = useState('');
  const [status, setStatus] = useState<'aktif' | 'lulus' | 'keluar'>('aktif');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'siswa'), orderBy('nama')), snap => {
      setSiswaList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Siswa)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditSiswa(null);
    setNama(''); setNis(''); setKelas(''); setStatus('aktif');
    setShowModal(true);
  };

  const openEdit = (s: Siswa) => {
    setEditSiswa(s);
    setNama(s.nama); setNis(s.nis); setKelas(s.kelas); setStatus(s.status);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = { nama, nis, kelas, status };
    if (editSiswa) {
      await updateDoc(doc(db, 'siswa', editSiswa.id), data);
    } else {
      await addDoc(collection(db, 'siswa'), data);
    }
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data siswa ini?')) return;
    await deleteDoc(doc(db, 'siswa', id));
  };

  // Export Excel
  const handleExport = () => {
    const data = siswaList.map(s => ({
      Nama: s.nama, NIS: s.nis, Kelas: s.kelas, Status: s.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
    XLSX.writeFile(wb, 'data_siswa_madin.xlsx');
  };

  // Import Excel
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws);
      const batch = writeBatch(db);
      rows.forEach(row => {
        const ref2 = doc(collection(db, 'siswa'));
        batch.set(ref2, {
          nama: row['Nama'] || '',
          nis: row['NIS'] || '',
          kelas: row['Kelas'] || '',
          status: (row['Status'] as 'aktif' | 'lulus' | 'keluar') || 'aktif',
        });
      });
      await batch.commit();
      alert(`${rows.length} siswa berhasil diimpor!`);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const filtered = siswaList.filter(s =>
    s.nama.toLowerCase().includes(search.toLowerCase()) ||
    s.nis.includes(search) ||
    s.kelas.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    aktif: 'bg-secondary-container text-on-secondary-container',
    lulus: 'bg-tertiary-container text-on-tertiary-container',
    keluar: 'bg-error-container text-on-error-container',
  };

  return (
    <div className="min-h-screen bg-surface-container-low pb-20">
      <TopAppBar title="Data Siswa" onSettings={() => navigate('/pengaturan')} />
      <div className="pt-16 px-4">
        {/* Search */}
        <div className="mt-4 mb-3 relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau kelas..."
            className="w-full pl-11 pr-4 py-3 bg-surface rounded-full border border-outline-variant
              focus:outline-none focus:border-primary text-on-surface text-sm" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          <button onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1.5 border border-outline
              py-2 rounded-xl text-on-surface text-sm hover:bg-surface-container transition-all">
            <Icon name="download" className="text-base" />
            Export Excel
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 border border-outline
              py-2 rounded-xl text-on-surface text-sm hover:bg-surface-container transition-all">
            <Icon name="upload" className="text-base" />
            Import Excel
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        </div>

        {/* Stats */}
        <p className="text-xs text-on-surface-variant mb-3">
          {filtered.length} dari {siswaList.length} siswa
        </p>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary-container border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="group" message="Belum ada data siswa." />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(siswa => (
              <div key={siswa.id} className="bg-surface rounded-xl border border-outline-variant p-4
                flex items-center gap-3 hover:border-primary transition-all">
                <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center
                  text-on-primary-container font-semibold text-sm shrink-0">
                  {getInitials(siswa.nama)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-on-surface text-sm truncate">{siswa.nama}</p>
                  <p className="text-xs text-on-surface-variant">{siswa.kelas} · NIS: {siswa.nis}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor[siswa.status]}`}>
                  {siswa.status}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(siswa)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10">
                    <Icon name="edit" className="text-base" />
                  </button>
                  <button onClick={() => handleDelete(siswa.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error-container">
                    <Icon name="delete" className="text-base" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={openAdd}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-on-primary rounded-2xl
          shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all z-40">
        <Icon name="person_add" />
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-on-surface">{editSiswa ? 'Edit Siswa' : 'Tambah Siswa'}</h3>
              <button onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <FloatingInput id="s-nama" label="Nama Lengkap" value={nama} onChange={setNama} required />
              <FloatingInput id="s-nis" label="NIS" value={nis} onChange={setNis} required />
              <div className="relative">
                <select value={kelas} onChange={e => setKelas(e.target.value)} required
                  className="w-full px-4 py-3 bg-transparent border border-outline rounded-xl
                    appearance-none focus:outline-none focus:border-primary text-on-surface">
                  <option value="" disabled>Pilih Kelas</option>
                  {KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>
              <div className="relative">
                <select value={status} onChange={e => setStatus(e.target.value as 'aktif' | 'lulus' | 'keluar')}
                  className="w-full px-4 py-3 bg-transparent border border-outline rounded-xl
                    appearance-none focus:outline-none focus:border-primary text-on-surface">
                  <option value="aktif">Aktif</option>
                  <option value="lulus">Lulus</option>
                  <option value="keluar">Keluar</option>
                </select>
                <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl border border-outline text-on-surface text-sm font-medium">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold
                    disabled:opacity-50 hover:opacity-90 active:scale-95 transition-all">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav active="/data-siswa" />
    </div>
  );
};

// ─── Input Nilai ───────────────────────────────────────────────────────────────

const InputNilai = () => {
  const navigate = useNavigate();
  const [kelas, setKelas] = useState('');
  const [mapel, setMapel] = useState('');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [nilaiMap, setNilaiMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!kelas) { setSiswaList([]); return; }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'siswa'), where('kelas', '==', kelas), orderBy('nama')),
      snap => {
        setSiswaList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Siswa)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [kelas]);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !kelas || !mapel) return;
    setSaving(true);
    const batch = writeBatch(db);
    siswaList.forEach(siswa => {
      const nilai = parseFloat(nilaiMap[siswa.id] || '0');
      if (isNaN(nilai)) return;
      const ref2 = doc(collection(db, 'nilai'));
      batch.set(ref2, {
        siswa_id: siswa.id,
        siswa_nama: siswa.nama,
        kelas, mata_pelajaran: mapel,
        nilai,
        guru_id: auth.currentUser!.uid,
        created_at: Timestamp.now(),
      });
    });
    await batch.commit();
    setSaving(false);
    setNilaiMap({});
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <div className="min-h-screen bg-surface-container-low pb-20">
      <TopAppBar title="Input Nilai" onSettings={() => navigate('/pengaturan')} />
      <div className="pt-16 px-4 py-4">
        {success && (
          <div className="mb-4 bg-secondary-container text-on-secondary-container rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <Icon name="check_circle" /> Nilai berhasil disimpan!
          </div>
        )}

        <form onSubmit={handleSimpan} className="flex flex-col gap-4">
          {/* Kelas */}
          <div className="relative">
            <select value={kelas} onChange={e => setKelas(e.target.value)} required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl
                appearance-none focus:outline-none focus:border-primary text-on-surface">
              <option value="" disabled>Pilih Kelas</option>
              {KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
          </div>

          {/* Mapel */}
          <div className="relative">
            <select value={mapel} onChange={e => setMapel(e.target.value)} required
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl
                appearance-none focus:outline-none focus:border-primary text-on-surface">
              <option value="" disabled>Pilih Mata Pelajaran</option>
              {MAPEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
          </div>

          {/* List Siswa + Input Nilai */}
          {loading ? (
            <div className="flex justify-center py-6"><div className="w-8 h-8 border-4 border-primary-container border-t-primary rounded-full animate-spin" /></div>
          ) : kelas && siswaList.length === 0 ? (
            <EmptyState icon="group" message="Tidak ada siswa aktif di kelas ini." />
          ) : siswaList.length > 0 ? (
            <div className="flex flex-col gap-2">
              {siswaList.map(siswa => (
                <div key={siswa.id} className="bg-surface rounded-xl border border-outline-variant p-3 flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-container rounded-full flex items-center justify-center
                    text-on-primary-container font-semibold text-xs shrink-0">
                    {getInitials(siswa.nama)}
                  </div>
                  <p className="flex-1 text-sm text-on-surface font-medium truncate">{siswa.nama}</p>
                  <input
                    type="number" min="0" max="100" placeholder="0"
                    value={nilaiMap[siswa.id] || ''}
                    onChange={e => setNilaiMap(prev => ({ ...prev, [siswa.id]: e.target.value }))}
                    className="w-20 text-center border border-outline-variant rounded-xl py-2 px-2
                      focus:outline-none focus:border-primary text-on-surface text-sm bg-transparent"
                  />
                </div>
              ))}

              <button type="submit" disabled={saving || !mapel}
                className="w-full bg-primary text-on-primary py-4 rounded-xl font-semibold mt-2
                  hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2">
                <Icon name="save" className="text-base" />
                {saving ? 'Menyimpan...' : 'Simpan Semua Nilai'}
              </button>
            </div>
          ) : (
            <EmptyState icon="edit_note" message="Pilih kelas untuk melihat daftar siswa." />
          )}
        </form>
      </div>
      <BottomNav active="/input-nilai" />
    </div>
  );
};

// ─── Jadwal Mengajar ───────────────────────────────────────────────────────────

const JadwalMengajar = () => {
  const navigate = useNavigate();
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<JadwalItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [hari, setHari] = useState('');
  const [jamMulai, setJamMulai] = useState('');
  const [jamSelesai, setJamSelesai] = useState('');
  const [mapel, setMapel] = useState('');
  const [kelas, setKelas] = useState('');
  const [ruang, setRuang] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(
      query(collection(db, 'jadwal'), where('guru_id', '==', auth.currentUser.uid), orderBy('hari')),
      snap => {
        setJadwalList(snap.docs.map(d => ({ id: d.id, ...d.data() } as JadwalItem)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditItem(null);
    setHari(''); setJamMulai(''); setJamSelesai(''); setMapel(''); setKelas(''); setRuang('');
    setShowModal(true);
  };

  const openEdit = (item: JadwalItem) => {
    setEditItem(item);
    setHari(item.hari); setJamMulai(item.jam_mulai); setJamSelesai(item.jam_selesai);
    setMapel(item.mata_pelajaran); setKelas(item.kelas); setRuang(item.ruang);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    const data = {
      hari, jam_mulai: jamMulai, jam_selesai: jamSelesai,
      mata_pelajaran: mapel, kelas, ruang,
      guru_id: auth.currentUser.uid,
    };
    if (editItem) {
      await updateDoc(doc(db, 'jadwal', editItem.id), data);
    } else {
      await addDoc(collection(db, 'jadwal'), data);
    }
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus jadwal ini?')) return;
    await deleteDoc(doc(db, 'jadwal', id));
  };

  const hariOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const grouped = hariOrder.reduce<Record<string, JadwalItem[]>>((acc, h) => {
    const items = jadwalList.filter(j => j.hari === h);
    if (items.length > 0) acc[h] = items;
    return acc;
  }, {});

  const hariColors: Record<string, string> = {
    Senin: 'bg-primary-container text-on-primary-container',
    Selasa: 'bg-secondary-container text-on-secondary-container',
    Rabu: 'bg-tertiary-container text-on-tertiary-container',
    Kamis: 'bg-primary-container text-on-primary-container',
    Jumat: 'bg-error-container text-on-error-container',
    Sabtu: 'bg-surface-container-high text-on-surface',
  };

  return (
    <div className="min-h-screen bg-surface-container-low pb-20">
      <TopAppBar title="Jadwal Mengajar" onSettings={() => navigate('/pengaturan')} />
      <div className="pt-16 px-4 py-4">
        {loading ? (
          <Spinner />
        ) : Object.keys(grouped).length === 0 ? (
          <EmptyState icon="calendar_month" message="Belum ada jadwal. Tambah jadwal baru!" />
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([h, items]) => (
              <div key={h}>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold mb-2 ${hariColors[h]}`}>
                  <Icon name="calendar_today" className="text-sm" />
                  {h}
                </div>
                <div className="flex flex-col gap-2">
                  {items.sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai)).map(item => (
                    <div key={item.id} className="bg-surface rounded-xl border border-outline-variant p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-on-surface">{item.mata_pelajaran}</p>
                          <p className="text-sm text-on-surface-variant">{item.kelas} · {item.ruang}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Icon name="schedule" className="text-sm text-primary" />
                            <span className="text-sm text-primary font-medium">
                              {item.jam_mulai} – {item.jam_selesai}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10">
                            <Icon name="edit" className="text-base" />
                          </button>
                          <button onClick={() => handleDelete(item.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error-container">
                            <Icon name="delete" className="text-base" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={openAdd}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-on-primary rounded-2xl
          shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all z-40">
        <Icon name="add" />
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-on-surface">{editItem ? 'Edit Jadwal' : 'Tambah Jadwal'}</h3>
              <button onClick={() => setShowModal(false)} className="text-on-surface-variant">
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="relative">
                <select value={hari} onChange={e => setHari(e.target.value)} required
                  className="w-full px-4 py-3 bg-transparent border border-outline rounded-xl
                    appearance-none focus:outline-none focus:border-primary text-on-surface">
                  <option value="" disabled>Pilih Hari</option>
                  {HARI_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input type="time" value={jamMulai} onChange={e => setJamMulai(e.target.value)} required
                    className="w-full px-3 py-3 bg-transparent border border-outline rounded-xl
                      focus:outline-none focus:border-primary text-on-surface text-sm" />
                  <label className="absolute -top-2 left-3 text-xs text-on-surface-variant bg-surface px-1">Jam Mulai</label>
                </div>
                <div className="relative">
                  <input type="time" value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} required
                    className="w-full px-3 py-3 bg-transparent border border-outline rounded-xl
                      focus:outline-none focus:border-primary text-on-surface text-sm" />
                  <label className="absolute -top-2 left-3 text-xs text-on-surface-variant bg-surface px-1">Jam Selesai</label>
                </div>
              </div>
              <div className="relative">
                <select value={mapel} onChange={e => setMapel(e.target.value)} required
                  className="w-full px-4 py-3 bg-transparent border border-outline rounded-xl
                    appearance-none focus:outline-none focus:border-primary text-on-surface">
                  <option value="" disabled>Mata Pelajaran</option>
                  {MAPEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>
              <div className="relative">
                <select value={kelas} onChange={e => setKelas(e.target.value)} required
                  className="w-full px-4 py-3 bg-transparent border border-outline rounded-xl
                    appearance-none focus:outline-none focus:border-primary text-on-surface">
                  <option value="" disabled>Kelas</option>
                  {KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <Icon name="arrow_drop_down" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>
              <FloatingInput id="j-ruang" label="Ruang / Lokasi" value={ruang} onChange={setRuang} />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl border border-outline text-on-surface text-sm font-medium">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold
                    disabled:opacity-50 hover:opacity-90 active:scale-95 transition-all">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav active="/jadwal" />
    </div>
  );
};

// ─── Pengaturan ────────────────────────────────────────────────────────────────

const Pengaturan = ({ profile, onLogout }: { profile: UserProfile | null; onLogout: () => void }) => {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [nama, setNama] = useState(profile?.nama || '');
  const [nip, setNip] = useState(profile?.nip || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { nama, nip });
    setSaving(false);
    setShowEditModal(false);
  };

  const handleLogout = async () => {
    if (!confirm('Yakin ingin keluar?')) return;
    await signOut(auth);
    onLogout();
  };

  const menuItems = [
    { icon: 'person', label: 'Edit Profil', action: () => { setNama(profile?.nama || ''); setNip(profile?.nip || ''); setShowEditModal(true); } },
    { icon: 'lock', label: 'Ganti Kata Sandi', action: () => setShowPassModal(true) },
    { icon: 'info', label: 'Tentang Aplikasi', action: () => alert('Madin Darul Dakwah v1.0\nSistem Akademik Madrasah Diniyah') },
  ];

  return (
    <div className="min-h-screen bg-surface-container-low pb-20">
      <TopAppBar title="Pengaturan" showBack onBack={() => navigate(-1)} />
      <div className="pt-16 px-4 py-4">
        {/* Profile Card */}
        <div className="bg-primary rounded-2xl p-5 mb-5 text-on-primary">
          <div className="flex items-center gap-4">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-white/30" />
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                {profile?.nama ? getInitials(profile.nama) : '?'}
              </div>
            )}
            <div>
              <p className="font-bold text-lg">{profile?.nama || 'Belum diisi'}</p>
              <p className="text-sm opacity-80">NIP: {profile?.nip || '-'}</p>
              <p className="text-xs opacity-60 mt-0.5">{profile?.email || auth.currentUser?.email}</p>
              <span className="inline-block bg-white/20 text-xs px-2 py-0.5 rounded-full mt-1">
                {profile?.role || 'guru'}
              </span>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden mb-4">
          {menuItems.map((item, i) => (
            <button key={item.label} onClick={item.action}
              className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-container
                transition-all text-left ${i < menuItems.length - 1 ? 'border-b border-outline-variant' : ''}`}>
              <div className="w-9 h-9 bg-surface-container rounded-full flex items-center justify-center">
                <Icon name={item.icon} className="text-primary" />
              </div>
              <span className="flex-1 text-on-surface font-medium">{item.label}</span>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </button>
          ))}
        </div>

        <button onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-4 bg-surface rounded-2xl border border-outline-variant
            hover:bg-error-container hover:border-error transition-all text-left">
          <div className="w-9 h-9 bg-error-container rounded-full flex items-center justify-center">
            <Icon name="logout" className="text-error" />
          </div>
          <span className="flex-1 text-error font-medium">Keluar</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-on-surface">Edit Profil</h3>
              <button onClick={() => setShowEditModal(false)} className="text-on-surface-variant"><Icon name="close" /></button>
            </div>
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <FloatingInput id="p-nama" label="Nama Lengkap" value={nama} onChange={setNama} required />
              <FloatingInput id="p-nip" label="NIP" value={nip} onChange={setNip} required />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 rounded-xl border border-outline text-on-surface text-sm">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold
                    disabled:opacity-50 hover:opacity-90 transition-all">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPassModal && <ChangePasswordModal onClose={() => setShowPassModal(false)} />}

      <BottomNav active="" />
    </div>
  );
};

const ChangePasswordModal = ({ onClose }: { onClose: () => void }) => {
  const [newPass, setNewPass] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== konfirmasi) { setError('Kata sandi tidak cocok.'); return; }
    if (newPass.length < 6) { setError('Minimal 6 karakter.'); return; }
    setLoading(true); setError('');
    try {
      const { updatePassword } = await import('firebase/auth');
      await updatePassword(auth.currentUser!, newPass);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch {
      setError('Gagal mengubah kata sandi. Silakan login ulang terlebih dahulu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-on-surface">Ganti Kata Sandi</h3>
          <button onClick={onClose} className="text-on-surface-variant"><Icon name="close" /></button>
        </div>
        {success ? (
          <div className="text-center py-4">
            <Icon name="check_circle" className="text-4xl text-primary mb-2" />
            <p className="text-on-surface font-medium">Kata sandi berhasil diubah!</p>
          </div>
        ) : (
          <form onSubmit={handleChange} className="flex flex-col gap-4">
            {error && <div className="px-4 py-3 bg-error-container text-on-error-container rounded-xl text-sm">{error}</div>}
            <FloatingInput id="np-pass" label="Kata Sandi Baru" type="password" value={newPass} onChange={setNewPass} required />
            <FloatingInput id="np-konfirmasi" label="Konfirmasi Kata Sandi" type="password" value={konfirmasi} onChange={setKonfirmasi} required />
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-outline text-on-surface text-sm">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold
                  disabled:opacity-50 hover:opacity-90 transition-all">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [needNip, setNeedNip] = useState(false);

  const loadProfile = useCallback(async (u: User) => {
    const snap = await getDoc(doc(db, 'users', u.uid));
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
      setNeedNip(false);
    } else {
      setNeedNip(true);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        await loadProfile(u);
      } else {
        setProfile(null);
        setNeedNip(false);
      }
      setInitializing(false);
    });
    return () => unsub();
  }, [loadProfile]);

  if (initializing) return <Spinner />;

  return (
    <Router>
      {/* NIP completion overlay for Google users without profile */}
      {user && needNip && (
        <NipModal user={user} onComplete={p => { setProfile(p); setNeedNip(false); }} />
      )}

      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/daftar" element={<Register />} />
            <Route path="/lupa-password" element={<ForgotPassword />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/beranda" element={<Beranda profile={profile} />} />
            <Route path="/buat-soal" element={<BuatSoal />} />
            <Route path="/data-siswa" element={<DataSiswa />} />
            <Route path="/input-nilai" element={<InputNilai />} />
            <Route path="/jadwal" element={<JadwalMengajar />} />
            <Route path="/pengaturan" element={
              <Pengaturan profile={profile} onLogout={() => { setUser(null); setProfile(null); }} />
            } />
            <Route path="*" element={<Navigate to="/beranda" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}
