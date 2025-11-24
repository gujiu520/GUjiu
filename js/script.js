// 全局变量
let currentMode = 'design';
let resultsChart = null;
let darkMode = false;
let currentResults = null;

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM加载完成，初始化事件绑定');
  
  // 绑定所有按钮事件
  bindAllEvents();
  
  // 初始化表单动画
  animateFormGroups();
  
  // 初始化提示
  setTimeout(function() {
    showNotification('欢迎使用圆柱压缩弹簧测试与设计系统！请输入参数开始设计或测试。');
  }, 1000);
});

// 绑定所有事件（统一管理）
function bindAllEvents() {
  // 模式切换事件
  document.getElementById('designMode').addEventListener('click', () => switchMode('design'));
  document.getElementById('testMode').addEventListener('click', () => switchMode('test'));
  
  // 核心功能按钮事件
  document.getElementById('calculateBtn').addEventListener('click', calculateResults);
  document.getElementById('resetBtn').addEventListener('click', resetForm);
  document.getElementById('exportBtn').addEventListener('click', exportResults);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('helpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('hidden');
  });
  
  // 模态框关闭事件
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('notificationModal').classList.add('hidden');
  });
  document.getElementById('closeHelpModal').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('hidden');
  });
  
  // 点击模态框背景关闭
  document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('helpModal')) {
      document.getElementById('helpModal').classList.add('hidden');
    }
  });
  
  document.getElementById('notificationModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('notificationModal')) {
      document.getElementById('notificationModal').classList.add('hidden');
    }
  });
  
  // 滚动事件
  window.addEventListener('scroll', function() {
    const header = document.getElementById('header');
    if (window.scrollY > 50) {
      header.classList.add('py-2', 'shadow');
      header.classList.remove('py-3');
    } else {
      header.classList.add('py-3');
      header.classList.remove('py-2', 'shadow');
    }
    document.querySelector('main').style.paddingTop = window.scrollY > 50 ? '10px' : '0';
  });
}

// 显示提示通知
function showNotification(message) {
  const modal = document.getElementById('notificationModal');
  const modalMsg = document.getElementById('modalMessage');
  modalMsg.textContent = message;
  modal.classList.remove('hidden');
}

// 切换工作模式
function switchMode(mode) {
  if (currentMode === mode) return;
  
  currentMode = mode;
  const designBtn = document.getElementById('designMode');
  const testBtn = document.getElementById('testMode');
  
  if (mode === 'design') {
    designBtn.classList.add('active');
    designBtn.classList.remove('inactive');
    testBtn.classList.add('inactive');
    testBtn.classList.remove('active');
    document.getElementById('designForm').classList.remove('hidden');
    document.getElementById('testForm').classList.add('hidden');
    document.getElementById('modeDescription').innerHTML = 
      '<p>参数设计模式：输入设计要求（最大工作载荷、最大压缩量等），钢丝直径、自由高度和弹簧中径可选填（不填则自动生成，填写则按固定值计算）。</p>';
  } else {
    testBtn.classList.add('active');
    testBtn.classList.remove('inactive');
    designBtn.classList.add('inactive');
    designBtn.classList.remove('active');
    document.getElementById('testForm').classList.remove('hidden');
    document.getElementById('designForm').classList.add('hidden');
    document.getElementById('modeDescription').innerHTML = 
      '<p>性能测试模式：输入现有弹簧的几何参数和材料信息，系统将计算其刚度、最大剪切应力等性能指标并进行稳定性校核。</p>';
  }
  
  document.getElementById('resultSection').classList.add('hidden');
  currentResults = null;
  animateFormGroups();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 表单组动画
function animateFormGroups() {
  const formGroups = document.querySelectorAll('.form-group');
  formGroups.forEach((group, index) => {
    if (!group.closest('div.hidden')) {
      group.style.opacity = '0';
      group.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        group.style.transition = 'all 0.3s ease';
        group.style.opacity = '1';
        group.style.transform = 'translateY(0)';
      }, 100 * (index + 1));
    }
  });
}

// 计算结果
function calculateResults() {
  showNotification('本产品仅供测试使用。网站生成的数据仅作演示，不作任何承诺或保证。');
  
  if (!validateForm()) {
    showNotification('请填写所有必填参数并确保数值有效！可选参数若填写需满足最小限制。');
    return;
  }
  
  try {
    if (currentMode === 'design') {
      currentResults = designSpringParameters();
    } else {
      currentResults = testSpringPerformance();
    }
    
    displayResults(currentResults);
    drawChart(currentResults);
    triggerSpringAnimation();
    
    setTimeout(() => {
      document.getElementById('notificationModal').classList.add('hidden');
    }, 3000);
    
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
  } catch (error) {
    console.error('计算过程出错：', error);
    showNotification('计算失败，请检查输入参数或刷新页面重试！');
  }
}

// 触发弹簧动画
function triggerSpringAnimation() {
  const springVis = document.getElementById('springVisualization');
  springVis.classList.remove('spring-animated');
  void springVis.offsetWidth; // 强制重绘
  springVis.classList.add('spring-animated');
}

// 单位转换函数
function convertValue(value, unitType) {
  if (!value || value === '') return null;
  
  const numValue = parseFloat(value);
  const unitElement = document.getElementById(`${unitType}Unit`);
  if (!unitElement) return numValue;
  
  const unit = unitElement.value;
  
  switch(unitType) {
    case 'maxLoad': return numValue * UNIT_CONVERTERS.load[unit];
    case 'maxDeflection': return numValue * UNIT_CONVERTERS.length[unit];
    case 'frequency': return numValue * UNIT_CONVERTERS.frequency[unit];
    case 'temperature': return unit === 'fahrenheit' ? UNIT_CONVERTERS.temperature.fahrenheit(numValue) : numValue;
    case 'optWireDiameter': return numValue * UNIT_CONVERTERS.length[unit];
    case 'optFreeHeight': return numValue * UNIT_CONVERTERS.length[unit];
    case 'optSpringDiameter': return numValue * UNIT_CONVERTERS.length[unit];
    default: return numValue;
  }
}

// 表单验证
function validateForm() {
  let isValid = true;
  const inputs = currentMode === 'design' 
    ? ['maxLoad', 'maxDeflection', 'frequency', 'temperature']
    : ['wireDiameter', 'springDiameter', 'freeHeight', 'activeCoils', 'supportCoils'];
  
  inputs.forEach(id => {
    const input = document.getElementById(id);
    if (!input.value || parseFloat(input.value) <= 0) {
      input.classList.add('border-red-500', 'focus:ring-red-200');
      input.classList.add('pulse');
      setTimeout(() => input.classList.remove('pulse'), 1000);
      isValid = false;
    } else {
      input.classList.remove('border-red-500', 'focus:ring-red-200');
    }
  });
  
  // 验证可选参数
  if (currentMode === 'design') {
    const optionalInputs = [
      {id: 'optWireDiameter', min: 0.5},
      {id: 'optFreeHeight', min: 5},
      {id: 'optSpringDiameter', min: 2}
    ];
    
    optionalInputs.forEach(({id, min}) => {
      const input = document.getElementById(id);
      if (input.value) {
        const value = parseFloat(input.value);
        if (value < min) {
          input.classList.add('border-red-500', 'focus:ring-red-200');
          input.classList.add('pulse');
          setTimeout(() => input.classList.remove('pulse'), 1000);
          isValid = false;
        } else {
          input.classList.remove('border-red-500', 'focus:ring-red-200');
        }
      }
    });
  }
  
  return isValid;
}

// 设计模式：生成弹簧参数
function designSpringParameters() {
  // 获取输入参数
  const maxLoad = convertValue(document.getElementById('maxLoad').value, 'maxLoad');
  const maxDeflection = convertValue(document.getElementById('maxDeflection').value, 'maxDeflection');
  const frequency = convertValue(document.getElementById('frequency').value, 'frequency');
  const temperature = parseFloat(document.getElementById('temperature').value);
  const material = document.getElementById('material').value;
  
  // 可选参数
  const fixedWireDiameter = convertValue(document.getElementById('optWireDiameter').value, 'optWireDiameter');
  const fixedFreeHeight = convertValue(document.getElementById('optFreeHeight').value, 'optFreeHeight');
  const fixedSpringDiameter = convertValue(document.getElementById('optSpringDiameter').value, 'optSpringDiameter');
  
  // 获取材料性能参数
  const materialProp = MATERIAL_PROPERTIES[material];
  
  // 计算刚度
  const stiffness = maxLoad / maxDeflection;
  
  let wireDiameter, springDiameter, activeCoils, freeHeight;
  const supportCoils = CONFIG.DEFAULT_SUPPORT_COILS;
  let fixedParamText = '无';
  
  // 逻辑优先级：固定钢丝直径 > 固定弹簧中径 > 固定自由高度 > 全部自动生成
  if (fixedWireDiameter) {
    wireDiameter = fixedWireDiameter;
    fixedParamText = `钢丝直径（${wireDiameter.toFixed(2)}mm）`;
    springDiameter = wireDiameter * 6;
    activeCoils = (materialProp.shearModulus * Math.pow(wireDiameter, 4)) / (8 * Math.pow(springDiameter, 3) * stiffness);
    freeHeight = maxDeflection * 2.5 + wireDiameter * (activeCoils + supportCoils);
    
    if (fixedSpringDiameter) {
      springDiameter = fixedSpringDiameter;
      fixedParamText = `钢丝直径（${wireDiameter.toFixed(2)}mm）+ 弹簧中径（${springDiameter.toFixed(2)}mm）`;
      activeCoils = (materialProp.shearModulus * Math.pow(wireDiameter, 4)) / (8 * Math.pow(springDiameter, 3) * stiffness);
      freeHeight = maxDeflection * 2.5 + wireDiameter * (activeCoils + supportCoils);
      
      if (fixedFreeHeight) {
        freeHeight = fixedFreeHeight;
        fixedParamText = `钢丝直径（${wireDiameter.toFixed(2)}mm）+ 弹簧中径（${springDiameter.toFixed(2)}mm）+ 自由高度（${freeHeight.toFixed(2)}mm）`;
        const totalCoils = (freeHeight - maxDeflection * 2.5) / wireDiameter;
        activeCoils = Math.max(1, totalCoils - supportCoils);
      }
    } else if (fixedFreeHeight) {
      freeHeight = fixedFreeHeight;
      fixedParamText = `钢丝直径（${wireDiameter.toFixed(2)}mm）+ 自由高度（${freeHeight.toFixed(2)}mm）`;
      const totalCoils = (freeHeight - maxDeflection * 2.5) / wireDiameter;
      activeCoils = Math.max(1, totalCoils - supportCoils);
    }
    
  } else if (fixedSpringDiameter) {
    springDiameter = fixedSpringDiameter;
    fixedParamText = `弹簧中径（${springDiameter.toFixed(2)}mm）`;
    wireDiameter = Math.sqrt((8 * maxLoad * 6) / (Math.PI * materialProp.allowableStress)) * 0.8;
    activeCoils = (materialProp.shearModulus * Math.pow(wireDiameter, 4)) / (8 * Math.pow(springDiameter, 3) * stiffness);
    freeHeight = maxDeflection * 2.5 + wireDiameter * (activeCoils + supportCoils);
    
    if (fixedFreeHeight) {
      freeHeight = fixedFreeHeight;
      fixedParamText = `弹簧中径（${springDiameter.toFixed(2)}mm）+ 自由高度（${freeHeight.toFixed(2)}mm）`;
      const totalCoils = (freeHeight - maxDeflection * 2.5) / wireDiameter;
      activeCoils = Math.max(1, totalCoils - supportCoils);
    }
    
  } else if (fixedFreeHeight) {
    freeHeight = fixedFreeHeight;
    fixedParamText = `自由高度（${freeHeight.toFixed(2)}mm）`;
    wireDiameter = Math.sqrt((8 * maxLoad * 6) / (Math.PI * materialProp.allowableStress)) * 0.8;
    springDiameter = wireDiameter * 6;
    activeCoils = (materialProp.shearModulus * Math.pow(wireDiameter, 4)) / (8 * Math.pow(springDiameter, 3) * stiffness);
    const totalCoils = (freeHeight - maxDeflection * 2.5) / wireDiameter;
    activeCoils = Math.max(1, totalCoils - supportCoils);
    
  } else {
    // 全部自动生成
    wireDiameter = Math.sqrt((8 * maxLoad * 6) / (Math.PI * materialProp.allowableStress)) * 0.8;
    springDiameter = wireDiameter * 6;
    activeCoils = (materialProp.shearModulus * Math.pow(wireDiameter, 4)) / (8 * Math.pow(springDiameter, 3) * stiffness);
    freeHeight = maxDeflection * 2.5 + wireDiameter * (activeCoils + supportCoils);
  }
  
  // 修正参数范围（避免不合理值）
  wireDiameter = Math.max(0.5, Math.round(wireDiameter * 100) / 100);
  springDiameter = Math.max(wireDiameter * 2, Math.round(springDiameter * 10) / 10);
  activeCoils = Math.max(2, Math.round(activeCoils * 2) / 2);
  freeHeight = Math.max(maxDeflection + wireDiameter * 3, Math.round(freeHeight * 10) / 10);
  
  // 计算其他性能参数
  const totalCoils = activeCoils + supportCoils;
  const solidHeight = wireDiameter * totalCoils;
  const safetyFactor = materialProp.allowableStress / ((8 * maxLoad * springDiameter) / (Math.PI * Math.pow(wireDiameter, 3)));
  const naturalFrequency = (1 / (2 * Math.PI)) * Math.sqrt(stiffness / (Math.PI * Math.pow(wireDiameter, 2) * springDiameter * totalCoils * materialProp.density / 4));
  const stabilityRatio = freeHeight / springDiameter;
  const isStable = stabilityRatio <= CONFIG.STABILITY_THRESHOLD;
  
  return {
    mode: 'design',
    material: materialProp.name,
    fixedParams: fixedParamText,
    wireDiameter,
    springDiameter,
    freeHeight,
    activeCoils,
    supportCoils,
    totalCoils,
    solidHeight,
    maxLoad,
    maxDeflection,
    stiffness,
    safetyFactor,
    naturalFrequency,
    workingFrequency: frequency,
    stabilityRatio,
    isStable,
    temperature
  };
}

// 测试模式：计算弹簧性能
function testSpringPerformance() {
  // 获取输入参数
  const wireDiameter = parseFloat(document.getElementById('wireDiameter').value);
  const springDiameter = parseFloat(document.getElementById('springDiameter').value);
  const freeHeight = parseFloat(document.getElementById('freeHeight').value);
  const activeCoils = parseFloat(document.getElementById('activeCoils').value);
  const supportCoils = parseFloat(document.getElementById('supportCoils').value);
  const material = document.getElementById('materialTest').value;
  
  // 获取材料性能参数
  const materialProp = MATERIAL_PROPERTIES[material];
  
  // 计算性能参数
  const totalCoils = activeCoils + supportCoils;
  const solidHeight = wireDiameter * totalCoils;
  const stiffness = (materialProp.shearModulus * Math.pow(wireDiameter, 4)) / (8 * Math.pow(springDiameter, 3) * activeCoils);
  const maxSafeLoad = (materialProp.allowableStress * Math.PI * Math.pow(wireDiameter, 3)) / (8 * springDiameter);
  const maxSafeDeflection = maxSafeLoad / stiffness;
  const safetyFactor = materialProp.allowableStress / ((8 * maxSafeLoad * springDiameter) / (Math.PI * Math.pow(wireDiameter, 3)));
  const naturalFrequency = (1 / (2 * Math.PI)) * Math.sqrt(stiffness / (Math.PI * Math.pow(wireDiameter, 2) * springDiameter * totalCoils * materialProp.density / 4));
  const stabilityRatio = freeHeight / springDiameter;
  const isStable = stabilityRatio <= CONFIG.STABILITY_THRESHOLD;
  
  return {
    mode: 'test',
    material: materialProp.name,
    wireDiameter,
    springDiameter,
    freeHeight,
    activeCoils,
    supportCoils,
    totalCoils,
    solidHeight,
    stiffness,
    maxSafeLoad,
    maxSafeDeflection,
    safetyFactor,
    naturalFrequency,
    stabilityRatio,
    isStable
  };
}

// 显示计算结果
function displayResults(results) {
  const resultSection = document.getElementById('resultSection');
  const basicResults = document.getElementById('basicResults');
  const performanceResults = document.getElementById('performanceResults');
  const stabilityResult = document.getElementById('stabilityResult');
  
  // 显示结果区
  resultSection.classList.remove('hidden');
  
  // 填充基本参数
  if (results.mode === 'design') {
    basicResults.innerHTML = `
      <div class="flex justify-between"><span class="text-gray-600">材料类型：</span><span class="font-medium">${results.material}</span></div>
      <div class="flex justify-between"><span class="text-gray-600">固定参数：</span><span class="font-medium">${results.fixedParams}</span></div>
      <div class="flex justify-between"><span class="text-gray-600">钢丝直径：</span><span class="font-medium">${results.wireDiameter.toFixed(2)} mm</span></div>
      <div class="flex justify-between"><span class="text-gray-600">弹簧中径：</span><span class="font-medium">${results.springDiameter.toFixed(2)} mm</span></div>
      <div class="flex justify-between"><span class="text-gray-600">自由高度：</span><span class="font-medium">${results.freeHeight.toFixed(2)} mm</span></div>
      <div class="flex justify-between"><span class="text-gray-600">有效圈数：</span><span class="font-medium">${results.activeCoils} 圈</span></div>
      <div class="flex justify-between"><span class="text-gray-600">支撑圈数：</span><span class="font-medium">${results.supportCoils} 圈</span></div>
      <div class="flex justify-between"><span class="text-gray-600">总圈数：</span><span class="font-medium">${results.totalCoils} 圈</span></div>
    `;
    
    performanceResults.innerHTML = `
      <div class="flex justify-between"><span class="text-gray-600">刚度：</span><span class="font-medium">${results.stiffness.toFixed(2)} N/mm</span></div>
      <div class="flex justify-between"><span class="text-gray-600">最大工作载荷：</span><span class="font-medium">${results.maxLoad.toFixed(2)} N</span></div>
      <div class="flex justify-between"><span class="text-gray-600">最大压缩量：</span><span class="font-medium">${results.maxDeflection.toFixed(2)} mm