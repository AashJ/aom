import { TYPE_GREEK_GRANARY } from "@aom/sim";
import iconUrl from "../../../assets/building-granary-icon.png";
import modelUrl from "../../../assets/models/greek-granary.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_GRANARY, key: "greek-granary", modelUrl, iconUrl, worldHeight: 3 });
