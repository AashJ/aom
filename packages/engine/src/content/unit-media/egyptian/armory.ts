import { TYPE_EGYPTIAN_ARMORY } from "@aom/sim";
import iconUrl from "../../../assets/building-armory-icon.png";
import modelUrl from "../../../assets/models/egyptian-armory.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_ARMORY, key: "egyptian-armory", modelUrl, iconUrl, worldHeight: 4.5 });
