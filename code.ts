/**
 * ============================================================================
 * MODULAR FIGMA VARIABLE ORCHESTRATOR (COLLECTION-CENTRIC)
 * ============================================================================
 */

let tally = { created: 0, updated: 0, failed: 0 };

/**
 * 1. CreateCollection
 */
async function CreateCollection(collectionName: string): Promise<VariableCollection> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existing = collections.find(c => c.name === collectionName);
  
  if (existing) return existing;
  return figma.variables.createVariableCollection(collectionName);
}

/**
 * 2. createMode
 */
function createMode(collection: VariableCollection, modeName: string): string {
  const existing = collection.modes.find(m => m.name === modeName);
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
 * 3. createVar
 */
async function createVar(collection: VariableCollection, modeId: string, vars: any[][]) {
  const allVariables = await figma.variables.getLocalVariablesAsync();
  
  for (const [varName, varType, varValue, varDescription] of vars) {
    try {
      let variable = allVariables.find(v => v.name === varName && v.variableCollectionId === collection.id);

      if (!variable) {
        let type: VariableResolvedDataType = "STRING";
        if (varType === "COLOR" || varType === "hex") type = "COLOR";
        else if (varType === "FLOAT") type = "FLOAT";
        else if (varType === "BOOLEAN") type = "BOOLEAN";

        // FIX: Passing the collection node (not just the ID) to resolve runtime error.
        // Also using figma.variables namespace as it's the more consistent API signature in older typings.
        variable = figma.variables.createVariable(varName, collection, type);
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

function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(char => char + char).join('');
  if (cleanHex.length !== 6) return null;
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
}

/**
 * PIPELINE
 */
async function runCreater(data: any) {
  tally = { created: 0, updated: 0, failed: 0 };
  
  const rawCol = await CreateCollection("_raw");
  const contextualCol = await CreateCollection("contextual");
  const rawModeId = rawCol.modes[0].modeId; 
  
  const rawMapping = new Map<string, Variable>();

  // STAGE 1: RAW
  if (data.raw) {
    for (const groupName in data.raw) {
      const weights = data.raw[groupName];
      const varsToCreate = Object.keys(weights).map(w => [
         weights[w].tknName,
         "COLOR",
         weights[w].value,
         `Base ${groupName} ${w}`
      ]);
      await createVar(rawCol, rawModeId, varsToCreate);
    }

    // Capture map after all raw vars are created
    const allFinalVars = await figma.variables.getLocalVariablesAsync();
    allFinalVars.forEach(v => {
      if (v.variableCollectionId === rawCol.id) {
        rawMapping.set(v.name, v);
      }
    });
  }

  // STAGE 2: CONTEXTUAL
  if (data.ctx) {
    for (const themeName in data.ctx) {
      const modeId = createMode(contextualCol, themeName);
      const colorGroups = data.ctx[themeName];
      
      for (const clrGroup in colorGroups) {
        const roles = colorGroups[clrGroup];
        for (const roleKey in roles) {
          const variations = roles[roleKey];
          const varsToCreate = Object.keys(variations).map(vKey => {
            const varData = variations[vKey];
            const targetVar = rawMapping.get(varData.valueRef || "");
            const valueAlias = targetVar ? { type: "VARIABLE_ALIAS", id: targetVar.id } : null;
            
            return [
              `${clrGroup}/${roleKey}/${vKey}`, 
              "COLOR",
              valueAlias,
              `Theme: ${themeName}`
            ];
          });
          await createVar(contextualCol, modeId, varsToCreate);
        }
      }
    }
  }

  console.log("Plugin runCreater finishing, tally:", tally);
  figma.ui.postMessage({ type: "finish", tally });
}

figma.showUI(__html__, { width: 340, height: 480, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "run-creater") {
    console.log("Starting run-creater...");
    await runCreater(msg.data);
    console.log("Run-creater completed.");
  }
  if (msg.type === "resize") figma.ui.resize(msg.width, msg.height);
  if (msg.type === "cancel") figma.closePlugin();
};
