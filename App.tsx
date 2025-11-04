import React, { useEffect, useState, useRef, useCallback } from "react";
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController } from "chart.js";
import type { Chart as ChartJS } from "chart.js";
import jsPDF from "jspdf";
import { motion, AnimatePresence } from "framer-motion";

// TypeScript declarations for CDN libraries
declare const Tesseract: any;
declare const tf: any; // TensorFlow.js
declare const QRious: any;

Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Analysis {
  text: string;
  score: number;
  label: string;
  time: string;
  explanation?: string;
}

// --- ADVANCED HEURISTIC ANALYSIS ENGINE V3 ---
interface AnalysisRule {
  id: string;
  category: 'Urgency' | 'Financial' | 'Authority' | 'Suspicious Links' | 'Generic Greeting' | 'Bad Grammar' | 'Unexpected Reward' | 'Threat' | 'Unexpected Attachment' | 'Psychological Tricks';
  weight: number;
  regex: RegExp;
  reason: string;
}

const advancedAnalysisRules: AnalysisRule[] = [
    // Urgency
    { id: 'URGENCY_1', category: 'Urgency', weight: 25, regex: /\b(urgent|immediate action required|act now|expiring soon|final warning)\b/gi, reason: "Creates a false sense of urgency to rush you into making a mistake." },
    { id: 'URGENCY_2', category: 'Urgency', weight: 15, regex: /\b(limited time|offer expires|today only)\b/gi, reason: "Pressures you with a time-sensitive deadline." },
    // Financial
    { id: 'FINANCIAL_1', category: 'Financial', weight: 20, regex: /\b(payment|invoice|wire transfer|refund|unusual transaction)\b/gi, reason: "Mentions financial transactions to get your attention." },
    { id: 'FINANCIAL_2', category: 'Financial', weight: 25, regex: /\b(credit card|bank account|ssn|social security|pin)\b/gi, reason: "Asks for highly sensitive financial or personal information." },
    // Authority / Impersonation
    { id: 'AUTHORITY_1', category: 'Authority', weight: 15, regex: /\b(verify your account|account confirmation|validate your details)\b/gi, reason: "Impersonates a legitimate service asking for verification." },
    { id: 'AUTHORITY_2', category: 'Authority', weight: 10, regex: /\b(IT department|help desk|administrator)\b/gi, reason: "Claims to be from a technical support or authority figure." },
    { id: 'AUTHORITY_3', category: 'Authority', weight: 20, regex: /\b(CEO|CFO|President|Manager)\b.*(urgent request|wire transfer|gift card)/gi, reason: "Impersonates a high-level executive to pressure you into making a financial transaction (CEO Fraud)." },
    { id: 'AUTHORITY_4', category: 'Authority', weight: 15, regex: /\b(fedex|dhl|ups|usps|postal service)\b.*(delivery failed|shipping update|tracking number)/gi, reason: "Impersonates a well-known shipping company with a fake delivery notice." },
    // Suspicious Links
    { id: 'LINKS_1', category: 'Suspicious Links', weight: 35, regex: /(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)/gi, reason: "Uses a URL shortener to hide the real, potentially malicious, destination of the link." },
    { id: 'LINKS_2', category: 'Suspicious Links', weight: 25, regex: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gi, reason: "Links directly to an IP address instead of a trusted domain name." },
    { id: 'LINKS_3', category: 'Suspicious Links', weight: 30, regex: /href\s*=\s*['"][^'"]*@/gi, reason: "Contains a link with an '@' symbol, a common trick to obscure the true domain." },
    { id: 'LINKS_4', category: 'Suspicious Links', weight: 20, regex: /https?:\/\/[a-z0-9-]+\.(xyz|top|info|club|buzz|icu)\b/gi, reason: "Uses a top-level domain (.xyz, .top, etc.) often associated with spam or malicious sites." },
    { id: 'LINKS_5', category: 'Suspicious Links', weight: 25, regex: /https?:\/\/([a-z0-9-]+\.){3,}/gi, reason: "Uses multiple subdomains, a technique to disguise a phishing domain as a legitimate one (e.g., yourbank.com.security.login.xyz)." },
    // Generic Greeting
    { id: 'GREETING_1', category: 'Generic Greeting', weight: 10, regex: /dear (customer|user|valued member|client)/gi, reason: "Uses a generic greeting. Legitimate companies usually use your name." },
    // Bad Grammar
    { id: 'GRAMMAR_1', category: 'Bad Grammar', weight: 5, regex: /\b(kindly|plese|verry|congratulationz|undeliverable)\b/gi, reason: "Contains common spelling or grammatical errors, often found in phishing emails." },
    { id: 'GRAMMAR_2', category: 'Bad Grammar', weight: 5, regex: /\b[A-Z]{5,}\b/gi, reason: "Excessive use of capital letters, intended to create unnecessary urgency or importance." },
    // Unexpected Reward
    { id: 'REWARD_1', category: 'Unexpected Reward', weight: 20, regex: /\b(you have won|prize|lottery|free gift|claim your reward|inheritance)\b/gi, reason: "Promises an unexpected prize or reward to lure you into clicking." },
    // Threat
    { id: 'THREAT_1', category: 'Threat', weight: 25, regex: /\b(account locked|account suspended|suspicious activity|unauthorized access|security alert)\b/gi, reason: "Uses threats about your account security to cause panic." },
    // Unexpected Attachment
    { id: 'ATTACHMENT_1', category: 'Unexpected Attachment', weight: 20, regex: /\b(attachment|attached document|invoice attached|download the file)\b/gi, reason: "References an unexpected attachment, which could contain malware." },
    // Psychological Tricks
    { id: 'PSYCH_1', category: 'Psychological Tricks', weight: 15, regex: /\b(confidential|private|secret information)\b/gi, reason: "Tries to spark curiosity by mentioning secret or confidential information." },
];

function performAdvancedHeuristicAnalysis(text: string): { score: number; foundFlags: { reason: string; category: string; id: string }[] } {
    let score = 0;
    const foundFlags: { reason: string; category: string; id: string }[] = [];
    const foundCategories = new Set<string>();
    const lowerCaseText = text.toLowerCase();

    advancedAnalysisRules.forEach(rule => {
        if (rule.regex.test(lowerCaseText)) {
            score += rule.weight;
            if (!foundFlags.some(f => f.id === rule.id)) {
                foundFlags.push({ reason: rule.reason, category: rule.category, id: rule.id });
                foundCategories.add(rule.category);
            }
        }
    });

    // --- Contextual Combination Bonuses ---
    if (foundCategories.has('Urgency') && foundCategories.has('Financial')) score += 20;
    if (foundCategories.has('Threat') && foundCategories.has('Suspicious Links')) score += 25;
    if (foundCategories.has('Authority') && foundCategories.has('Financial')) score += 25;
    if (foundCategories.has('Authority') && foundCategories.has('Urgency')) score += 20;
    if (foundCategories.has('Unexpected Attachment') && foundCategories.has('Urgency')) score += 15;
    if (foundCategories.has('Threat') && foundCategories.has('Authority')) score += 20;

    score = Math.min(score, 100);
    return { score, foundFlags };
}


// --- ADVANCED OFFLINE MACHINE LEARNING ENGINE V2 ---
const mlKeywords: { [key: string]: number } = {
  // High-risk keywords
  'verify': 0.9, 'password': 0.8, 'username': 0.7, 'ssn': 1.0, 'locked': 0.8, 'suspended': 0.8,
  'unusual': 0.7, 'activity': 0.6, 'login': 0.7, 'confidential': 0.8, 'immediate': 0.8,
  'action': 0.6, 'required': 0.7, 'winner': 0.9, 'prize': 0.9, 'congratulations': 0.8, 'free': 0.7,
  'invoice': 0.7, 'payment': 0.8, 'refund': 0.7, 'inheritance': 0.9, 'kindly': 0.6, 'wire': 0.9, 'transfer': 0.8,
  // Low-risk (negative weights)
  'hello': -0.5, 'team': -0.4, 'update': -0.3, 'meeting': -0.6, 'report': -0.5, 'thanks': -0.7,
  'sincerely': -0.8, 'documentation': -0.6, 'feedback': -0.5, 'reminder': -0.2,
};

const mlNgrams: { [key: string]: number } = {
  // High-risk phrases
  'verify your': 0.9, 'your account': 0.8, 'account is': 0.6, 'is locked': 0.9, 'action required': 0.8,
  'immediate action': 0.9, 'click here': 0.7, 'update your': 0.7, 'credit card': 0.9,
  'bank account': 0.9, 'dear customer': 0.6, 'social security': 1.0, 'final notice': 0.8
};

// Simulated model weights for offline inference
const modelWeights = {
    keywordScore: 1.2,
    ngramScore: 1.5,
    uppercaseRatio: 5.0, // High weight for excessive caps
    symbolRatio: 3.0,
    digitRatio: 1.5,
    bias: -2.0 // Adjusts the activation threshold
};

interface MLFeatures {
    keywordScore: number;
    ngramScore: number;
    uppercaseRatio: number;
    symbolRatio: number;
    digitRatio: number;
    flaggedWords: string[];
    flaggedNgrams: string[];
}

function extractMLFeatures(text: string): MLFeatures {
    const lowerCaseText = text.toLowerCase();
    const tokens = lowerCaseText.replace(/[.,!?;:"']/g, ' ').split(/\s+/);
    const uniqueTokens = [...new Set(tokens)];
    
    let keywordScore = 0;
    const flaggedWords: string[] = [];
    uniqueTokens.forEach(token => {
        if (mlKeywords[token]) {
            keywordScore += mlKeywords[token];
            if (mlKeywords[token] > 0.6) flaggedWords.push(token);
        }
    });

    let ngramScore = 0;
    const flaggedNgrams: string[] = [];
    Object.keys(mlNgrams).forEach(ngram => {
        if (lowerCaseText.includes(ngram)) {
            ngramScore += mlNgrams[ngram];
            flaggedNgrams.push(ngram);
        }
    });
    
    const textLength = text.length || 1;
    const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / textLength;
    const symbolRatio = (text.match(/[!@#$%^&*()_+~`|}{[\]:;?><,.\/-=]/g) || []).length / textLength;
    const digitRatio = (text.match(/[0-9]/g) || []).length / textLength;

    return { keywordScore, ngramScore, uppercaseRatio, symbolRatio, digitRatio, flaggedWords, flaggedNgrams };
}

function runAdvancedMLAnalysis(text: string): { score: number; details: MLFeatures } {
    if (!text) return { score: 0, details: { keywordScore: 0, ngramScore: 0, uppercaseRatio: 0, symbolRatio: 0, digitRatio: 0, flaggedWords: [], flaggedNgrams: [] } };
    
    const features = extractMLFeatures(text);

    // Simulated Linear Model + Sigmoid Activation
    const logit = (features.keywordScore * modelWeights.keywordScore) +
                  (features.ngramScore * modelWeights.ngramScore) +
                  (features.uppercaseRatio * modelWeights.uppercaseRatio) +
                  (features.symbolRatio * modelWeights.symbolRatio) +
                  (features.digitRatio * modelWeights.digitRatio) +
                  modelWeights.bias;
    
    const probability = 1 / (1 + Math.exp(-logit));
    const score = probability * 100;
    
    return { score: Math.min(score, 100), details: features };
}

function generateCombinedExplanation(
    heuristicResult: { score: number; foundFlags: { reason: string; category: string; id: string }[] },
    mlResult: { score: number; details: MLFeatures },
    finalScore: number
): string {
    if (finalScore < 5) {
        return "Overall Assessment: Low Risk\n\nOur analysis did not find any common phishing indicators. However, always remain cautious and verify unexpected requests through official channels.";
    }

    let explanation = `Overall Assessment: ${finalScore > 60 ? 'High Risk' : finalScore > 30 ? 'Medium Risk' : 'Low Risk'}\n\nThis content exhibits characteristics of a phishing attempt. We advise caution.\n\n`;

    if (heuristicResult.foundFlags.length > 0) {
        explanation += "Heuristic Analysis (Rule-Based Detections):\n";
        const flagsByCategory: { [key: string]: string[] } = {};
        heuristicResult.foundFlags.forEach(flag => {
            if (!flagsByCategory[flag.category]) flagsByCategory[flag.category] = [];
            flagsByCategory[flag.category].push(flag.reason);
        });
        Object.keys(flagsByCategory).forEach(category => {
            explanation += `• [${category}]\n`;
            flagsByCategory[category].forEach(reason => {
                explanation += `  - ${reason}\n`;
            });
        });
    }

    const mlDetails = mlResult.details;
    if (mlDetails.flaggedWords.length > 0 || mlDetails.flaggedNgrams.length > 0 || mlResult.score > 20) {
        explanation += "\nMachine Learning Analysis (Linguistic & Structural Cues):\n";
        if (mlDetails.flaggedNgrams.length > 0) {
            explanation += `  - Detected suspicious phrases: ${mlDetails.flaggedNgrams.slice(0, 3).join(', ')}.\n`;
        }
        if (mlDetails.flaggedWords.length > 0) {
            explanation += `  - Identified high-risk keywords: ${mlDetails.flaggedWords.slice(0, 4).join(', ')}.\n`;
        }
        if (mlDetails.uppercaseRatio > 0.1) {
            explanation += `  - Noticed an unusually high amount of capital letters, a common tactic to create false urgency.\n`;
        }
        if (mlDetails.symbolRatio > 0.05) {
            explanation += `  - Detected an unusual density of symbols, which can be used to obscure text.\n`;
        }
    }
    
    explanation += "\nRecommendation:\n";
    if (finalScore > 60) {
         explanation += "DO NOT click any links, download attachments, or reply. Delete this message immediately. If you are concerned about an account, log in through an official website or app you trust, not through any links provided in this message.";
    } else if (finalScore > 30) {
        explanation += "This content has some suspicious elements. Be very careful before proceeding. Double-check the sender's identity and independently verify any requests before taking action.";
    } else {
        explanation += "While the risk score is low, one or more potential issues were flagged. It's always best to be cautious with unsolicited messages.";
    }
    
    return explanation;
}


// --- UI & STYLING ---
const glassEffectClasses = "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] backdrop-blur-[8px] shadow-[0_6px_18px_rgba(2,6,23,0.6)]";

// --- SECURITY TOOLKIT COMPONENTS ---
const PasswordGenerator: React.FC = () => {
    const [password, setPassword] = useState('');
    const [length, setLength] = useState(16);
    const [options, setOptions] = useState({ uppercase: true, numbers: true, symbols: true });
    const [copied, setCopied] = useState(false);
    const [customChars, setCustomChars] = useState('');
    const [memorablePhrase, setMemorablePhrase] = useState('');

    const generatePassword = useCallback(() => {
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const syms = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
        
        let charPool = lower;
        if (options.uppercase) charPool += upper;
        if (options.numbers) charPool += nums;
        if (options.symbols) charPool += syms;
        
        const uniqueCustomChars = [...new Set(customChars.split(''))].join('');
        charPool += uniqueCustomChars;

        if (!charPool) {
            setPassword('Select character types!');
            return;
        }

        let newPassword = '';
        for (let i = 0; i < length; i++) {
            newPassword += charPool.charAt(Math.floor(Math.random() * charPool.length));
        }
        setPassword(newPassword);
    }, [length, options, customChars]);

    const generateMemorablePassword = () => {
        if (!memorablePhrase.trim()) {
            alert("Please enter a word or phrase to make it strong.");
            return;
        }

        let strongPass = memorablePhrase.replace(/\s+/g, '');
        if (strongPass.length > 0) {
            strongPass = strongPass.charAt(0).toUpperCase() + strongPass.slice(1);
        }

        const substitutions: { [key: string]: string } = { 'a': '@', 'e': '3', 'i': '!', 'o': '0', 's': '$', 't': '7' };
        let passArray = strongPass.split('');
        for (let i = 0; i < passArray.length; i++) {
            const lowerChar = passArray[i].toLowerCase();
            if (substitutions[lowerChar] && Math.random() > 0.6) {
                passArray[i] = substitutions[lowerChar];
            }
        }
    
        const nums = '0123456789';
        const syms = '!@#$%^&*?';
        const numCount = Math.floor(Math.random() * 2) + 1;
        const symCount = Math.floor(Math.random() * 2) + 1;

        for(let i=0; i < numCount; i++) {
            const randIndex = Math.floor(Math.random() * (passArray.length + 1));
            const randomNumber = nums.charAt(Math.floor(Math.random() * nums.length));
            passArray.splice(randIndex, 0, randomNumber);
        }
    
        for(let i=0; i < symCount; i++) {
            const randIndex = Math.floor(Math.random() * (passArray.length + 1));
            const randomSymbol = syms.charAt(Math.floor(Math.random() * syms.length));
            passArray.splice(randIndex, 0, randomSymbol);
        }
    
        setPassword(passArray.join(''));
    };

    useEffect(() => {
        generatePassword();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div layout className={`p-5 rounded-2xl ${glassEffectClasses} w-full`}>
            <h3 className="text-xl font-semibold text-indigo-300 mb-4">Secure Password Generator</h3>
            <div className={`flex items-center p-3 rounded-lg bg-slate-800/60 border border-slate-700 mb-4`}>
                <span className="font-mono text-lg text-white flex-grow break-all">{password}</span>
                <button onClick={copyToClipboard} className="ml-4 px-3 py-1 bg-indigo-500 rounded-md text-sm hover:bg-indigo-400 transition-colors">{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div className="space-y-4">
                 <div>
                    <h4 className="font-semibold text-gray-300 mb-2">Random Password</h4>
                    <div>
                        <label htmlFor="length" className="block text-sm text-gray-300 mb-1">Length: {length}</label>
                        <input type="range" id="length" min="8" max="64" value={length} onChange={e => setLength(parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3">
                        {Object.keys(options).map(key => (
                            <label key={key} className="flex items-center cursor-pointer">
                                <input type="checkbox" checked={options[key as keyof typeof options]} onChange={() => setOptions(prev => ({ ...prev, [key]: !prev[key] }))} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"/>
                                <span className="ml-2 text-gray-200 capitalize">{key}</span>
                            </label>
                        ))}
                    </div>
                     <div className="mt-3">
                         <label htmlFor="customChars" className="block text-sm text-gray-300 mb-1">Include Custom Characters:</label>
                         <input type="text" id="customChars" value={customChars} onChange={e => setCustomChars(e.target.value)} placeholder="e.g., #?&@" className="w-full p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"/>
                     </div>
                    <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={generatePassword} className="mt-3 bg-indigo-500 hover:bg-indigo-400 transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-indigo-500/20">Regenerate</motion.button>
                 </div>
                 
                 <hr className="border-slate-700" />

                 <div>
                    <h4 className="font-semibold text-gray-300 mb-2">Memorable Password</h4>
                     <div>
                         <label htmlFor="memorablePhrase" className="block text-sm text-gray-300 mb-1">Your word or phrase:</label>
                         <input type="text" id="memorablePhrase" value={memorablePhrase} onChange={e => setMemorablePhrase(e.target.value)} placeholder="e.g., My dog is fluffy" className="w-full p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"/>
                     </div>
                    <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={generateMemorablePassword} disabled={!memorablePhrase.trim()} className="mt-3 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-teal-500/20">Make it Strong</motion.button>
                 </div>
            </div>
        </motion.div>
    );
};

const QrCodeGenerator: React.FC = () => {
    const [text, setText] = useState('https://google.com');
    const qrRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (qrRef.current && text) {
            new QRious({
                element: qrRef.current,
                value: text,
                size: 200,
                background: 'white',
                foreground: 'black',
            });
        }
    }, [text]);

    return (
        <motion.div layout className={`p-5 rounded-2xl ${glassEffectClasses} w-full`}>
            <h3 className="text-xl font-semibold text-indigo-300 mb-4">QR Code Generator</h3>
            <div className="flex flex-col items-center">
                <div className="p-2 bg-white rounded-lg inline-block">
                    <canvas ref={qrRef}></canvas>
                </div>
                 <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Enter URL or text" className="w-full mt-4 p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"/>
            </div>
        </motion.div>
    );
};


// --- MAIN APP COMPONENT ---
export default function App(): React.ReactElement {
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'toolkit'>('analyzer');
  const [history, setHistory] = useState<Analysis[]>(() => {
    try {
      const s = localStorage.getItem("phishHistory");
      return s ? JSON.parse(s) : [];
    } catch (error) {
      console.error("Failed to parse history from localStorage", String(error));
      return [];
    }
  });
  
  const pieChartRef = useRef<ChartJS | null>(null);
  const barChartRef = useRef<ChartJS | null>(null);
  const latest = history.length > 0 ? history[history.length - 1] : null;

  useEffect(() => {
    localStorage.setItem("phishHistory", JSON.stringify(history));
    
    if (activeTab !== 'analyzer') return;

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
  }, [history, activeTab]);

  const analyzeText = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return alert("Please enter text or URL to analyze.");
    setIsLoading(true);

    const heuristicResult = performAdvancedHeuristicAnalysis(textToAnalyze);
    const mlResult = runAdvancedMLAnalysis(textToAnalyze);
    const score = Math.min(100, heuristicResult.score * 0.5 + mlResult.score * 0.5);
    
    const explanation = generateCombinedExplanation(heuristicResult, mlResult, score);
    const label = score > 60 ? "High Risk 🔴" : score > 30 ? "Medium Risk 🟠" : "Low Risk 🟢";
    
    const entry: Analysis = { text: textToAnalyze, score: Math.round(score), label, time: new Date().toLocaleString(), explanation, };
    setHistory(prev => [...prev, entry]);
    setInput("");
    setIsLoading(false);
  };
  
  async function analyzeImageOffline(file: File) {
      if (!file) return;
      setIsLoading(true);
      alert("🔍 Analyzing image... This may take a moment.");

      try {
        const { data } = await Tesseract.recognize(file, "eng");
        await analyzeText(`[Image Analysis of: ${file.name}]\n\n${data.text}`);
        alert(`✅ Offline image analysis complete.`);
      } catch (error) {
        console.error("A critical error occurred during image analysis:", String(error));
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

  const TabButton: React.FC<{tabId: 'analyzer' | 'toolkit', children: React.ReactNode}> = ({ tabId, children }) => (
    <button onClick={() => setActiveTab(tabId)} className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tabId ? 'text-white' : 'text-gray-400 hover:text-white'}`}>
      {children}
      {activeTab === tabId && <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" layoutId="underline" />}
    </button>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-500 pb-2">PhishGuard</h1>
          <p className="text-gray-300 mt-2 text-base md:text-lg">Your Powerful Offline Security Suite</p>
        </motion.header>

        <div className="flex justify-center mb-6">
          <div className={`flex space-x-2 p-1 rounded-lg ${glassEffectClasses}`}>
              <TabButton tabId="analyzer">Hybrid Analysis Engine</TabButton>
              <TabButton tabId="toolkit">Security Toolkit</TabButton>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
            >
                {activeTab === 'analyzer' && (
                    <>
                        <main className="grid lg:grid-cols-5 gap-6">
                            <section className={`lg:col-span-3 p-5 rounded-2xl ${glassEffectClasses}`}>
                                <motion.div layout>
                                    <h2 className="text-2xl font-semibold text-cyan-200 mb-4">Analyze Content</h2>
                                    <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste suspicious email content, a message, or a URL here..." className="w-full p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow duration-300" rows={8} disabled={isLoading}/>
                                    <div className="flex flex-wrap gap-3 mt-4 items-center">
                                        <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={() => analyzeText(input)} disabled={isLoading || !input.trim()} className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-cyan-500/20">{isLoading ? "Analyzing..." : "Analyze Text"}</motion.button>
                                        <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }}>
                                            <label htmlFor="image-upload" className={`bg-indigo-500 hover:bg-indigo-400 transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-indigo-500/20 block cursor-pointer ${isLoading ? 'bg-slate-600 !cursor-not-allowed' : ''}`}>Upload Image</label>
                                            <input id="image-upload" type="file" accept="image/*" className="hidden" disabled={isLoading} onChange={(e) => { if (e.target.files && e.target.files[0]) { analyzeImageOffline(e.target.files[0]); e.target.value = ''; } }}/>
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
                                                <blockquote className="text-gray-300 mt-1 pl-3 border-l-2 border-cyan-400 bg-slate-900/50 p-2 rounded-r-md text-sm whitespace-pre-wrap">{latest.explanation}</blockquote>
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
                                    {h.explanation && (<blockquote className="text-gray-300 mt-2 pl-3 border-l-2 border-cyan-400 bg-slate-900/30 p-2 rounded-r-md text-sm whitespace-pre-wrap">{h.explanation}</blockquote>)}
                                    <p className="text-gray-300 mt-2 break-words text-sm bg-slate-900/20 p-2 rounded-md">{h.text}</p>
                                  </motion.div>
                                ))
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </section>
                    </>
                )}
                {activeTab === 'toolkit' && (
                    <main className="grid md:grid-cols-2 gap-6">
                        <PasswordGenerator />
                        <QrCodeGenerator />
                    </main>
                )}
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}