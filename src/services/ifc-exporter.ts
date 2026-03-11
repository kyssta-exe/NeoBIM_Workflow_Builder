/**
 * IFC Exporter — generates a valid IFC4 STEP Physical File (.ifc) from massing geometry.
 *
 * Follows the buildingSMART IFC4 ADD2 TC1 specification.
 * Produces valid ISO-10303-21 files that open in BIMvision, BlenderBIM, FreeCAD, Xeokit, etc.
 *
 * Spatial hierarchy: IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey
 * Elements: IfcWall (.STANDARD.) with IfcExtrudedAreaSolid geometry
 *           IfcSlab (.FLOOR. / .ROOF.) with IfcExtrudedAreaSolid geometry
 */

import type { MassingGeometry, FootprintPoint } from "@/types/geometry";

interface IFCExportOptions {
  projectName?: string;
  siteName?: string;
  buildingName?: string;
  author?: string;
}

// ─── IFC Base-64 GUID Generator ─────────────────────────────────────────────
// IFC GlobalId: exactly 22 characters from the IFC base-64 alphabet.
const IFC_BASE64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

/** Deterministic 22-char IFC GlobalId from a seed. */
function ifcGuid(seed: number): string {
  // Use a simple hash to generate unique 22-char strings
  let h = seed * 2654435761 + Date.now();
  let result = "";
  for (let i = 0; i < 22; i++) {
    h = ((h >>> 0) * 31 + i * 17 + seed) >>> 0;
    result += IFC_BASE64[h % 64];
    h = (h >>> 6) ^ (h * 65599);
  }
  return result;
}

// ─── Entity ID Counter ──────────────────────────────────────────────────────
class IdCounter {
  private _value: number;
  constructor(start = 1) { this._value = start; }
  next(): number { return this._value++; }
  get current(): number { return this._value; }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function f(n: number, decimals = 4): string {
  return n.toFixed(decimals);
}

/**
 * Generate a complete valid IFC4 file from massing geometry.
 */
export function generateIFCFile(
  geometry: MassingGeometry,
  options: IFCExportOptions = {}
): string {
  const {
    projectName = "BuildFlow Export",
    siteName = "Default Site",
    buildingName = geometry.buildingType,
    author = "BuildFlow",
  } = options;

  const now = new Date().toISOString().replace(/\.\d+Z$/, "");
  const timestamp = Math.floor(Date.now() / 1000);
  const id = new IdCounter();
  const lines: string[] = [];

  // Sanitize strings for STEP format (no single quotes)
  const safeName = (s: string) => s.replace(/'/g, "");

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  const header = [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION(('ViewDefinition [DesignTransferView_V1]'),'2;1');`,
    `FILE_NAME('${safeName(buildingName)}.ifc','${now}',('${safeName(author)}'),('BuildFlow'),'BuildFlow IFC Exporter','BuildFlow','');`,
    `FILE_SCHEMA(('IFC4'));`,
    "ENDSEC;",
    "",
    "DATA;",
  ].join("\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARED GEOMETRY PRIMITIVES
  // ═══════════════════════════════════════════════════════════════════════════
  const worldOriginId = id.next();
  lines.push(`#${worldOriginId}=IFCCARTESIANPOINT((0.,0.,0.));`);

  const zDirId = id.next();
  lines.push(`#${zDirId}=IFCDIRECTION((0.,0.,1.));`);

  const xDirId = id.next();
  lines.push(`#${xDirId}=IFCDIRECTION((1.,0.,0.));`);

  const worldPlacementId = id.next();
  lines.push(`#${worldPlacementId}=IFCAXIS2PLACEMENT3D(#${worldOriginId},#${zDirId},#${xDirId});`);

  // ═══════════════════════════════════════════════════════════════════════════
  // GEOMETRIC REPRESENTATION CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════
  const contextId = id.next();
  lines.push(`#${contextId}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#${worldPlacementId},$);`);

  const bodyContextId = id.next();
  lines.push(`#${bodyContextId}=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${contextId},$,.MODEL_VIEW.,$);`);

  // ═══════════════════════════════════════════════════════════════════════════
  // UNITS — SI (metre, square metre, cubic metre, radian, second)
  // ═══════════════════════════════════════════════════════════════════════════
  const mId = id.next();
  lines.push(`#${mId}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);

  const m2Id = id.next();
  lines.push(`#${m2Id}=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);`);

  const m3Id = id.next();
  lines.push(`#${m3Id}=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);`);

  const radId = id.next();
  lines.push(`#${radId}=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);`);

  const secId = id.next();
  lines.push(`#${secId}=IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.);`);

  const unitAssignId = id.next();
  lines.push(`#${unitAssignId}=IFCUNITASSIGNMENT((#${mId},#${m2Id},#${m3Id},#${radId},#${secId}));`);

  // ═══════════════════════════════════════════════════════════════════════════
  // OWNER HISTORY
  // ═══════════════════════════════════════════════════════════════════════════
  const personId = id.next();
  lines.push(`#${personId}=IFCPERSON($,'${safeName(author)}','',$,$,$,$,$);`);

  const orgId = id.next();
  lines.push(`#${orgId}=IFCORGANIZATION($,'BuildFlow','BuildFlow Workflow Platform',$,$);`);

  const personOrgId = id.next();
  lines.push(`#${personOrgId}=IFCPERSONANDORGANIZATION(#${personId},#${orgId},$);`);

  const appId = id.next();
  lines.push(`#${appId}=IFCAPPLICATION(#${orgId},'1.0','BuildFlow Workflow Builder','BuildFlow');`);

  const ownerHistId = id.next();
  lines.push(`#${ownerHistId}=IFCOWNERHISTORY(#${personOrgId},#${appId},$,.ADDED.,${timestamp},$,$,${timestamp});`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT
  // ═══════════════════════════════════════════════════════════════════════════
  const projectId = id.next();
  lines.push(`#${projectId}=IFCPROJECT('${ifcGuid(projectId)}',#${ownerHistId},'${safeName(projectName)}',$,$,$,$,(#${contextId}),#${unitAssignId});`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SITE
  // ═══════════════════════════════════════════════════════════════════════════
  const sitePlacementId = id.next();
  lines.push(`#${sitePlacementId}=IFCLOCALPLACEMENT($,#${worldPlacementId});`);

  const siteId = id.next();
  lines.push(`#${siteId}=IFCSITE('${ifcGuid(siteId)}',#${ownerHistId},'${safeName(siteName)}',$,$,#${sitePlacementId},$,$,.ELEMENT.,$,$,$,$,$);`);

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILDING
  // ═══════════════════════════════════════════════════════════════════════════
  const buildingPlacementId = id.next();
  lines.push(`#${buildingPlacementId}=IFCLOCALPLACEMENT(#${sitePlacementId},#${worldPlacementId});`);

  const buildingId = id.next();
  lines.push(`#${buildingId}=IFCBUILDING('${ifcGuid(buildingId)}',#${ownerHistId},'${safeName(buildingName)}',$,$,#${buildingPlacementId},$,$,.ELEMENT.,$,$,$);`);

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILDING STOREYS & ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  const storeyIds: number[] = [];

  for (const storey of geometry.storeys) {
    // ── Storey placement (relative to building, offset by elevation) ──
    const storeyOriginId = id.next();
    lines.push(`#${storeyOriginId}=IFCCARTESIANPOINT((0.,0.,${f(storey.elevation)}));`);

    const storeyAxisId = id.next();
    lines.push(`#${storeyAxisId}=IFCAXIS2PLACEMENT3D(#${storeyOriginId},#${zDirId},#${xDirId});`);

    const storeyPlacementId = id.next();
    lines.push(`#${storeyPlacementId}=IFCLOCALPLACEMENT(#${buildingPlacementId},#${storeyAxisId});`);

    const storeyId = id.next();
    lines.push(`#${storeyId}=IFCBUILDINGSTOREY('${ifcGuid(storeyId)}',#${ownerHistId},'${safeName(storey.name)}',$,$,#${storeyPlacementId},$,$,.ELEMENT.,${f(storey.elevation)});`);
    storeyIds.push(storeyId);

    const storeyElementIds: number[] = [];

    const storeySpaceIds: number[] = [];

    for (const element of storey.elements) {
      if (element.type === "wall") {
        const wallId = writeWallEntity(
          element, storey, storeyPlacementId,
          bodyContextId, zDirId, ownerHistId,
          id, lines
        );
        storeyElementIds.push(wallId);

      } else if (element.type === "slab" || element.type === "roof") {
        const slabId = writeSlabEntity(
          element, geometry.footprint, storeyPlacementId,
          bodyContextId, ownerHistId,
          element.type === "roof",
          id, lines
        );
        storeyElementIds.push(slabId);

      } else if (element.type === "column") {
        const colId = writeColumnEntity(
          element, storeyPlacementId,
          bodyContextId, zDirId, ownerHistId,
          id, lines
        );
        storeyElementIds.push(colId);

      } else if (element.type === "space") {
        const spaceId = writeSpaceEntity(
          element, storeyPlacementId,
          bodyContextId, ownerHistId,
          id, lines
        );
        storeySpaceIds.push(spaceId);
      }
    }

    // ── Spatial containment: physical elements → storey ──
    if (storeyElementIds.length > 0) {
      const relId = id.next();
      lines.push(`#${relId}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid(relId)}',#${ownerHistId},'${safeName(storey.name)} Contents',$,(${storeyElementIds.map(i => `#${i}`).join(",")}),#${storeyId});`);
    }

    // ── Spatial decomposition: IfcSpace → storey (spaces are spatial elements) ──
    if (storeySpaceIds.length > 0) {
      const relSpaceId = id.next();
      lines.push(`#${relSpaceId}=IFCRELAGGREGATES('${ifcGuid(relSpaceId)}',#${ownerHistId},'${safeName(storey.name)} Spaces',$,#${storeyId},(${storeySpaceIds.map(i => `#${i}`).join(",")}));`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPATIAL AGGREGATION: Project → Site → Building → Storeys
  // ═══════════════════════════════════════════════════════════════════════════
  const relProjSiteId = id.next();
  lines.push(`#${relProjSiteId}=IFCRELAGGREGATES('${ifcGuid(relProjSiteId)}',#${ownerHistId},'ProjectToSite',$,#${projectId},(#${siteId}));`);

  const relSiteBldgId = id.next();
  lines.push(`#${relSiteBldgId}=IFCRELAGGREGATES('${ifcGuid(relSiteBldgId)}',#${ownerHistId},'SiteToBuilding',$,#${siteId},(#${buildingId}));`);

  const relBldgStoreysId = id.next();
  lines.push(`#${relBldgStoreysId}=IFCRELAGGREGATES('${ifcGuid(relBldgStoreysId)}',#${ownerHistId},'BuildingToStoreys',$,#${buildingId},(${storeyIds.map(i => `#${i}`).join(",")}));`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTY SET: Building Info
  // ═══════════════════════════════════════════════════════════════════════════
  const propFloors = id.next();
  lines.push(`#${propFloors}=IFCPROPERTYSINGLEVALUE('NumberOfFloors',$,IFCINTEGER(${geometry.floors}),$);`);

  const propHeight = id.next();
  lines.push(`#${propHeight}=IFCPROPERTYSINGLEVALUE('TotalHeight',$,IFCLENGTHMEASURE(${f(geometry.totalHeight)}),$);`);

  const propGFA = id.next();
  lines.push(`#${propGFA}=IFCPROPERTYSINGLEVALUE('GrossFloorArea',$,IFCAREAMEASURE(${f(geometry.gfa, 2)}),$);`);

  const propFootprint = id.next();
  lines.push(`#${propFootprint}=IFCPROPERTYSINGLEVALUE('FootprintArea',$,IFCAREAMEASURE(${f(geometry.footprintArea, 2)}),$);`);

  const propType = id.next();
  lines.push(`#${propType}=IFCPROPERTYSINGLEVALUE('BuildingType',$,IFCTEXT('${safeName(geometry.buildingType)}'),$);`);

  const psetId = id.next();
  lines.push(`#${psetId}=IFCPROPERTYSET('${ifcGuid(psetId)}',#${ownerHistId},'BuildFlow_BuildingInfo',$,(#${propFloors},#${propHeight},#${propGFA},#${propFootprint},#${propType}));`);

  const relPsetId = id.next();
  lines.push(`#${relPsetId}=IFCRELDEFINESBYPROPERTIES('${ifcGuid(relPsetId)}',#${ownerHistId},$,$,(#${buildingId}),#${psetId});`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSEMBLE FILE
  // ═══════════════════════════════════════════════════════════════════════════
  return [header, ...lines, "ENDSEC;", "END-ISO-10303-21;"].join("\n");
}


// ─── Wall Entity Writer ─────────────────────────────────────────────────────

import type { GeometryElement, MassingStorey } from "@/types/geometry";

function writeWallEntity(
  element: GeometryElement,
  storey: MassingStorey,
  storeyPlacementId: number,
  bodyContextId: number,
  zDirId: number,
  ownerHistId: number,
  id: IdCounter,
  lines: string[]
): number {
  const wallLength = element.properties.length ?? 10;
  const wallThickness = element.properties.thickness ?? 0.25;
  const wallHeight = element.properties.height ?? storey.height;

  // ── Profile: IfcRectangleProfileDef centered at (length/2, thickness/2) ──
  const profCenterId = id.next();
  lines.push(`#${profCenterId}=IFCCARTESIANPOINT((${f(wallLength / 2)},${f(wallThickness / 2)}));`);

  const profPlacementId = id.next();
  lines.push(`#${profPlacementId}=IFCAXIS2PLACEMENT2D(#${profCenterId},$);`);

  const profileId = id.next();
  lines.push(`#${profileId}=IFCRECTANGLEPROFILEDEF(.AREA.,'Wall Profile',#${profPlacementId},${f(wallLength)},${f(wallThickness)});`);

  // ── Extrusion: Z-up by wallHeight ──
  const extDirId = id.next();
  lines.push(`#${extDirId}=IFCDIRECTION((0.,0.,1.));`);

  const solidId = id.next();
  lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(#${profileId},$,#${extDirId},${f(wallHeight)});`);

  // ── Shape representation ──
  const shapeRepId = id.next();
  lines.push(`#${shapeRepId}=IFCSHAPEREPRESENTATION(#${bodyContextId},'Body','SweptSolid',(#${solidId}));`);

  const prodShapeId = id.next();
  lines.push(`#${prodShapeId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);

  // ── Local placement: position wall at its footprint vertex, oriented along wall direction ──
  const v0 = element.vertices[0];
  const v1 = element.vertices[1];
  const dx = v1.x - v0.x;
  const dy = v1.y - v0.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  const wallOriginId = id.next();
  lines.push(`#${wallOriginId}=IFCCARTESIANPOINT((${f(v0.x)},${f(v0.y)},0.));`);

  const wallXDirId = id.next();
  lines.push(`#${wallXDirId}=IFCDIRECTION((${f(dx / len, 6)},${f(dy / len, 6)},0.));`);

  const wallAxisId = id.next();
  lines.push(`#${wallAxisId}=IFCAXIS2PLACEMENT3D(#${wallOriginId},#${zDirId},#${wallXDirId});`);

  const wallPlacementId = id.next();
  lines.push(`#${wallPlacementId}=IFCLOCALPLACEMENT(#${storeyPlacementId},#${wallAxisId});`);

  // ── Wall entity (IFC4: .STANDARD. for exterior, .PARTITIONING. for interior) ──
  const wallPredefinedType = element.properties.isPartition ? ".PARTITIONING." : ".STANDARD.";
  const wallId = id.next();
  lines.push(`#${wallId}=IFCWALL('${ifcGuid(wallId)}',#${ownerHistId},'${element.properties.name}',$,$,#${wallPlacementId},#${prodShapeId},$,${wallPredefinedType});`);

  return wallId;
}


// ─── Slab Entity Writer ─────────────────────────────────────────────────────

function writeSlabEntity(
  element: GeometryElement,
  footprint: FootprintPoint[],
  storeyPlacementId: number,
  bodyContextId: number,
  ownerHistId: number,
  isRoof: boolean,
  id: IdCounter,
  lines: string[]
): number {
  const thickness = element.properties.thickness ?? 0.3;

  // ── Profile: IfcArbitraryClosedProfileDef from footprint polyline ──
  // Write 2D cartesian points for the profile
  const ptIds: number[] = [];
  for (const p of footprint) {
    const ptId = id.next();
    lines.push(`#${ptId}=IFCCARTESIANPOINT((${f(p.x)},${f(p.y)}));`);
    ptIds.push(ptId);
  }
  // Close the polyline: last point = first point
  ptIds.push(ptIds[0]);

  const polylineId = id.next();
  lines.push(`#${polylineId}=IFCPOLYLINE((${ptIds.map(i => `#${i}`).join(",")}));`);

  const profileId = id.next();
  lines.push(`#${profileId}=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,'Slab Profile',#${polylineId});`);

  // ── Extrusion: Z-up by thickness ──
  const extDirId = id.next();
  lines.push(`#${extDirId}=IFCDIRECTION((0.,0.,1.));`);

  const solidId = id.next();
  lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(#${profileId},$,#${extDirId},${f(thickness)});`);

  // ── Shape representation ──
  const shapeRepId = id.next();
  lines.push(`#${shapeRepId}=IFCSHAPEREPRESENTATION(#${bodyContextId},'Body','SweptSolid',(#${solidId}));`);

  const prodShapeId = id.next();
  lines.push(`#${prodShapeId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);

  // ── Local placement: offset slab downward by its thickness so top face is at floor level ──
  const slabOriginId = id.next();
  lines.push(`#${slabOriginId}=IFCCARTESIANPOINT((0.,0.,${f(-thickness)}));`);

  const slabAxisId = id.next();
  lines.push(`#${slabAxisId}=IFCAXIS2PLACEMENT3D(#${slabOriginId},$,$);`);

  const slabPlacementId = id.next();
  lines.push(`#${slabPlacementId}=IFCLOCALPLACEMENT(#${storeyPlacementId},#${slabAxisId});`);

  // ── Slab entity ──
  const predefinedType = isRoof ? ".ROOF." : ".FLOOR.";
  const slabId = id.next();
  lines.push(`#${slabId}=IFCSLAB('${ifcGuid(slabId)}',#${ownerHistId},'${element.properties.name}',$,$,#${slabPlacementId},#${prodShapeId},$,${predefinedType});`);

  return slabId;
}


// ─── Column Entity Writer ────────────────────────────────────────────────────

function writeColumnEntity(
  element: GeometryElement,
  storeyPlacementId: number,
  bodyContextId: number,
  zDirId: number,
  ownerHistId: number,
  id: IdCounter,
  lines: string[]
): number {
  const colHeight = element.properties.height ?? 3.6;
  const colRadius = element.properties.radius ?? 0.3;

  // ── Profile: IfcCircleProfileDef ──
  const profCenterId = id.next();
  lines.push(`#${profCenterId}=IFCCARTESIANPOINT((0.,0.));`);

  const profPlacementId = id.next();
  lines.push(`#${profPlacementId}=IFCAXIS2PLACEMENT2D(#${profCenterId},$);`);

  const profileId = id.next();
  lines.push(`#${profileId}=IFCCIRCLEPROFILEDEF(.AREA.,'Column Profile',#${profPlacementId},${f(colRadius)});`);

  // ── Extrusion ──
  const extDirId = id.next();
  lines.push(`#${extDirId}=IFCDIRECTION((0.,0.,1.));`);

  const solidId = id.next();
  lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(#${profileId},$,#${extDirId},${f(colHeight)});`);

  // ── Shape representation ──
  const shapeRepId = id.next();
  lines.push(`#${shapeRepId}=IFCSHAPEREPRESENTATION(#${bodyContextId},'Body','SweptSolid',(#${solidId}));`);

  const prodShapeId = id.next();
  lines.push(`#${prodShapeId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);

  // ── Local placement at column center ──
  // Get center from first vertex (bottom center of octagonal approximation)
  const cx = element.vertices.length > 0
    ? element.vertices.reduce((s, v) => s + v.x, 0) / element.vertices.length
    : 0;
  const cy = element.vertices.length > 0
    ? element.vertices.reduce((s, v) => s + v.y, 0) / element.vertices.length
    : 0;

  const colOriginId = id.next();
  lines.push(`#${colOriginId}=IFCCARTESIANPOINT((${f(cx)},${f(cy)},0.));`);

  const colAxisId = id.next();
  lines.push(`#${colAxisId}=IFCAXIS2PLACEMENT3D(#${colOriginId},#${zDirId},$);`);

  const colPlacementId = id.next();
  lines.push(`#${colPlacementId}=IFCLOCALPLACEMENT(#${storeyPlacementId},#${colAxisId});`);

  // ── Column entity ──
  const colId = id.next();
  lines.push(`#${colId}=IFCCOLUMN('${ifcGuid(colId)}',#${ownerHistId},'${element.properties.name}',$,$,#${colPlacementId},#${prodShapeId},$,.COLUMN.);`);

  return colId;
}


// ─── Space Entity Writer ─────────────────────────────────────────────────────

function writeSpaceEntity(
  element: GeometryElement,
  storeyPlacementId: number,
  bodyContextId: number,
  ownerHistId: number,
  id: IdCounter,
  lines: string[]
): number {
  const spaceHeight = element.properties.height ?? 3.6;
  const spaceFootprint = element.properties.spaceFootprint;

  if (!spaceFootprint || spaceFootprint.length < 3) {
    // Fallback: skip if no valid footprint
    const dummyId = id.next();
    lines.push(`#${dummyId}=IFCSPACE('${ifcGuid(dummyId)}',#${ownerHistId},'${element.properties.name}',$,$,#${storeyPlacementId},$,$,.ELEMENT.,.INTERNAL.,$);`);
    return dummyId;
  }

  // ── Profile: IfcArbitraryClosedProfileDef from space footprint ──
  const ptIds: number[] = [];
  for (const p of spaceFootprint) {
    const ptId = id.next();
    lines.push(`#${ptId}=IFCCARTESIANPOINT((${f(p.x)},${f(p.y)}));`);
    ptIds.push(ptId);
  }
  ptIds.push(ptIds[0]); // close polyline

  const polylineId = id.next();
  lines.push(`#${polylineId}=IFCPOLYLINE((${ptIds.map(i => `#${i}`).join(",")}));`);

  const profileId = id.next();
  lines.push(`#${profileId}=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,'Space Profile',#${polylineId});`);

  // ── Extrusion ──
  const extDirId = id.next();
  lines.push(`#${extDirId}=IFCDIRECTION((0.,0.,1.));`);

  const solidId = id.next();
  lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(#${profileId},$,#${extDirId},${f(spaceHeight)});`);

  // ── Shape representation ──
  const shapeRepId = id.next();
  lines.push(`#${shapeRepId}=IFCSHAPEREPRESENTATION(#${bodyContextId},'Body','SweptSolid',(#${solidId}));`);

  const prodShapeId = id.next();
  lines.push(`#${prodShapeId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);

  // ── Local placement ──
  const spaceOriginId = id.next();
  lines.push(`#${spaceOriginId}=IFCCARTESIANPOINT((0.,0.,0.));`);

  const spaceAxisId = id.next();
  lines.push(`#${spaceAxisId}=IFCAXIS2PLACEMENT3D(#${spaceOriginId},$,$);`);

  const spacePlacementId = id.next();
  lines.push(`#${spacePlacementId}=IFCLOCALPLACEMENT(#${storeyPlacementId},#${spaceAxisId});`);

  // ── Space entity ──
  const spaceType = element.properties.spaceUsage === "circulation" ? ".GFA." : ".INTERNAL.";
  const spaceId = id.next();
  lines.push(`#${spaceId}=IFCSPACE('${ifcGuid(spaceId)}',#${ownerHistId},'${element.properties.spaceName ?? element.properties.name}',$,$,#${spacePlacementId},#${prodShapeId},$,.ELEMENT.,${spaceType},$);`);

  return spaceId;
}
