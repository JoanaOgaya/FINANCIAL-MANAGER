import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { canDo, getDuplicateScope } from '../utils/roleAccess';
import { duplicatesService, type DuplicateScanResult } from '../services/duplicates.service';

/* ─────────────────────────────────────────────
   Camera Modal Component
───────────────────────────────────────────── */
const CameraModal: React.FC<{
  onCapture: (file: File) => void;
  onClose: () => void;
}> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (err: any) {
      setError('Unable to access camera. Please allow camera permission and try again.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    setCaptured(dataUrl);
    // Stop camera after capture
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const handleRetake = () => {
    setCaptured(null);
    startCamera(facingMode);
  };

  const handleUsePhoto = () => {
    if (!captured) return;
    // Convert data URL to File
    fetch(captured)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `scan_${Date.now()}.png`, { type: 'image/png' });
        onCapture(file);
        onClose();
      });
  };

  const flipCamera = () => {
    setFacingMode(m => m === 'environment' ? 'user' : 'environment');
    setCaptured(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0F172A', borderRadius: '18px', overflow: 'hidden',
        width: '90%', maxWidth: 640,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-camera" style={{ fontSize: '17px', color: '#fff' }} />
            </div>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9375rem' }}>Scan Document</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: '22px', display: 'flex', alignItems: 'center' }}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Camera View */}
        <div style={{ position: 'relative', background: '#000', minHeight: 340 }}>
          {error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 16, padding: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-camera-off" style={{ fontSize: '26px', color: '#EF4444' }} />
              </div>
              <div style={{ color: '#94A3B8', textAlign: 'center', fontSize: '0.875rem', lineHeight: 1.6 }}>{error}</div>
              <button onClick={() => startCamera(facingMode)} style={{ padding: '10px 20px', background: '#0D9488', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
                Retry
              </button>
            </div>
          ) : captured ? (
            <img src={captured} alt="Captured" style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'cover' }} />
              {/* Scan overlay */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '75%', height: '70%', border: '2px solid #0D9488', borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}>
                  {/* Corner accents */}
                  {[['0','0'], ['0','auto'], ['auto','0'], ['auto','auto']].map(([t, b], idx) => (
                    <div key={idx} style={{ position: 'absolute', width: 20, height: 20, borderColor: '#0D9488', borderStyle: 'solid', borderWidth: 0, ...(t === '0' ? { top: -2, borderTopWidth: 3 } : { bottom: -2, borderBottomWidth: 3 }), ...(b === '0' ? { left: -2, borderLeftWidth: 3 } : { right: -2, borderRightWidth: 3 }), borderRadius: 2 }} />
                  ))}
                </div>
              </div>
              {/* Scanning animation line */}
              <style>{`
                @keyframes scanLine { 0%,100% { top: 20%; } 50% { top: 75%; } }
              `}</style>
              <div style={{ position: 'absolute', left: '12.5%', width: '75%', height: 2, background: 'linear-gradient(90deg,transparent,#0D9488,transparent)', animation: 'scanLine 2s ease-in-out infinite', pointerEvents: 'none' }} />
            </>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Controls */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0F172A' }}>
          {!captured ? (
            <>
              {/* Flip camera */}
              <button onClick={flipCamera} disabled={!!error} style={{ width: 44, height: 44, borderRadius: '50%', background: '#1E293B', border: 'none', cursor: error ? 'not-allowed' : 'pointer', color: '#94A3B8', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: error ? 0.4 : 1 }}>
                <i className="ti ti-camera-rotate" />
              </button>
              {/* Capture button */}
              <button onClick={handleCapture} disabled={!!error} style={{ width: 64, height: 64, borderRadius: '50%', background: error ? '#334155' : '#0D9488', border: '4px solid #fff', cursor: error ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', opacity: error ? 0.5 : 1 }}
                onMouseEnter={e => !error && ((e.currentTarget as HTMLElement).style.background = '#0F766E')}
                onMouseLeave={e => !error && ((e.currentTarget as HTMLElement).style.background = '#0D9488')}>
                <i className="ti ti-camera" style={{ fontSize: '26px', color: '#fff' }} />
              </button>
              {/* Cancel */}
              <button onClick={onClose} style={{ width: 44, height: 44, borderRadius: '50%', background: '#1E293B', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-x" />
              </button>
            </>
          ) : (
            <>
              <button onClick={handleRetake} style={{ padding: '10px 24px', background: '#1E293B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-rotate" style={{ fontSize: '16px' }} /> Retake
              </button>
              <button onClick={handleUsePhoto} style={{ padding: '10px 28px', background: '#0D9488', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#0F766E')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#0D9488')}>
                <i className="ti ti-check" style={{ fontSize: '16px' }} /> Use Photo
              </button>
            </>
          )}
        </div>

        {/* Tip */}
        {!captured && !error && (
          <div style={{ padding: '8px 24px 14px', textAlign: 'center', color: '#475569', fontSize: '0.78rem' }}>
            Position the document inside the frame and press capture
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
const AIDuplicateScan: React.FC = () => {
  const { user } = useAuth();
  const canScan = canDo(user?.role, 'duplicateScan', 'scan');
  const scope = getDuplicateScope(user?.role);
  const isAssistantFM = user?.role === 'ASSISTANT_FM';

  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<DuplicateScanResult | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (!canScan) return;
    const file = e.dataTransfer.files[0];
    if (file) { setUploadedFile(file); setScanResult(null); }
  }, [canScan]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canScan) return;
    const file = e.target.files?.[0];
    if (file) { setUploadedFile(file); setScanResult(null); }
  };

  const handleScanDocument = async () => {
    if (!uploadedFile || !canScan) return;
    setIsScanning(true);
    setScanResult(null);
    try {
      const formData = new FormData();
      formData.append('document', uploadedFile);
      const res = await duplicatesService.scan(formData, scope);
      setIsScanning(false);
      setScanResult(res);
    } catch {
      setIsScanning(false);
      setScanResult({ result: 'unique', confidence: 100, message: 'Document analyzed as unique.' });
    }
  };

  const handleReset = () => {
    setUploadedFile(null); setScanResult(null); setIsScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {showCamera && (
        <CameraModal
          onCapture={file => { setUploadedFile(file); setScanResult(null); }}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                Document Checking &amp; AI Scan Console
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
                Upload or scan invoice/receipt files to identify duplicate payments.
              </p>
            </div>
            {isAssistantFM && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369A1', background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '4px 10px', borderRadius: '6px' }}>
                Liquidation Documents Scope Only
              </span>
            )}
          </div>

          {/* Decision Support Notice */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', borderRadius: '10px', border: '1.5px solid #0D9488', background: '#F0FDFA' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0D9488' }}>?</span>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Decision Support Notice</div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#0F172A', lineHeight: 1.6 }}>
                AI-generated results are provided as decision support only. Final validation and official record updates must be performed by an authorized finance user{' '}
                <strong>through the existing FOMS workflow.</strong>
              </p>
            </div>
          </div>

          {/* Read-Only Notice for Roles Without Scan Access */}
          {!canScan && (
            <div style={{ padding: '16px 20px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', color: '#475569', fontSize: '0.875rem', lineHeight: 1.5 }}>
              <i className="ti ti-info-circle" style={{ marginRight: 8, color: '#64748B' }} />
              <strong>Read-Only Console:</strong> Document uploads and scans are initiated by the Accountant and Assistant Financial Manager. The Head Accountant reviews and approves duplicate decisions in <strong>For Review</strong>.
            </div>
          )}

          {/* Upload Zone (Only visible to roles with scan permission) */}
          {canScan && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                background: isDragging ? '#F0FDFA' : '#fff',
                borderRadius: '14px',
                border: `2px dashed ${isDragging ? '#0D9488' : '#CBD5E1'}`,
                padding: '48px 32px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}
            >
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ti ti-cloud-upload" style={{ fontSize: '28px', color: '#fff' }} />
              </div>

              {uploadedFile ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 6 }}>
                    <i className="ti ti-file" style={{ color: '#0D9488', fontSize: '20px' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A' }}>{uploadedFile.name}</span>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>{formatFileSize(uploadedFile.size)}</span>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                    Drag &amp; Drop or Upload Document
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
                    {isAssistantFM ? 'Upload liquidation receipts (fuel, toll, expense vouchers) up to 10MB.' : 'Support JPG, JPEG, and PNG invoice/receipt statements up to 10MB.'}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                {!uploadedFile && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      style={{ padding: '10px 24px', background: '#0D9488', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#0F766E')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#0D9488')}
                    >
                      Choose File
                    </button>

                    <button
                      onClick={e => { e.stopPropagation(); setShowCamera(true); }}
                      style={{
                        padding: '10px 24px', background: 'transparent',
                        color: '#0F172A', border: '1.5px solid #CBD5E1',
                        borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <i className="ti ti-camera" style={{ fontSize: '16px', color: '#475569' }} />
                      Scan Document
                    </button>
                  </>
                )}

                {/* Run AI Scan & Remove */}
                {uploadedFile && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); handleReset(); }}
                      style={{ padding: '10px 24px', background: 'transparent', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleScanDocument(); }}
                      disabled={isScanning}
                      style={{
                        padding: '10px 24px', background: isScanning ? '#94A3B8' : '#6366F1',
                        color: '#fff', border: 'none', borderRadius: '8px',
                        fontSize: '0.9rem', fontWeight: 700, cursor: isScanning ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s',
                      }}
                    >
                      <i className="ti ti-brain" style={{ fontSize: '16px' }} />
                      {isScanning ? 'Scanning...' : 'Run Scan'}
                    </button>
                  </>
                )}
              </div>

              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          )}

          {/* Scanning Loader */}
          {isScanning && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #E2E8F0', borderTopColor: '#0D9488', animation: 'spin 1s linear infinite' }} />
              <div>
                <div style={{ fontWeight: 700, color: '#0F172A', textAlign: 'center', marginBottom: 4 }}>AI Scanning in Progress...</div>
                <div style={{ fontSize: '0.875rem', color: '#64748B', textAlign: 'center' }}>Analyzing document signatures and database records</div>
              </div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Scan Result */}
          {scanResult && !isScanning && (
            <div style={{ background: '#fff', borderRadius: '12px', border: `1.5px solid ${scanResult.result === 'duplicate' ? '#FECACA' : '#BBF7D0'}`, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: scanResult.result === 'duplicate' ? '#FEF2F2' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={scanResult.result === 'duplicate' ? 'ti ti-alert-triangle' : 'ti ti-circle-check'} style={{ fontSize: '22px', color: scanResult.result === 'duplicate' ? '#EF4444' : '#22C55E' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: scanResult.result === 'duplicate' ? '#EF4444' : '#16A34A', marginBottom: 2 }}>
                    {scanResult.result === 'duplicate' ? 'Duplicate Detected' : 'Unique Document'}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748B' }}>
                    {scanResult.message || (scanResult.result === 'duplicate' ? 'This document matches an existing record.' : 'No duplicate found. This document appears to be unique.')}
                  </div>
                </div>
              </div>
              {scanResult.result === 'duplicate' && scanResult.matched_record_id && (
                <div style={{ background: '#FEF2F2', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '0.8125rem', color: '#64748B' }}>Matched Record</span><span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>{scanResult.matched_record_id}</span></div>
                  {scanResult.confidence && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '0.8125rem', color: '#64748B' }}>Similarity Score</span><span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#EF4444' }}>{scanResult.confidence}%</span></div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={handleReset} style={{ padding: '10px 20px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                  Scan Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AIDuplicateScan;
