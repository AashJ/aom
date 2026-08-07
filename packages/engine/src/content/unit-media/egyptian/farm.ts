import { TYPE_EGYPTIAN_FARM } from "@aom/sim";
import iconUrl from "../../../assets/building-farm-icon.png";
import modelUrl from "../../../assets/models/farm-cabbages.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_FARM, key: "egyptian-farm", modelUrl, iconUrl, worldHeight: 1 });
