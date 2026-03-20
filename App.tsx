import React, { useState } from 'react';
import { generateDesignPlan, generatePosterFromPlan, generateWhiteBg, rebuildPromptFromBrief, DesignPlan } from './services/geminiService';
import { Sparkles, Upload, X, Download, ImageIcon, Monitor, Tv, Settings2, Layout, Layers, Leaf, Palette, Wand2, Scissors, Check, ArrowRight, Pencil, Save, FolderOpen } from 'lucide-react';

type AppState = 'idle' | 'removing-bg' | 'planning' | 'planned' | 'generating' | 'completed';

const App: React.FC = () => {
  const [productName, setProductName] = useState('');
  const [customReq, setCustomReq] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [position, setPosition] = useState('右侧');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [whiteBgImage, setWhiteBgImage] = useState<string | null>(null);
  const [ingredientImages, setIngredientImages] = useState<string[]>([]);
  const [designPlan, setDesignPlan] = useState<DesignPlan | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>('idle');

  // 用于传给后续步骤的产品图：优先用白底图，没有就用原图
  const productImage = whiteBgImage || originalImage;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
        setWhiteBgImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIngredientUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => setIngredientImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeIngredientImage = (index: number) => {
    setIngredientImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 第零步：生成白底图
  const handleRemoveBg = async () => {
    if (!originalImage) return;
    setAppState('removing-bg');
    try {
      const result = await generateWhiteBg(originalImage);
      setWhiteBgImage(result);
      setAppState('idle');
    } catch (error) {
      console.error(error);
      alert("抠图失败，请重试");
      setAppState('idle');
    }
  };

  // 第一步：策划设计方案
  const handlePlan = async () => {
    if (!productName) { alert("请输入产品名称"); return; }
    setAppState('planning');
    setDesignPlan(null);
    setGeneratedImage(null);
    try {
      const plan = await generateDesignPlan(
        productName, customReq, productImage || undefined, ingredientImages, quantity, position
      );
      setDesignPlan(plan);
      setAppState('planned');
    } catch (error) {
      console.error(error);
      alert("方案策划失败，请重试");
      setAppState('idle');
    }
  };

  // 第二步：根据方案生成海报
  const handleGenerate = async () => {
    if (!designPlan) return;
    setAppState('generating');
    try {
      const result = await generatePosterFromPlan(
        designPlan.imagePrompt,
        designPlan.ingredientTable || '',
        productImage || undefined,
        ingredientImages
      );
      setGeneratedImage(result);
      setAppState('completed');
    } catch (error) {
      console.error(error);
      alert("图片生成失败，请重试");
      setAppState('planned');
    }
  };

  const reset = () => {
    setGeneratedImage(null);
    setDesignPlan(null);
    setProductName('');
    setCustomReq('');
    setOriginalImage(null);
    setWhiteBgImage(null);
    setIngredientImages([]);
    setQuantity('1');
    setPosition('右侧');
    setAppState('idle');
    setEditingPlan(false);
  };

  const clearProductImage = () => {
    setOriginalImage(null);
    setWhiteBgImage(null);
  };

  const [editingPlan, setEditingPlan] = useState(false);

  // 方案段落定义
  const sectionDefs = [
    { key: '色调', color: 'text-rose-400' },
    { key: '场景故事', color: 'text-amber-400' },
    { key: '远景', color: 'text-blue-400' },
    { key: '中景', color: 'text-emerald-400' },
    { key: '近景', color: 'text-orange-400' },
    { key: '光影', color: 'text-yellow-400' },
    { key: '氛围关键词', color: 'text-purple-400' },
  ];

  // 解析设计方案文本
  const parsePlanSections = (text: string) => {
    const sections: { title: string; fullTitle: string; content: string; color: string }[] = [];
    for (const p of sectionDefs) {
      const regex = new RegExp(`(【${p.key}[^】]*】)([\\s\\S]*?)(?=【|$)`);
      const match = text.match(regex);
      if (match) {
        sections.push({ title: p.key, fullTitle: match[1], content: match[2].trim(), color: p.color });
      }
    }
    return sections;
  };

  // 更新方案中某个段落的内容
  const updatePlanSection = (sectionKey: string, newContent: string) => {
    if (!designPlan) return;
    const text = designPlan.displayText;
    const regex = new RegExp(`(【${sectionKey}[^】]*】)[\\s\\S]*?(?=【|$)`);
    const newText = text.replace(regex, `$1\n${newContent}\n\n`);
    setDesignPlan({ ...designPlan, displayText: newText.trim() });
  };

  // 用修改后的中文方案重新生成英文 scenePrompt + ingredientTable
  const rebuildImagePrompt = async () => {
    if (!designPlan) return;
    setAppState('planning');
    try {
      const result = await rebuildPromptFromBrief(
        designPlan.displayText, productName, quantity, position
      );
      setDesignPlan({
        ...designPlan,
        imagePrompt: result.imagePrompt,
        ingredientTable: result.ingredientTable,
      });
      setEditingPlan(false);
      setAppState('planned');
    } catch (error) {
      console.error(error);
      alert("方案更新失败");
      setAppState('planned');
    }
  };

  const isInputLocked = appState === 'removing-bg' || appState === 'planning' || appState === 'generating';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-rose-500/30">
      {/* Header */}
      <nav className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-rose-500 to-orange-500 p-2 rounded-xl shadow-lg shadow-rose-500/20">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AI 视觉生成工坊</h1>
              <p className="text-[10px] font-bold text-rose-500 tracking-[0.2em] uppercase opacity-80">Visual Generation Studio</p>
            </div>
          </div>
          {(designPlan || generatedImage || whiteBgImage) && (
            <button onClick={reset} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              重置全部
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ======= 左侧：参数输入 ======= */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <Settings2 className="w-4 h-4" /> 产品信息
            </div>

            {/* 产品名称 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">产品名称</label>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={isInputLocked}
                placeholder="例如：香港大药房酸枣仁膏"
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 outline-none transition disabled:opacity-50"
              />
            </div>

            {/* 数量 & 位置 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3" /> 产品数量
                </label>
                <select value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={isInputLocked}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 outline-none transition appearance-none disabled:opacity-50">
                  <option value="1">1 件</option>
                  <option value="2">2 件</option>
                  <option value="3">3 件</option>
                  <option value="组合">多件组合</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layout className="w-3 h-3" /> 产品位置
                </label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} disabled={isInputLocked}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 outline-none transition appearance-none disabled:opacity-50">
                  <option value="右侧">居右</option>
                  <option value="左侧">居左</option>
                  <option value="居中">居中</option>
                </select>
              </div>
            </div>

            {/* ===== 产品包装图 — 含白底图流程 ===== */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">产品包装图</label>

              {originalImage ? (
                <div className="space-y-3">
                  {/* 原图 vs 白底图 对比 */}
                  <div className={`grid gap-3 ${whiteBgImage ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {/* 原图 */}
                    <div className="relative">
                      <div className={`aspect-square rounded-xl overflow-hidden border bg-black/20 ${whiteBgImage ? 'border-white/5' : 'border-white/10'}`}>
                        <img src={originalImage} className="w-full h-full object-contain" alt="原图" />
                      </div>
                      <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-slate-300 px-2 py-0.5 rounded-md">原图</span>
                      <button onClick={clearProductImage} disabled={isInputLocked}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 p-1 rounded-full shadow-lg transition">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>

                    {/* 白底图 */}
                    {whiteBgImage && (
                      <div className="relative">
                        <div className="aspect-square rounded-xl overflow-hidden border border-emerald-500/30 bg-white">
                          <img src={whiteBgImage} className="w-full h-full object-contain" alt="白底图" />
                        </div>
                        <span className="absolute bottom-2 left-2 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="w-3 h-3" /> 白底图
                        </span>
                        {/* 保存白底图 */}
                        <a href={whiteBgImage} download={`${productName || '产品'}_白底图.png`}
                          className="absolute top-2 right-2 bg-emerald-600 hover:bg-emerald-500 p-1.5 rounded-full shadow-lg transition" title="保存白底图">
                          <Save className="w-3 h-3 text-white" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* 抠图 / 上传白底图 按钮 */}
                  {!whiteBgImage && appState !== 'removing-bg' && (
                    <div className="flex gap-2">
                      <button onClick={handleRemoveBg}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition active:scale-[0.98] bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg shadow-cyan-500/10">
                        <Scissors className="w-4 h-4" />
                        AI 抠图
                      </button>
                      <label className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-300 flex items-center justify-center gap-2 transition cursor-pointer border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5">
                        <FolderOpen className="w-4 h-4" />
                        用已有白底图
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setWhiteBgImage(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} />
                      </label>
                    </div>
                  )}
                  {appState === 'removing-bg' && (
                    <div className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-slate-700 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      正在抠图...
                    </div>
                  )}
                  {whiteBgImage && (
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-emerald-400/80">白底图将用于后续生成</p>
                      <button onClick={() => setWhiteBgImage(null)} disabled={isInputLocked}
                        className="text-[11px] text-slate-500 hover:text-rose-400 transition">重新抠图</button>
                    </div>
                  )}
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-white/10 hover:border-rose-500/50 hover:bg-rose-500/5 cursor-pointer transition group ${isInputLocked ? 'pointer-events-none opacity-50' : ''}`}>
                  <Upload className="w-8 h-8 text-slate-600 group-hover:text-rose-500 transition mb-2" />
                  <span className="text-xs text-slate-500 font-medium">点击上传产品原图</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              )}
            </div>

            {/* 配料/属性 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">配料 / 核心属性</label>
              <textarea
                value={customReq}
                onChange={(e) => setCustomReq(e.target.value)}
                disabled={isInputLocked}
                rows={3}
                placeholder="产品的配料表或核心卖点，例如：&#10;酸枣仁、百合、茯苓、桂圆、莲子"
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 outline-none transition resize-none text-sm disabled:opacity-50"
              />
            </div>

            {/* 配料参考图 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Leaf className="w-3 h-3" /> 配料参考图 (可选)
              </label>
              <p className="text-[11px] text-slate-500">上传配料实物照片，避免AI混淆相似食材</p>
              {ingredientImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {ingredientImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/20">
                      <img src={img} className="w-full h-full object-cover" alt={`配料${idx + 1}`} />
                      <button onClick={() => removeIngredientImage(idx)} disabled={isInputLocked}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 p-1 rounded-full shadow-lg transition">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer transition group ${isInputLocked ? 'pointer-events-none opacity-50' : ''}`}>
                <Upload className="w-4 h-4 text-slate-600 group-hover:text-amber-500 transition" />
                <span className="text-xs text-slate-500 font-medium group-hover:text-amber-400">点击上传配料照片</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleIngredientUpload} />
              </label>
            </div>

            {/* ===== 操作按钮 ===== */}
            <div className="space-y-3 pt-2">

              {/* 步骤指示 */}
              {appState === 'idle' && !designPlan && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    策划方案
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 text-[10px] font-bold flex items-center justify-center">2</span>
                    生成海报
                  </div>
                </div>
              )}

              {/* 策划方案按钮 */}
              {(appState === 'idle' || appState === 'planned' || appState === 'completed') && (
                <button onClick={handlePlan}
                  className="w-full py-3.5 rounded-xl font-bold text-white shadow-xl shadow-purple-500/10 flex items-center justify-center gap-2 transition active:scale-[0.98] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500">
                  <Palette className="w-5 h-5" />
                  {designPlan ? '重新策划方案' : '策划设计方案'}
                </button>
              )}

              {appState === 'planning' && (
                <div className="w-full py-3.5 rounded-xl font-bold text-white bg-slate-700 flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  正在策划设计方案...
                </div>
              )}

              {/* 生成海报按钮 */}
              {(appState === 'planned' || appState === 'completed') && (
                <button onClick={handleGenerate}
                  className="w-full py-3.5 rounded-xl font-bold text-white shadow-xl shadow-rose-500/10 flex items-center justify-center gap-2 transition active:scale-[0.98] bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500">
                  <Wand2 className="w-5 h-5" />
                  {generatedImage ? '同方案再生一张' : '生成海报'}
                </button>
              )}

              {appState === 'generating' && (
                <div className="w-full py-3.5 rounded-xl font-bold text-white bg-slate-700 flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  正在渲染海报...
                </div>
              )}
            </div>
          </div>

          {/* 流程提示 */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">三步流程</h4>
            <ul className="text-[11px] text-slate-400 space-y-2 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-cyan-500 font-bold">0</span>
                <span><strong>抠图：</strong>上传产品图 → AI去背景生成白底图，提高包装还原度</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-500 font-bold">1</span>
                <span><strong>策划：</strong>AI根据产品+配料推导色调、场景故事、三层构图</span>
              </li>
              <li className="flex gap-2">
                <span className="text-rose-500 font-bold">2</span>
                <span><strong>生图：</strong>严格按方案渲染1920x1080，场景+配料+产品一致</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ======= 右侧：方案 + 画布 ======= */}
        <div className="lg:col-span-8 space-y-6">

          {/* 设计方案展示 — 可编辑 */}
          {designPlan && (
            <div className={`bg-slate-800/50 border rounded-2xl p-5 space-y-3 ${editingPlan ? 'border-amber-500/40' : 'border-white/10'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" /> 设计方案
                  {editingPlan && <span className="text-[10px] text-amber-400 font-normal">编辑中</span>}
                </h3>
                <div className="flex items-center gap-3">
                  {!editingPlan && (appState === 'planned' || appState === 'completed') && (
                    <button onClick={() => setEditingPlan(true)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-400 transition font-medium">
                      <Pencil className="w-3 h-3" /> 修改方案
                    </button>
                  )}
                  {editingPlan && (
                    <>
                      <button onClick={() => setEditingPlan(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-300 transition font-medium">
                        取消
                      </button>
                      <button onClick={rebuildImagePrompt}
                        className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition font-bold bg-amber-500/10 px-3 py-1.5 rounded-lg">
                        <Check className="w-3 h-3" /> 确认修改并更新
                      </button>
                    </>
                  )}
                  {!editingPlan && appState === 'planned' && (
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
                      方案就绪
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsePlanSections(designPlan.displayText).map((sec, i) => (
                  <div key={i} className={`bg-slate-900/50 rounded-xl p-3 ${sec.title === '场景故事' ? 'sm:col-span-2' : ''}`}>
                    <div className={`text-xs font-bold ${sec.color} mb-1`}>{sec.title}</div>
                    {editingPlan ? (
                      <textarea
                        value={sec.content}
                        onChange={(e) => updatePlanSection(sec.title, e.target.value)}
                        rows={sec.title === '场景故事' ? 2 : sec.title === '近景' ? 5 : 3}
                        className="w-full bg-slate-800/80 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-slate-200 leading-relaxed focus:ring-1 focus:ring-amber-500/50 outline-none transition resize-none"
                      />
                    ) : (
                      <p className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                    )}
                  </div>
                ))}
              </div>
              {editingPlan && (
                <p className="text-[11px] text-amber-400/60 text-center pt-1">
                  修改后点击"确认修改并更新"，AI会根据你的修改重新生成画图指令
                </p>
              )}
            </div>
          )}

          {/* 画布预览 */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Monitor className="w-5 h-5 text-rose-500" /> 画布预览 (1920x1080)
            </h3>
            {generatedImage && (
              <a href={generatedImage} download={`Yihe_Poster_${productName}.png`}
                className="flex items-center gap-2 text-xs font-bold text-rose-500 hover:text-rose-400 transition">
                <Download className="w-4 h-4" /> 下载原图
              </a>
            )}
          </div>

          <div className="relative aspect-video bg-slate-800 rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
            {(appState === 'planning' || appState === 'generating' || appState === 'removing-bg') ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
                <div className="relative w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-4 border-rose-500/20 rounded-full animate-ping" />
                  <div className="absolute inset-2 border-4 border-rose-500/40 rounded-full animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {appState === 'removing-bg'
                      ? <Scissors className="w-8 h-8 text-cyan-500" />
                      : appState === 'planning'
                        ? <Palette className="w-8 h-8 text-purple-500" />
                        : <ImageIcon className="w-8 h-8 text-rose-500" />
                    }
                  </div>
                </div>
                <h4 className="text-xl font-bold text-white">
                  {appState === 'removing-bg' ? '正在抠图' : appState === 'planning' ? '正在策划设计方案' : '正在渲染海报'}
                </h4>
                <p className="text-slate-500 text-sm mt-2">
                  {appState === 'removing-bg'
                    ? '去除背景，生成纯白底产品图...'
                    : appState === 'planning'
                      ? '分析产品特征，推导色调、场景、构图...'
                      : '按设计方案严格渲染 1080P 商业海报...'
                  }
                </p>
              </div>
            ) : generatedImage ? (
              <>
                <img src={generatedImage} className="w-full h-full object-cover" alt="Generated" />
                <div className="absolute top-8 left-0 right-0 text-center pointer-events-none opacity-40 group-hover:opacity-100 transition duration-500">
                  <div className="inline-block border-2 border-dashed border-white/30 rounded-lg px-10 py-6">
                    <p className="text-3xl font-black text-white/50 tracking-[0.5em]">XXXXXX</p>
                    <p className="text-sm font-medium text-white/40 tracking-[0.2em] mt-2">xxxxxx</p>
                    <p className="text-[10px] text-white/20 mt-4 uppercase">文案预留区</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                <ImageIcon className="w-20 h-20 mb-4 opacity-10" />
                <p className="text-sm font-medium opacity-40">
                  {originalImage ? '产品图已上传，建议先抠图再策划方案' : '上传产品图开始'}
                </p>
              </div>
            )}
          </div>

          {/* 底部提示 */}
          <div className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 flex gap-4 items-center">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300">设计流程说明</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                白底图让AI准确识别产品包装外观；设计方案确定色调和场景叙事；生图时中文方案作为约束同步传入，确保场景遵从度。
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;
