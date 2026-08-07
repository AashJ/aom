import { TYPE_EGYPTIAN_MONUMENT_TO_VILLAGERS } from "@aom/sim";
import iconUrl from "../../../assets/building-monument-one-icon.png";
import modelUrl from "../../../assets/models/egyptian-monument-to-villagers.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_MONUMENT_TO_VILLAGERS, key: "egyptian-monument-to-villagers", modelUrl, iconUrl, worldHeight: 3 });
