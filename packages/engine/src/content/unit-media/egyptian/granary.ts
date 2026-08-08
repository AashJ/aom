import { TYPE_EGYPTIAN_GRANARY } from "@aom/sim";
import iconUrl from "../../../assets/building-granary-icon.png";
import modelUrl from "../../../assets/models/egyptian-granary.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_GRANARY, key: "egyptian-granary", modelUrl, iconUrl, worldHeight: 3 });
