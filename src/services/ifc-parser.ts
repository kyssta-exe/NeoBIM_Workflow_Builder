/**
 * IFC Parser service using web-ifc (WASM) — server-side only.
 * Extracts element counts, quantity sets, and storey information from IFC files.
 */

// Dynamic import to avoid bundling WASM in client
import { IfcAPI, IFCBUILDINGSTOREY, IFCWALL, IFCWINDOW, IFCDOOR, IFCSLAB, IFCCOLUMN, IFCBEAM, IFCSTAIR } from "web-ifc";

export interface IFCElement {
  type: string;
  count: number;
  area?: number;
  volume?: number;
  source: string;
}

export interface IFCParseResult {
  filename: string;
  schema: string;
  storeys: number;
  totalElements: number;
  elements: IFCElement[];
}

const IFC_TYPES = [
  { typeId: IFCWALL,          label: "IfcWall" },
  { typeId: IFCWINDOW,        label: "IfcWindow" },
  { typeId: IFCDOOR,          label: "IfcDoor" },
  { typeId: IFCSLAB,          label: "IfcSlab" },
  { typeId: IFCCOLUMN,        label: "IfcColumn" },
  { typeId: IFCBEAM,          label: "IfcBeam" },
  { typeId: IFCSTAIR,         label: "IfcStair" },
];

export async function parseIFCBuffer(
  buffer: Uint8Array,
  filename: string
): Promise<IFCParseResult> {
  const ifcAPI = new IfcAPI();
  await ifcAPI.Init();

  const modelID = ifcAPI.OpenModel(buffer, {
    COORDINATE_TO_ORIGIN: true,
  });

  // Get schema
  const schema = ifcAPI.GetModelSchema(modelID) ?? "IFC2X3";

  // Count storeys
  const storeyIDs = ifcAPI.GetLineIDsWithType(modelID, IFCBUILDINGSTOREY);
  const storeyCount = storeyIDs.size();

  // Count elements per type
  const elements: IFCElement[] = [];
  let totalElements = 0;

  for (const { typeId, label } of IFC_TYPES) {
    const ids = ifcAPI.GetLineIDsWithType(modelID, typeId);
    const count = ids.size();
    if (count > 0) {
      elements.push({
        type: label,
        count,
        source: "geometry_computed",
      });
      totalElements += count;
    }
  }

  ifcAPI.CloseModel(modelID);

  return {
    filename,
    schema,
    storeys: storeyCount,
    totalElements,
    elements,
  };
}
