
import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Sparkles, Search, CheckCircle, Download, ChevronRight, ChevronLeft, Layout, PenTool, Image as ImageIcon, Copy, ExternalLink, Loader2, AlertCircle, Maximize2, Wand2, Upload, Zap, TrendingUp, RefreshCw, Layers, ShieldCheck, CreditCard, Play } from 'lucide-react';
import { AppStep, BookProject, ImageSize } from './types';
import { gemini } from './services/geminiService';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.PLAN);
  const [topic, setTopic] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [pageCount, setPageCount] = useState(5);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  const [useProImages, setUseProImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoPilotStatus, setAutoPilotStatus] = useState<string | null>(null);
  const [project, setProject] = useState<BookProject | null>(null);
  const [currentGenerationIndex, setCurrentGenerationIndex] = useState(-1);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [trendInfo, setTrendInfo] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setRefImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const discoverTrend = async () => {
    setLoading(true);
    try {
      const trend = await gemini.findTrendingTopic();
      setTopic(trend.topic);
      setBookTitle(trend.title);
      setTrendInfo(trend.reason);
    } catch (err) {
      alert("ไม่สามารถดึงข้อมูลเทรนด์ได้ในขณะนี้");
    } finally {
      setLoading(false);
    }
  };

  const runDailyAutoEmpire = async () => {
    setLoading(true);
    setStep(AppStep.PLAN);
    try {
      setAutoPilotStatus("กำลังวิเคราะห์ Google Trends และ Pain points ล่าสุด...");
      const trend = await gemini.findTrendingTopic();
      setTopic(trend.topic);
      setBookTitle(trend.title);
      setTrendInfo(trend.reason);

      setAutoPilotStatus("กำลังออกแบบโครงสร้างหนังสือและเนื้อเรื่อง...");
      const structure = await gemini.generateStoryStructure(trend.topic, 5, true);
      const newProject: BookProject = {
        title: trend.title,
        topic: trend.topic,
        pages: structure,
        imageSize: '1K'
      };
      setProject(newProject);
      setStep(AppStep.GENERATE);

      setAutoPilotStatus("กำลังวาดภาพประกอบทั้งหมด (ขั้นตอนนี้อาจใช้เวลาสักครู่)...");
      const updatedPages = [...newProject.pages];
      for (let i = 0; i < updatedPages.length; i++) {
        setAutoPilotStatus(`กำลังสร้างภาพหน้า ${i + 1} จาก ${updatedPages.length}...`);
        setCurrentGenerationIndex(i);
        const imageUrl = await gemini.generateImage(updatedPages[i].imagePrompt, '1K', false);
        updatedPages[i].imageUrl = imageUrl;
        // Local state update for smooth rendering
        setProject(prev => prev ? { ...prev, pages: [...updatedPages] } : null);
      }
      setCurrentGenerationIndex(-1);

      setAutoPilotStatus("กำลังเตรียมข้อมูลการตลาดและ SEO...");
      const seo = await gemini.generateSEO(trend.topic, trend.title);
      setProject(prev => prev ? { ...prev, seo } : null);
      
      setAutoPilotStatus(null);
      setStep(AppStep.PREVIEW);
    } catch (err) {
      console.error(err);
      alert("Auto-Pilot พบข้อผิดพลาด กรุณาลองใหม่");
      setAutoPilotStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const startPlanning = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      let analysis = "";
      if (refImage) {
        analysis = await gemini.analyzeReferenceImage(refImage);
      }
      const structure = await gemini.generateStoryStructure(
        topic + (analysis ? ` (Reference Analysis: ${analysis})` : ""), 
        pageCount, 
        useDeepThinking
      ); 
      setProject({
        title: bookTitle || `The Adventure of ${topic}`,
        topic,
        pages: structure,
        imageSize
      });
      setStep(AppStep.GENERATE);
    } catch (err) {
      alert("การวางแผนล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  const generateSingleImage = async (index: number) => {
    if (!project) return;
    setCurrentGenerationIndex(index);
    try {
      const imageUrl = await gemini.generateImage(project.pages[index].imagePrompt, project.imageSize, false);
      const updatedPages = [...project.pages];
      updatedPages[index].imageUrl = imageUrl;
      setProject({ ...project, pages: updatedPages });
    } catch (err: any) {
      alert("การสร้างภาพล้มเหลว");
    } finally {
      setCurrentGenerationIndex(-1);
    }
  };

  const generateAllImages = async () => {
    if (!project) return;
    setLoading(true);
    for (let i = 0; i < project.pages.length; i++) {
      if (project.pages[i].imageUrl) continue;
      await generateSingleImage(i);
    }
    setLoading(false);
  };

  const handleEditImage = async (index: number) => {
    if (!project || !editPrompt) return;
    setLoading(true);
    try {
      const page = project.pages[index];
      if (page.imageUrl) {
        const newUrl = await gemini.editImage(page.imageUrl, editPrompt);
        const updatedPages = [...project.pages];
        updatedPages[index].imageUrl = newUrl;
        setProject({ ...project, pages: updatedPages });
        setEditingIndex(null);
        setEditPrompt('');
      }
    } catch (err) {
      alert("แก้ไขภาพไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSEO = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const seo = await gemini.generateSEO(project.topic, project.title);
      setProject({ ...project, seo });
      setStep(AppStep.SEO);
    } catch (err) {
      alert("สร้าง SEO ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const downloadAllImagesZip = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`images`);
      project.pages.forEach((p, i) => {
        if (p.imageUrl) {
          const base64 = p.imageUrl.split(',')[1];
          folder?.file(`page_${i + 1}.png`, base64, { base64: true });
        }
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}_Images.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("ดาวน์โหลดล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  const downloadFullKit = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const zip = new JSZip();
      
      const imgFolder = zip.folder("illustrations");
      project.pages.forEach((p, i) => {
        if (p.imageUrl) {
          imgFolder?.file(`page_${i + 1}.png`, p.imageUrl.split(',')[1], { base64: true });
        }
      });

      if (project.seo) {
        zip.file("MARKETING_METADATA.txt", `Title: ${project.seo.title}\n\nDescription:\n${project.seo.description}\n\nTags: ${project.seo.keywords.join(', ')}`);
      }

      const storyText = project.pages.map(p => `Page ${p.pageNumber}:\n${p.text}\n`).join('\n' + '-'.repeat(20) + '\n\n');
      zip.file("STORY_CONTENT.txt", `Book Title: ${project.title}\nTopic: ${project.topic}\n\nCONTENT:\n\n${storyText}`);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}_Assets.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert("ไม่สามารถสร้างชุดไฟล์ได้");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(type);
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: AppStep.PLAN, label: 'Strategy', icon: PenTool },
      { id: AppStep.GENERATE, label: 'Visuals', icon: ImageIcon },
      { id: AppStep.SEO, label: 'Marketing', icon: Search },
      { id: AppStep.PREVIEW, label: 'Result', icon: CheckCircle },
    ];
    return (
      <div className="flex items-center justify-center space-x-2 md:space-x-4 mb-8">
        {steps.map((s, idx) => {
          const isActive = step === s.id;
          const isPast = steps.findIndex(x => x.id === step) > idx;
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all ${isActive ? 'border-blue-500 bg-blue-500/20 text-blue-400' : isPast ? 'border-green-500 bg-green-500 text-white' : 'border-slate-700 text-slate-500'}`}>
                  {isPast ? <CheckCircle size={18} /> : <s.icon size={18} />}
                </div>
                <span className={`text-[8px] md:text-[10px] mt-2 font-bold uppercase tracking-wider ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>{s.label}</span>
              </div>
              {idx < steps.length - 1 && <div className={`h-[1px] w-6 md:w-12 -mt-4 transition-colors ${isPast ? 'bg-green-500' : 'bg-slate-700'}`} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 selection:bg-blue-500/30">
      {/* Auto-Pilot Overlay */}
      {autoPilotStatus && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500 px-4">
          <div className="flex flex-col items-center gap-8 max-w-md w-full text-center p-10 glass rounded-[3rem] border-blue-500/20 shadow-2xl">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="text-blue-500 animate-pulse" size={32} />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-black italic gradient-text uppercase tracking-widest">Auto-Pilot Active</h2>
              <p className="text-slate-200 font-medium leading-relaxed text-sm h-12 flex items-center justify-center">{autoPilotStatus}</p>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
               <div className="bg-blue-500 h-full animate-progress-indeterminate"></div>
            </div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Building Your Passive Empire...</p>
          </div>
        </div>
      )}

      <header className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl shadow-blue-500/20 ring-1 ring-white/10">
            <Zap className="text-white fill-current animate-pulse" size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter italic leading-none">EMPIRE <span className="gradient-text">OS</span></h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-1">One-Click PDF Empire Studio</p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3">
          <button 
            onClick={runDailyAutoEmpire}
            disabled={loading}
            className="flex items-center gap-2 gradient-bg px-8 py-3 rounded-2xl text-white font-black text-xs shadow-xl shadow-blue-600/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 group"
          >
            {loading && !autoPilotStatus ? <Loader2 className="animate-spin" size={16} /> : <Play className="fill-current" size={16} />}
            RUN DAILY GENERATE (ONE-CLICK)
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl flex flex-col items-center">
        {renderStepIndicator()}

        <div className="w-full glass rounded-[2rem] p-6 md:p-10 shadow-2xl relative overflow-hidden border-slate-800 ring-1 ring-white/5">
          {step === AppStep.PLAN && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="text-center space-y-3">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Manual Strategy</h2>
                <div className="flex justify-center items-center gap-2 text-blue-400/80 bg-blue-500/5 py-1 px-4 rounded-full w-fit mx-auto border border-blue-500/10">
                  <ShieldCheck size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Free Tier Optimized (Flash)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Market & Niche</label>
                      <button 
                        onClick={discoverTrend}
                        disabled={loading}
                        className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1"
                      >
                        <TrendingUp size={10} /> DISCOVER TRENDS
                      </button>
                    </div>
                    <textarea 
                      placeholder="พล็อตเรื่อง หรือปล่อยว่างเพื่อใช้ AI Trends..." 
                      className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white resize-none text-sm placeholder:text-slate-600"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                    {trendInfo && (
                      <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Search size={10} /> Trend Insight</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{trendInfo}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Book Title (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="เช่น The Brave Little Lion..." 
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-5 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm placeholder:text-slate-600"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pages</label>
                      <select 
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                        value={pageCount}
                        onChange={(e) => setPageCount(Number(e.target.value))}
                      >
                        {[5, 8, 12, 16].map(n => <option key={n} value={n}>{n} หน้า</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visual Mode</label>
                      <div className="flex gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700">
                        <button 
                          className="flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all bg-blue-600 text-white shadow-lg"
                        >
                          Flash (Free)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon size={14} className="text-blue-500" /> Style Reference
                    </h3>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-800/50 hover:border-blue-500/50 transition-all overflow-hidden relative group"
                    >
                      {refImage ? (
                        <img src={refImage} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <div className="p-3 bg-slate-800 rounded-full text-slate-500 group-hover:scale-110 transition-transform">
                            <Upload size={20} />
                          </div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest text-center px-6">อัปโหลดภาพอ้างอิงสไตล์</p>
                        </>
                      )}
                      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                    </div>
                  </div>

                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 relative">
                        <input 
                          type="checkbox" 
                          id="thinking" 
                          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-blue-500 cursor-pointer appearance-none checked:bg-blue-500 border-2 transition-all"
                          checked={useDeepThinking}
                          onChange={(e) => setUseDeepThinking(e.target.checked)}
                        />
                        {useDeepThinking && <CheckCircle className="absolute inset-0 m-auto text-white" size={12} />}
                      </div>
                      <label htmlFor="thinking" className="text-xs cursor-pointer flex flex-col gap-1">
                        <span className="font-black text-slate-300 uppercase tracking-tighter">Smart Analysis (Free)</span>
                        <span className="text-[10px] text-slate-500 leading-tight">ใช้ Thinking Config กับ Flash Model เพื่อเพิ่มคุณภาพเนื้อเรื่องฟรี</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-6">
                <button 
                  onClick={startPlanning}
                  disabled={loading || !topic}
                  className="w-full max-w-sm gradient-bg hover:opacity-90 active:scale-95 disabled:opacity-50 text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/20 text-xs"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles size={18} />}
                  <span>{loading ? "ANALYZING..." : "START MANUAL GENERATION"}</span>
                </button>
              </div>
            </div>
          )}

          {step === AppStep.GENERATE && project && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-6 md:p-8 rounded-[2rem] border border-slate-800">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/20">
                    <ImageIcon className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-black">{project.title}</h2>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest border text-blue-400 bg-blue-500/10 border-blue-500/20">
                        FLASH VISUALS
                      </span>
                      <span className="text-[8px] font-black text-slate-400 bg-slate-800 px-2 py-0.5 rounded uppercase tracking-widest border border-slate-700">{project.pages.length} PAGES</span>
                    </div>
                  </div>
                </div>
                {!project.pages.every(p => p.imageUrl) && (
                  <button 
                    onClick={generateAllImages}
                    disabled={loading}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                    PAINT ENTIRE BOOK (FREE)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                {project.pages.map((page, idx) => (
                  <div key={idx} className={`relative glass border-slate-800 rounded-3xl overflow-hidden p-5 transition-all ${currentGenerationIndex === idx ? 'ring-2 ring-blue-500 bg-blue-500/5' : 'hover:border-slate-700'}`}>
                    <div className="aspect-square bg-slate-900 rounded-2xl mb-5 overflow-hidden relative border border-slate-800 group shadow-inner">
                      {page.imageUrl ? (
                        <>
                          <img src={page.imageUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-cover transition-all group-hover:scale-105 duration-700" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                             <button 
                              onClick={() => generateSingleImage(idx)}
                              className="bg-white/10 backdrop-blur-md p-3 rounded-xl text-white hover:bg-blue-600 transition-all border border-white/20"
                              title="Generate Preview"
                            >
                              <Play size={18} fill="currentColor" />
                            </button>
                             <button 
                              onClick={() => setEditingIndex(idx)}
                              className="bg-white/10 backdrop-blur-md p-3 rounded-xl text-white hover:bg-indigo-600 transition-all border border-white/20"
                              title="AI Editor"
                            >
                              <Wand2 size={18} />
                            </button>
                            <button 
                              onClick={() => generateSingleImage(idx)}
                              className="bg-white/10 backdrop-blur-md p-3 rounded-xl text-white hover:bg-slate-700 transition-all border border-white/20"
                              title="Redraw / Resubmit"
                            >
                              <RefreshCw size={18} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                          {currentGenerationIndex === idx ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                              <span className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em] animate-pulse">Rendering...</span>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                               <button 
                                onClick={() => generateSingleImage(idx)}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-blue-500 transition-all flex items-center gap-2"
                              >
                                <Play size={12} fill="currentColor" /> Preview
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-black bg-slate-800 text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">PAGE {idx + 1}</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed font-medium italic">"{page.text}"</p>
                    </div>

                    {editingIndex === idx && (
                      <div className="absolute inset-0 bg-slate-950/98 flex flex-col items-center justify-center p-8 z-20 animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-full max-w-xs space-y-6">
                          <div className="text-center">
                            <h4 className="font-black text-sm uppercase tracking-widest mb-1">AI Smart Editor (Flash)</h4>
                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Fast Modification Mode</p>
                          </div>
                          <div className="space-y-2">
                            <input 
                              type="text" 
                              placeholder="เช่น 'Add a blue hat' หรือ 'Change background to forest'..." 
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                              value={editPrompt}
                              onChange={(e) => setEditPrompt(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => { setEditingIndex(null); setEditPrompt(''); }}
                              className="flex-1 py-3 rounded-xl bg-slate-800 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all text-slate-400"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleEditImage(idx)}
                              disabled={loading || !editPrompt}
                              className="flex-1 py-3 rounded-xl gradient-bg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                              Update
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {project.pages.every(p => p.imageUrl) && (
                <div className="flex justify-end pt-8 border-t border-slate-800">
                  <button 
                    onClick={handleGenerateSEO}
                    className="gradient-bg text-white px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:scale-105 transition-all text-[11px]"
                  >
                    <span>NEXT: SMART MARKETING</span>
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </div>
          )}

          {step === AppStep.SEO && project?.seo && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-black uppercase tracking-tight">AI Sales Assistant</h2>
                <p className="text-slate-400 text-sm">คัดลอกข้อมูลเหล่านี้ไปใช้ใน Etsy หรือ Amazon KDP เพื่อประสิทธิภาพสูงสุด</p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Layout size={12} /> Product Title
                    </label>
                    {copyFeedback === 'title' && <span className="text-[9px] text-green-400 font-black uppercase animate-pulse">Copied!</span>}
                  </div>
                  <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 flex justify-between items-center group shadow-inner">
                    <span className="text-slate-200 text-sm font-bold leading-relaxed">{project.seo.title}</span>
                    <button 
                      onClick={() => copyToClipboard(project.seo!.title, 'title')} 
                      className="ml-4 text-slate-500 hover:text-blue-400 transition-all p-2 bg-slate-800 rounded-lg"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <PenTool size={12} /> Description
                    </label>
                    {copyFeedback === 'desc' && <span className="text-[9px] text-green-400 font-black uppercase animate-pulse">Copied!</span>}
                  </div>
                  <div className="relative">
                    <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 h-56 overflow-y-auto text-sm text-slate-400 leading-relaxed scrollbar-hide">
                      {project.seo.description}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(project.seo!.description, 'desc')} 
                      className="absolute top-4 right-4 text-slate-500 hover:text-blue-400 p-2 bg-slate-800 rounded-xl transition-all"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Search size={12} /> Search Keywords (Tags)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {project.seo.keywords.map((tag, i) => (
                      <span key={i} className="bg-slate-900 text-blue-400 text-[9px] font-black px-4 py-2 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all uppercase tracking-widest">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-8 border-t border-slate-800">
                <button 
                  onClick={() => setStep(AppStep.GENERATE)} 
                  className="text-slate-500 hover:text-white font-bold px-6 py-3 rounded-xl border border-slate-800 hover:bg-slate-800 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest"
                >
                  <ChevronLeft size={16} /> Back to Canvas
                </button>
                <button 
                  onClick={() => setStep(AppStep.PREVIEW)} 
                  className="gradient-bg text-white px-10 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-blue-500/30 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em]"
                >
                  PREVIEW FINAL KIT <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === AppStep.PREVIEW && project && (
            <div className="space-y-12 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-500/10 text-green-400 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-green-500/20">
                  <CheckCircle size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight italic">EMPIRE ASSETS READY!</h2>
                  <p className="text-slate-400 text-sm">ยินดีด้วย! ทรัพย์สินดิจิทัลของคุณพร้อมสำหรับการสร้างรายได้แล้ว</p>
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-[2.5rem] p-8 md:p-12 border border-slate-800 flex flex-col lg:flex-row gap-10 text-left relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[100px] pointer-events-none transition-all group-hover:bg-blue-500/20"></div>
                
                <div className="w-full lg:w-2/5 aspect-square rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 ring-4 ring-slate-900 transition-transform duration-700 group-hover:rotate-1">
                  {project.pages[0].imageUrl && <img src={project.pages[0].imageUrl} alt="Cover" className="w-full h-full object-cover" />}
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-3xl font-black leading-tight">{project.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <div className="bg-blue-500/10 text-blue-400 font-black px-3 py-1.5 rounded-lg text-[8px] border border-blue-500/20 tracking-widest uppercase">{project.pages.length} PAGES</div>
                        <div className="bg-green-500/10 text-green-400 font-black px-3 py-1.5 rounded-lg text-[8px] border border-green-500/20 tracking-widest uppercase">FREE TIER (FLASH)</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-xs text-slate-400 leading-relaxed italic">
                        "อาณาจักร PDF ของคุณถูกสร้างขึ้นโดย AI และพร้อมที่จะกลายเป็น Passive Income ตลอด 24 ชม."
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                    <button 
                      onClick={downloadFullKit}
                      disabled={loading}
                      className="bg-white text-slate-900 hover:bg-slate-200 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all shadow-xl disabled:opacity-50 active:scale-95"
                    >
                      {loading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                      Download Assets (.zip)
                    </button>
                    <button 
                      onClick={downloadAllImagesZip}
                      disabled={loading}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all border border-slate-700"
                    >
                      <ImageIcon size={16} /> Download Images (.zip)
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-10 pt-10 border-t border-slate-900">
                <button 
                  onClick={() => {
                    setStep(AppStep.PLAN);
                    setProject(null);
                    setTopic('');
                    setBookTitle('');
                    setRefImage(null);
                    setTrendInfo(null);
                  }}
                  className="text-slate-500 hover:text-blue-400 font-black uppercase tracking-[0.3em] text-[9px] underline underline-offset-[10px] transition-all"
                >
                  START NEW PROJECT
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-16 text-center text-slate-700 text-[9px] pb-16 space-y-4">
          <p className="uppercase tracking-[0.4em] font-black opacity-50 italic">Industrial Grade Passive PDF Engine • Optimized for Gemini Free Tier (Flash Only)</p>
          <div className="flex justify-center items-center gap-6 font-bold tracking-widest uppercase opacity-40">
             <span>Flash 3.0 Preview</span>
             <span>•</span>
             <span>Flash Lite</span>
             <span>•</span>
             <span>Search Grounding</span>
          </div>
          <div className="flex justify-center gap-4 text-slate-800">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="hover:text-blue-500 underline transition-colors">Billing Documentation</a>
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes progress-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-progress-indeterminate {
          animation: progress-indeterminate 1.5s infinite linear;
          width: 50%;
        }
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default App;
