import { TYPE_EGYPTIAN_LUMBER_CAMP } from "@aom/sim";
import iconUrl from "../../../assets/building-lumber-camp-icon.png";
import modelUrl from "../../../assets/models/egyptian-lumber-camp.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_LUMBER_CAMP, key: "egyptian-lumber-camp", modelUrl, iconUrl, worldHeight: 3 });
