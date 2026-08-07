import { TYPE_EGYPTIAN_TOWER } from "@aom/sim";
import iconUrl from "../../../assets/building-tower-icon.png";
import modelUrl from "../../../assets/models/egyptian-tower.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_TOWER, key: "egyptian-tower", modelUrl, iconUrl, worldHeight: 6 });
