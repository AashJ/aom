import { TYPE_GREEK_WALL_MEDIUM } from "@aom/sim";
import iconUrl from "../../../assets/building-wall-icon.png";
import modelUrl from "../../../assets/models/greek-wall-medium.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_WALL_MEDIUM, key: "greek-wall-medium", modelUrl, iconUrl, worldHeight: 2.2 });
