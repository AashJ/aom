import { TYPE_GREEK_WALL_SHORT } from "@aom/sim";
import iconUrl from "../../../assets/building-wall-icon.png";
import modelUrl from "../../../assets/models/greek-wall-short.glb?url";
import { singleModelBuildingMedia } from "../../building-media";
export const definition = singleModelBuildingMedia({ type: TYPE_GREEK_WALL_SHORT, key: "greek-wall-short", modelUrl, iconUrl, worldHeight: 2.2 });
