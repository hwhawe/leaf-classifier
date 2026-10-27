import { useCallback, useRef, useState } from 'react'
import { explainLabel } from './diseaseInfo'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function App() {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle') // idle | scanning | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setResult(null)
    setStatus('idle')
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    loadFile(e.dataTransfer.files?.[0])
  }

  const handleAnalyze = async () => {
    if (!imageFile) return
    setStatus('scanning')
    setErrorMsg('')
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      const res = await fetch(`${API_URL}/predict`, { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server merespons ${res.status}`)
      }
      const data = await res.json()
      setResult(data)
      setStatus('done')
    } catch (err) {
      setErrorMsg(
        err.message === 'Failed to fetch'
          ? 'Tidak bisa terhubung ke server. Pastikan backend Flask berjalan di ' + API_URL
          : err.message,
      )
      setStatus('error')
    }
  }

  const reset = () => {
    setImageFile(null)
    setImagePreview(null)
    setResult(null)
    setStatus('idle')
    setErrorMsg('')
  }

  return (
    <div className="page">
      <header className="header">
        <span className="eyebrow">OLID-I · ViT-Small/16 · 57 taksa</span>
        <h1 className="title">
          Spesimen<span className="title-dot">.</span>
        </h1>
        <p className="subtitle">Unggah foto daun untuk diagnosis penyakit tanaman secara instan.</p>
      </header>

      <main className="stage">
        <section
          className={`dropzone ${isDragOver ? 'is-dragover' : ''} ${imagePreview ? 'has-image' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => status !== 'scanning' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              loadFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          {!imagePreview && (
            <div className="dropzone-empty">
              <div className="ruler-icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" width="40" height="40">
                  <rect x="8" y="20" width="48" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="16" y1="20" x2="16" y2="28" stroke="currentColor" strokeWidth="2" />
                  <line x1="24" y1="20" x2="24" y2="26" stroke="currentColor" strokeWidth="2" />
                  <line x1="32" y1="20" x2="32" y2="28" stroke="currentColor" strokeWidth="2" />
                  <line x1="40" y1="20" x2="40" y2="26" stroke="currentColor" strokeWidth="2" />
                  <line x1="48" y1="20" x2="48" y2="28" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <p className="dropzone-label">Seret gambar ke sini, atau klik untuk memilih file</p>
              <p className="dropzone-hint">JPG, PNG · satu daun per gambar</p>
            </div>
          )}

          {imagePreview && (
            <div className="specimen">
              <img src={imagePreview} alt="Spesimen daun yang diunggah" />
              {status === 'scanning' && (
                <div className="scan-overlay">
                  <div className="scan-line" />
                </div>
              )}
              {status !== 'scanning' && (
                <div className="specimen-hover">
                  <span>Klik atau seret gambar baru untuk mengganti</span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          {status === 'idle' && !result && (
            <div className="panel-inner panel-idle">
              <p className="panel-heading">Siap dianalisis</p>
              <p className="panel-body">
                Model akan memeriksa tekstur, warna, dan pola bercak pada permukaan daun untuk
                menentukan kelas penyakit yang paling mendekati.
              </p>
              <button className="btn-primary" disabled={!imageFile} onClick={handleAnalyze}>
                Analisis Spesimen
              </button>
              {!imageFile && <p className="panel-note">Unggah gambar terlebih dahulu.</p>}
            </div>
          )}

          {status === 'scanning' && (
            <div className="panel-inner panel-scanning">
              <p className="panel-heading">Memindai jaringan daun…</p>
              <div className="pulse-track">
                <div className="pulse-bar" />
              </div>
              <p className="panel-note mono">running inference on vit-small/16</p>
            </div>
          )}

          {status === 'error' && (
            <div className="panel-inner panel-error">
              <p className="panel-heading">Analisis gagal</p>
              <p className="panel-body">{errorMsg}</p>
              <button className="btn-secondary" onClick={handleAnalyze}>
                Coba lagi
              </button>
            </div>
          )}

          {status === 'done' && result && (
            <div className="panel-inner panel-result">
              <p className="result-eyebrow">Diagnosis utama</p>
              <h2 className="result-label">{formatLabel(result.prediction)}</h2>
              <p className="result-confidence mono">{result.confidence.toFixed(2)}% keyakinan</p>

              {(() => {
                const info = explainLabel(result.prediction)
                return (
                  <div className="explain-box">
                    <div className="explain-tags">
                      {info.crop && <span className="tag tag-crop">{info.crop}</span>}
                      <span className="tag tag-category">{info.category}</span>
                    </div>
                    <p className="explain-title">{info.title}</p>
                    <p className="explain-desc">{info.description}</p>
                    {info.tip && <p className="explain-tip">💡 {info.tip}</p>}
                  </div>
                )
              })()}

              <div className="ranking">
                {result.top5.map((item, i) => {
                  const info = explainLabel(item.label)
                  return (
                    <div className="rank-row" key={item.label} title={info.title}>
                      <span className="rank-index mono">{String(i + 1).padStart(2, '0')}</span>
                      <span className="rank-name">{formatLabel(item.label)}</span>
                      <div className="rank-bar-track">
                        <div className="rank-bar-fill" style={{ width: `${item.confidence}%` }} />
                      </div>
                      <span className="rank-pct mono">{item.confidence.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>

              <button className="btn-secondary" onClick={reset}>
                Analisis spesimen lain
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>Skripsi — Klasifikasi Penyakit Daun Tanaman · ViT-Small/16 · Dataset OLID-I</span>
      </footer>
    </div>
  )
}

function formatLabel(raw) {
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}
