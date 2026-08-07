import { TYPE_GREEK_ARMORY } from "@aom/sim";
import iconUrl from "../../../assets/building-armory-icon.png";
import modelUrl from "../../../assets/models/greek-armory.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_ARMORY, key: "greek-armory", modelUrl, iconUrl, worldHeight: 4.5 });
