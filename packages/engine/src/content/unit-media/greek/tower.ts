import { TYPE_GREEK_TOWER } from "@aom/sim";
import iconUrl from "../../../assets/building-tower-icon.png";
import modelUrl from "../../../assets/models/greek-tower.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_TOWER, key: "greek-tower", modelUrl, iconUrl, worldHeight: 6 });
