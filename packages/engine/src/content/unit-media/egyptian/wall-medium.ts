import { TYPE_EGYPTIAN_WALL_MEDIUM } from "@aom/sim";
import iconUrl from "../../../assets/building-wall-icon.png";
import modelUrl from "../../../assets/models/egyptian-wall-medium.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_EGYPTIAN_WALL_MEDIUM, key: "egyptian-wall-medium", modelUrl, iconUrl, worldHeight: 2.2 });
