// ==========================================================
// V3.7: 压缩弹簧计算器核心 JavaScript 逻辑
// ==========================================================

// --- 1. 数据常量定义 ---
const MATERIALS = {
    'oil_tempered_chrome_silicon': { label: '油回火铬硅钢 (OTCS)', G: 77200, G_imp: 11200000, desc: '高强度，疲劳寿命长' },
    'music_wire': { label: '琴钢丝 (Music Wire)', G: 80000, G_imp: 11600000, desc: '最常用，疲劳性能优异' },
    'stainless_steel_302': { label: '不锈钢 302 (SS302)', G: 70000, G_imp: 10150000, desc: '耐腐蚀性好，中等强度' },
};

const FIELDS = {
    design: [
        { id: 'load', label: '目标载荷 (F)', unit_m: 'N', unit_i: 'lb', type: 'number', required: true, desc: '在压缩量 $\\delta$ 处需要的力' },
        { id: 'compress', label: '目标压缩量 ($\\delta$)', unit_m: 'mm', unit_i: 'in', type: 'number', required: true, desc: '弹簧在此载荷下的变形量' },
        { id: 'wire_dia', label: '钢丝直径 (d)', unit_m: 'mm', unit_i: 'in', type: 'number', required: false, val: 2.0, desc: '弹簧线的直径' },
        { id: 'mean_dia', label: '弹簧中径 (D)', unit_m: 'mm', unit_i: 'in', type: 'number', required: false, val: 18.0, desc: '弹簧线圈的平均直径' },
        { id: 'free_height', label: '自由高度 (L0)', unit_m: 'mm', unit_i: 'in', type: 'number', required: false, val: 40.0, desc: '弹簧在未受力时的总长' },
        { id: 'end_condition', label: '端部形状', type: 'select', required: false, val: 2, options: [
            { label: '并圈磨平 (Squared and Ground)', val: 2 },
            { label: '并圈未磨平 (Squared)', val: 1.5 },
            { label: '开圈未磨平 (Open)', val: 1 },
        ], desc: '影响总圈数和压并高度' }
    ],
    analysis: [
        { id: 'wire_dia', label: '钢丝直径 (d)', unit_m: 'mm', unit_i: 'in', type: 'number', required: true, desc: '弹簧线的直径' },
        { id: 'mean_dia', label: '弹簧中径 (D)', unit_m: 'mm', unit_i: 'in', type: 'number', required: true, desc: '弹簧线圈的平均直径' },
        { id: 'coils', label: '有效圈数 (n)', unit_m: '圈', unit_i: '圈', type: 'number', required: true, desc: '参与受力的线圈数量' },
        { id: 'free_height', label: '自由高度 (L0)', unit_m: 'mm', unit_i: 'in', type: 'number', required: true, desc: '弹簧在未受力时的总长' },
        { id: 'end_condition', label: '端部形状', type: 'select', required: false, val: 2, options: [
            { label: '并圈磨平 (Squared and Ground)', val: 2 },
            { label: '并圈未磨平 (Squared)', val: 1.5 },
            { label: '开圈未磨平 (Open)', val: 1 },
        ], desc: '影响总圈数和压并高度' }
    ]
};

const DEFAULT_VALUES_METRIC = { wire_dia: 2.0, mean_dia: 18.0, free_height: 40.0 };
const DEFAULT_VALUES_IMPERIAL = { wire_dia: 0.0787, mean_dia: 0.7087, free_height: 1.5748 }; // 对应的英寸值 (约)

// --- 2. 状态变量 ---
let currentUnit = 'metric'; // 'metric' | 'imperial'
let currentMode = 'design'; // 'design' | 'analysis'
let calcResult = {};
let history = JSON.parse(localStorage.getItem('springCalcHistory')) || [];

// --- 3. 核心计算逻辑 ---

function calculate(saveHistory = true) {
    const matKey = document.getElementById('material').value;
    const G = currentUnit === 'metric' ? MATERIALS[matKey].G : MATERIALS[matKey].G_imp;
    
    let resultData = [];
    
    // --- 辅助函数：获取输入值 ---
    const getVal = (id) => {
        const inputEl = document.getElementById(id);
        const val = inputEl?.value;
        const field = FIELDS[currentMode].find(f => f.id === id);
        
        if (val === null || val === undefined || val.trim() === "") {
            // 设计模式下的默认值（针对特定参数）
            if (currentMode === 'design' && ['wire_dia', 'mean_dia', 'free_height'].includes(id)) {
                return currentUnit === 'metric' ? DEFAULT_VALUES_METRIC[id] : DEFAULT_VALUES_IMPERIAL[id];
            }
            // 使用字段配置中的默认值或 NaN
            if (field && field.val !== undefined) {
                 if (field.type === 'select') {
                    // 对于 Select 字段，val 存储的是数值
                    return field.val;
                }
                return field.val;
            }
            return NaN; 
        }
        
        // 对于 Select 字段，需要获取其选定的数值
        if (field && field.type === 'select') {
            return parseFloat(val);
        }
        
        return parseFloat(val);
    };
    
    // 检查必填项
    const requiredFields = FIELDS[currentMode].filter(f => f.required);
    let allValid = true;
    let requiredParams = {};

    for (const field of requiredFields) {
        const val = getVal(field.id);
        if (isNaN(val) || val <= 0) {
            allValid = false;
        }
        requiredParams[field.id] = val; // 收集值，即使是 NaN
    }
    
    if (!allValid) {
        document.getElementById('error-message').textContent = '请输入所有必填参数，且值须大于 0。';
        document.getElementById('error-box').classList.remove('hidden');
        return;
    }

    let load, comp, d, D, n, L0_input, total_coils_factor;
    
    // 获取端部系数（n_a）
    total_coils_factor = getVal('end_condition');

    if (currentMode === 'design') {
        load = getVal('load'); comp = getVal('compress'); d = getVal('wire_dia'); D = getVal('mean_dia'); L0_input = getVal('free_height'); 
        
        // 弹簧指数
        const C = D / d;
        // 瓦尔因子 (Wahl Factor)
        const Kw = (4*C-1)/(4*C-4) + 0.615/C;
        // 必需刚度
        const k_req = load / comp;
        
        // 1. 计算理论有效圈数 $n_{theory}$
        let n_theory = (G * Math.pow(d, 4)) / (8 * Math.pow(D, 3) * k_req);
        
        // 2. 关键优化：将有效圈数四舍五入到最近的 0.5 圈
        n = Math.round(n_theory * 2) / 2; 

        // 3. 使用取整后的圈数重新计算**实际刚度** $k_{actual}$
        const k_actual = (G * Math.pow(d, 4)) / (8 * Math.pow(D, 3) * n);
        
        // 4. 计算**实际最大载荷**和**剪切应力**
        const F_actual = k_actual * comp; // 实际载荷 = 实际刚度 * 压缩量
        const tau = (8 * F_actual * D * Kw) / (Math.PI * Math.pow(d, 3));
        
        // 5. 计算压并长度和最大压缩量
        const L0_final = L0_input; 
        const Lt = (n + total_coils_factor) * d; // 总圈数 Lt = n + n_a
        const maxComp = Math.max(0, L0_final - Lt);
        const maxLoad = k_actual * maxComp; // 压并载荷
        const tau_s = (8 * maxLoad * D * Kw) / (Math.PI * Math.pow(d, 3)); // 压并应力
        
        // 6. 确定许用应力
        const allowableStress = currentUnit === 'metric' ? 800 : 116000; // 简化许用应力 (MPa 或 psi)
        const sf = allowableStress / tau;
        const sf_s = allowableStress / tau_s; // 压并安全系数

        calcResult = { 
            mode: 'design',
            unit: currentUnit,
            d: d, D: D, n: n, L0: L0_final, Lt: Lt,
            k: k_actual, 
            load_design: F_actual, 
            stress_design: tau, 
            maxComp: maxComp, 
            load_max: maxLoad,
            stress_max: tau_s,
            sf: sf
        };

        resultData = [
            { id: 'wire_dia', label: '钢丝直径 (d)', val: d, unit: currentUnit==='metric'?'mm':'in', highlight: true },
            { id: 'coils', label: '推荐有效圈数 (n)', val: n, unit: '圈', icon: 'fa-spin fa-circle-notch', highlight: true },
            { id: 'stiffness', label: '实际刚度 (k)', val: k_actual, unit: currentUnit==='metric'?'N/mm':'lb/in' },
            { id: 'load_actual', label: '实际设计载荷 (F)', val: F_actual, unit: currentUnit==='metric'?'N':'lb' },
            { id: 'stress_design', label: '设计剪切应力(τ)', val: tau, unit: currentUnit==='metric'?'MPa':'psi', color: tau > allowableStress ? 'text-red-500' : 'text-green-600' },
            { id: 'safety_factor', label: '设计安全系数 (SF)', val: sf, unit: '', color: sf < 1.2 ? 'text-red-500' : 'text-green-600' },
            { id: 'solid_height', label: '压并高度 (Lt)', val: Lt, unit: currentUnit==='metric'?'mm':'in' },
            { id: 'stress_solid', label: '压并应力(τs)', val: tau_s, unit: currentUnit==='metric'?'MPa':'psi', color: tau_s > 1.2 * allowableStress ? 'text-red-500' : 'text-green-600' }
        ];
        

    } else { // --- 2. 分析模式 (analysis) ---
        d = getVal('wire_dia'); D = getVal('mean_dia'); n = getVal('coils'); const L0 = getVal('free_height');

        // 弹簧指数
        const C = D / d;
        // 瓦尔因子 (Wahl Factor)
        const Kw = (4*C-1)/(4*C-4) + 0.615/C;
        // 刚度
        const k = (G * Math.pow(d, 4)) / (8 * Math.pow(D, 3) * n);
        
        // 压并长度 (Solid Height)
        const Lt = (n + total_coils_factor) * d; 
        // 最大压缩量
        const maxComp = Math.max(0, L0 - Lt);
        // 最大载荷 (压并载荷)
        const maxLoad = k * maxComp;
        // 压并剪切应力
        const stress = (8 * maxLoad * D * Kw) / (Math.PI * Math.pow(d, 3));
        
        // 确定许用应力
        const allowableStress = currentUnit === 'metric' ? 1000 : 145000; // 简化许用应力
        const sf = allowableStress / stress;

        calcResult = { 
            mode: 'analysis',
            unit: currentUnit,
            d: d, D: D, n: n, L0: L0, Lt: Lt,
            k: k, 
            maxComp: maxComp, 
            load_max: maxLoad, 
            stress_max: stress,
            sf: sf
        };

        resultData = [
            { id: 'stiffness', label: '弹簧刚度 (k)', val: k, unit: currentUnit==='metric'?'N/mm':'lb/in', highlight: true },
            { id: 'load_max', label: '压并载荷 (Fmax)', val: maxLoad, unit: currentUnit==='metric'?'N':'lb', highlight: true },
            { id: 'max_compress', label: '最大压缩量 (δmax)', val: maxComp, unit: currentUnit==='metric'?'mm':'in' },
            { id: 'solid_height', label: '压并高度 (Lt)', val: Lt, unit: currentUnit==='metric'?'mm':'in' },
            { id: 'stress', label: '压并剪切应力(τs)', val: stress, unit: currentUnit==='metric'?'MPa':'psi', color: stress > allowableStress ? 'text-red-500' : 'text-green-600' },
            { id: 'safety_factor', label: '压并安全系数 (SF)', val: sf, unit: '', color: sf < 1.2 ? 'text-red-500' : 'text-green-600' }
        ];
    }

    document.getElementById('error-box').classList.add('hidden');
    renderResults(resultData);
    updateChart(calcResult);
    
    if (saveHistory) {
        saveCalculationHistory(calcResult);
    }

    const status = document.getElementById('calc-status');
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 2000);
}

// --- 4. UI 渲染与更新函数 ---

// 渲染输入字段
function renderInputFields() {
    const container = document.getElementById('input-fields-container');
    const unit = currentUnit === 'metric' ? 'unit_m' : 'unit_i';
    container.innerHTML = FIELDS[currentMode].map(field => {
        const fieldUnit = field[unit];
        let inputHtml;
        
        if (field.type === 'select') {
             inputHtml = `
                <select id="${field.id}" class="w-full border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 transition" onchange="calculate(false)">
                    ${field.options.map(opt => `<option value="${opt.val}" ${opt.val === field.val ? 'selected' : ''}>${opt.label}</option>`).join('')}
                </select>
            `;
        } else {
            // 默认的 number/text 输入框
            const requiredMark = field.required ? '<span class="text-red-500">*</span>' : '';
            const value = currentUnit === 'metric' ? (field.val || '') : 
                          (field.id in DEFAULT_VALUES_IMPERIAL ? DEFAULT_VALUES_IMPERIAL[field.id] : (field.val || ''));
                          
            inputHtml = `
                <div class="relative">
                    <input type="${field.type}" id="${field.id}" value="${value}" 
                           class="w-full border border-gray-300 rounded-lg p-3 pr-16 bg-gray-50 focus:ring-blue-500 focus:border-blue-500 transition text-lg"
                           oninput="calculate(false)" step="any" min="0">
                    <span class="absolute right-0 top-0 mt-3 mr-4 text-gray-500 text-sm font-medium pointer-events-none">${fieldUnit}</span>
                </div>
            `;
        }
        
        return `
            <div class="${field.required ? 'required-field' : ''}">
                <label for="${field.id}" class="block text-sm font-medium text-gray-700 mb-1">
                    ${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}
                </label>
                ${inputHtml}
                <p class="text-xs mt-1 text-gray-400">${field.desc}</p>
            </div>
        `;
    }).join('');
    
    // 如果是设计模式，第一次渲染时执行一次计算
    if (currentMode === 'design') {
        calculate(false); 
    }
}

// 渲染结果卡片
function renderResults(data) {
    const container = document.getElementById('results-container');
    if (data.length === 0) {
        container.innerHTML = '<p class="text-gray-500 lg:col-span-4">请输入参数并点击计算。</p>';
        return;
    }
    
    container.innerHTML = data.map(item => `
        <div class="result-card ${item.highlight ? 'bg-indigo-50 border-indigo-200' : ''}">
            <p class="result-label">${item.label}</p>
            <div class="flex items-end">
                <span class="result-value ${item.color || 'text-gray-900'}">
                    ${(item.val || 0).toFixed(item.unit === '圈' ? 1 : 3)}
                </span>
                <span class="result-unit">${item.unit}</span>
            </div>
        </div>
    `).join('');
}

// 渲染材料选择下拉框
function renderMaterialSelect() {
    const select = document.getElementById('material');
    select.innerHTML = Object.keys(MATERIALS).map(key => `
        <option value="${key}">${MATERIALS[key].label}</option>
    `).join('');
    
    // 默认选中第一个
    select.value = Object.keys(MATERIALS)[0];
    
    // 监听材料变化
    select.addEventListener('change', () => {
        updateMaterialProps();
        calculate(false);
    });
    updateMaterialProps();
}

// 更新材料属性显示
function updateMaterialProps() {
    const matKey = document.getElementById('material').value;
    const material = MATERIALS[matKey];
    const G = currentUnit === 'metric' ? material.G : material.G_imp;
    const unit = currentUnit === 'metric' ? 'MPa' : 'psi';
    document.getElementById('material-prop').textContent = `G = ${G.toLocaleString()} ${unit} (${material.desc})`;
}

// 力-变形曲线图
let springChartInstance = null;
function updateChart(result) {
    const ctx = document.getElementById('springChart').getContext('2d');
    const placeholder = document.getElementById('chart-placeholder');
    
    if (!result.d || !result.k) {
        if (springChartInstance) {
            springChartInstance.destroy();
            springChartInstance = null;
        }
        placeholder.classList.remove('hidden');
        return;
    }
    
    placeholder.classList.add('hidden');
    
    const maxComp = result.L0 - result.d * result.total_coils_factor; // 使用总圈数进行压并计算的近似值
    const maxDeflection = result.maxComp > 0 ? result.maxComp : result.L0 * 0.8; // 如果 L0 < Lt，则取 L0 * 80% 作为最大显示压缩量
    const unit_force = currentUnit === 'metric' ? 'N' : 'lb';
    const unit_length = currentUnit === 'metric' ? 'mm' : 'in';

    const dataPoints = [];
    const steps = 15;
    
    for (let i = 0; i <= steps; i++) {
        const delta = (maxDeflection / steps) * i;
        const force = result.k * delta;
        dataPoints.push({ x: delta, y: force });
    }

    const data = {
        datasets: [{
            label: `弹簧刚度 k = ${result.k.toFixed(3)} ${unit_force}/${unit_length}`,
            data: dataPoints,
            borderColor: '#4f46e5', // indigo-600
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            borderWidth: 3,
            tension: 0,
            pointRadius: 3,
            fill: true
        }]
    };
    
    // 添加设计点（仅设计模式）
    if (result.mode === 'design') {
        data.datasets.push({
            label: `设计点 (F=${result.load_design.toFixed(2)}, δ=${(result.load_design / result.k).toFixed(3)})`,
            data: [{ x: result.load_design / result.k, y: result.load_design }],
            borderColor: '#10b981', // emerald-500
            backgroundColor: '#10b981',
            pointRadius: 6,
            pointStyle: 'crossRot',
            showLine: false
        });
    }

    if (springChartInstance) {
        springChartInstance.destroy();
    }
    
    springChartInstance = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: `变形量 ${unit_length}`,
                        font: { size: 14 }
                    },
                    min: 0
                },
                y: {
                    title: {
                        display: true,
                        text: `弹簧力 ${unit_force}`,
                        font: { size: 14 }
                    },
                    min: 0,
                    // 确保最大压并载荷可见
                    max: result.load_max * 1.1 || null 
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += `F = ${context.parsed.y.toFixed(2)} ${unit_force}`;
                            }
                            return label;
                        },
                        afterLabel: function(context) {
                             if (context.parsed.x !== null) {
                                return `δ = ${context.parsed.x.toFixed(3)} ${unit_length}`;
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });
}

// --- 5. 历史记录功能 ---

function saveCalculationHistory(result) {
    if (!result.d || !result.k) return;
    
    const now = new Date();
    const matKey = document.getElementById('material').value;
    const historyItem = {
        id: Date.now(),
        date: now.toLocaleString(),
        material: MATERIALS[matKey].label,
        mode: result.mode === 'design' ? '设计' : '分析',
        unit: result.unit === 'metric' ? '公制' : '英制',
        summary: result.mode === 'design' 
            ? `d=${result.d.toFixed(2)}, D=${result.D.toFixed(2)}, n=${result.n.toFixed(1)} 圈, k=${result.k.toFixed(3)}`
            : `d=${result.d.toFixed(2)}, D=${result.D.toFixed(2)}, n=${result.n.toFixed(1)} 圈, Fmax=${result.load_max.toFixed(2)}`,
        data: result
    };
    
    // 限制历史记录数量
    history.unshift(historyItem);
    if (history.length > 10) {
        history.pop();
    }
    
    localStorage.setItem('springCalcHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('history-container');
    if (history.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">暂无历史记录。</p>';
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div class="history-item flex justify-between items-center" data-id="${item.id}">
            <div>
                <p class="font-semibold text-gray-800">${item.mode} (${item.unit}): ${item.material}</p>
                <p class="text-xs text-gray-500">${item.summary}</p>
            </div>
            <p class="text-xs text-gray-400 ml-4">${item.date.split(' ')[1]}</p>
        </div>
    `).join('');
    
    // 绑定历史记录点击事件
    document.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const item = history.find(h => h.id === id);
            if (item) {
                loadHistoryItem(item.data);
            }
        });
    });
}

// 从历史记录加载数据到输入框
function loadHistoryItem(data) {
    // 1. 切换模式和单位
    if (currentMode !== data.mode) {
        currentMode = data.mode;
        document.getElementById('mode-design').classList.toggle('bg-indigo-600');
        document.getElementById('mode-design').classList.toggle('text-white');
        document.getElementById('mode-design').classList.toggle('hover:bg-gray-100');
        document.getElementById('mode-design').classList.toggle('shadow-md');
        
        document.getElementById('mode-analysis').classList.toggle('bg-indigo-600');
        document.getElementById('mode-analysis').classList.toggle('text-white');
        document.getElementById('mode-analysis').classList.toggle('hover:bg-gray-100');
        document.getElementById('mode-analysis').classList.toggle('shadow-md');
        
        // 重新渲染输入字段
        renderInputFields();
    }
    
    if (currentUnit !== data.unit) {
        currentUnit = data.unit;
        document.getElementById('unit-toggle').checked = (currentUnit === 'imperial');
        handleUnitToggle(); // 再次调用以更新标签
    }
    
    // 2. 填充输入框
    for (const key in data) {
        const inputEl = document.getElementById(key);
        if (inputEl) {
            inputEl.value = data[key];
        }
    }
    
    // 3. 重新计算和渲染结果
    calculate(false); // 不保存历史记录
}

function clearHistory() {
    if (confirm('确定要清空所有计算历史记录吗？')) {
        history = [];
        localStorage.removeItem('springCalcHistory');
        renderHistory();
    }
}


// --- 6. PDF 导出功能 ---

function exportToPdf() {
    if (!calcResult.d) {
        alert('请先计算弹簧参数！');
        return;
    }
    
    // 1. 准备用于 PDF 渲染的 HTML 结构
    const reportHTML = createReportHTML();
    
    // 2. 使用 html2canvas 将 HTML 渲染成图片
    const reportContainer = document.createElement('div');
    reportContainer.innerHTML = reportHTML;
    reportContainer.id = 'pdf-report';
    reportContainer.style.position = 'absolute';
    reportContainer.style.left = '-9999px'; // 确保在屏幕外渲染
    document.body.appendChild(reportContainer);
    
    // 确保 Chart.js 实例更新以捕获最新图表
    updateChart(calcResult); 

    html2canvas(reportContainer, {
        scale: 2, // 提高分辨率
        useCORS: true,
        allowTaint: true,
        logging: false,
        letterRendering: true,
    }).then(canvas => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; 
        const pageHeight = 295; 
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // 引入字体 (CN-Fallback 是 Base64 字体定义的名称)
        pdf.addFont('CN-Fallback', 'CN-Fallback', 'normal');
        pdf.setFont('CN-Fallback');

        // 处理分页
        if (imgHeight > pageHeight) {
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
                if (heightLeft > 0) {
                    pdf.addPage();
                }
            }
        } else {
             pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        }

        // 保存文件
        const modeLabel = calcResult.mode === 'design' ? '设计' : '分析';
        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save(`弹簧计算报告_${modeLabel}_${dateStr}.pdf`);
        
        // 移除临时容器
        document.body.removeChild(reportContainer);
    });
}

// 构建 PDF 报告的 HTML 内容
function createReportHTML() {
    const unit_length = currentUnit === 'metric' ? 'mm' : 'in';
    const unit_force = currentUnit === 'metric' ? 'N' : 'lb';
    const unit_stress = currentUnit === 'metric' ? 'MPa' : 'psi';
    const matKey = document.getElementById('material').value;
    const G = currentUnit === 'metric' ? MATERIALS[matKey].G : MATERIALS[matKey].G_imp;
    const G_unit = currentUnit === 'metric' ? 'MPa' : 'psi';

    let parameters = [];
    let results = [];

    // 收集所有结果数据
    const resultData = document.getElementById('results-container').innerHTML;
    
    // 收集输入参数
    FIELDS[calcResult.mode].forEach(field => {
        const val = document.getElementById(field.id)?.value || document.getElementById(field.id)?.options[document.getElementById(field.id).selectedIndex].text;
        const unit = field.type === 'select' ? '' : field[currentUnit === 'metric' ? 'unit_m' : 'unit_i'];
        parameters.push({ label: field.label, value: val, unit: unit });
    });


    // 报告标题和基本信息
    let html = `
        <div style="font-family: 'CN-Fallback', sans-serif; padding: 20px; color: #333; font-size: 12px; line-height: 1.5;">
            <h1 style="text-align: center; color: #1e40af; font-size: 20px; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px;">压缩弹簧计算报告 (${calcResult.mode === 'design' ? '设计模式' : '分析模式'})</h1>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="width: 50%;"><strong>计算日期:</strong> ${new Date().toLocaleString('zh-CN')}</td>
                    <td style="width: 50%;"><strong>计算单位:</strong> ${currentUnit === 'metric' ? '公制 (N, mm, MPa)' : '英制 (lb, in, psi)'}</td>
                </tr>
                <tr>
                    <td><strong>材料类型:</strong> ${MATERIALS[matKey].label}</td>
                    <td><strong>剪切模量 (G):</strong> ${G.toLocaleString()} ${G_unit}</td>
                </tr>
            </table>

            <h2 style="color: #1f2937; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">输入参数</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                <thead>
                    <tr style="background-color: #e5e7eb;">
                        <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">参数名称</th>
                        <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">值</th>
                        <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">单位</th>
                    </tr>
                </thead>
                <tbody>
                    ${parameters.map(p => `
                        <tr>
                            <td style="border: 1px solid #d1d5db; padding: 8px;">${p.label}</td>
                            <td style="border: 1px solid #d1d5db; padding: 8px; font-weight: bold;">${p.value}</td>
                            <td style="border: 1px solid #d1d5db; padding: 8px;">${p.unit}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <h2 style="color: #1f2937; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">计算结果</h2>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 30px;">
                ${resultData.replace(/<div class="result-card (.*?)">/g, (match, p1) => `<div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px; background-color: ${p1.includes('indigo-50') ? '#eef2ff' : '#f9fafb'};">`).replace(/<p class="result-label">/g, '<p style="font-size: 11px; color: #6b7280; margin-bottom: 3px;">')
                 .replace(/<div class="flex items-end">/g, '<div style="display: flex; align-items: flex-end;">')
                 .replace(/<span class="result-value (.*?)">/g, (match, p1) => `<span style="font-size: 16px; font-weight: bold; color: ${p1.includes('red') ? '#dc2626' : '#10b981'};">`)
                 .replace(/<span class="result-unit">/g, '<span style="font-size: 11px; color: #4b5563; margin-left: 3px;">')
                 .replace(/<i class="fas fa-spin fa-circle-notch">/g, '<span>~') // 移除图标
                 .replace(/<\/i>/g, '</span>') // 移除图标
            }
            </div>

            <h2 style="color: #1f2937; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">力-变形曲线</h2>
            <div id="chart-image-container" style="width: 100%; height: 250px; background-color: #fff; border: 1px solid #ccc;">
                 <canvas id="springChart"></canvas> 
            </div>
            <p style="text-align: center; margin-top: 10px; font-size: 10px; color: #6b7280;">曲线显示弹簧力随变形量的变化关系。刚度 ${calcResult.k.toFixed(3)} ${unit_force}/${unit_length}</p>

            <div style="margin-top: 40px; text-align: center; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 10px; color: #9ca3af;">
                此报告由弹簧设计计算器生成。计算结果仅供参考，请以专业工程核算为准。
            </div>
        </div>
    `;
    return html;
}

// --- 7. 事件监听器与初始化 ---

function handleModeToggle(e) {
    const newMode = e.currentTarget.dataset.mode;
    if (newMode === currentMode) return;
    
    currentMode = newMode;
    
    // 切换按钮样式
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
        btn.classList.add('text-gray-700', 'hover:bg-gray-100');
    });
    e.currentTarget.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
    e.currentTarget.classList.remove('text-gray-700', 'hover:bg-gray-100');
    
    // 重新渲染输入字段
    renderInputFields();
}

function handleUnitToggle() {
    const isImperial = document.getElementById('unit-toggle').checked;
    currentUnit = isImperial ? 'imperial' : 'metric';
    
    // 更新标签样式
    document.getElementById('unit-label-metric').classList.toggle('text-indigo-600', !isImperial);
    document.getElementById('unit-label-metric').classList.toggle('text-gray-700', isImperial);
    document.getElementById('unit-label-imperial').classList.toggle('text-indigo-600', isImperial);
    document.getElementById('unit-label-imperial').classList.toggle('text-gray-700', !isImperial);
    
    // 重新渲染输入字段和材料属性（触发单位更新）
    renderInputFields();
    updateMaterialProps();
}

document.addEventListener('DOMContentLoaded', () => {
    // 初始化渲染
    renderMaterialSelect();
    renderInputFields();
    renderHistory();
    
    // 绑定事件
    document.getElementById('mode-design').addEventListener('click', handleModeToggle);
    document.getElementById('mode-analysis').addEventListener('click', handleModeToggle);
    document.getElementById('unit-toggle').addEventListener('change', handleUnitToggle);
    document.getElementById('calculate-btn').addEventListener('click', () => calculate(true));
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPdf);
    document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
    
    // 重置按钮：清空所有输入
    document.getElementById('reset-btn').addEventListener('click', () => {
        FIELDS[currentMode].forEach(field => {
            const inputEl = document.getElementById(field.id);
            if (inputEl && field.type !== 'select') {
                 // 重置为默认值，如果是设计模式
                if (currentMode === 'design' && (field.id in DEFAULT_VALUES_METRIC || field.id in DEFAULT_VALUES_IMPERIAL)) {
                     inputEl.value = currentUnit === 'metric' ? DEFAULT_VALUES_METRIC[field.id] : DEFAULT_VALUES_IMPERIAL[field.id];
                } else if (field.val !== undefined) {
                    // 重置为配置的默认值
                     inputEl.value = field.val;
                } else {
                    // 否则清空
                     inputEl.value = '';
                }
            } else if (inputEl && field.type === 'select') {
                // select 重置为第一个选项
                inputEl.value = field.options[0].val;
            }
        });
        document.getElementById('error-box').classList.add('hidden');
        document.getElementById('results-container').innerHTML = '<p class="text-gray-500 lg:col-span-4">请输入参数并点击计算。</p>';
        updateChart({}); // 清空图表
        // 重新计算以应用默认值
        calculate(false);
    });
});