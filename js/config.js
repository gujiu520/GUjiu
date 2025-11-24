// 全局配置常量
const CONFIG = {
  STABILITY_THRESHOLD: 3.5,  // 稳定性临界比值（自由高度/弹簧中径）
  DEFAULT_SUPPORT_COILS: 2,  // 默认支撑圈数
  SAFETY_FACTOR_MIN: 1.2,    // 最小安全系数要求
  TEMPERATURE_DEFAULT: 25    // 默认环境温度（℃）
};

// 材料性能参数库
const MATERIAL_PROPERTIES = {
  carbonSteel: { 
    name: '碳素弹簧钢 (65Mn)', 
    shearModulus: 80000,    // 剪切模量 (MPa)
    allowableStress: 650,   // 许用剪切应力 (MPa)
    density: 7.85           // 密度 (g/cm³)
  },
  stainlessSteel: { 
    name: '不锈钢 (304)', 
    shearModulus: 73000, 
    allowableStress: 480, 
    density: 7.93 
  },
  alloySteel: { 
    name: '合金弹簧钢 (50CrVA)', 
    shearModulus: 82000, 
    allowableStress: 800, 
    density: 7.85 
  },
  siliconSteel: { 
    name: '硅锰弹簧钢 (60Si2Mn)', 
    shearModulus: 81000, 
    allowableStress: 750, 
    density: 7.85 
  }
};

// 单位转换系数
const UNIT_CONVERTERS = {
  load: { N: 1, kgf: 9.80665, lbf: 4.44822 },
  length: { mm: 1, cm: 10, inch: 25.4 },
  frequency: { Hz: 1, kHz: 1000 },
  temperature: { 
    celsius: 1, 
    fahrenheit: (val) => (val - 32) * 5 / 9 
  }
};

// 导出到全局（浏览器环境）
window.CONFIG = CONFIG;
window.MATERIAL_PROPERTIES = MATERIAL_PROPERTIES;
window.UNIT_CONVERTERS = UNIT_CONVERTERS;