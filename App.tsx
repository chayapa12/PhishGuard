import React, { useEffect, useState, useRef, useCallback } from "react";
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController } from "chart.js";
import type { Chart as ChartJS } from "chart.js";
import jsPDF from "jspdf";
import { motion, AnimatePresence } from "framer-motion";

// TypeScript declarations for CDN libraries
declare const tf: any;
declare const Tesseract: any;
declare const QRious: any;

Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Analysis {
  text: string;
  score: number;
  label: string;
  time: string;
  explanation?: string;
}

// --- ANALYSIS ENGINE V1: HEURISTICS (FALLBACK) ---
interface HeuristicAnalysisResult {
  score: number;
  explanation: string;
}

const analysisRules = [
  { weight: 20, regex: /\b(password|verify your account|ssn|social security|credit card|pin)\b/gi, reason: "Requests sensitive information (password, SSN, credit card)." },
  { weight: 15, regex: /\b(bank|payment|invoice|suspicious activity|account locked)\b/gi, reason: "Uses financial or security-related language." },
  { weight: 25, regex: /\b(urgent|immediate action required|account will be suspended|final warning|act now)\b/gi, reason: "Creates a sense of urgency or threat." },
  { weight: 10, regex: /\b(limited time|offer expires)\b/gi, reason: "Pressures you with a limited-time offer." },
  { weight: 30, regex: /(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)/gi, reason: "Uses a URL shortener which can hide the true destination." },
  { weight: 20, regex: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gi, reason: "Contains a direct IP address link instead of a domain name." },
  { weight: 25, regex: /@\w+\.\w+\/|https?:\/\/[^\s]+\.[^\s]+\//gi, reason: "Contains an unusual link format." },
  { weight: 10, regex: /dear (customer|user|valued member)/gi, reason: "Uses a generic greeting instead of your name." },
  { weight: 5, regex: /\b(kindly|plese|verry|congratulation)\b/gi, reason: "Contains common spelling or grammatical errors." },
  { weight: 20, regex: /\b(you have won|prize|lottery|free gift|claim your reward)\b/gi, reason: "Promises an unexpected prize or reward." },
  { weight: 15, regex: /\b(attachment|download|document)\b/gi, reason: "References an unsolicited attachment." },
];

function performHeuristicAnalysis(text: string): HeuristicAnalysisResult {
  let score = 0;
  const reasons: string[] = [];
  const lowerCaseText = text.toLowerCase();

  analysisRules.forEach(rule => {
    if (rule.regex.test(lowerCaseText)) {
      score += rule.weight;
      if (!reasons.includes(rule.reason)) {
        reasons.push(rule.reason);
      }
    }
  });
  
  score = Math.min(score, 100);
  
  let explanation = "No major risks detected based on standard text analysis.";
  if (reasons.length > 0) {
    explanation = "This content is potentially risky for the following reasons: " + reasons.join(' ');
  }
  return { score, explanation: `[Standard Heuristic Engine] ${explanation}` };
}


// --- ANALYSIS ENGINE V2: DEEP LEARNING (PRIMARY) ---
async function preprocessText(text: string): Promise<any> {
    const sequenceLength = 200; 
    const vocabulary = { '<PAD>': 0, '<START>': 1, 'hello': 2, 'world': 3 };
    const tokens = text.toLowerCase().split(/\s+/).map(word => vocabulary[word] || 0);
    const padded = tokens.slice(0, sequenceLength).concat(Array(Math.max(0, sequenceLength - tokens.length)).fill(0));
    return tf.tensor2d([padded]);
}

function preprocessImage(imgElement: HTMLImageElement): any {
    const imageSize = 128;
    return tf.browser.fromPixels(imgElement)
        .resizeNearestNeighbor([imageSize, imageSize])
        .toFloat()
        .div(tf.scalar(255.0))
        .expandDims(0);
}


// --- UI & STYLING ---
const glassEffectClasses = "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] backdrop-blur-[8px] shadow-[0_6px_18px_rgba(2,6,23,0.6)]";
const tabButtonClasses = "px-4 py-2 rounded-lg font-semibold transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400";
const activeTabClasses = "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30";
const inactiveTabClasses = "bg-slate-700/50 hover:bg-slate-600/70 text-gray-300";


// --- NEW TOOLKIT COMPONENTS ---

const PasswordToolkit: React.FC = () => {
    const [password, setPassword] = useState('');
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [options, setOptions] = useState({ length: 16, numbers: true, symbols: true, uppercase: true });
    const [strength, setStrength] = useState({ score: 0, feedback: 'Enter a password to test' });

    useEffect(() => {
        if (!password) {
            setStrength({ score: 0, feedback: 'Enter a password to test' });
            return;
        }
        let score = 0;
        const feedbackItems = [];
        if (password.length >= 8) score += 25; else feedbackItems.push('Too short');
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 25; else feedbackItems.push('Needs uppercase & lowercase');
        if (/\d/.test(password)) score += 25; else feedbackItems.push('Needs numbers');
        if (/[^A-Za-z0-9]/.test(password)) score += 25; else feedbackItems.push('Needs symbols');
        
        setStrength({ score, feedback: feedbackItems.length > 0 ? `Weak: ${feedbackItems.join(', ')}.` : 'Strong password!' });
    }, [password]);

    const generatePassword = useCallback(() => {
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const syms = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
        let charset = lower;
        if (options.uppercase) charset += upper;
        if (options.numbers) charset += nums;
        if (options.symbols) charset += syms;

        let newPassword = '';
        const randomValues = new Uint32Array(options.length);
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < options.length; i++) {
            newPassword += charset[randomValues[i] % charset.length];
        }
        setGeneratedPassword(newPassword);
    }, [options]);
    
    const strengthColor = strength.score < 50 ? 'bg-red-500' : strength.score < 100 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-5 rounded-2xl ${glassEffectClasses} space-y-6`}>
            <div>
                <h3 className="text-xl font-semibold text-cyan-200 mb-3">Password Strength Analyzer</h3>
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Type a password..." className="w-full p-3 rounded-lg bg-slate-800/60 border border-slate-700" />
                <div className="w-full bg-slate-700 rounded-full h-2.5 mt-3">
                    <div className={`${strengthColor} h-2.5 rounded-full transition-all duration-300`} style={{ width: `${strength.score}%` }}></div>
                </div>
                <p className="text-sm text-gray-300 mt-2">{strength.feedback}</p>
            </div>
            <div>
                <h3 className="text-xl font-semibold text-cyan-200 mb-3">Secure Password Generator</h3>
                <div className="grid grid-cols-2 gap-4 items-center">
                    <div>
                        <label className="block text-sm">Length: {options.length}</label>
                        <input type="range" min="8" max="32" value={options.length} onChange={e => setOptions(o => ({ ...o, length: parseInt(e.target.value) }))} className="w-full" />
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center"><input type="checkbox" checked={options.uppercase} onChange={e => setOptions(o => ({...o, uppercase: e.target.checked}))} className="mr-2" /> Uppercase</label>
                        <label className="flex items-center"><input type="checkbox" checked={options.numbers} onChange={e => setOptions(o => ({...o, numbers: e.target.checked}))} className="mr-2" /> Numbers</label>
                        <label className="flex items-center"><input type="checkbox" checked={options.symbols} onChange={e => setOptions(o => ({...o, symbols: e.target.checked}))} className="mr-2" /> Symbols</label>
                    </div>
                </div>
                <button onClick={generatePassword} className="bg-indigo-500 px-4 py-2 rounded-md font-semibold mt-4">Generate</button>
                {generatedPassword && (
                    <div className="mt-4 bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <span className="font-mono break-all">{generatedPassword}</span>
                        <button onClick={() => navigator.clipboard.writeText(generatedPassword)} title="Copy to clipboard" className="ml-4 p-2 rounded-md hover:bg-slate-700">📋</button>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const QRCodeGenerator: React.FC = () => {
    const [text, setText] = useState('');
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        if (qrCanvasRef.current && text) {
            new QRious({
                element: qrCanvasRef.current,
                value: text,
                size: 200,
                background: 'transparent',
                foreground: '#e5e7eb',
                padding: 10,
            });
        }
    }, [text]);

    const downloadQR = () => {
        if (qrCanvasRef.current && text) {
            const link = document.createElement('a');
            link.download = 'qrcode.png';
            link.href = qrCanvasRef.current.toDataURL('image/png');
            link.click();
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-5 rounded-2xl ${glassEffectClasses} space-y-4`}>
            <h3 className="text-xl font-semibold text-cyan-200">Offline QR Code Generator</h3>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Enter text or URL..." className="w-full p-3 rounded-lg bg-slate-800/60 border border-slate-700" rows={4}></textarea>
            <div className="flex justify-center items-center bg-slate-800/50 rounded-lg p-4 min-h-[220px]">
                {text ? <canvas ref={qrCanvasRef}></canvas> : <p className="text-gray-400">QR code will appear here</p>}
            </div>
            <button onClick={downloadQR} disabled={!text} className="bg-green-600 disabled:bg-slate-600 px-4 py-2 rounded-md font-semibold">Download QR</button>
        </motion.div>
    );
};

const FileHasher: React.FC = () => {
    const [fileName, setFileName] = useState('');
    const [hashes, setHashes] = useState<{ [key: string]: string }>({});
    const [isHashing, setIsHashing] = useState(false);

    const calculateHashes = async (file: File) => {
        if (!file) return;
        setIsHashing(true);
        setFileName(file.name);
        setHashes({});

        const reader = new FileReader();
        reader.onload = async (e) => {
            const buffer = e.target?.result as ArrayBuffer;
            if (!buffer) return;

            const algorithms = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'];
            const calculatedHashes: { [key: string]: string } = {};

            for (const algo of algorithms) {
                try {
                    const hashBuffer = await crypto.subtle.digest(algo, buffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    calculatedHashes[algo] = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                } catch(err) {
                    calculatedHashes[algo] = 'Algorithm not supported by browser';
                }
                setHashes({ ...calculatedHashes }); // Update state incrementally
            }
            setIsHashing(false);
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-5 rounded-2xl ${glassEffectClasses} space-y-4`}>
            <h3 className="text-xl font-semibold text-cyan-200">File Integrity Checker</h3>
            <label htmlFor="file-upload" className={`w-full block text-center p-6 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 ${isHashing ? 'animate-pulse' : ''}`}>
                {isHashing ? 'Calculating...' : (fileName || 'Click or drag file to upload')}
            </label>
            <input id="file-upload" type="file" className="hidden" onChange={e => e.target.files && calculateHashes(e.target.files[0])} />
            {Object.keys(hashes).length > 0 && (
                <div className="space-y-2 bg-slate-800/50 p-3 rounded-lg">
                    {Object.entries(hashes).map(([algo, hash]) => (
                        <div key={algo} className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-gray-300 w-24">{algo}</span>
                            <input type="text" readOnly value={hash} className="font-mono bg-slate-900 p-1 rounded w-full" />
                            <button onClick={() => navigator.clipboard.writeText(hash)} title="Copy" className="ml-2 p-2 rounded-md hover:bg-slate-700">📋</button>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
};


// --- MAIN APP COMPONENT ---
export default function App(): React.ReactElement {
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<Analysis[]>(() => {
    try {
      const s = localStorage.getItem("phishHistory");
      return s ? JSON.parse(s) : [];
    } catch (error) {
      // FIX: The `error` object in a catch block is of type `unknown`. Explicitly convert it to a string to satisfy TypeScript's type checking.
      console.error("Failed to parse history from localStorage", String(error));
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState('analyzer');
  
  const pieChartRef = useRef<ChartJS | null>(null);
  const barChartRef = useRef<ChartJS | null>(null);
  const latest = history.length > 0 ? history[history.length - 1] : null;

  useEffect(() => {
    localStorage.setItem("phishHistory", JSON.stringify(history));

    const low = history.filter(h => h.score <= 30).length;
    const medium = history.filter(h => h.score > 30 && h.score <= 60).length;
    const high = history.filter(h => h.score > 60).length;

    const pieCtx = document.getElementById("pieChart") as HTMLCanvasElement | null;
    const barCtx = document.getElementById("barChart") as HTMLCanvasElement | null;
    if (!pieCtx || !barCtx) return;

    if (pieChartRef.current) pieChartRef.current.destroy();
    if (barChartRef.current) barChartRef.current.destroy();

    pieChartRef.current = new Chart(pieCtx, {
      type: "doughnut", data: { labels: ["Low Risk", "Medium Risk", "High Risk"], datasets: [{ data: [low, medium, high], backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"], borderColor: "#334155", borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { position: "bottom", labels: { color: "#d1d5db", padding: 15, font: { size: 12 } } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw} analyses` } } } }
    });

    barChartRef.current = new Chart(barCtx, {
      type: "bar", data: { labels: ["Low", "Medium", "High"], datasets: [{ label: 'Number of Analyses', data: [low, medium, high], backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"], borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: "#d1d5db" }, grid: { display: false } }, y: { ticks: { color: "#d1d5db", stepSize: 1 }, grid: { color: "rgba(255,255,255,0.1)" } } }, plugins: { legend: { display: false } } }
    });
  }, [history]);

  const analyzeText = async () => {
    if (!input.trim()) return alert("Please enter text or URL to analyze.");
    setIsLoading(true);

    let analysisResult: HeuristicAnalysisResult;

    try {
        const model = await tf.loadLayersModel('/models/text_model/model.json');
        const preprocessedInput = await preprocessText(input);
        const prediction = model.predict(preprocessedInput) as any;
        const score = prediction.dataSync()[0] * 100;
        analysisResult = { score, explanation: `[Advanced AI Model] The deep learning model analyzed the text's semantic context and structure to determine its risk profile.` };
        console.log("Successfully analyzed with Advanced AI Model.");
    } catch (error) {
        console.warn("Advanced AI text model not found or failed. Falling back to heuristic engine.", error);
        analysisResult = performHeuristicAnalysis(input);
    }
    
    const { score, explanation } = analysisResult;
    const label = score > 60 ? "High Risk 🔴" : score > 30 ? "Medium Risk 🟠" : "Low Risk 🟢";
    const entry: Analysis = { text: input, score: Math.round(score), label, time: new Date().toLocaleString(), explanation, };
    setHistory(prev => [...prev, entry]);
    setInput("");
    setIsLoading(false);
  };
  
  async function analyzeImageOfflineHybrid(file: File) {
      if (!file) return;
      setIsLoading(true);
      alert("🔍 Analyzing image... This may take a moment.");

      try {
        const { data } = await Tesseract.recognize(file, "eng");
        const { score: textScore, explanation: textExplanation } = performHeuristicAnalysis(data.text);
        
        let visualScore = 0;
        let finalExplanation: string;

        try {
          const img = document.createElement("img");
          img.src = URL.createObjectURL(file);
          await new Promise<void>((resolve) => { img.onload = () => resolve(); });

          const model = await tf.loadLayersModel("/models/image_model/model.json");
          const tensor = preprocessImage(img);
          const prediction = model.predict(tensor) as any;
          visualScore = prediction.dataSync()[0] * 100;

          const combinedScore = Math.min((visualScore * 0.6 + textScore * 0.4), 100);
          finalExplanation = `[Advanced AI Model] Visual analysis detected phishing patterns with ${visualScore.toFixed(0)}% confidence. Text analysis contributed to the final score.`;
           visualScore = combinedScore;
        } catch (error) {
          console.warn("Advanced AI image model not found or failed. Using OCR text analysis only.", error);
          finalExplanation = textExplanation;
          visualScore = textScore;
        }
        
        const label = visualScore > 60 ? "High Risk 🔴" : visualScore > 30 ? "Medium Risk 🟠" : "Low Risk 🟢";
        const entry: Analysis = { text: `[Image Analysis] ${file.name}`, score: Math.round(visualScore), label, time: new Date().toLocaleString(), explanation: finalExplanation };
        setHistory((prev) => [...prev, entry]);
        alert(`✅ Offline image analysis complete:\n${label} (${visualScore.toFixed(0)}%)`);
      } catch (error) {
        console.error("A critical error occurred during image analysis:", error);
        alert("❌ A critical error occurred during image analysis. Please check the console for details.");
      } finally {
        setIsLoading(false);
      }
  }

  const clearHistory = () => {
    if (!history.length) return alert("History is already empty.");
    if (window.confirm("Are you sure you want to clear all analysis history? This action cannot be undone.")) {
      setHistory([]);
    }
  };

  const downloadReport = () => {
    if (!history.length) return alert("No history to generate a report.");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("PhishGuard - Offline Analysis Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Report generated on: ${new Date().toLocaleString()}`, 14, 30);
    let yPos = 40;
    history.forEach((h, i) => {
      if (yPos > 260) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.text(`${i + 1}. Risk Level: ${h.label} (${h.score}%)`, 14, yPos);
      yPos += 6;
      doc.setFontSize(10);
      doc.text(`Analyzed on: ${h.time}`, 14, yPos);
      yPos += 8;
      const reasonText = doc.splitTextToSize(`Reasoning: ${h.explanation || 'N/A'}`, 180);
      doc.text(reasonText, 14, yPos);
      yPos += (reasonText.length * 5) + 4;
      const contentText = doc.splitTextToSize(`Content: ${h.text}`, 180);
      doc.text(contentText, 14, yPos);
      yPos += (contentText.length * 5) + 10;
    });
    doc.save("PhishGuard_Report.pdf");
  };

  const renderActiveTab = () => {
    switch (activeTab) {
        case 'analyzer':
            return <PhishingAnalyzerTab />;
        case 'toolkit':
            return <SecurityToolkitTab />;
        default:
            return null;
    }
  };

  const PhishingAnalyzerTab = () => (
      <motion.div key="analyzer" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
        <main className="grid lg:grid-cols-5 gap-6">
            <section className={`lg:col-span-3 p-5 rounded-2xl ${glassEffectClasses}`}>
                <motion.div layout>
                    <h2 className="text-2xl font-semibold text-cyan-200 mb-4">Analysis Engine</h2>
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste suspicious email content, a message, or a URL here..." className="w-full p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow duration-300" rows={8} disabled={isLoading}/>
                    <div className="flex flex-wrap gap-3 mt-4 items-center">
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={analyzeText} disabled={isLoading || !input.trim()} className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-cyan-500/20">{isLoading ? "Analyzing..." : "Analyze Text"}</motion.button>
                        <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }}>
                            <label htmlFor="image-upload" className={`bg-indigo-500 hover:bg-indigo-400 transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-indigo-500/20 block cursor-pointer ${isLoading ? 'bg-slate-600 !cursor-not-allowed' : ''}`}>Upload Image</label>
                            <input id="image-upload" type="file" accept="image/*" className="hidden" disabled={isLoading} onChange={(e) => { if (e.target.files && e.target.files[0]) { analyzeImageOfflineHybrid(e.target.files[0]); e.target.value = ''; } }}/>
                        </motion.div>
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={() => setInput("")} disabled={isLoading} className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 transition-colors px-5 py-2 rounded-lg">Clear Input</motion.button>
                    </div>

                    <AnimatePresence>
                        {latest && (
                        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 bg-slate-800/70 p-4 rounded-lg border border-slate-700">
                            <h3 className="text-lg font-semibold text-gray-200 mb-2">Latest Result</h3>
                            <div className="space-y-2">
                            <p className="text-gray-300"><strong>Risk Level:</strong> <span className="ml-2 font-bold">{latest.label}</span></p>
                            <p className="text-gray-300"><strong>Confidence Score:</strong> <span className="ml-2 font-bold">{latest.score}%</span></p>
                            {latest.explanation && (
                                <div>
                                <p className="text-gray-300"><strong>Reasoning:</strong></p>
                                <blockquote className="text-gray-300 mt-1 pl-3 border-l-2 border-cyan-400 bg-slate-900/50 p-2 rounded-r-md text-sm">{latest.explanation}</blockquote>
                                </div>
                            )}
                            <p className="text-gray-300 mt-2 break-words bg-slate-900/50 p-2 rounded-md max-h-24 overflow-y-auto text-sm"><span className="font-semibold text-gray-400">Original Content: </span>{latest.text}</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-3 text-right">{latest.time}</p>
                        </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </section>
            <section className={`lg:col-span-2 p-5 rounded-2xl ${glassEffectClasses}`}>
                <motion.div layout>
                    <h2 className="text-2xl font-semibold text-cyan-200 mb-4">Dashboard</h2>
                    <div className="h-52 w-full"><canvas id="pieChart"></canvas></div>
                    <div className="h-52 w-full mt-4"><canvas id="barChart"></canvas></div>
                    <div className="flex flex-wrap gap-3 justify-end mt-4">
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={downloadReport} className="bg-green-600 hover:bg-green-500 transition-colors px-4 py-2 rounded-lg font-semibold shadow-lg shadow-green-500/20">📄 Download PDF</motion.button>
                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={clearHistory} className="bg-red-600 hover:bg-red-500 transition-colors px-4 py-2 rounded-lg font-semibold shadow-lg shadow-red-500/20">🗑️ Clear History</motion.button>
                    </div>
                </motion.div>
            </section>
        </main>
        <section className="mt-8">
          <h3 className="text-2xl font-semibold text-cyan-200 mb-4">Analysis History</h3>
          <motion.div layout className="grid gap-4">
            <AnimatePresence>
              {history.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center text-gray-400 p-8 rounded-2xl ${glassEffectClasses}`}>No analysis history. Run an analysis to get started!</motion.div>
              ) : (
                history.slice().reverse().map((h, i) => (
                  <motion.div key={`${h.time}-${i}`} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className={`p-4 rounded-lg ${glassEffectClasses}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">{h.label} <span className="text-sm text-gray-300">({h.score}%)</span></div>
                        <div className="text-xs text-gray-400">{h.time}</div>
                      </div>
                    </div>
                    {h.explanation && (<blockquote className="text-gray-300 mt-2 pl-3 border-l-2 border-cyan-400 bg-slate-900/30 p-2 rounded-r-md text-sm">{h.explanation}</blockquote>)}
                    <p className="text-gray-300 mt-2 break-words text-sm bg-slate-900/20 p-2 rounded-md">{h.text}</p>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>
        </section>
    </motion.div>
  );

  const SecurityToolkitTab = () => (
    <motion.div key="toolkit" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
        <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-6">
                <PasswordToolkit />
                <QRCodeGenerator />
            </div>
            <div>
                <FileHasher />
            </div>
        </div>
    </motion.div>
  );


  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-500 pb-2">PhishGuard</h1>
          <p className="text-gray-300 mt-2 text-base md:text-lg">Your Powerful Offline Security Suite</p>
        </motion.header>
        
        <nav className="flex justify-center mb-8">
            <div className={`flex space-x-2 p-1.5 rounded-xl ${glassEffectClasses}`}>
                <button onClick={() => setActiveTab('analyzer')} className={`${tabButtonClasses} ${activeTab === 'analyzer' ? activeTabClasses : inactiveTabClasses}`}>🛡️ Phishing Analyzer</button>
                <button onClick={() => setActiveTab('toolkit')} className={`${tabButtonClasses} ${activeTab === 'toolkit' ? activeTabClasses : inactiveTabClasses}`}>🛠️ Security Toolkit</button>
            </div>
        </nav>

        <AnimatePresence mode="wait">
            {renderActiveTab()}
        </AnimatePresence>

      </div>
    </div>
  );
}
