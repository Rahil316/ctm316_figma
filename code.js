/**
 * ============================================================================
 * MODULAR FIGMA VARIABLE ORCHESTRATOR
 * Organization:
 * 1. UI Initialization
 * 2. Message Router (Main entry point)
 * 3. Export Formatters (String generation for CSV/CSS/JSON)
 * 4. Figma Variable API (CRUD operations)
 * 5. Color Logic Engine (Generation & Mapping)
 * 6. Mathematical Utilities (Color math & HSL/RGB)
 * ============================================================================
 */

/**
 * 1. UI INITIALIZATION
 */
figma.showUI(__html__, { width: 480, height: 800, themeColors: true });

/**
 * 2. MESSAGE ROUTER
 * Directs incoming messages from the UI thread to appropriate system handlers.
 */
figma.ui.onmessage = async (msg) => {
  try {
    switch (msg.type) {
      /**
       * Primary execution loop: Generates logic and syncs to Figma.
       */
      case "run-creater":
        {
          const tokenState = msg.state;
          const processedData = ColorEngine.process(tokenState);
          await VariableManager.sync(processedData, msg.scope || "all");
        }
        break;

      /**
       * Window Management.
       */
      case "resize":
        figma.ui.resize(msg.width, msg.height);
        break;

      /**
       * Offloads heavy formatting for Exports to the plugin thread.
       */
      case "request-processed-data":
        {
          const tokenState = msg.state;
          const processedData = ColorEngine.process(tokenState);
          let content = "";

          if (msg.exportType === "json") content = JSON.stringify(processedData, null, 2);
          else if (msg.exportType === "csv") content = ExportFormatter.toCSV(processedData);
          else if (msg.exportType === "css") content = ExportFormatter.toCSS(processedData);

          figma.ui.postMessage({ type: "processed-data-response", content, exportType: msg.exportType });
        }
        break;

      case "cancel":
        figma.closePlugin();
        break;
    }
  } catch (err) {
    console.error("Plugin Error:", err);
    figma.ui.postMessage({ type: "error", message: err.message || "Unknown error" });
  }
};

/**
 * 3. EXPORT FORMATTERS
 * Converts the processed token object into various string formats.
 */
const ExportFormatter = {
  /**
   * Generates a flat CSV list of raw color tokens.
   */
  toCSV(processedData) {
    let csv = "Group,Weight,Token Name,Value\n";
    for (const group in processedData.raw) {
      for (const weight in processedData.raw[group]) {
        const item = processedData.raw[group][weight];
        csv += `${group},${weight},${item.tknName},${item.value}\n`;
      }
    }
    return csv;
  },

  /**
   * Generates a CSS Variable file containing both Raw and Contextual tokens.
   */
  toCSS(processedData) {
    let css = ":root {\n  /* Raw Color Ramp */\n";
    for (const group in processedData.raw) {
      for (const weight in processedData.raw[group]) {
        const item = processedData.raw[group][weight];
        css += `  --${item.tknName.toLowerCase()}: ${item.value};\n`;
      }
    }
    ["light", "dark"].forEach((themeName) => {
      css += `\n  /* Contextual Tokens (${themeName.charAt(0).toUpperCase() + themeName.slice(1)}) */\n`;
      for (const group in processedData.ctx[themeName]) {
        for (const role in processedData.ctx[themeName][group]) {
          for (const variation in processedData.ctx[themeName][group][role]) {
            const val = processedData.ctx[themeName][group][role][variation].value;
            const varName = `--${group.toLowerCase()}-${role.toLowerCase()}-${variation.toLowerCase()}-${themeName}`;
            css += `  ${varName}: ${val};\n`;
          }
        }
      }
    });
    css += "}\n";
    return css;
  },
};

/**
 * 4. FIGMA VARIABLE API (CRUD)
 * Manages the creation, naming, and mode-assignments of Figma variables.
 */
const VariableManager = {
  tally: { created: 0, updated: 0, failed: 0 },
  cache: { variables: [], collections: [] },

  /**
   * Main synchronization loop.
   * @param {Object} processedData - The generated color ramp and mapping.
   * @param {String} scope - 'all', 'groups', or 'roles'.
   */
  async sync(processedData, scope = "all") {
    this.tally = { created: 0, updated: 0, failed: 0 };
    await this.refreshCache();

    // STAGE 1: RAW (Groups ramps)
    if (scope === "all" || scope === "groups") {
      const rawCol = await this.getOrCreateCollection("_raw");
      const rawModeId = rawCol.modes[0].modeId;
      if (processedData.raw) {
        for (const groupName in processedData.raw) {
          const weights = processedData.raw[groupName];
          const varsToCreate = Object.keys(weights).map((w) => [
            weights[w].tknName,
            "COLOR",
            weights[w].value,
            `Base ${groupName} Ramp Weight ${w}`,
          ]);
          await this.upsertVariables(rawCol, rawModeId, varsToCreate);
        }
      }
    }

    // STAGE 2: CONTEXTUAL (Thematic Roles)
    if (scope === "all" || scope === "roles") {
      const contextualCol = await this.getOrCreateCollection("contextual");
      const rawCol = await this.getOrCreateCollection("_raw");

      if (processedData.ctx) {
        for (const themeName in processedData.ctx) {
          const modeId = this.ensureMode(contextualCol, themeName);
          const colorGroups = processedData.ctx[themeName];

          for (const clrGroup in colorGroups) {
            const roles = colorGroups[clrGroup];
            for (const roleKey in roles) {
              const variations = roles[roleKey];
              const varsToCreate = Object.keys(variations).map((vKey) => {
                const varData = variations[vKey];
                // Link Role to the Raw Base Variable via Alias
                const targetVar = this.cache.variables.find(
                  (v) => v.name === varData.valueRef && v.variableCollectionId === rawCol.id
                );
                const valueAlias = targetVar ? { type: "VARIABLE_ALIAS", id: targetVar.id } : null;

                return [`${clrGroup}/${roleKey}/${vKey}`, "COLOR", valueAlias, `Contextual mapping for ${themeName}`];
              });
              await this.upsertVariables(contextualCol, modeId, varsToCreate);
            }
          }
        }
      }
    }

    figma.ui.postMessage({ type: "finish", tally: this.tally });
  },

  async refreshCache() {
    this.cache.variables = await figma.variables.getLocalVariablesAsync();
    this.cache.collections = await figma.variables.getLocalVariableCollectionsAsync();
  },

  async getOrCreateCollection(name) {
    const existing = this.cache.collections.find((c) => c.name === name);
    if (existing) return existing;

    const newCol = figma.variables.createVariableCollection(name);
    this.cache.collections.push(newCol);
    return newCol;
  },

  ensureMode(collection, modeName) {
    const existing = collection.modes.find((m) => m.name === modeName);
    if (existing) return existing.modeId;

    if (collection.modes.length === 1 && collection.modes[0].name.toLowerCase().startsWith("mode")) {
      collection.renameMode(collection.modes[0].modeId, modeName);
      return collection.modes[0].modeId;
    }

    try {
      return collection.addMode(modeName);
    } catch (e) {
      return collection.modes[0].modeId;
    }
  },

  async upsertVariables(collection, modeId, vars) {
    for (const [varName, varType, varValue, varDescription] of vars) {
      try {
        let variable = this.cache.variables.find(
          (v) => v.name === varName && v.variableCollectionId === collection.id
        );

        if (!variable) {
          let type = "STRING";
          if (varType === "COLOR") type = "COLOR";
          else if (varType === "FLOAT") type = "FLOAT";
          else if (varType === "BOOLEAN") type = "BOOLEAN";

          variable = figma.variables.createVariable(varName, collection, type);
          this.cache.variables.push(variable);
          this.tally.created++;
        } else {
          this.tally.updated++;
        }

        if (variable) {
          if (varDescription) variable.description = varDescription;
          if (varValue !== undefined && varValue !== null) {
            if (varType === "COLOR" && typeof varValue === "string") {
              const rgb = ColorUtils.hexToRgb(varValue);
              if (rgb) variable.setValueForMode(modeId, rgb);
            } else {
              variable.setValueForMode(modeId, varValue);
            }
          }
        }
      } catch (err) {
        this.tally.failed++;
      }
    }
  },
};

/**
 * 5. COLOR LOGIC ENGINE
 * Handles the generation of color ramps and the intelligent mapping of roles.
 */
const ColorEngine = {
  /**
   * The core processing loop that converts a raw configuration into a processed token structure.
   */
  process(tokenState) {
    const lightBg = ColorUtils.normalizeHex(tokenState.lightBg) || "#FFFFFF";
    const darkBg = ColorUtils.normalizeHex(tokenState.darkBg) || "#000000";
    const weightCount = tokenState.weightCount;
    const weightMethod = tokenState.weightMethod || "Logarithmic";
    const roleMappingMethod = tokenState.roleMappingMethod || "Contrast-Based";
    const variations = (tokenState.roleVariations || "Darkest,Dark,Base,Light,Lightest")
      .split(",")
      .map((v) => v.trim());

    const rawVarObj = {};
    const conVarObj = { light: {}, dark: {} };

    // Stage 1: Generate Raw Ramps
    tokenState.clrGroups.forEach((group) => {
      const seed = ColorUtils.normalizeHex(group.value) || "#000000";
      const colorVars = ColorUtils.colorStepsMaker(seed, weightCount, weightMethod);
      colorVars.reverse(); // Order from Light to Dark for Weight ramp

      const rawGroup = {};
      colorVars.forEach((val, i) => {
        const weight = i + 1;
        rawGroup[weight] = {
          value: val,
          tknName: `${group.name}-${weight}`,
          shortName: `${group.shortName}-${weight}`,
        };
      });
      rawVarObj[group.name] = rawGroup;
    });

    // Stage 2: Map Contextual Themes
    const themes = [
      { name: "light", bg: lightBg },
      { name: "dark", bg: darkBg },
    ];

    themes.forEach((theme) => {
      const themeName = theme.name;
      const conTheme = (conVarObj[themeName] = {});

      tokenState.clrGroups.forEach((group) => {
        const groupName = group.name;
        conTheme[groupName] = {};

        Object.entries(tokenState.roles).forEach(([roleKey, role]) => {
          const conRole = {};
          const minC = parseFloat(role.minContrast);
          const gap = parseInt(role.gaps);

          let baseWeight = role.baseWeight ? parseInt(role.baseWeight) : -1;

          // Intelligently find the center weight based on Contrast or Manual setting
          if (roleMappingMethod === "Contrast-Based" || baseWeight === -1) {
            if (themeName === "light") {
              for (let i = 1; i <= weightCount; i++) {
                if (ColorUtils.contrastRatio(rawVarObj[groupName][i].value, theme.bg) >= minC) {
                  baseWeight = i;
                  break;
                }
              }
            } else {
              for (let i = weightCount; i >= 1; i--) {
                if (ColorUtils.contrastRatio(rawVarObj[groupName][i].value, theme.bg) >= minC) {
                  baseWeight = i;
                  break;
                }
              }
            }
          }

          if (baseWeight === -1) baseWeight = Math.floor(weightCount / 2);

          // Build variations around the center weight
          const centerIdx = Math.floor(variations.length / 2);
          variations.forEach((v, i) => {
            const stepOffset = i - centerIdx;
            let w = baseWeight + stepOffset * gap * (themeName === "light" ? 1 : -1);
            w = Math.max(1, Math.min(weightCount, w));
            const data = rawVarObj[groupName][w];
            conRole[v] = {
              value: data.value,
              valueRef: data.tknName,
            };
          });
          conTheme[groupName][roleKey] = conRole;
        });
      });
    });

    return { raw: rawVarObj, ctx: conVarObj };
  },
};

/**
 * 6. MATHEMATICAL UTILITIES
 * Core math for color conversions, relative luminance, and ramp distribution.
 */
const ColorUtils = {
  normalizeHex(hex) {
    if (!hex) return null;
    let h = hex.toString().replace("#", "").toUpperCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return h.length === 6 ? "#" + h : null;
  },

  hexToRgb(hex) {
    const h = this.normalizeHex(hex);
    if (!h) return null;
    const r = parseInt(h.substring(1, 3), 16) / 255;
    const g = parseInt(h.substring(3, 5), 16) / 255;
    const b = parseInt(h.substring(5, 7), 16) / 255;
    return { r, g, b };
  },

  rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  },

  hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) r = g = b = l;
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b];
  },

  hslToHex(h, s, l) {
    const rgb = this.hslToRgb(h, s, l);
    const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
  },

  relLum(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 0;
    const a = [rgb.r, rgb.g, rgb.b].map((v) => {
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  },

  contrastRatio(hex1, hex2) {
    const l1 = this.relLum(hex1);
    const l2 = this.relLum(hex2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  },

  /**
   * Distributes colors along a ramp using various mathematical methods.
   */
  colorStepsMaker(hexIn, count, method = "Logarithmic") {
    const rgb = this.hexToRgb(hexIn);
    if (!rgb) return [];
    const [h, s] = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const output = [];

    for (let i = 1; i <= count; i++) {
      let targetLum;
      const t = i / (count + 1);

      switch (method) {
        case "Linear":
          targetLum = 0.05 + 0.9 * t;
          break;
        case "Exponential":
          targetLum = 0.05 + 0.9 * Math.pow(t, 2);
          break;
        case "Logarithmic":
        default:
          const minV = Math.log(0.05),
            maxV = Math.log(1.05);
          const step = (maxV - minV) / (count + 1);
          targetLum = Math.exp(minV + step * i) - 0.05;
          break;
      }

      let low = 0, high = 100, closestL = 50;
      for (let j = 0; j < 20; j++) {
        let mid = (low + high) / 2;
        let midHex = this.hslToHex(h, s, mid);
        let midLum = this.relLum(midHex);
        closestL = mid;
        if (Math.abs(midLum - targetLum) < 0.0001) break;
        if (midLum < targetLum) low = mid;
        else high = mid;
      }
      output.push(this.hslToHex(h, s, closestL));
    }
    return output;
  },
};
