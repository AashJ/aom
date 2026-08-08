import { TYPE_EGYPTIAN_MINING_CAMP } from "@aom/sim";
import iconUrl from "../../../assets/building-mining-camp-icon.png";
import modelUrl from "../../../assets/models/egyptian-mining-camp.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_MINING_CAMP, key: "egyptian-mining-camp", modelUrl, iconUrl, worldHeight: 3 });
