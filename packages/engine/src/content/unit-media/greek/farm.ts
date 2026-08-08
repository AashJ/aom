import { TYPE_GREEK_FARM } from "@aom/sim";
import iconUrl from "../../../assets/building-farm-icon.png";
import modelUrl from "../../../assets/models/farm-cabbages.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_FARM, key: "greek-farm", modelUrl, iconUrl, worldHeight: 1 });
