import React, { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';

// Load jsQR and qrcode-generator libraries from CDN
const loadLibraries = () => {
  return Promise.all([
    new Promise((resolve, reject) => {
      if (window.jsQR) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }),
    new Promise((resolve, reject) => {
      if (window.qrcode) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    })
  ]);
};

export default function CybergbejaScanner() {
  const [activeTab, setActiveTab] = useState('scan');
  const [qrLink, setQrLink] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const qrCodeRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const [generateText, setGenerateText] = useState('');
  const [generatedQR, setGeneratedQR] = useState(false);

  const BACKEND_URL = 'https://qr-scanner-7kv6.onrender.com';

  useEffect(() => {
    loadLibraries().then(() => {
      setLibrariesLoaded(true);
      console.log('Libraries loaded successfully');
    }).catch(err => {
      console.error('Failed to load libraries:', err);
    });

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        startScanning();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setResultMessage('Error: Cannot access camera');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    setIsScanning(false);
  };

  const startScanning = () => {
    scanIntervalRef.current = setInterval(() => {
      captureAndScan();
    }, 500);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || !librariesLoaded) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const code = await detectQRCode(canvas);
      
      if (code) {
        console.log('QR Code detected:', code);
        await sendToBackend(code);
      }
    } catch (err) {
      console.error('Scan error:', err);
    }
  };

  const detectQRCode = async (canvas) => {
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use jsQR library
    if (window.jsQR) {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code) {
        return code.data;
      }
    }
    
    return null;
  };

  const sendToBackend = async (qrData) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      const response = await fetch(`${BACKEND_URL}/?exp=${encodeURIComponent(qrData)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Backend response:', data);
      
      if (data.response) {
        setQrLink(qrData);
        setResultMessage(data.response);
        stopCamera();
      } else if (data.error) {
        setResultMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Scan error:', err);
      setResultMessage(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanClick = () => {
    if (isScanning) {
      stopCamera();
    } else {
      setQrLink('');
      setResultMessage('');
      startCamera();
    }
  };

  const handleGenerateQR = () => {
    if (!generateText.trim()) {
      alert('Please enter text to generate QR code');
      return;
    }

    if (!librariesLoaded || !window.qrcode) {
      alert('QR Code library is still loading. Please wait...');
      return;
    }

    // Clear previous QR code
    if (qrCodeRef.current) {
      qrCodeRef.current.innerHTML = '';
    }

    try {
      // Create QR code using qrcode-generator library
      const typeNumber = 0; // Auto determine type
      const errorCorrectionLevel = 'L';
      const qr = window.qrcode(typeNumber, errorCorrectionLevel);
      qr.addData(generateText);
      qr.make();
      
      // Create canvas and draw QR code
      const canvas = document.createElement('canvas');
      const cellSize = 8;
      const margin = 16;
      const size = qr.getModuleCount() * cellSize + margin * 2;
      
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      
      // Black modules
      ctx.fillStyle = '#000000';
      for (let row = 0; row < qr.getModuleCount(); row++) {
        for (let col = 0; col < qr.getModuleCount(); col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(
              col * cellSize + margin,
              row * cellSize + margin,
              cellSize,
              cellSize
            );
          }
        }
      }
      
      qrCodeRef.current.appendChild(canvas);
      setGeneratedQR(true);
    } catch (err) {
      console.error('Generate error:', err);
      alert('Error generating QR code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* CHANGE LOGO HERE: Replace '/logo.png' with your logo file path */}
            <img 
              src="/logo.png" 
              alt="Cybergbeja Logo" 
              className="h-10 w-auto"
            />
          </div>
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('scan')}
              className={`font-medium ${
                activeTab === 'scan' ? 'text-blue-500' : 'text-gray-600'
              }`}
            >
              Scan Qr
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`font-medium ${
                activeTab === 'generate' ? 'text-blue-500' : 'text-gray-600'
              }`}
            >
              Generate Qr
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {activeTab === 'scan' ? (
        <div className="container mx-auto px-6 py-12">
          <div className="flex gap-8 items-start">
            {/* Video Preview */}
            <div className="flex-shrink-0">
              <div className="w-96 h-72 bg-white border-2 border-gray-200 rounded-lg shadow-sm overflow-hidden relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  style={{ display: isScanning ? 'block' : 'none' }}
                />
                {!isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <Camera className="text-gray-300" size={80} />
                  </div>
                )}
              </div>
            </div>

            {/* Results Section */}
            <div className="flex-1">
              <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm p-8 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Result</h2>
                <div className="text-gray-700 mb-1">
                  <span className="font-semibold">QR Link:</span> {qrLink || 'No scan yet'}
                </div>
                <div className="text-gray-700">
                  <span className="font-semibold">Result:</span> {resultMessage || 'No result'}
                </div>
              </div>

              <button
                onClick={handleScanClick}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50"
                disabled={isProcessing || !librariesLoaded}
              >
                {isScanning ? 'STOP SCANNING' : 'CLICK TO SCAN QR'}
              </button>
              
              {!librariesLoaded && (
                <p className="text-sm text-gray-500 mt-2">Loading QR scanner...</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Generate QR Tab */
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate QR Code</h2>
              <input
                type="text"
                value={generateText}
                onChange={(e) => setGenerateText(e.target.value)}
                placeholder="Enter text or URL to generate QR code"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleGenerateQR}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-8 rounded-lg transition-colors"
              >
                GENERATE QR CODE
              </button>
            </div>

            {generatedQR && (
              <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm p-8 text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Your QR Code</h3>
                <div ref={qrCodeRef} className="flex justify-center mb-4"></div>
                <button
                  onClick={() => {
                    const canvas = qrCodeRef.current.querySelector('canvas');
                    if (canvas) {
                      const url = canvas.toDataURL('image/png');
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'qr-code.png';
                      a.click();
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                >
                  Download QR Code
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Footer */}
      <footer className="bg-blue-400 text-gray-900 py-8 mt-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                {/* CHANGE LOGO HERE: Replace '/logo.png' with your logo file path */}
                <img 
                  src="/logo.png" 
                  alt="Cybergbeja Logo" 
                  className="h-8 w-auto"
                />
              </div>
              <h3 className="font-bold text-lg mb-3">Usage</h3>
              <ul className="space-y-2 text-sm">
                <li>◦ The scanner works for embedded URL and email address while everyother is categorised as text.</li>
                <li>◦ To start the scanner click start</li>
                <li>◦ The response is shown in the scan result section.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">Tips</h3>
              <ul className="space-y-2 text-sm">
                <li>◦ Adopt a reliable scanner, such as Cybergbeja QRcode scanner.</li>
                <li>◦ Identify the source. Never scan a QR code if you can't verify where it came from.</li>
                <li>◦ Keep an eye out for phishing.</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
