import { TYPE_EGYPTIAN_OUTPOST } from "@aom/sim";
import iconUrl from "../../../assets/building-outpost-icon.png";
import modelUrl from "../../../assets/models/egyptian-outpost.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_OUTPOST, key: "egyptian-outpost", modelUrl, iconUrl, worldHeight: 5 });
