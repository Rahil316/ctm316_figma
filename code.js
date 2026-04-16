/**
 * ============================================================================
 * MODULAR FIGMA VARIABLE ORCHESTRATOR (COLLECTION-CENTRIC)
 * ============================================================================
 */

let tally = { created: 0, updated: 0, failed: 0 };
let variableCache = [];
let collectionCache = [];

/**
 * Sync cache with current Figma state
 */
async function syncCache() {
  variableCache = await figma.variables.getLocalVariablesAsync();
  collectionCache = await figma.variables.getLocalVariableCollectionsAsync();
}

/**
 * 1. CreateCollection (Cached)
 */
async function CreateCollection(collectionName) {
  const existing = collectionCache.find((c) => c.name === collectionName);
  if (existing) return existing;

  const newCol = figma.variables.createVariableCollection(collectionName);
  collectionCache.push(newCol);
  return newCol;
}

/**
 * 2. createMode
 */
function createMode(collection, modeName) {
  const existing = collection.modes.find((m) => m.name === modeName);
  if (existing) return existing.modeId;

  if (collection.modes.length === 1 && collection.modes[0].name.toLowerCase().startsWith("mode")) {
    collection.renameMode(collection.modes[0].modeId, modeName);
    return collection.modes[0].modeId;
  }

  try {
    return collection.addMode(modeName);
  } catch (e) {
    console.warn(`Mode limit reached for ${collection.name}. Fallback to first.`);
    return collection.modes[0].modeId;
  }
}

/**
 * 3. createVar (Optimized with Cache)
 */
async function createVar(collection, modeId, vars) {
  for (const [varName, varType, varValue, varDescription] of vars) {
    try {
      let variable = variableCache.find((v) => v.name === varName && v.variableCollectionId === collection.id);

      if (!variable) {
        let type = "STRING";
        if (varType === "COLOR" || varType === "hex") type = "COLOR";
        else if (varType === "FLOAT") type = "FLOAT";
        else if (varType === "BOOLEAN") type = "BOOLEAN";

        variable = figma.variables.createVariable(varName, collection, type);
        variableCache.push(variable);
        tally.created++;
      } else {
        tally.updated++;
      }

      if (variable) {
        if (varDescription) variable.description = varDescription;

        if (varValue !== undefined && varValue !== "#" && varValue !== null) {
          if ((varType === "COLOR" || varType === "hex") && typeof varValue === "string") {
            const rgb = hexToRgb(varValue);
            if (rgb) variable.setValueForMode(modeId, rgb);
          } else {
            variable.setValueForMode(modeId, varValue);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${varName}:`, err);
      tally.failed++;
    }
  }
}

function hexToRgb(hex) {
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3)
    cleanHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  if (cleanHex.length !== 6) return null;
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
}

/**
 * PIPELINE
 */
async function runCreater(data) {
  tally = { created: 0, updated: 0, failed: 0 };
  await syncCache();

  const rawCol = await CreateCollection("_raw");
  const contextualCol = await CreateCollection("contextual");
  const rawModeId = rawCol.modes[0].modeId;

  // STAGE 1: RAW
  if (data.raw) {
    for (const groupName in data.raw) {
      const weights = data.raw[groupName];
      const varsToCreate = Object.keys(weights).map((w) => [weights[w].tknName, "COLOR", weights[w].value, `Base ${groupName} ${w}`]);
      await createVar(rawCol, rawModeId, varsToCreate);
    }
  }

  // STAGE 2: CONTEXTUAL (Using updated cache)
  if (data.ctx) {
    for (const themeName in data.ctx) {
      const modeId = createMode(contextualCol, themeName);
      const colorGroups = data.ctx[themeName];

      for (const clrGroup in colorGroups) {
        const roles = colorGroups[clrGroup];
        for (const roleKey in roles) {
          const variations = roles[roleKey];
          const varsToCreate = Object.keys(variations).map((vKey) => {
            const varData = variations[vKey];
            const targetVar = variableCache.find((v) => v.name === varData.valueRef && v.variableCollectionId === rawCol.id);
            const valueAlias = targetVar ? { type: "VARIABLE_ALIAS", id: targetVar.id } : null;

            return [`${clrGroup}/${roleKey}/${vKey}`, "COLOR", valueAlias, `Theme: ${themeName}`];
          });
          await createVar(contextualCol, modeId, varsToCreate);
        }
      }
    }
  }

  console.log("Plugin runCreater finishing, tally:", tally);
  figma.ui.postMessage({ type: "finish", tally });
}

figma.showUI(__html__, { width: 480, height: 760, themeColors: true });

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === "run-creater") {
      console.log("Starting run-creater...");
      await runCreater(msg.data);
      console.log("Run-creater completed.");
    }
    if (msg.type === "resize") {
      console.log("Resizing to:", msg.width, msg.height);
      figma.ui.resize(msg.width, msg.height);
    }
    if (msg.type === "cancel") figma.closePlugin();
  } catch (err) {
    console.error("Plugin Error:", err);
    figma.ui.postMessage({ type: "error", message: err.message || "An unknown error occurred in the plugin" });
  }
};
