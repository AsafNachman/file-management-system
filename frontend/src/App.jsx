import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import axios from 'axios';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBHuwDGjrydPyMvfFGcKrecbtEUbJbI9RA",
  authDomain: "file-manager-task.firebaseapp.com",
  projectId: "file-manager-task",
  storageBucket: "file-manager-task.firebasestorage.app",
  messagingSenderId: "313855747442",
  appId: "1:313855747442:web:a00e1442f7625bf79029eb",
  measurementId: "G-SC90F6F0R2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const API_URL = "https://file-backend-313855747442.us-central1.run.app";

// --- UI Components ---
const Button = ({ onClick, children, variant = 'primary', style }) => {
    const baseStyle = {
        padding: '10px 16px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'background 0.2s',
        ...style
    };

    const variants = {
        primary: { background: '#3b82f6', color: 'white' },
        danger: { background: '#ef4444', color: 'white' },
        outline: { background: 'transparent', border: '1px solid currentColor' },
    };

    return (
        <button onClick={onClick} style={{ ...baseStyle, ...variants[variant] }}>
            {children}
        </button>
    );
};

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [sortBy, setSortBy] = useState("date");
  const [filterType, setFilterType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // *** THEME ***
  const theme = {
    bg: isDarkMode ? '#0f172a' : '#f3f4f6',
    containerBg: isDarkMode ? '#1e293b' : '#ffffff',
    text: isDarkMode ? '#f1f5f9' : '#1e293b',
    subText: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    hover: isDarkMode ? '#334155' : '#f1f5f9',
    shadow: isDarkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.5)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  useEffect(() => {
    // FORCE BODY TO FILL SCREEN
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.width = '100%';
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.text;
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    document.body.style.transition = 'background-color 0.3s ease';
  }, [isDarkMode, theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const accessToken = await currentUser.getIdToken();
        setUser(currentUser);
        setToken(accessToken);
        
        const savedTheme = localStorage.getItem(`darkMode_${currentUser.uid}`);
        setIsDarkMode(savedTheme === 'true');

        fetchFiles(accessToken);
      } else {
        setUser(null);
        setToken("");
        setFiles([]);
        setIsDarkMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (user) localStorage.setItem(`darkMode_${user.uid}`, newMode);
  };

  const fetchFiles = async (authToken, sort = sortBy, filter = filterType, search = searchQuery) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (sort) params.append("sort_by", sort);
      if (filter) params.append("file_type", filter);
      if (search) params.append("search", search);

      const response = await axios.get(`${API_URL}/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleUpload = async (event) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setLoading(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const data = new FormData();
        data.append("file", selectedFiles[i]);
        await axios.post(`${API_URL}/upload`, data, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
        });
      }
      fetchFiles(token);
    } catch (error) {
      alert("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    try {
      await axios.delete(`${API_URL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(files.filter(f => f.id !== fileId));
    } catch (error) {
      alert("Error deleting file.");
    }
  };

  const handleDownload = async (fileId, filename) => {
    try {
        const response = await axios.get(`${API_URL}/files/${fileId}/download`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob', 
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        alert("Download failed.");
    }
  };

  const applyFilters = () => { if (token) fetchFiles(token, sortBy, filterType, searchQuery); };

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
    color: theme.text,
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div style={{ 
          display: 'flex', 
          height: '100vh', 
          width: '100vw',  // Full viewport width
          justifyContent: 'center', 
          alignItems: 'center', 
          flexDirection: 'column', 
          gap: '20px',
          margin: 0
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: 0 }}>File Management App</h1>
        <p style={{ color: theme.subText, marginTop: '-10px' }}>Secure Cloud Storage</p>
        <Button onClick={handleLogin}>Sign in with Google</Button>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div style={{ 
        minHeight: '100vh', 
        width: '100vw',             // FIX: Force full viewport width
        margin: 0,                  // FIX: Remove margins
        padding: '40px 20px', 
        display: 'flex', 
        justifyContent: 'center',   // FIX: Center horizontally
        alignItems: 'flex-start',   
        boxSizing: 'border-box',    // FIX: Handle padding correctly
        overflowX: 'hidden'         // FIX: Prevent accidental scrollbars
    }}>
      
      {/* Main Card Container */}
      <div style={{ 
          width: '100%', 
          maxWidth: '900px',        
          backgroundColor: theme.containerBg, 
          borderRadius: '16px', 
          boxShadow: theme.shadow,
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          gap: '30px'
      }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.border}`, paddingBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>File Management App</h2>
            <p style={{ margin: '5px 0 0', fontSize: '0.9rem', color: theme.subText }}>Welcome back, {user.displayName}</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="outline" onClick={toggleTheme} style={{ color: theme.text, borderColor: theme.border }}>
              {isDarkMode ? '🌙' : '☀️'}
            </Button>
            <Button variant="outline" onClick={handleLogout} style={{ color: theme.text, borderColor: theme.border }}>
              Logout
            </Button>
          </div>
        </header>

        {/* Upload Area */}
        <section style={{ 
            border: `2px dashed ${theme.border}`, 
            borderRadius: '12px', 
            padding: '40px', 
            textAlign: 'center',
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f9fafb',
            transition: 'border-color 0.2s'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>☁️</div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>Upload your files</h3>
          <p style={{ color: theme.subText, fontSize: '0.9rem', marginBottom: '20px' }}>Supported: PDF, JSON, TXT</p>
          <input 
            type="file" 
            multiple 
            accept=".json,.txt,.pdf" 
            onChange={handleUpload} 
            disabled={loading} 
            style={{ color: 'transparent', width: '110px' }}
          />
        </section>

        {/* Filters Toolbar */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
          <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={inputStyle} />
          
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle}>
            <option value="date">Sort by Date</option>
            <option value="size">Sort by Size</option>
          </select>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={inputStyle}>
            <option value="">All Types</option>
            <option value="application/pdf">PDF</option>
            <option value="application/json">JSON</option>
            <option value="text/plain">TXT</option>
          </select>

          <Button onClick={applyFilters}>Apply Filters</Button>
        </section>

        {/* File List */}
        <section>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Your Files ({files.length})</h3>
          
          {loading && <div style={{ textAlign: 'center', padding: '20px', color: theme.subText }}>Loading files...</div>}
          {!loading && files.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: theme.subText, border: `1px solid ${theme.border}`, borderRadius: '8px' }}>No files found. Upload one to get started!</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {files.map(file => (
              <div key={file.id} style={{ 
                  border: `1px solid ${theme.border}`, 
                  padding: '16px', 
                  borderRadius: '10px',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'transform 0.1s',
                }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: '1.5rem' }}>
                    {file.contentType.includes('pdf') ? '📕' : file.contentType.includes('json') ? '📋' : '📄'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{file.filename}</div>
                    <div style={{ fontSize: '0.85rem', color: theme.subText }}>
                      {(file.size / 1024).toFixed(2)} KB • {new Date(file.uploadDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="primary" onClick={() => handleDownload(file.id, file.filename)} style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                    Download
                  </Button>
                  
                  {file.userId === user.uid && (
                    <Button variant="danger" onClick={() => handleDelete(file.id)} style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;