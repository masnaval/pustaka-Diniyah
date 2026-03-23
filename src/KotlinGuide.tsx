import React from 'react';
import { X, Code, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';

const CodeBlock = ({ title, code }: { title: string, code: string }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-emerald-900 font-bold text-sm">{title}</h4>
        <button onClick={copy} className="text-emerald-400 hover:text-emerald-600 transition-colors">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="bg-emerald-900 text-emerald-50 p-4 rounded-xl text-xs overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
    </div>
  );
};

export const KotlinGuide = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-emerald-50 flex items-center justify-between bg-emerald-600 text-white">
          <div className="flex items-center gap-2">
            <Code className="w-6 h-6" />
            <h2 className="text-xl font-bold">Panduan Kotlin (Android)</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-700 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-emerald-50/20">
          <p className="text-emerald-600 text-sm mb-6">Berikut adalah panduan kode Kotlin untuk implementasi di Android Studio.</p>
          
          <CodeBlock 
            title="1. Gradle Dependencies (build.gradle)"
            code={`// Firebase
implementation("com.google.firebase:firebase-auth-ktx:22.3.1")
implementation("com.google.firebase:firebase-firestore-ktx:24.10.3")
implementation("com.google.firebase:firebase-storage-ktx:20.3.0")

// Google Sign-In
implementation("com.google.android.gms:play-services-auth:21.0.0")

// PDF Viewer (Lightweight)
implementation("com.github.barteksc:android-pdf-viewer:2.8.2")`}
          />

          <CodeBlock 
            title="2. Data Model (Kitab.kt)"
            code={`data class Kitab(
    val id: String = "",
    val judul: String = "",
    val deskripsi: String = "",
    val kategori: String = "",
    val pdf_url: String = "",
    val uploader_id: String = "",
    val uploader_name: String = "",
    val timestamp: Long = 0
)`}
          />

          <CodeBlock 
            title="3. Firebase Setup (FirebaseUtils.kt)"
            code={`object FirebaseUtils {
    val auth = FirebaseAuth.getInstance()
    val db = FirebaseFirestore.getInstance()
    val storage = FirebaseStorage.getInstance().reference

    fun uploadKitab(kitab: Kitab, fileUri: Uri, onSuccess: () -> Unit) {
        val fileRef = storage.child("kitab/\${System.currentTimeMillis()}.pdf")
        fileRef.putFile(fileUri).addOnSuccessListener {
            fileRef.downloadUrl.addOnSuccessListener { uri ->
                val newKitab = kitab.copy(pdf_url = uri.toString())
                db.collection("kitab_list").add(newKitab).addOnSuccessListener {
                    onSuccess()
                }
            }
        }
    }
}`}
          />

          <CodeBlock 
            title="4. UI Dasar (Compose Home)"
            code={`@Composable
fun KitabItem(kitab: Kitab, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(8.dp).clickable { onClick() },
        elevation = 4.dp
    ) {
        Row(modifier = Modifier.padding(16.dp)) {
            Icon(Icons.Default.Book, contentDescription = null)
            Column(modifier = Modifier.padding(start = 16.dp)) {
                Text(kitab.judul, fontWeight = FontWeight.Bold)
                Text(kitab.kategori, style = MaterialTheme.typography.caption)
            }
        }
    }
}`}
          />
        </div>
      </motion.div>
    </div>
  );
};
