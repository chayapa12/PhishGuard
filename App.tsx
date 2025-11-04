import React, { useEffect, useState, useRef } from "react";
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController } from "chart.js";
import type { Chart as ChartJS } from "chart.js";
import jsPDF from "jspdf";
import { motion, AnimatePresence } from "framer-motion";

Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Analysis {
  text: string;
  score: number;
  label: string;
  time: string;
  explanation?: string;
}

// --- ADVANCED OFFLINE ANALYSIS ENGINE ---
interface OfflineAnalysisResult {
  score: number;
  explanation: string;
}

const analysisRules = [
  // High-risk keywords (financial, credentials)
  { weight: 20, regex: /\b(password|verify your account|ssn|social security|credit card|pin)\b/gi, reason: "Requests sensitive information (password, SSN, credit card)." },
  { weight: 15, regex: /\b(bank|payment|invoice|suspicious activity|account locked)\b/gi, reason: "Uses financial or security-related language." },
  
  // Urgency and threats
  { weight: 25, regex: /\b(urgent|immediate action required|account will be suspended|final warning|act now)\b/gi, reason: "Creates a sense of urgency or threat." },
  { weight: 10, regex: /\b(limited time|offer expires)\b/gi, reason: "Pressures you with a limited-time offer." },
  
  // Suspicious links
  { weight: 30, regex: /(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)/gi, reason: "Uses a URL shortener which can hide the true destination." },
  { weight: 20, regex: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/gi, reason: "Contains a direct IP address link instead of a domain name." },
  { weight: 15, regex: /\.([a-z]{2,})\//gi, reason: "Contains a link." }, // General link presence
  { weight: 25, regex: /@\w+\.\w+\/|https?:\/\/[^\s]+\.[^\s]+\//gi, reason: "Contains an unusual link format." },


  // Generic greetings and poor grammar
  { weight: 10, regex: /dear (customer|user|valued member)/gi, reason: "Uses a generic greeting instead of your name." },
  { weight: 5, regex: /\b(kindly|plese|verry|congratulation)\b/gi, reason: "Contains common spelling or grammatical errors." },
  
  // Unexpected prizes or attachments
  { weight: 20, regex: /\b(you have won|prize|lottery|free gift|claim your reward)\b/gi, reason: "Promises an unexpected prize or reward." },
  { weight: 15, regex: /\b(attachment|download|document)\b/gi, reason: "References an unsolicited attachment." },
];

function performOfflineAnalysis(text: string): OfflineAnalysisResult {
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
  
  // Clamp score to 100
  score = Math.min(score, 100);
  
  let explanation = "No major risks detected.";
  if (reasons.length > 0) {
    explanation = "This content is potentially risky for the following reasons: " + reasons.join(' ');
  }
  if (score > 80 && !reasons.some(r => r.includes("urgency"))) {
      explanation += " It exhibits multiple characteristics of a phishing attempt."
  }

  return { score, explanation };
}

// --- UI COMPONENTS ---

const glassEffectClasses = "bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] backdrop-blur-[8px] shadow-[0_6px_18px_rgba(2,6,23,0.6)]";

export default function App(): React.ReactElement {
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<Analysis[]>(() => {
    try {
      const s = localStorage.getItem("phishHistory");
      return s ? JSON.parse(s) : [];
    } catch (error) {
      console.error("Failed to parse history from localStorage", error);
      return [];
    }
  });
  
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
      type: "doughnut",
      data: {
        labels: ["Low Risk", "Medium Risk", "High Risk"],
        datasets: [{
          data: [low, medium, high],
          backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
          borderColor: "#334155",
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: { 
          legend: { 
            position: "bottom", 
            labels: { color: "#d1d5db", padding: 15, font: { size: 12 } } 
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.raw} analyses`
            }
          }
        }
      }
    });

    barChartRef.current = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: ["Low", "Medium", "High"],
        datasets: [{
          label: 'Number of Analyses',
          data: [low, medium, high],
          backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: "#d1d5db" }, grid: { display: false } },
          y: { ticks: { color: "#d1d5db", stepSize: 1 }, grid: { color: "rgba(255,255,255,0.1)" } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }, [history]);

  const analyzeText = () => {
    if (!input.trim()) return alert("Please enter text or URL to analyze.");
    setIsLoading(true);

    // Simulate analysis time
    setTimeout(() => {
      const { score, explanation } = performOfflineAnalysis(input);
      const label = score > 60 ? "High Risk 🔴" : score > 30 ? "Medium Risk 🟠" : "Low Risk 🟢";
      const entry: Analysis = { 
        text: input, 
        score, 
        label, 
        time: new Date().toLocaleString(),
        explanation,
      };
      setHistory(prev => [...prev, entry]);
      setInput("");
      setIsLoading(false);
    }, 500); // A small delay to make the loading state visible
  };
  
  const handleImageUploadClick = () => {
    alert("Image analysis requires an online AI model and is not available in this offline version of PhishGuard.");
  };

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
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
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

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.header 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }} 
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-500 pb-2">PhishGuard</h1>
          <p className="text-gray-300 mt-2 text-base md:text-lg">Your Powerful Offline Phishing Analyzer</p>
        </motion.header>

        <main className="grid lg:grid-cols-5 gap-6">
          <section className={`lg:col-span-3 p-5 rounded-2xl ${glassEffectClasses}`}>
            <motion.div layout>
              <h2 className="text-2xl font-semibold text-cyan-200 mb-4">Analysis Engine</h2>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste suspicious email content, a message, or a URL here..."
                className="w-full p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow duration-300"
                rows={8}
                disabled={isLoading}
              />
              <div className="flex flex-wrap gap-3 mt-4">
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={analyzeText} disabled={isLoading || !input.trim()} className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-cyan-500/20">
                  {isLoading ? "Analyzing..." : "Analyze Text"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05, y: -2 }} onClick={handleImageUploadClick} disabled={isLoading} className="bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors px-5 py-2 rounded-lg font-semibold shadow-lg shadow-indigo-500/20">
                  Upload Image
                </motion.button>
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
                          <blockquote className="text-gray-300 mt-1 pl-3 border-l-2 border-cyan-400 bg-slate-900/50 p-2 rounded-r-md text-sm">
                            {latest.explanation}
                          </blockquote>
                        </div>
                      )}
                      <p className="text-gray-300 mt-2 break-words bg-slate-900/50 p-2 rounded-md max-h-24 overflow-y-auto text-sm">
                        <span className="font-semibold text-gray-400">Original Content: </span>{latest.text}
                      </p>
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
                  <motion.div 
                    key={`${h.time}-${i}`} 
                    layout 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`p-4 rounded-lg ${glassEffectClasses}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">{h.label} <span className="text-sm text-gray-300">({h.score}%)</span></div>
                        <div className="text-xs text-gray-400">{h.time}</div>
                      </div>
                    </div>
                    {h.explanation && (
                       <blockquote className="text-gray-300 mt-2 pl-3 border-l-2 border-cyan-400 bg-slate-900/30 p-2 rounded-r-md text-sm">
                         {h.explanation}
                       </blockquote>
                    )}
                    <p className="text-gray-300 mt-2 break-words text-sm bg-slate-900/20 p-2 rounded-md">{h.text}</p>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
