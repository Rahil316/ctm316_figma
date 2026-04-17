"use strict";
// Setting default color system
let DefaultSystem = {
  designSystemName: "Rahil316",
  weightsMethod: "Balanced",
  roleMappingMethod: "Contrast Based",
  weightsCount: 25,
  weightNames: [],
  roleVariationsCount: 5,
  roleVariationsNames: ["lighter", "light", "base", "dark", "darker"],
  colorInputs: [
    {
      colorName: "Primary",
      colorNameShort: "pr",
      colorValue: "#0067DD",
    },
    {
      colorName: "Secondary",
      colorNameShort: "sc",
      colorValue: "#EFEFF2",
    },
    {
      colorName: "Tertiary",
      colorNameShort: "",
      colorValue: "#E7163F",
    },
    {
      colorName: "Gray",
      colorNameShort: "gr",
      colorValue: "#808080",
    },
    {
      colorName: "red",
      colorNameShort: "rd",
      colorValue: "#FF0000",
    },
    {
      colorName: "orange",
      colorNameShort: "og",
      colorValue: "#FFA500",
    },
    {
      colorName: "green",
      colorNameShort: "gn",
      colorValue: "#00FF00",
    },
    {
      colorName: "Sky Blue",
      colorNameShort: "sb",
      colorValue: "#87CEEB",
    },
  ],
  roleInputs: [
    {
      name: "Text",
      nameShort: "tx",
      basePoint: 0,
      gaps: 0,
    },
    {
      name: "Fill",
      nameShort: "fi",
      basePoint: 0,
      gaps: 0,
    },
    {
      name: "Background",
      nameShort: "bg",
      basePoint: 0,
      gaps: 0,
    },
    {
      name: "Border",
      nameShort: "br",
      basePoint: 0,
      gaps: 0,
    },
  ],
};
// Function to generate color weights
function TokensMaker(config) {
  // Populates Colors
  let colors = {
    collection: config.colorInputs.map((colorInput) => {
      return {
        colorName: colorInput.colorName,
        colorNameShort: colorInput.colorNameShort,
        colorWeights: colorWeightsMaker(colorInput, config.weightsCount, config.weightNames, config.weightsMethod),
      };
    }),
  };
  // Populating Roles
  let roles = colorRolesMakerManual(config.roleInputs, config.roleVariationsNames, config.roleVariationsCount, colors);
  // return Output
  return { colorSystemConfig: config, colorWeights: colors, roleTokens: roles };
}
const tokenCollection = TokensMaker(DefaultSystem);
console.log(tokenCollection);

("use strict");
function SericeManker(weightsCount) {
  let serise = [];
  for (let i = 1; i <= weightsCount; i++) {
    serise.push(`${i}`);
  }
  return serise;
}
// Color Utils
function hex2rgb(hex = "#000000") {
  hex.includes("#") ? (hex = hex.slice(1)) : hex;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}
function rgb2hex(rgb) {
  return `#${rgb.r.toString(16)}${rgb.g.toString(16)}${rgb.b.toString(16)}`;
}
function rgb2hsl(rgb) {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;
  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max === min) {
    h = 0;
    s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function getContrast(fg, bg) {
  let ratio = rgb2hsl(hex2rgb(fg)).l / rgb2hsl(hex2rgb(bg)).l;
  let ratting;
  if (ratio >= 4.5) {
    ratting = "AA";
  } else if (ratio >= 3) {
    ratting = "A";
  } else {
    ratting = "Fail";
  }
  return {
    rating: ratting,
    ratio: ratio,
  };
}
// ##############################################################################################################################################################
// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;
  return {
    r: parseInt(fullHex.substring(0, 2), 16),
    g: parseInt(fullHex.substring(2, 4), 16),
    b: parseInt(fullHex.substring(4, 6), 16),
  };
}
// Helper function to convert RGB to hex
function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.round(Math.max(0, Math.min(255, x)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
// Helper function to calculate relative luminance (0-1)
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
// Helper function to calculate contrast ratio
function getContrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
// Helper function to convert RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
// Helper function to convert HSL to RGB
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
/**
 * Function 1: Gradual gradient from dark to light
 * Creates a smooth linear gradient from dark shade to light tint
 */
function generateGradualGradient(hex, weights) {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const colors = [];
  for (let i = 0; i < weights; i++) {
    const progress = i / (weights - 1);
    // Linear interpolation from darker (20% lightness) to lighter (95% lightness)
    const lightness = 20 + progress * 75;
    const rgb = hslToRgb(hsl.h, hsl.s, lightness);
    colors.push(rgbToHex(rgb.r, rgb.g, rgb.b));
  }
  return colors;
}
/**
 * Function 2: Original color in middle with balanced shades and tints
 * Places the input color at the center and generates shades/tints based on its luminance
 */
function generateBalancedShades(hex, weights) {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const colors = new Array(weights);
  const middleIndex = Math.floor(weights / 2);
  // Example for weights = 13:
  // middleIndex = 6 (0-based, so position 7 of 1-13)
  // indices 0-5: lighter than original (0 = brightest)
  // index 6: original color
  // indices 7-12: darker than original (12 = darkest)
  // Place original color in middle
  colors[middleIndex] = hex;
  // Generate lighter tints (moving toward index 0)
  for (let i = 0; i < middleIndex; i++) {
    // Distance from middle: middleIndex - i
    // For i=5 (index 6, just before middle): distance = 1
    // For i=0 (index 1, brightest): distance = 6
    const distanceFromMiddle = middleIndex - i;
    const maxDistance = middleIndex;
    const progress = distanceFromMiddle / maxDistance;
    // As progress increases (further from middle), lightness increases
    const maxLightness = Math.min(98, hsl.l + (100 - hsl.l) * 0.85);
    const lightness = hsl.l + (maxLightness - hsl.l) * progress;
    const rgb = hslToRgb(hsl.h, hsl.s, lightness);
    colors[i] = rgbToHex(rgb.r, rgb.g, rgb.b);
  }
  // Generate darker shades (moving toward last index)
  for (let i = middleIndex + 1; i < weights; i++) {
    // Distance from middle: i - middleIndex
    // For i=7 (index 8, just after middle): distance = 1
    // For i=12 (index 13, darkest): distance = 6
    const distanceFromMiddle = i - middleIndex;
    const maxDistance = weights - middleIndex - 1;
    const progress = distanceFromMiddle / maxDistance;
    // As progress increases (further from middle), lightness decreases
    const luminance = getLuminance(r, g, b);
    const minLightnessMultiplier = luminance > 0.5 ? 0.2 : 0.1;
    const minLightness = Math.max(3, hsl.l * minLightnessMultiplier);
    const lightness = hsl.l - (hsl.l - minLightness) * progress;
    const rgb = hslToRgb(hsl.h, hsl.s, lightness);
    colors[i] = rgbToHex(rgb.r, rgb.g, rgb.b);
  }
  return colors;
}
/**
 * Function 3: Perceptually uniform contrast steps
 * Ensures consistent contrast ratios against black across all hues
 */
function generateUniformSteps(hex, weights) {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const baseLuminance = getLuminance(r, g, b);
  const blackLuminance = 0; // Black has luminance of 0
  // Calculate target contrast ratios for each step
  const targetContrasts = [];
  const maxContrast = getContrastRatio(1, blackLuminance); // White against black ≈ 21:1
  const minContrast = 1.1;
  for (let i = 0; i < weights; i++) {
    const progress = i / (weights - 1);
    // Exponential curve for more perceptually uniform contrast steps
    const contrast = minContrast + (maxContrast - minContrast) * Math.pow(progress, 1.5);
    targetContrasts.push(contrast);
  }
  const colors = [];
  const hueSaturation = { h: hsl.h, s: hsl.s };
  for (const targetContrast of targetContrasts) {
    // Binary search for the right lightness to achieve target contrast
    let low = 0;
    let high = 100;
    let bestLightness = 0;
    let bestDiff = Infinity;
    for (let iteration = 0; iteration < 20; iteration++) {
      const mid = (low + high) / 2;
      const testRgb = hslToRgb(hueSaturation.h, hueSaturation.s, mid);
      const testLuminance = getLuminance(testRgb.r, testRgb.g, testRgb.b);
      const actualContrast = getContrastRatio(testLuminance, blackLuminance);
      const diff = Math.abs(actualContrast - targetContrast);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestLightness = mid;
      }
      if (actualContrast < targetContrast) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const finalRgb = hslToRgb(hueSaturation.h, hueSaturation.s, bestLightness);
    colors.push(rgbToHex(finalRgb.r, finalRgb.g, finalRgb.b));
  }
  return colors;
}
// Makes weights of a single color input
function colorWeightsMaker(colorInput, weightsCount, weightNames = SericeManker(weightsCount), weightsMethod) {
  let colorTokens = [];
  let colorArray = [];
  if (weightsMethod === "Gradual") {
    colorArray = generateGradualGradient(colorInput.colorValue, weightsCount);
  } else if (weightsMethod === "Balanced") {
    colorArray = generateBalancedShades(colorInput.colorValue, weightsCount);
  } else if (weightsMethod === "Uniform") {
    colorArray = generateUniformSteps(colorInput.colorValue, weightsCount);
  } else {
    console.error("Invalid weights method");
  }
  // Loop For Each Weight
  for (let i = 0; i < weightsCount; i++) {
    colorTokens.push({
      name: colorInput.colorName + "/" + weightNames[i],
      nameShort: colorInput.colorNameShort + "/" + weightNames[i],
      value: colorArray[i],
      weight: i,
      contrast: {
        dark: getContrast(colorArray[i], "#000000"),
        light: getContrast(colorArray[i], "#FFFFFF"),
      },
    });
  }
  return colorTokens;
}

function colorRolesMakerManual(roleInput, verations, roleVariationsCount, colorTokens) {
  return {
    roleTokensCollection: [],
  };
}
function colorRolesMakerContrastBased(roleInput, verations, roleVariationsCount, colorTokens) {
  return {
    roleTokensCollection: [],
  };
}
