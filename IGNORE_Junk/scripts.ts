//Interfaces
//
//  ColorInput from dom or default input
interface colorInput {
  colorName: string;
  colorNameShort: string;
  colorValue: string;
}
interface colorToken {
  name: string;
  nameShort: string;
  value: string;
  weight: number;
  contrast: {
    dark?: {
      rating: string;
      ratio: number;
    };
    light?: {
      rating: string;
      ratio: number;
    };
  };
}
// collection of a single color tokens
interface colorTokensCollection {
  colorName: string;
  colorNameShort: string;
  colorWeights: colorToken[];
}
// collection of all color tokens
interface allColorTokens {
  collection: colorTokensCollection[];
}
//  ColorInput from dom or default input for manual color mapping
interface roleInputManual {
  name: string;
  nameShort: string;
  basePoint: number;
  gaps: number;
}
//  ColorInput from dom or default input for contrast based color mapping

interface roleInputContrast {
  name: string;
  roleNameShort: string;
  minContrast: number;
  gaps: number;
}
//  Single role token output
interface roleToken {
  roleTokenName: string;
  roleTokenNameShort: string;
  refWeightToken: string;
  contrast: {
    dark?: {
      rating: string;
      ratio: number;
    };
    light?: {
      rating: string;
      ratio: number;
    };
  };
}
// collection of a single roles variations
interface roleTokensCollection {
  roleName: string;
  roleNameShort: string;
  variations: roleToken[];
  warnings?: string[];
}
// collection of all roles variations
interface allRolesTokens {
  roleTokensCollection: roleTokensCollection[];
}
// Collective Config ofthe whole system
interface colorSystemConfig {
  designSystemName: string;
  weightsMethod: string;
  roleMappingMethod: string;
  weightsCount: number;
  weightNames: string[];
  roleVariationsCount: number;
  roleVariationsNames: string[];
  colorInputs: colorInput[];
  roleInputs: roleInputManual[];
}

// Output Architecture
interface colorSystemOutput {
  colorSystemConfig: colorSystemConfig;
  colorWeights: allColorTokens;
  roleTokens: allRolesTokens;
}

// Setting default color system
let DefaultSystem: colorSystemConfig = {
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
function TokensMaker(config: colorSystemConfig): colorSystemOutput {
  // Populates Colors
  let colors: allColorTokens = {
    collection: config.colorInputs.map((colorInput) => {
      return {
        colorName: colorInput.colorName,
        colorNameShort: colorInput.colorNameShort,
        colorWeights: colorWeightsMaker(colorInput, config.weightsCount, config.weightNames, config.weightsMethod),
      };
    }),
  };
  // Populating Roles
  let roles: allRolesTokens = colorRolesMakerManual(config.roleInputs, config.roleVariationsNames, config.roleVariationsCount, colors);
  // return Output
  return { colorSystemConfig: config, colorWeights: colors, roleTokens: roles };
}
const tokenCollection: colorSystemOutput = TokensMaker(DefaultSystem);
console.log(tokenCollection);
